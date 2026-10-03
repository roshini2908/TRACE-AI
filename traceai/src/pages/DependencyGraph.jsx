import { useEffect, useState, useCallback } from 'react'
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge } from 'reactflow'
import 'reactflow/dist/style.css'
import { projectsAPI, requirementsAPI, componentsAPI, traceabilityAPI, analysisAPI } from '../services/api'
import { Brain } from 'lucide-react'

// Node styles per type
const NODE_STYLES = {
  Requirement: { background: '#EEF4FC', border: '2px solid #2864B4', color: '#1a4a8a' },
  Frontend:    { background: '#F3EEF9', border: '2px solid #6E46AA', color: '#4a2d7a' },
  API:         { background: '#F3EEF9', border: '2px solid #6E46AA', color: '#4a2d7a' },
  Backend:     { background: '#E8F7F7', border: '2px solid #1E9191', color: '#125757' },
  Service:     { background: '#E8F7F7', border: '2px solid #1E9191', color: '#125757' },
  Database:    { background: '#E8F7F7', border: '2px solid #1E9191', color: '#125757' },
  Test:        { background: '#F5F5F5', border: '2px solid #5A5A5A', color: '#3a3a3a' },
  Default:     { background: '#F5F5F5', border: '2px solid #aaa',    color: '#555' },
}
const IMPACT_STYLE   = { background: '#FDF4E8', border: '2px solid #DC8228', color: '#8a4f10' }
const VERIFIED_STYLE = { background: '#EBF6EF', border: '2px solid #32965A', color: '#1a5a32' }

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-card border border-gray-100 p-3 z-10">
      <p className="text-xs font-semibold text-gray-700 mb-2">Legend</p>
      {[
        ['Requirement', '#2864B4'], ['API / Frontend', '#6E46AA'], ['Service / Database', '#1E9191'],
        ['AI Suggested Impact', '#DC8228'], ['Verified', '#32965A'],
      ].map(([label, color]) => (
        <div key={label} className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-gray-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

export default function DependencyGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [projects, setProjects]   = useState([])
  const [projectId, setProjectId] = useState('')
  const [impactMode, setImpact]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState(null)
  const [error, setError]         = useState('')

  useEffect(() => {
    projectsAPI.getAll().then(res => {
      const ps = res.data.data.projects
      setProjects(ps)
      if (ps.length > 0) setProjectId(ps[0]._id)
    }).catch(err => setError(err.message))
  }, [])

  useEffect(() => {
    if (!projectId) return
    buildGraph(projectId)
  }, [projectId, impactMode])

  const buildGraph = async (pid) => {
    setLoading(true)
    try {
      const [reqRes, compRes, linkRes, anRes] = await Promise.all([
        requirementsAPI.getAll({ projectId: pid }),
        componentsAPI.getAll({ projectId: pid }),
        traceabilityAPI.getAll({ projectId: pid }),
        analysisAPI.getAll({ projectId: pid }),
      ])

      const requirements = reqRes.data.data.requirements
      const components   = compRes.data.data.components
      const links        = linkRes.data.data.links
      const analyses     = anRes.data.data.analyses

      // Collect impacted component IDs from latest analysis
      const impactedIds = new Set()
      const verifiedIds = new Set()
      if (impactMode && analyses.length > 0) {
        const latest = analyses[0]
        latest.impactedComponents?.forEach(c => {
          if (c.componentId) {
            if (c.verificationStatus === 'Verified') verifiedIds.add(String(c.componentId))
            else impactedIds.add(String(c.componentId))
          }
        })
      }

      // Build nodes
      const reqNodes = requirements.map((r, i) => ({
        id: `req-${r._id}`, type: 'default',
        position: { x: 200 + i * 250, y: 50 },
        data: { label: `${r.reqId}\n${r.title}`, type: 'Requirement', raw: r },
        style: { ...NODE_STYLES.Requirement, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, width: 160, whiteSpace: 'pre-line', textAlign: 'center' },
      }))

      const compNodes = components.map((c, i) => {
        let style = NODE_STYLES[c.type] || NODE_STYLES.Default
        if (impactMode) {
          const cId = String(c._id)
          if (verifiedIds.has(cId)) style = VERIFIED_STYLE
          else if (impactedIds.has(cId)) style = IMPACT_STYLE
          else style = { ...style, opacity: 0.35 }
        }
        return {
          id: `comp-${c._id}`, type: 'default',
          position: { x: 50 + (i % 4) * 230, y: 200 + Math.floor(i / 4) * 160 },
          data: { label: c.name, type: c.type, raw: c },
          style: { ...style, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 500, width: 150, textAlign: 'center' },
        }
      })

      // Build edges from traceability links
      const edgeList = links.map(l => ({
        id: `edge-${l._id}`,
        source: `req-${l.requirementId?._id || l.requirementId}`,
        target: `comp-${l.componentId?._id || l.componentId}`,
        label: l.relationshipType,
        style: { stroke: l.source === 'AI Suggested' ? '#6E46AA' : '#aaa', strokeDasharray: l.source === 'AI Suggested' ? '5,3' : undefined },
        labelStyle: { fontSize: 9, fill: '#888' },
        animated: l.source === 'AI Suggested',
      }))

      setNodes([...reqNodes, ...compNodes])
      setEdges(edgeList)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const onNodeClick = useCallback((_, node) => setSelected(node.data.raw), [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dependency Graph</h1>
          <p className="text-sm text-gray-500 mt-1">Visual traceability — requirements to components.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400">
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <button onClick={() => setImpact(v => !v)}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${impactMode ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
            <Brain size={15} /> {impactMode ? 'Impact View' : 'Normal View'}
          </button>
        </div>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      <div className="relative rounded-xl overflow-hidden border border-gray-100 shadow-card" style={{ height: 520 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <p className="text-sm text-gray-400 animate-pulse">Building graph…</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView fitViewOptions={{ padding: 0.2 }}
          >
            <Background gap={20} color="#f0f0f0" />
            <Controls />
            <MiniMap nodeColor={n => n.style?.border?.includes('2864B4') ? '#2864B4' : n.style?.border?.includes('6E46AA') ? '#6E46AA' : '#1E9191'} />
          </ReactFlow>
        )}
        <Legend />
      </div>

      {/* Side panel */}
      {selected && (
        <div className="card border-l-4 border-l-primary-400">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-mono">{selected.reqId || selected.componentId}</p>
              <h3 className="font-semibold text-gray-900 mt-0.5">{selected.title || selected.name}</h3>
              {selected.type && <span className="badge bg-gray-100 text-gray-600 mt-1">{selected.type}</span>}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          {selected.description && <p className="text-xs text-gray-600 mt-2">{selected.description}</p>}
          {selected.technology && <p className="text-xs text-gray-400 mt-1">Tech: {selected.technology}</p>}
          {selected.path && <p className="text-xs font-mono text-gray-300 mt-0.5">{selected.path}</p>}
        </div>
      )}
    </div>
  )
}
