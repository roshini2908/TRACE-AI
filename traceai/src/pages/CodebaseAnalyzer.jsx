import { useEffect, useState, useCallback, useRef } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Upload, FolderOpen, FileCode2, Brain, Loader, CheckCircle,
  XCircle, Clock, ChevronDown, ChevronUp, RefreshCw, AlertTriangle,
  Layers, GitBranch, Database, Server, FileText, Code2, Share2, X,
  Eye, Wand2, ArrowLeftRight, Pencil, ThumbsUp, ThumbsDown, History,
} from 'lucide-react'
import { projectsAPI, requirementsAPI, codebaseAPI } from '../services/api'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TYPE_ICONS = {
  component: Layers, api: GitBranch, model: Database,
  service: Server, file: FileCode2, test: FileText, config: FileText,
}
const IMPACT_COLORS = {
  high:   'bg-danger-100 text-danger-700',
  medium: 'bg-orange-100 text-orange-700',
  low:    'bg-green-100 text-green-700',
}
const IMPACT_TYPE_COLORS = {
  direct:   'bg-danger-50 text-danger-600 border border-danger-200',
  indirect: 'bg-orange-50 text-orange-600 border border-orange-200',
  possible: 'bg-gray-50 text-gray-600 border border-gray-200',
}
const VER_COLORS = {
  Verified:       'bg-green-100 text-green-700',
  Rejected:       'bg-danger-100 text-danger-600',
  'Pending Review':'bg-orange-100 text-orange-600',
}

// Node background colours for the Impact Graph
const IMPACT_NODE_COLORS = {
  requirement: { bg: '#EEF4FC', border: '#2864B4', text: '#1a4a8a' },
  high:        { bg: '#FAEAEA', border: '#BE4646', text: '#7a1a1a' },
  medium:      { bg: '#FDF4E8', border: '#DC8228', text: '#7a4410' },
  low:         { bg: '#EBF6EF', border: '#32965A', text: '#1a5a32' },
  dep:         { bg: '#F5F5F5', border: '#8A8A8A', text: '#3a3a3a' },
}

// ─── BUILD IMPACT GRAPH DATA (pure function, no hooks) ────────────────────────
/**
 * Takes a CodeImpactAnalysis result + dependency array and returns
 * React Flow { nodes, edges } that represent:
 *   Requirement → Potentially Affected files → Their dependencies
 *
 * All data comes from the stored analysis — no hardcoding.
 */
function buildImpactGraphData(impactResult, dependencies, filter) {
  if (!impactResult) return { nodes: [], edges: [] }

  // Collect all affected items across all four arrays
  const allAffected = [
    ...(impactResult.affectedFiles      || []),
    ...(impactResult.affectedComponents || []),
    ...(impactResult.affectedAPIs       || []),
    ...(impactResult.affectedModels     || []),
  ]

  // Apply filter
  const filtered = allAffected.filter(item => {
    if (!filter || filter === 'all') return true
    if (['high','medium','low'].includes(filter))      return item.impactLevel === filter
    if (['direct','indirect','possible'].includes(filter)) return item.impactType === filter
    if (['file','component','api','model','service'].includes(filter)) return item.type === filter
    return true
  })

  if (filtered.length === 0) return { nodes: [], edges: [] }

  const nodes = []
  const edges = []
  const addedPaths = new Set()

  // ── Requirement root node ────────────────────────────────────────────────
  const REQ_ID = 'req-root'
  const reqLabel = impactResult.requirementText?.length > 60
    ? impactResult.requirementText.slice(0, 57) + '…'
    : (impactResult.requirementText || 'New Requirement')

  nodes.push({
    id: REQ_ID,
    type: 'default',
    position: { x: 0, y: 0 },
    data: {
      label: reqLabel,
      nodeType: 'requirement',
      fullText: impactResult.requirementText,
    },
    style: {
      background: IMPACT_NODE_COLORS.requirement.bg,
      border: `2px solid ${IMPACT_NODE_COLORS.requirement.border}`,
      color: IMPACT_NODE_COLORS.requirement.text,
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 11,
      fontWeight: 700,
      maxWidth: 220,
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
    },
  })

  // ── Affected file nodes in a fan below the requirement ───────────────────
  const colCount = Math.min(filtered.length, 4)
  const colWidth = 240
  const startX   = -((colCount - 1) * colWidth) / 2

  filtered.forEach((item, i) => {
    if (addedPaths.has(item.path)) return
    addedPaths.add(item.path)

    const col    = i % colCount
    const row    = Math.floor(i / colCount)
    const colors = IMPACT_NODE_COLORS[item.impactLevel] || IMPACT_NODE_COLORS.dep
    const nodeId = `affected-${item._id || i}`
    const fname  = item.path?.split('/').pop() || item.path || 'Unknown'

    nodes.push({
      id: nodeId,
      type: 'default',
      position: { x: startX + col * colWidth, y: 160 + row * 130 },
      data: {
        label: fname,
        nodeType: 'affected',
        item,
        fullPath: item.path,
      },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        borderRadius: 8,
        padding: '7px 12px',
        fontSize: 10,
        fontWeight: 600,
        maxWidth: 180,
        textAlign: 'center',
      },
    })

    // Edge: requirement → affected file
    edges.push({
      id:     `req-${nodeId}`,
      source: REQ_ID,
      target: nodeId,
      label:  'potentially affects',
      type:   'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: colors.border },
      style:  { stroke: colors.border, strokeWidth: 1.5 },
      labelStyle: { fontSize: 9, fill: '#888' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
      animated: item.impactLevel === 'high',
    })
  })

  // ── Dependency edges between affected files (from static analysis) ───────
  // Only draw edges that connect two nodes already in the graph
  const nodePathMap = {}
  nodes.forEach(n => { if (n.data.fullPath) nodePathMap[n.data.fullPath] = n.id })

  ;(dependencies || []).forEach((dep, i) => {
    const srcId = nodePathMap[dep.sourceFile]
    const tgtId = nodePathMap[dep.targetFile]
    if (srcId && tgtId && srcId !== tgtId) {
      const edgeId = `dep-${srcId}-${tgtId}`
      if (!edges.find(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: srcId,
          target: tgtId,
          label:  dep.relationship || 'imports',
          type:   'smoothstep',
          style:  { stroke: '#aaa', strokeDasharray: '4 3' },
          labelStyle: { fontSize: 9, fill: '#aaa' },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#aaa' },
        })
      }
    }
  })

  return { nodes, edges }
}

// ─── IMPACT GRAPH COMPONENT (module-level — prevents focus-loss bug) ─────────
function ImpactGraph({ impactResult, dependencies, onClose }) {
  const [igNodes, setIgNodes, onIgNodesChange] = useNodesState([])
  const [igEdges, setIgEdges, onIgEdgesChange] = useEdgesState([])
  const [filter,  setFilter]  = useState('all')
  const [selected, setSelected] = useState(null)

  // Rebuild graph whenever impactResult, dependencies, or filter changes
  useEffect(() => {
    const { nodes, edges } = buildImpactGraphData(impactResult, dependencies, filter)
    setIgNodes(nodes)
    setIgEdges(edges)
    setSelected(null)
  }, [impactResult, dependencies, filter])

  const handleNodeClick = useCallback((_, node) => {
    setSelected(node.data)
  }, [])

  const totalAffected = [
    ...(impactResult?.affectedFiles      || []),
    ...(impactResult?.affectedComponents || []),
    ...(impactResult?.affectedAPIs       || []),
    ...(impactResult?.affectedModels     || []),
  ].length

  const FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'high',     label: 'High' },
    { id: 'medium',   label: 'Medium' },
    { id: 'low',      label: 'Low' },
    { id: 'direct',   label: 'Direct' },
    { id: 'indirect', label: 'Indirect' },
    { id: 'possible', label: 'Possible' },
    { id: 'component',label: 'Components' },
    { id: 'api',      label: 'APIs' },
    { id: 'model',    label: 'Models' },
    { id: 'service',  label: 'Services' },
    { id: 'file',     label: 'Files' },
  ]

  return (
    <div className="space-y-3 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Share2 size={16} className="text-primary-600" /> Impact Graph
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Requirement → {totalAffected} potentially affected items → existing dependencies
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          <X size={13} /> Close graph
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border
              ${filter === f.id
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Graph canvas */}
      <div
        className="relative rounded-xl overflow-hidden border border-gray-100 shadow-card"
        style={{ height: 520 }}
      >
        {igNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50 gap-2">
            <Share2 size={32} className="text-gray-200" />
            <p className="text-sm text-gray-400">No nodes match the current filter.</p>
            <button onClick={() => setFilter('all')} className="text-xs text-primary-500 hover:text-primary-700">
              Reset filter
            </button>
          </div>
        ) : (
          <ReactFlow
            nodes={igNodes}
            edges={igEdges}
            onNodesChange={onIgNodesChange}
            onEdgesChange={onIgEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background gap={20} color="#f3f4f6" />
            <Controls />
            <MiniMap
              nodeColor={n => {
                if (n.data.nodeType === 'requirement') return '#2864B4'
                const lvl = n.data.item?.impactLevel
                if (lvl === 'high')   return '#BE4646'
                if (lvl === 'medium') return '#DC8228'
                if (lvl === 'low')    return '#32965A'
                return '#8A8A8A'
              }}
            />
          </ReactFlow>
        )}
      </div>

      {/* Legend */}
      <div className="card bg-gray-50 border-gray-100">
        <p className="text-xs font-semibold text-gray-600 mb-2">Legend</p>
        <div className="flex flex-wrap gap-4">
          {[
            ['Requirement',        '#2864B4'],
            ['High Impact',        '#BE4646'],
            ['Medium Impact',      '#DC8228'],
            ['Low Impact',         '#32965A'],
            ['Dependency edge',    '#AAAAAA'],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0 border-t-2 border-dashed border-gray-400" />
            <span className="text-xs text-gray-600">Static dependency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0 border-t-2 border-gray-500" />
            <span className="text-xs text-gray-600">Impact edge</span>
          </div>
        </div>
      </div>

      {/* Selected node detail panel */}
      {selected && selected.nodeType === 'affected' && selected.item && (
        <div className="card border-l-4 border-l-primary-400 animate-fade-in">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900">File Impact Details</h4>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 mb-0.5">File</p>
              <p className="font-mono font-semibold text-gray-800 break-all">{selected.fullPath}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Type</p>
              <span className={`badge capitalize ${
                selected.item.type === 'component' ? 'bg-purple-100 text-purple-700'
                : selected.item.type === 'api'    ? 'bg-primary-100 text-primary-700'
                : selected.item.type === 'model'  ? 'bg-teal-100 text-teal-700'
                : selected.item.type === 'service'? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
              }`}>{selected.item.type}</span>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Potential Impact</p>
              <span className={`badge capitalize ${IMPACT_COLORS[selected.item.impactLevel]}`}>
                {selected.item.impactLevel}
              </span>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Impact Type</p>
              <span className={`badge capitalize ${IMPACT_TYPE_COLORS[selected.item.impactType]}`}>
                {selected.item.impactType}
              </span>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${selected.item.confidence}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-700">{selected.item.confidence}%</span>
              </div>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Verification</p>
              <span className={`badge ${VER_COLORS[selected.item.verificationStatus]}`}>
                {selected.item.verificationStatus}
              </span>
            </div>
          </div>
          {selected.item.reason && (
            <div className="mt-3 bg-gray-50 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-gray-600 mb-1">AI Reason</p>
              <p className="text-xs text-gray-700">{selected.item.reason}</p>
            </div>
          )}
          {selected.item.evidence && (
            <div className="mt-2 bg-primary-50 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-primary-700 mb-1">Evidence</p>
              <p className="text-xs text-gray-600">{selected.item.evidence}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3 italic">
            ⚠ This is an AI-suggested analysis. Changes should be verified by a developer before implementation.
          </p>
        </div>
      )}

      {selected && selected.nodeType === 'requirement' && (
        <div className="card border-l-4 border-l-primary-400 animate-fade-in">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-900">New Requirement</h4>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{selected.fullText}</p>
          <p className="text-xs text-gray-400 mt-2">
            Overall confidence: <strong>{impactResult?.overallConfidence}%</strong> ·
            Change type: <strong>{impactResult?.changeType}</strong>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── RISK BADGE + PANEL (module-level) ───────────────────────────────────────
const RISK_STYLES = {
  low:      { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  bar: 'bg-green-500'  },
  medium:   { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', bar: 'bg-orange-500' },
  high:     { bg: 'bg-danger-100', text: 'text-danger-700', border: 'border-danger-300', bar: 'bg-danger-500' },
  critical: { bg: 'bg-red-200',    text: 'text-red-800',    border: 'border-red-400',    bar: 'bg-red-600'    },
}

function RiskBadge({ level, score }) {
  const s = RISK_STYLES[level] || RISK_STYLES.medium
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-2 h-2 rounded-full ${s.bar}`} />
      {(level || 'UNKNOWN').toUpperCase()}
      {score != null && <span className="opacity-60 font-normal ml-0.5">({score}/100)</span>}
    </span>
  )
}

function RiskPanel({ riskScore }) {
  if (!riskScore) return null
  const s = RISK_STYLES[riskScore.level] || RISK_STYLES.medium
  return (
    <div className={`card border ${s.border} ${s.bg}/30`}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Change Risk</p>
          <RiskBadge level={riskScore.level} score={riskScore.score} />
        </div>
        <div className="flex-1 min-w-48">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Risk score</span>
            <span className="text-xs font-bold text-gray-700">{riskScore.score}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${s.bar} transition-all`} style={{ width: `${riskScore.score}%` }} />
          </div>
        </div>
      </div>
      {riskScore.explanation && (
        <p className="text-xs text-gray-700 mb-3">{riskScore.explanation}</p>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          ['Direct',      riskScore.direct,      'text-danger-600'],
          ['Indirect',    riskScore.indirect,    'text-orange-600'],
          ['Possible',    riskScore.possible,    'text-gray-500'],
          ['Components',  riskScore.components,  'text-purple-600'],
          ['APIs',        riskScore.apis,        'text-teal-600'],
          ['Models',      riskScore.models,      'text-green-600'],
        ].map(([label, val, color]) => (
          <div key={label} className="bg-white/70 rounded-lg p-2 text-center border border-white">
            <p className={`text-lg font-bold ${color}`}>{val ?? 0}</p>
            <p className="text-[10px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── EVIDENCE PANEL (module-level) ───────────────────────────────────────────
function EvidencePanel({ impactResult }) {
  const allItems = [
    ...(impactResult?.affectedFiles      || []),
    ...(impactResult?.affectedComponents || []),
    ...(impactResult?.affectedAPIs       || []),
    ...(impactResult?.affectedModels     || []),
  ].filter(i => i.evidenceDetail &&
    (i.evidenceDetail.functions?.length || i.evidenceDetail.apis?.length ||
     i.evidenceDetail.existingData?.length || i.evidenceDetail.dependencies?.length))

  if (allItems.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <Brain size={14} className="text-purple-600" /> AI Evidence
        <span className="badge bg-purple-100 text-purple-600 text-[10px]">AI Suggested</span>
      </h3>
      <p className="text-xs text-gray-400 italic">
        Structured evidence extracted by static analysis for each potentially affected artifact.
      </p>
      <div className="space-y-2">
        {allItems.map(item => (
          <div key={item._id || item.path} className="card border border-purple-100">
            <div className="flex items-start gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-gray-800 truncate flex-1">{item.path}</span>
              <span className={`badge ${IMPACT_COLORS[item.impactLevel]}`}>{item.impactLevel}</span>
              <span className="text-xs text-gray-400">{item.confidence}%</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {item.evidenceDetail?.functions?.length > 0 && (
                <div className="bg-gray-50 rounded p-2">
                  <p className="font-semibold text-gray-600 mb-1">Functions</p>
                  {item.evidenceDetail.functions.map(f => <code key={f} className="block text-primary-700">{f}()</code>)}
                </div>
              )}
              {item.evidenceDetail?.apis?.length > 0 && (
                <div className="bg-gray-50 rounded p-2">
                  <p className="font-semibold text-gray-600 mb-1">API Endpoints</p>
                  {item.evidenceDetail.apis.map(a => <code key={a} className="block text-teal-700">{a}</code>)}
                </div>
              )}
              {item.evidenceDetail?.existingData?.length > 0 && (
                <div className="bg-gray-50 rounded p-2">
                  <p className="font-semibold text-gray-600 mb-1">Existing Data</p>
                  {item.evidenceDetail.existingData.map(d => <code key={d} className="block text-orange-700">{d}</code>)}
                </div>
              )}
              {item.evidenceDetail?.dependencies?.length > 0 && (
                <div className="bg-gray-50 rounded p-2">
                  <p className="font-semibold text-gray-600 mb-1">Dependencies</p>
                  {item.evidenceDetail.dependencies.map(d => <span key={d} className="block text-gray-600 truncate">{d}</span>)}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── BLAST RADIUS GRAPH (module-level) ───────────────────────────────────────
function BlastRadiusGraph({ blastRadius, impactResult }) {
  if (!blastRadius?.totalArtifacts) return null

  const nodes = []
  const edges = []

  // Root requirement node
  nodes.push({
    id: 'req',
    type: 'default',
    position: { x: 200, y: 10 },
    data: { label: 'New Requirement' },
    style: { background: '#2864B4', color: '#fff', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: 11, minWidth: 160, textAlign: 'center' },
  })

  // Propagation path nodes
  const allAffected = [
    ...(impactResult?.affectedFiles      || []),
    ...(impactResult?.affectedComponents || []),
    ...(impactResult?.affectedAPIs       || []),
    ...(impactResult?.affectedModels     || []),
  ]

  const colCount = Math.min(allAffected.length, 4)
  allAffected.forEach((item, i) => {
    const col      = i % colCount
    const row      = Math.floor(i / colCount)
    const startX   = 0 - ((colCount - 1) * 200) / 2
    const colors   = IMPACT_NODE_COLORS[item.impactLevel] || IMPACT_NODE_COLORS.dep
    const nodeId   = `br-${i}`
    const fname    = (item.path || '').split('/').pop()

    nodes.push({
      id: nodeId,
      type: 'default',
      position: { x: startX + col * 200, y: 120 + row * 100 },
      data: { label: fname, item },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 10,
        fontWeight: 600,
        maxWidth: 160,
        textAlign: 'center',
      },
    })

    edges.push({
      id: `br-req-${i}`,
      source: 'req',
      target: nodeId,
      label: item.impactType,
      type: 'smoothstep',
      style: { stroke: colors.border, strokeWidth: 1.5 },
      labelStyle: { fontSize: 9, fill: '#888' },
      animated: item.impactType === 'direct',
      markerEnd: { type: MarkerType.ArrowClosed, color: colors.border },
    })
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-800">Blast Radius</h3>
        <div className="flex gap-2 text-xs">
          <span className="badge bg-danger-100 text-danger-700">Direct: {blastRadius.direct}</span>
          <span className="badge bg-orange-100 text-orange-700">Indirect: {blastRadius.indirect}</span>
          <span className="badge bg-gray-100 text-gray-600">Possible: {blastRadius.possible}</span>
          <span className="badge bg-primary-100 text-primary-700">Total: {blastRadius.totalArtifacts}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        How far this requirement change may propagate through the existing project.
        Requirement → Potentially Affected Artifacts → Their Dependencies.
      </p>
      <div className="relative rounded-xl overflow-hidden border border-gray-100 shadow-card" style={{ height: 380 }}>
        <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.3}>
          <Background gap={20} color="#f3f4f6" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

// ─── TEST IMPACT PANEL (module-level) ────────────────────────────────────────
function TestImpactPanel({ testImpact }) {
  if (!testImpact) return null
  const tests = testImpact.potentiallyAffectedTests || []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <FileText size={14} className="text-teal-600" /> Test Impact
        </h3>
        <div className="flex gap-2 text-xs">
          <span className="badge bg-danger-100 text-danger-700">Direct: {testImpact.direct}</span>
          <span className="badge bg-orange-100 text-orange-700">Indirect: {testImpact.indirect}</span>
          <span className="badge bg-teal-100 text-teal-700">Total: {tests.length}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500">{testImpact.summary}</p>
      {tests.length === 0 ? (
        <div className="card text-center py-8 bg-gray-50">
          <p className="text-sm text-gray-400">No test files were linked to potentially affected source files.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((t, i) => (
            <div key={i} className="card flex items-start gap-3">
              <FileText size={14} className="text-teal-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-mono text-xs font-semibold text-gray-800 truncate">{t.path}</span>
                  <span className={`badge text-[10px] ${t.impactType === 'direct' ? 'bg-danger-100 text-danger-600' : 'bg-orange-100 text-orange-600'}`}>
                    {t.impactType}
                  </span>
                  <span className="text-xs text-gray-400">{t.confidence}%</span>
                </div>
                {t.relatedFile && <p className="text-xs text-gray-400 mb-1">Related: <span className="font-mono">{t.relatedFile}</span></p>}
                <p className="text-xs text-gray-600">{t.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 italic">
        "Potentially Affected" — these tests may need to be updated. Human review required.
      </p>
    </div>
  )
}

// ─── TRACEABILITY GAPS PANEL (module-level) ───────────────────────────────────
const GAP_SEVERITY_COLORS = {
  high:   'bg-danger-100 text-danger-700 border border-danger-200',
  medium: 'bg-orange-100 text-orange-700 border border-orange-200',
  low:    'bg-gray-100 text-gray-600 border border-gray-200',
}

function GapsPanel({ gaps }) {
  if (!gaps?.length) return (
    <div className="card text-center py-8 bg-gray-50">
      <CheckCircle size={28} className="mx-auto text-green-400 mb-2" />
      <p className="text-sm text-gray-500">No traceability gaps detected for this analysis.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <AlertTriangle size={14} className="text-orange-500" /> Traceability Gaps
        </h3>
        <span className="badge bg-orange-100 text-orange-700">{gaps.length} gap{gaps.length !== 1 ? 's' : ''} detected</span>
      </div>
      <div className="space-y-2">
        {gaps.map((g, i) => (
          <div key={i} className="card border-l-4 border-l-orange-400">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`badge ${GAP_SEVERITY_COLORS[g.severity]}`}>{g.severity?.toUpperCase()}</span>
                  <span className="text-xs font-semibold text-gray-700">{g.gapType?.replace(/-/g, ' ')}</span>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-1">{g.relatedArtifact}</p>
              </div>
            </div>
            <p className="text-xs text-gray-700 mb-2">{g.reason}</p>
            {g.suggestedAction && (
              <div className="bg-primary-50 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-primary-700 mb-0.5">Suggested Action</p>
                <p className="text-xs text-gray-700">{g.suggestedAction}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── REPORT MODAL (module-level) ─────────────────────────────────────────────
function ReportModal({ impactId, uploadId, onClose }) {
  const [report,   setReport]  = useState(null)
  const [loading,  setLoading] = useState(true)
  const [error,    setError]   = useState('')

  useEffect(() => {
    codebaseAPI.getImpactReport(impactId)
      .then(r => setReport(r.data.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [impactId])

  const downloadReport = () => {
    if (!report?.reportText) return
    const blob = new Blob([report.reportText], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    // Use codebase name in filename, not project name
    const baseName = (report.codebase?.name || 'report').replace(/\s+/g, '-').toLowerCase()
    a.href = url; a.download = `traceai-impact-${baseName}-${impactId.slice(-6)}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadCSV = () => {
    if (!report?.impact) return
    const all = [
      ...(report.impact.affectedFiles      || []),
      ...(report.impact.affectedComponents || []),
      ...(report.impact.affectedAPIs       || []),
      ...(report.impact.affectedModels     || []),
    ]
    const header = 'Path,Type,ImpactLevel,ImpactType,Confidence,Verification,Reason'
    const rows = all.map(a =>
      `"${a.path}","${a.type}","${a.impactLevel}","${a.impactType}",${a.confidence},"${a.verificationStatus}","${(a.reason||'').replace(/"/g,"'")}"`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `traceai-impact-${impactId.slice(-6)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const RISK_COLORS = { low: 'text-green-700', medium: 'text-orange-600', high: 'text-danger-600', critical: 'text-red-700' }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText size={16} className="text-primary-600" /> Impact Analysis Report
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader size={16} className="animate-spin" /> Generating report…
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center">
            <AlertTriangle size={28} className="mx-auto text-danger-400 mb-2" />
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        ) : report && (
          <div className="px-5 py-4 space-y-4">

            {/* ── Codebase identity — shows the UPLOADED project, never TraceAI project name */}
            {report.codebase && (
              <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-primary-700 mb-1">Uploaded Codebase</p>
                <p className="text-sm font-bold text-gray-900">{report.codebase.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {report.codebase.originalFileName}
                  {report.codebase.sourceFiles > 0 && ` · ${report.codebase.sourceFiles} source files analyzed`}
                  {report.codebase.languages?.length > 0 && ` · ${report.codebase.languages.join(', ')}`}
                </p>
              </div>
            )}

            {/* ── Stats — separated totalAnalyzed from potentiallyAffected */}
            {report.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Total Analyzed',    report.stats.totalAnalyzed,        'text-gray-600'],
                  ['Potentially Affected', report.stats.potentiallyAffected, 'text-primary-600'],
                  ['Verified',          report.stats.verified,             'text-green-600'],
                  ['Pending Review',    report.stats.pending,              'text-orange-600'],
                ].map(([label, val, color]) => (
                  <div key={label} className="card text-center py-3 bg-gray-50">
                    <p className={`text-xl font-bold ${color}`}>{val ?? 0}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Risk score — shows actual score/100, not 0 ── */}
            {report.stats && (
              <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-xl flex-wrap">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Risk Level</p>
                  <p className={`text-base font-bold uppercase ${RISK_COLORS[report.stats.riskLevel] || 'text-gray-700'}`}>
                    {(report.stats.riskLevel || '—').toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Risk Score</p>
                  <p className="text-base font-bold text-gray-800">
                    {report.stats.riskScore != null ? `${report.stats.riskScore}/100` : '—'}
                  </p>
                </div>
                <div className="flex-1 min-w-32">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        report.stats.riskLevel === 'critical' ? 'bg-red-600' :
                        report.stats.riskLevel === 'high'     ? 'bg-danger-500' :
                        report.stats.riskLevel === 'medium'   ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${report.stats.riskScore ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Plain-text preview */}
            <div className="bg-gray-950 rounded-xl overflow-auto max-h-80">
              <pre className="text-gray-200 text-xs p-4 leading-relaxed whitespace-pre-wrap font-mono">
                {report.reportText}
              </pre>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={downloadReport} className="flex items-center gap-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors">
                <FileText size={14} /> Download .txt
              </button>
              <button onClick={downloadCSV} className="flex items-center gap-2 text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors">
                <FileText size={14} /> Export CSV
              </button>
              <button onClick={onClose} className="ml-auto text-sm text-gray-400 hover:text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
            </div>
            <p className="text-xs text-gray-400 italic">AI-suggested analysis. All results require human verification. No source code was modified.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CODE VIEWER MODAL (module-level) ────────────────────────────────────────
/**
 * Displays actual uploaded source code read from the stored ZIP.
 * Never executes the code. Never shows secrets.
 */
function CodeViewer({ uploadId, filePath, impactItem, requirementText, onClose, onGenerateProposal }) {
  const [fileData, setFileData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!uploadId || !filePath) return
    setLoading(true)
    codebaseAPI.getFileContent(uploadId, filePath)
      .then(r => setFileData(r.data.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [uploadId, filePath])

  const lines = fileData?.content?.split('\n') || []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <FileCode2 size={16} className="text-primary-600 flex-shrink-0" />
              <span className="font-mono text-sm font-bold text-gray-900 truncate">{filePath}</span>
              {impactItem && (
                <>
                  <span className={`badge ${IMPACT_COLORS[impactItem.impactLevel]}`}>
                    {impactItem.impactLevel} impact
                  </span>
                  <span className={`badge ${VER_COLORS[impactItem.verificationStatus]}`}>
                    {impactItem.verificationStatus}
                  </span>
                </>
              )}
            </div>
            {impactItem?.confidence && (
              <p className="text-xs text-gray-400 mt-1">AI Confidence: {impactItem.confidence}%</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 flex-shrink-0 ml-3" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* AI Reason banner */}
        {impactItem?.reason && (
          <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
            <p className="text-xs font-semibold text-purple-700 mb-0.5 flex items-center gap-1.5">
              <Brain size={12} /> AI Reason
              <span className="badge bg-purple-100 text-purple-600 ml-1 text-[10px]">AI Suggested</span>
            </p>
            <p className="text-xs text-gray-700">{impactItem.reason}</p>
          </div>
        )}

        {/* Code */}
        <div className="px-0 py-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader size={16} className="animate-spin" /> Loading source code…
            </div>
          ) : error ? (
            <div className="px-5 py-6 text-center">
              <AlertTriangle size={28} className="mx-auto text-danger-400 mb-2" />
              <p className="text-sm text-danger-600">{error}</p>
              <p className="text-xs text-gray-400 mt-1">The original ZIP must still be present on the server.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[55vh] font-mono text-xs bg-gray-950 rounded-b-xl">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                      <td className="select-none text-right pr-4 pl-3 py-0.5 text-gray-500 border-r border-gray-800 w-12 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="pl-4 pr-3 py-0.5 text-gray-100 whitespace-pre">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && fileData && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-wrap gap-2">
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>{lines.length} lines</span>
              <span className="capitalize">{fileData.language}</span>
              <span className="capitalize">{fileData.fileType}</span>
              {fileData.functions?.length > 0 && <span>{fileData.functions.length} functions</span>}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400 italic">Existing code — not modified</p>
              {onGenerateProposal && (
                <button
                  onClick={() => onGenerateProposal(filePath, fileData)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Wand2 size={12} /> Generate Proposed Change
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DIFF VIEWER (module-level) ───────────────────────────────────────────────
/**
 * Side-by-side + unified diff display.
 * Clearly marks BEFORE (original) vs PROPOSED AFTER (AI suggestion).
 * Original uploaded code is NEVER modified.
 */
function DiffViewer({ originalCode, proposedCode, diff, filePath, language }) {
  const [mode, setMode] = useState('split') // 'split' | 'unified'

  // Parse unified diff into annotated lines
  const parsedDiff = (diff || '').split('\n').map(line => {
    if (line.startsWith('+++') || line.startsWith('---')) return { type: 'header', text: line }
    if (line.startsWith('@@'))   return { type: 'hunk',   text: line }
    if (line.startsWith('+'))    return { type: 'add',    text: line.slice(1) }
    if (line.startsWith('-'))    return { type: 'remove', text: line.slice(1) }
    return                              { type: 'context', text: line.startsWith(' ') ? line.slice(1) : line }
  }).filter(l => !['header'].includes(l.type))

  const LINE_STYLE = {
    add:     'bg-green-950 text-green-300',
    remove:  'bg-red-950  text-red-300',
    hunk:    'bg-gray-800 text-blue-400',
    context: 'text-gray-300',
  }

  const origLines  = (originalCode  || '').split('\n')
  const propLines  = (proposedCode  || '').split('\n')

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">View:</span>
        {['split','unified'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-lg font-medium border transition-colors capitalize
              ${mode === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
            {m}
          </button>
        ))}
      </div>

      {mode === 'split' ? (
        <div className="grid grid-cols-2 gap-0 border border-gray-200 rounded-xl overflow-hidden font-mono text-xs">
          {/* BEFORE */}
          <div className="border-r border-gray-200">
            <div className="bg-danger-50 px-3 py-1.5 text-xs font-bold text-danger-700 border-b border-gray-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-danger-500 inline-block" /> BEFORE — Existing Code
            </div>
            <div className="overflow-auto max-h-80 bg-gray-950">
              <table className="w-full border-collapse">
                <tbody>
                  {origLines.map((line, i) => (
                    <tr key={i} className="hover:bg-gray-800/40">
                      <td className="select-none text-right pr-2 pl-2 text-gray-600 border-r border-gray-800 w-8 text-[10px]">{i+1}</td>
                      <td className="pl-3 pr-2 py-px text-gray-200 whitespace-pre">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* AFTER */}
          <div>
            <div className="bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 border-b border-gray-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> PROPOSED AFTER — AI Suggested
            </div>
            <div className="overflow-auto max-h-80 bg-gray-950">
              <table className="w-full border-collapse">
                <tbody>
                  {propLines.map((line, i) => (
                    <tr key={i} className="hover:bg-gray-800/40">
                      <td className="select-none text-right pr-2 pl-2 text-gray-600 border-r border-gray-800 w-8 text-[10px]">{i+1}</td>
                      <td className="pl-3 pr-2 py-px text-green-200 whitespace-pre">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Unified diff */
        <div className="border border-gray-200 rounded-xl overflow-hidden font-mono text-xs">
          <div className="bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 border-b border-gray-200">
            Unified Diff — {filePath}
          </div>
          <div className="overflow-auto max-h-96 bg-gray-950">
            <table className="w-full border-collapse">
              <tbody>
                {parsedDiff.map((line, i) => (
                  <tr key={i} className={`${LINE_STYLE[line.type] || ''}`}>
                    <td className="select-none pl-2 pr-3 text-gray-500 text-[10px] w-5">
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'hunk' ? '@@' : ' '}
                    </td>
                    <td className="pl-2 pr-3 py-px whitespace-pre">{line.text || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-800" /><span className="text-gray-500">Removed</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-800" /><span className="text-gray-500">Added</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-700" /><span className="text-gray-500">Context</span></div>
      </div>
    </div>
  )
}

// ─── PROPOSAL PANEL (module-level) ───────────────────────────────────────────
/**
 * Full proposal workflow: view diff, edit, approve, reject.
 * The original uploaded source code is NEVER modified here.
 */
function ProposalPanel({ proposal, uploadId, onUpdated, onClose }) {
  const [editMode,  setEditMode]  = useState(false)
  const [editCode,  setEditCode]  = useState(proposal?.editedCode || proposal?.proposedCode || '')
  const [comment,   setComment]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')

  const PROPOSAL_STATUS_COLORS = {
    Draft:    'bg-gray-100 text-gray-600',
    Approved: 'bg-green-100 text-green-700',
    Rejected: 'bg-danger-100 text-danger-600',
    Edited:   'bg-orange-100 text-orange-700',
  }

  const displayCode = proposal?.editedCode || proposal?.proposedCode || ''

  const doAction = async (action) => {
    setSaving(true); setMsg('')
    try {
      let res
      if (action === 'approve') {
        res = await codebaseAPI.approveProposal(uploadId, proposal._id, { reviewComment: comment })
      } else if (action === 'reject') {
        res = await codebaseAPI.rejectProposal(uploadId, proposal._id, { reviewComment: comment })
      } else if (action === 'edit') {
        if (!editCode.trim()) { setMsg('Edited code cannot be empty.'); setSaving(false); return }
        res = await codebaseAPI.editProposal(uploadId, proposal._id, { editedCode: editCode, reviewComment: comment })
        setEditMode(false)
      }
      setMsg(res.data.message || 'Saved.')
      onUpdated(res.data.data.proposal)
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowLeftRight size={16} className="text-primary-600" />
              <span className="text-sm font-bold text-gray-900">Proposed Code Change</span>
              <span className={`badge ${PROPOSAL_STATUS_COLORS[proposal?.proposalStatus]}`}>
                {proposal?.proposalStatus}
              </span>
              <span className="badge bg-purple-100 text-purple-600 text-[10px]">AI Proposed</span>
            </div>
            <p className="font-mono text-xs text-gray-500 mt-1">{proposal?.filePath}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 ml-3" aria-label="Close"><X size={18} /></button>
        </div>

        {/* Safety notice */}
        <div className="mx-5 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-700 font-semibold mb-0.5">⚠ AI-Generated Proposal</p>
          <p className="text-xs text-orange-600">
            This is an AI-generated proposed change. The original uploaded code has NOT been modified.
            Review the diff carefully before approving. Accepting does not automatically apply the change.
          </p>
        </div>

        {/* Reasoning */}
        {proposal?.reasoning && (
          <div className="mx-5 mt-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
            <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1"><Brain size={12} /> AI Reasoning</p>
            <p className="text-xs text-gray-700">{proposal.reasoning}</p>
          </div>
        )}

        {/* Diff viewer */}
        <div className="px-5 mt-4">
          {editMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Edit Proposed Code</p>
                <button onClick={() => setEditMode(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel edit</button>
              </div>
              <textarea
                value={editCode}
                onChange={e => setEditCode(e.target.value)}
                rows={20}
                className="w-full font-mono text-xs bg-gray-950 text-green-200 rounded-xl p-4 border-0 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-y"
              />
            </div>
          ) : (
            <DiffViewer
              originalCode={proposal?.originalCode}
              proposedCode={displayCode}
              diff={proposal?.diff}
              filePath={proposal?.filePath}
              language={proposal?.language}
            />
          )}
        </div>

        {/* Review comment + actions */}
        <div className="px-5 py-4 mt-3 border-t border-gray-100 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Review comment <span className="text-gray-400">(optional)</span></label>
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a note about this decision…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {msg && (
            <p className={`text-xs px-3 py-2 rounded-lg ${msg.toLowerCase().includes('error') || msg.toLowerCase().includes('fail') ? 'bg-danger-50 text-danger-600' : 'bg-green-50 text-green-700'}`}>
              {msg}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => doAction('approve')}
              disabled={saving || proposal?.proposalStatus === 'Approved'}
              className="flex items-center gap-1.5 text-sm font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? <Loader size={13} className="animate-spin" /> : <ThumbsUp size={13} />}
              Accept Proposed Change
            </button>
            <button
              onClick={() => doAction('reject')}
              disabled={saving || proposal?.proposalStatus === 'Rejected'}
              className="flex items-center gap-1.5 text-sm font-semibold bg-danger-600 hover:bg-danger-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <ThumbsDown size={13} /> Reject Proposal
            </button>
            {editMode ? (
              <button onClick={() => doAction('edit')} disabled={saving}
                className="flex items-center gap-1.5 text-sm font-semibold bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                {saving ? <Loader size={13} className="animate-spin" /> : <Pencil size={13} />} Save Edit
              </button>
            ) : (
              <button onClick={() => { setEditCode(displayCode); setEditMode(true) }}
                className="flex items-center gap-1.5 text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors">
                <Pencil size={13} /> Edit Proposal
              </button>
            )}
            <button onClick={onClose} className="ml-auto text-sm text-gray-400 hover:text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
          <p className="text-xs text-gray-400 italic">
            Accepting does not automatically apply the change. The original uploaded source code remains unchanged.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── SMALL REUSABLE COMPONENTS (module-level to avoid focus-loss bug) ─────────
function StatBadge({ label, value, color = 'text-primary-600' }) {
  return (
    <div className="card text-center py-3 px-2">
      <p className={`text-xl font-bold ${color}`}>{value ?? 0}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function StatusPill({ status }) {
  const MAP = {
    pending:    'bg-gray-100 text-gray-500',
    uploaded:   'bg-primary-100 text-primary-700',
    extracting: 'bg-orange-100 text-orange-700',
    analyzing:  'bg-purple-100 text-purple-700',
    in_progress:'bg-purple-100 text-purple-700',
    completed:  'bg-green-100 text-green-700',
    failed:     'bg-danger-100 text-danger-600',
  }
  return (
    <span className={`badge ${MAP[status] || 'bg-gray-100 text-gray-500'} capitalize`}>{status}</span>
  )
}

function ImpactCard({ item, onVerify, impactId, onViewCode, onGenerateProposal }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = TYPE_ICONS[item.type] || FileCode2
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Icon size={13} className="text-gray-400 flex-shrink-0" />
            <span className="font-mono text-xs font-semibold text-gray-800 truncate">{item.path}</span>
            <span className={`badge ${IMPACT_COLORS[item.impactLevel]}`}>{item.impactLevel} impact</span>
            <span className={`badge text-[10px] ${IMPACT_TYPE_COLORS[item.impactType]}`}>{item.impactType}</span>
            <span className={`badge ${VER_COLORS[item.verificationStatus]}`}>{item.verificationStatus}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Confidence: <strong className="text-gray-600">{item.confidence}%</strong></span>
            <span>Type: <strong className="text-gray-600 capitalize">{item.type}</strong></span>
          </div>

          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2">
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? 'Hide detail' : 'View reason & evidence'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              <div className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-xs font-semibold text-gray-600 mb-1">AI Reason</p>
                <p className="text-xs text-gray-700">{item.reason}</p>
              </div>
              {item.evidence && (
                <div className="bg-primary-50 rounded-lg p-2.5">
                  <p className="text-xs font-semibold text-primary-700 mb-1">Evidence</p>
                  <p className="text-xs text-gray-600">{item.evidence}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {/* Verification row */}
          <div className="flex gap-1">
            <button onClick={() => onVerify(impactId, item._id, 'Verified')}
              disabled={item.verificationStatus === 'Verified'}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 rounded-lg font-medium transition-colors">
              <CheckCircle size={11} /> Accept
            </button>
            <button onClick={() => onVerify(impactId, item._id, 'Rejected')}
              disabled={item.verificationStatus === 'Rejected'}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-danger-100 text-danger-600 hover:bg-danger-200 disabled:opacity-40 rounded-lg font-medium transition-colors">
              <XCircle size={11} /> Reject
            </button>
            <button onClick={() => onVerify(impactId, item._id, 'Pending Review')}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg font-medium transition-colors">
              <Clock size={11} /> Review
            </button>
          </div>
          {/* Code actions row */}
          <div className="flex gap-1">
            <button
              onClick={() => onViewCode && onViewCode(item)}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-lg font-medium transition-colors"
            >
              <Eye size={11} /> View Code
            </button>
            <button
              onClick={() => onGenerateProposal && onGenerateProposal(item)}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition-colors"
            >
              <Wand2 size={11} /> Propose Change
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CodebaseAnalyzer() {
  // Project / upload state
  const [projects, setProjects]       = useState([])
  const [selectedProject, setProject] = useState('')
  const [uploads, setUploads]         = useState([])
  const [activeUpload, setActiveUpload] = useState(null)

  // Upload UI state
  const [dragOver, setDragOver]   = useState(false)
  const [selectedFile, setFile]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const fileInputRef = useRef(null)

  // Files / deps
  const [files, setFiles]         = useState([])
  const [fileSearch, setFileSearch] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('')

  // Graph (dependency graph — existing codebase)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState(null)

  // Dependencies (for use in Impact Graph)
  const [dependencies, setDependencies] = useState([])

  // Impact analysis
  const [requirements, setRequirements] = useState([])
  const [reqText, setReqText]   = useState('')
  const [reqId, setReqId]       = useState('')
  const [runningImpact, setRunImpact] = useState(false)
  const [impactResult, setImpact]     = useState(null)
  const [impactHistory, setHistory]   = useState([])
  const [showImpactGraph, setShowImpactGraph] = useState(false)

  // Code Viewer
  const [codeViewer, setCodeViewer]   = useState(null)  // { filePath, impactItem }

  // Proposal workflow
  const [generatingProposal, setGenProposal] = useState(false)
  const [proposalPanel, setProposalPanel]     = useState(null)  // proposal object
  const [proposals, setProposals]             = useState([])

  // Report modal
  const [showReport, setShowReport] = useState(false)

  const [activeTab, setTab]     = useState('upload') // upload | structure | graph | impact | history | proposals

  const [error, setError]   = useState('')
  const [loading, setLoad]  = useState(true)

  // ─── LOAD PROJECTS ──────────────────────────────────────────────────────────
  useEffect(() => {
    projectsAPI.getAll().then(r => {
      const ps = r.data.data.projects
      setProjects(ps)
      if (ps.length > 0) setProject(ps[0]._id)
    }).catch(e => setError(e.message)).finally(() => setLoad(false))
  }, [])

  useEffect(() => {
    if (!selectedProject) return
    requirementsAPI.getAll({ projectId: selectedProject }).then(r => setRequirements(r.data.data.requirements)).catch(() => {})
    codebaseAPI.getProjectUploads(selectedProject).then(r => {
      const ups = r.data.data.uploads
      setUploads(ups)
      if (ups.length > 0 && ups[0].analysisStatus === 'completed') setActiveUpload(ups[0])
    }).catch(() => {})
  }, [selectedProject])

  useEffect(() => {
    if (!activeUpload || activeUpload.analysisStatus !== 'completed') return
    loadFiles()
    loadGraph()
    loadImpactHistory()
    loadProposals()
  }, [activeUpload])

  const loadFiles = async () => {
    if (!activeUpload) return
    try {
      const r = await codebaseAPI.getFiles(activeUpload._id)
      setFiles(r.data.data.files)
    } catch {}
  }

  const loadGraph = async () => {
    if (!activeUpload) return
    try {
      const r = await codebaseAPI.getGraph(activeUpload._id)
      setNodes(r.data.data.nodes)
      setEdges(r.data.data.edges)
    } catch {}
    // Also load raw dependency edges for the Impact Graph
    try {
      const d = await codebaseAPI.getDependencies(activeUpload._id)
      setDependencies(d.data.data.dependencies)
    } catch {}
  }

  const loadImpactHistory = async () => {
    if (!activeUpload) return
    try {
      const r = await codebaseAPI.getImpactHistory(activeUpload._id)
      setHistory(r.data.data.history)
    } catch {}
  }

  const loadProposals = async () => {
    if (!activeUpload) return
    try {
      const r = await codebaseAPI.listProposals(activeUpload._id)
      setProposals(r.data.data.proposals)
    } catch {}
  }

  // ─── UPLOAD ─────────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.zip')) setFile(f)
    else setError('Only .zip files are accepted.')
  }, [])

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile || !selectedProject) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('zipFile', selectedFile)
      fd.append('projectId', selectedProject)
      const upRes = await codebaseAPI.upload(fd)
      const upload = upRes.data.data.upload
      setActiveUpload(upload)

      setUploading(false); setAnalyzing(true)
      const anRes = await codebaseAPI.analyze(upload._id)
      const done  = anRes.data.data.upload
      setActiveUpload(done)
      setUploads(prev => [done, ...prev.filter(u => u._id !== done._id)])
      setFile(null)
      setTab('structure')
      await loadFiles()
      await loadGraph()
      await loadImpactHistory()
    } catch (e) { setError(e.message) }
    finally { setUploading(false); setAnalyzing(false) }
  }

  // ─── RE-ANALYZE ─────────────────────────────────────────────────────────────
  const handleReAnalyze = async (uploadId) => {
    setAnalyzing(true); setError('')
    try {
      const r = await codebaseAPI.analyze(uploadId)
      setActiveUpload(r.data.data.upload)
      await loadFiles(); await loadGraph()
    } catch (e) { setError(e.message) }
    finally { setAnalyzing(false) }
  }

  // ─── IMPACT ANALYSIS ────────────────────────────────────────────────────────
  const handleRunImpact = async () => {
    if (!reqText.trim() || !activeUpload) return
    setRunImpact(true); setError(''); setImpact(null); setShowImpactGraph(false)
    try {
      const r = await codebaseAPI.runImpact(activeUpload._id, {
        requirementText: reqText,
        requirementId: reqId || undefined,
      })
      setImpact(r.data.data.impact)
      setTab('impact')
      await loadImpactHistory()
    } catch (e) { setError(e.message) }
    finally { setRunImpact(false) }
  }

  const handleVerify = async (impactId, itemId, status) => {
    try {
      const r = await codebaseAPI.verifyItem(impactId, itemId, { verificationStatus: status })
      setImpact(r.data.data.impact)
    } catch (e) { alert(e.message) }
  }

  // ─── CODE VIEWER ────────────────────────────────────────────────────────────
  const handleViewCode = (impactItem) => {
    setCodeViewer({ filePath: impactItem.path, impactItem })
  }

  // ─── GENERATE PROPOSAL ──────────────────────────────────────────────────────
  const handleGenerateProposal = async (impactItem, fileDataOverride) => {
    if (!activeUpload || !impactResult) return
    setGenProposal(true)
    setError('')
    try {
      const res = await codebaseAPI.generateProposal(activeUpload._id, {
        filePath:        impactItem.path || (fileDataOverride && fileDataOverride.path),
        requirementText: reqText || impactResult.requirementText,
        impactId:        impactResult._id,
      })
      const proposal = res.data.data.proposal
      setProposalPanel(proposal)
      setProposals(prev => {
        const idx = prev.findIndex(p => p.filePath === proposal.filePath)
        if (idx >= 0) { const next = [...prev]; next[idx] = proposal; return next }
        return [proposal, ...prev]
      })
    } catch (e) { setError(e.message) }
    finally { setGenProposal(false) }
  }

  const handleProposalUpdated = (updated) => {
    setProposalPanel(updated)
    setProposals(prev => prev.map(p => p._id === updated._id ? updated : p))
  }

  // ─── FILTERED FILES ─────────────────────────────────────────────────────────
  const filteredFiles = files.filter(f => {
    const q = fileSearch.toLowerCase()
    return (!q || f.path.toLowerCase().includes(q))
        && (!fileTypeFilter || f.fileType === fileTypeFilter)
  })

  const isReady = activeUpload?.analysisStatus === 'completed'

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Code2 size={22} className="text-primary-600" /> Codebase Analyzer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload a project ZIP, analyze its structure, then identify potentially affected files when requirements change.
          </p>
        </div>
        <select
          value={selectedProject}
          onChange={e => { setProject(e.target.value); setActiveUpload(null); setFiles([]); setNodes([]); setEdges([]); setImpact(null); setShowImpactGraph(false); setCodeViewer(null); setProposalPanel(null); setProposals([]) }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="">Select project…</option>
          {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="card border-danger-200 bg-danger-50 flex items-center gap-2">
          <AlertTriangle size={16} className="text-danger-500 flex-shrink-0" />
          <p className="text-sm text-danger-600">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-danger-400 hover:text-danger-600"><XCircle size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 pb-0 flex-wrap">
        {[
          { id: 'upload',    label: 'Upload' },
          { id: 'structure', label: 'Structure',        disabled: !isReady },
          { id: 'graph',     label: 'Dependency Graph', disabled: !isReady },
          { id: 'impact',    label: 'Impact Analysis',  disabled: !isReady },
          { id: 'proposals', label: `Proposals${proposals.length ? ` (${proposals.length})` : ''}`, disabled: !isReady },
          { id: 'history',   label: 'History',          disabled: !isReady },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors
              ${activeTab === t.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── UPLOAD TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'upload' && (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`card border-2 border-dashed cursor-pointer transition-colors text-center py-12
              ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }}
            />
            <Upload size={36} className={`mx-auto mb-3 ${dragOver ? 'text-primary-500' : 'text-gray-300'}`} />
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedFile.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-600">Drag & drop a project ZIP here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse — max 50 MB</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleUploadAndAnalyze}
              disabled={!selectedFile || !selectedProject || uploading || analyzing}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
            >
              {(uploading || analyzing)
                ? <><Loader size={15} className="animate-spin" /> {uploading ? 'Uploading…' : 'Analyzing…'}</>
                : <><Upload size={15} /> Upload & Analyze</>}
            </button>
            {selectedFile && !uploading && !analyzing && (
              <button onClick={() => setFile(null)} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
            )}
          </div>

          {/* Previous uploads */}
          {uploads.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Previous Uploads</h2>
              <div className="space-y-2">
                {uploads.map(u => (
                  <div key={u._id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer
                    ${activeUpload?._id === u._id ? 'border-primary-300 bg-primary-50' : 'border-gray-100 hover:bg-gray-50'}`}
                    onClick={() => { setActiveUpload(u); if (u.analysisStatus === 'completed') setTab('structure') }}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{u.originalFileName}</p>
                      <p className="text-xs text-gray-400">{u.sourceFiles} source files · {new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={u.analysisStatus} />
                      {u.analysisStatus === 'completed' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleReAnalyze(u._id) }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Re-analyze"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supported types info */}
          <div className="card bg-gray-50 border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">Supported file types</p>
            <div className="flex flex-wrap gap-1.5">
              {['JS','JSX','TS','TSX','Python','Java','C/C++','HTML','CSS','SCSS','JSON'].map(t => (
                <span key={t} className="badge bg-white border border-gray-200 text-gray-600">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              <strong>node_modules, .git, dist, build, venv</strong> and other generated directories are automatically ignored.
            </p>
          </div>
        </div>
      )}

      {/* ── STRUCTURE TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'structure' && isReady && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBadge label="Source Files"  value={activeUpload.sourceFiles}          color="text-primary-600" />
            <StatBadge label="Components"    value={activeUpload.summary?.components}   color="text-purple-600" />
            <StatBadge label="APIs"          value={activeUpload.summary?.apis}         color="text-teal-600" />
            <StatBadge label="Models"        value={activeUpload.summary?.models}       color="text-green-600" />
            <StatBadge label="Functions"     value={activeUpload.summary?.functions}    color="text-orange-600" />
            <StatBadge label="Dependencies"  value={activeUpload.summary?.dependencies} color="text-gray-600" />
          </div>

          {/* Language tags */}
          {activeUpload.languages?.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 font-medium">Languages:</span>
              {activeUpload.languages.map(l => (
                <span key={l} className="badge bg-primary-100 text-primary-700 capitalize">{l}</span>
              ))}
            </div>
          )}

          {/* File search + filter */}
          <div className="flex gap-2 flex-wrap">
            <input
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
              placeholder="Search file path…"
              className="flex-1 min-w-48 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <select
              value={fileTypeFilter}
              onChange={e => setFileTypeFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
            >
              <option value="">All Types</option>
              {['component','api','model','service','test','file','style','config'].map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>

          {/* File list */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    {['Path','Type','Language','Functions','Components','Routes'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredFiles.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No files match your filter.</td></tr>
                  ) : filteredFiles.map(f => {
                    const Icon = TYPE_ICONS[f.fileType] || FileCode2
                    return (
                      <tr key={f._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-3 py-2 font-mono text-gray-700 max-w-xs truncate">
                          <span className="flex items-center gap-1.5">
                            <Icon size={11} className="text-gray-400 flex-shrink-0" />
                            {f.path}
                          </span>
                        </td>
                        <td className="px-3 py-2 capitalize">
                          <span className={`badge ${
                            f.fileType === 'component' ? 'bg-purple-100 text-purple-700'
                            : f.fileType === 'api'     ? 'bg-primary-100 text-primary-700'
                            : f.fileType === 'model'   ? 'bg-teal-100 text-teal-700'
                            : f.fileType === 'service' ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>{f.fileType}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{f.language}</td>
                        <td className="px-3 py-2 text-gray-500">{f.functions?.length || 0}</td>
                        <td className="px-3 py-2 text-gray-500">{f.components?.length || 0}</td>
                        <td className="px-3 py-2 text-gray-500">{f.routes?.length || 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── GRAPH TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'graph' && isReady && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Nodes represent source files. Edges are deterministic import/require relationships. Click a node to inspect it.
          </p>
          <div className="relative rounded-xl overflow-hidden border border-gray-100 shadow-card" style={{ height: 500 }}>
            {nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <p className="text-sm text-gray-400">No dependency edges found. Upload a project with inter-file imports.</p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes} edges={edges}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                onNodeClick={(_, n) => setSelectedNode(n.data)}
                fitView fitViewOptions={{ padding: 0.15 }}
              >
                <Background gap={20} color="#f0f0f0" />
                <Controls />
                <MiniMap />
              </ReactFlow>
            )}
          </div>

          {selectedNode && (
            <div className="card border-l-4 border-l-primary-400">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold text-gray-800">{selectedNode.path}</p>
                  <span className={`badge mt-1 ${
                    selectedNode.type === 'component' ? 'bg-purple-100 text-purple-700'
                    : selectedNode.type === 'api'    ? 'bg-primary-100 text-primary-700'
                    : selectedNode.type === 'model'  ? 'bg-teal-100 text-teal-700'
                    : 'bg-gray-100 text-gray-600'
                  } capitalize`}>{selectedNode.type}</span>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              </div>
            </div>
          )}

          {/* Graph legend */}
          <div className="card bg-gray-50 border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">Legend</p>
            <div className="flex flex-wrap gap-3">
              {[
                ['Component', '#6E46AA'], ['API / Route', '#2864B4'], ['Model', '#1E9191'],
                ['Service', '#32965A'], ['File', '#8A8A8A'],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── IMPACT ANALYSIS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'impact' && isReady && (
        <div className="space-y-5">
          {/* Input */}
          <div className="card space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Describe the new requirement or feature change
              </label>
              <p className="text-xs text-gray-400 mb-2">
                TraceAI will use static dependency analysis + AI to identify potentially affected source files.
              </p>
              <textarea
                value={reqText}
                onChange={e => setReqText(e.target.value)}
                rows={3}
                placeholder={'e.g. "Add estimated arrival time to food delivery tracking."'}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {requirements.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Link to existing requirement <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  value={reqId}
                  onChange={e => {
                    setReqId(e.target.value)
                    if (e.target.value) {
                      const r = requirements.find(r => r._id === e.target.value)
                      if (r && !reqText) setReqText(r.description)
                    }
                  }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">None — enter requirement text above</option>
                  {requirements.map(r => (
                    <option key={r._id} value={r._id}>{r.reqId} — {r.title}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleRunImpact}
              disabled={runningImpact || !reqText.trim()}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
            >
              {runningImpact
                ? <><Loader size={15} className="animate-spin" /> Analyzing impact…</>
                : <><Brain size={15} /> Analyze Impact</>}
            </button>
            {generatingProposal && (
              <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-4 py-2.5 rounded-lg">
                <Loader size={14} className="animate-spin" /> Generating AI proposed change…
              </div>
            )}
          </div>

          {/* Results */}
          {impactResult && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="card border border-purple-100 bg-purple-50/30">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={15} className="text-purple-600" />
                  <span className="text-sm font-semibold text-purple-700">AI Analysis Summary</span>
                  <span className="badge bg-purple-100 text-purple-600 text-[10px]">AI Suggested</span>
                </div>
                <p className="text-sm text-gray-700 mb-3">{impactResult.summary}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-white border border-purple-100 rounded-lg px-3 py-1.5">
                    Change: <strong>{impactResult.changeType}</strong>
                  </span>
                  <span className="bg-white border border-purple-100 rounded-lg px-3 py-1.5">
                    Confidence: <strong>{impactResult.overallConfidence}%</strong>
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Files', impactResult.affectedFiles?.length || 0, 'text-primary-600'],
                  ['Components', impactResult.affectedComponents?.length || 0, 'text-purple-600'],
                  ['APIs', impactResult.affectedAPIs?.length || 0, 'text-teal-600'],
                  ['Models', impactResult.affectedModels?.length || 0, 'text-green-600'],
                ].map(([label, val, color]) => (
                  <div key={label} className="card text-center py-3">
                    <p className={`text-2xl font-bold ${color}`}>{val}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Potentially Affected {label}</p>
                  </div>
                ))}
              </div>

              {/* All affected items grouped */}
              {[
                { title: 'Potentially Affected Files',      items: impactResult.affectedFiles },
                { title: 'Potentially Affected Components', items: impactResult.affectedComponents },
                { title: 'Potentially Affected APIs',       items: impactResult.affectedAPIs },
                { title: 'Potentially Affected Models',     items: impactResult.affectedModels },
              ].filter(g => g.items?.length > 0).map(group => (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">{group.title}</h3>
                  <p className="text-xs text-gray-400 mb-2 italic">
                    AI-suggested — requires human verification before making changes.
                  </p>
                  <div className="space-y-2">
                    {group.items.map(item => (
                      <ImpactCard
                        key={item._id}
                        item={item}
                        impactId={impactResult._id}
                        onVerify={handleVerify}
                        onViewCode={handleViewCode}
                        onGenerateProposal={handleGenerateProposal}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Risks */}
              {impactResult.risks?.length > 0 && (
                <div className="card border-l-4 border-l-orange-400">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-orange-500" /> Identified Risks
                  </h3>
                  <ul className="space-y-1">
                    {impactResult.risks.map((r, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-2">
                        <span className="text-orange-400 flex-shrink-0">⚠</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── View Impact Graph button ─────────────────────────────── */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                <button
                  onClick={() => setShowImpactGraph(v => !v)}
                  className={`flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors border
                    ${showImpactGraph
                      ? 'bg-primary-50 text-primary-700 border-primary-300 hover:bg-primary-100'
                      : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'}`}
                >
                  <Share2 size={15} />
                  {showImpactGraph ? 'Hide Impact Graph' : 'View Impact Graph'}
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <FileText size={15} /> Generate Impact Report
                </button>
                {showImpactGraph && (
                  <span className="text-xs text-gray-400">
                    Click any node to see details
                  </span>
                )}
              </div>

              {/* ── Risk Panel ──────────────────────────────────────────────── */}
              {impactResult.riskScore && (
                <RiskPanel riskScore={impactResult.riskScore} />
              )}

              {/* ── Evidence Panel ──────────────────────────────────────────── */}
              <EvidencePanel impactResult={impactResult} />

              {/* ── Blast Radius ────────────────────────────────────────────── */}
              {impactResult.blastRadius?.totalArtifacts > 0 && (
                <BlastRadiusGraph blastRadius={impactResult.blastRadius} impactResult={impactResult} />
              )}

              {/* ── Test Impact ─────────────────────────────────────────────── */}
              {impactResult.testImpact && (
                <TestImpactPanel testImpact={impactResult.testImpact} />
              )}

              {/* ── Traceability Gaps ───────────────────────────────────────── */}
              <GapsPanel gaps={impactResult.traceabilityGaps} />

              {/* ── Impact Graph (inline, below results) ────────────────── */}
              {showImpactGraph && (
                <ImpactGraph
                  impactResult={impactResult}
                  dependencies={dependencies}
                  onClose={() => setShowImpactGraph(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PROPOSALS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'proposals' && isReady && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ArrowLeftRight size={16} className="text-primary-600" /> Code Change Proposals
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                AI-generated proposed changes for potentially affected files. Original code is never modified.
              </p>
            </div>
            <span className="badge bg-purple-100 text-purple-700">AI Proposed — Requires Human Review</span>
          </div>

          {proposals.length === 0 ? (
            <div className="card text-center py-14">
              <Wand2 size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No proposals yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Run an impact analysis, then click <strong>"Propose Change"</strong> on an affected file.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map(p => {
                const STATUS_COLORS = {
                  Draft:    'bg-gray-100 text-gray-600',
                  Approved: 'bg-green-100 text-green-700',
                  Rejected: 'bg-danger-100 text-danger-600',
                  Edited:   'bg-orange-100 text-orange-700',
                }
                return (
                  <div key={p._id} className="card hover:shadow-card-hover transition-shadow">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <FileCode2 size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-xs font-semibold text-gray-800 truncate">{p.filePath}</span>
                          <span className={`badge ${STATUS_COLORS[p.proposalStatus]}`}>{p.proposalStatus}</span>
                          <span className="badge bg-purple-100 text-purple-600 text-[10px]">AI Proposed</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.requirementText}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(p.createdAt).toLocaleString()}
                          {p.reviewedBy && <span className="ml-2">· Reviewed</span>}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const r = await codebaseAPI.getProposal(activeUpload._id, p._id)
                            setProposalPanel(r.data.data.proposal)
                          } catch (e) { alert(e.message) }
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        <ArrowLeftRight size={12} /> View Diff
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'history' && isReady && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Impact Analysis History</h2>
          {impactHistory.length === 0 ? (
            <div className="card text-center py-12">
              <Brain size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No impact analyses yet. Run your first analysis in the Impact tab.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {impactHistory.map(h => {
                const total = (h.affectedFiles?.length || 0) + (h.affectedComponents?.length || 0) +
                              (h.affectedAPIs?.length || 0) + (h.affectedModels?.length || 0)
                return (
                  <div
                    key={h._id}
                    className="card hover:shadow-card-hover transition-shadow cursor-pointer"
                    onClick={() => { setImpact(h); setTab('impact'); setShowImpactGraph(false) }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">{h.requirementText}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{total} potentially affected items</span>
                          <span>Confidence: {h.overallConfidence}%</span>
                          <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={`badge flex-shrink-0 ${
                        h.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{h.status}</span>
                    </div>
                    {h.requirementId && (
                      <p className="text-xs text-primary-600 mt-1 font-mono">{h.requirementId.reqId}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>

      {/* ── CODE VIEWER MODAL ──────────────────────────────────────────────── */}
      {codeViewer && activeUpload && (
        <CodeViewer
          uploadId={activeUpload._id}
          filePath={codeViewer.filePath}
          impactItem={codeViewer.impactItem}
          requirementText={reqText || impactResult?.requirementText}
          onClose={() => setCodeViewer(null)}
          onGenerateProposal={(fp, fd) => {
            setCodeViewer(null)
            handleGenerateProposal(codeViewer.impactItem || { path: fp }, fd)
          }}
        />
      )}

      {/* ── PROPOSAL PANEL MODAL ───────────────────────────────────────────── */}
      {proposalPanel && activeUpload && (
        <ProposalPanel
          proposal={proposalPanel}
          uploadId={activeUpload._id}
          onUpdated={handleProposalUpdated}
          onClose={() => setProposalPanel(null)}
        />
      )}

      {/* ── IMPACT REPORT MODAL ────────────────────────────────────────────── */}
      {showReport && impactResult?._id && (
        <ReportModal
          impactId={impactResult._id}
          uploadId={activeUpload?._id}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}
