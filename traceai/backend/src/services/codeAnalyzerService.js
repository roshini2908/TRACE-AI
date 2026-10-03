/**
 * Static code analyzer — deterministically extracts structure from source files.
 * Supports: JS/JSX/TS/TSX, Python, Java, C/C++
 * Never executes uploaded code.
 */

const path = require('path')

// ─── LANGUAGE DETECTION ───────────────────────────────────────────────────────
const EXTENSION_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp',
  '.h': 'c', '.hpp': 'cpp', '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.json': 'json', '.md': 'markdown', '.yaml': 'yaml', '.yml': 'yaml',
}

const SOURCE_EXTENSIONS = new Set([
  '.js','.jsx','.ts','.tsx','.py','.java','.c','.cpp','.cc','.h','.hpp',
  '.html','.css','.scss','.json',
])

const IGNORED_DIRS = new Set([
  'node_modules','.git','dist','build','coverage','.cache','.next',
  'venv','__pycache__','.venv','env','target','out','bin','obj',
  '.idea','.vscode','vendor','bower_components','packages',
])

// ─── FILE TYPE CLASSIFICATION ─────────────────────────────────────────────────
const classifyFileType = (filePath, content = '') => {
  const lower = filePath.toLowerCase()
  const base  = path.basename(lower)

  if (/\.(test|spec)\.[jt]sx?$/.test(lower)) return 'test'
  if (lower.includes('/models/') || lower.includes('/model/') || /model\.[jt]sx?$/.test(lower)) return 'model'
  if (lower.includes('/routes/') || lower.includes('/router/')) return 'api'
  if (lower.includes('/controllers/') || lower.includes('/controller/')) return 'api'
  if (lower.includes('/services/') || lower.includes('/service/')) return 'service'
  if (lower.includes('/components/') || lower.includes('/pages/') || lower.includes('/screens/')) return 'component'
  if (lower.includes('/hooks/') || base.startsWith('use')) return 'component'
  if (lower.includes('/middleware/')) return 'service'
  if (['.css','.scss','.html'].some(e => lower.endsWith(e))) return 'style'
  if (['.json','.yaml','.yml'].some(e => lower.endsWith(e))) return 'config'

  // Content-based hints
  if (content) {
    if (/app\.get|app\.post|router\.get|router\.post|@app\.route|@router\./i.test(content)) return 'api'
    if (/mongoose\.model|Schema\(|@Entity|@Table/i.test(content)) return 'model'
    if (/React\.|jsx|tsx|import React|export default function [A-Z]/i.test(content)) return 'component'
  }
  return 'file'
}

// ─── JS/TS ANALYZER ───────────────────────────────────────────────────────────
const analyzeJavaScript = (content, filePath) => {
  const imports   = []
  const exports_  = []
  const functions = []
  const classes   = []
  const components= []
  const routes    = []
  const models    = []

  // Imports: import X from 'y'  |  import { X } from 'y'  |  require('y')
  const importRe = /import\s+(?:[\w*{},\s]+from\s+)?['"]([^'"]+)['"]/g
  let m
  while ((m = importRe.exec(content)) !== null) imports.push(m[1])

  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = requireRe.exec(content)) !== null) imports.push(m[1])

  // Named exports
  const exportRe = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g
  while ((m = exportRe.exec(content)) !== null) exports_.push(m[1])

  // Functions
  const funcRe = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g
  while ((m = funcRe.exec(content)) !== null) functions.push(m[1] || m[2])

  // Classes
  const classRe = /class\s+(\w+)/g
  while ((m = classRe.exec(content)) !== null) classes.push(m[1])

  // React components: export default function Foo or const Foo = () =>
  const compRe = /(?:export\s+default\s+function\s+|export\s+(?:const|function)\s+)([A-Z]\w+)/g
  while ((m = compRe.exec(content)) !== null) components.push(m[1])

  // Express routes
  const routeRe = /(?:router|app)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
  while ((m = routeRe.exec(content)) !== null) routes.push(`${m[1].toUpperCase()} ${m[2]}`)

  // Mongoose models
  const modelRe = /mongoose\.model\s*\(\s*['"](\w+)['"]/g
  while ((m = modelRe.exec(content)) !== null) models.push(m[1])

  return {
    imports: [...new Set(imports)],
    exports: [...new Set(exports_)],
    functions: [...new Set(functions.filter(Boolean))].slice(0, 40),
    classes: [...new Set(classes)],
    components: [...new Set(components)],
    routes: [...new Set(routes)],
    models: [...new Set(models)],
  }
}

// ─── PYTHON ANALYZER ──────────────────────────────────────────────────────────
const analyzePython = (content) => {
  const imports   = []
  const functions = []
  const classes   = []
  const routes    = []

  const importRe = /^(?:import|from)\s+([\w.]+)/gm
  let m
  while ((m = importRe.exec(content)) !== null) imports.push(m[1])

  const funcRe = /^def\s+(\w+)/gm
  while ((m = funcRe.exec(content)) !== null) functions.push(m[1])

  const classRe = /^class\s+(\w+)/gm
  while ((m = classRe.exec(content)) !== null) classes.push(m[1])

  const routeRe = /@(?:app|router)\s*\.\s*(?:route|get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/g
  while ((m = routeRe.exec(content)) !== null) routes.push(m[1])

  return { imports: [...new Set(imports)], functions, classes, routes, exports: [], components: [], models: [] }
}

// ─── JAVA ANALYZER ────────────────────────────────────────────────────────────
const analyzeJava = (content) => {
  const imports = []
  const classes = []
  const functions = []
  let m

  const importRe = /^import\s+([\w.]+);/gm
  while ((m = importRe.exec(content)) !== null) imports.push(m[1])

  const classRe = /(?:public|private|protected)?\s*class\s+(\w+)/g
  while ((m = classRe.exec(content)) !== null) classes.push(m[1])

  const methodRe = /(?:public|private|protected)\s+\w+\s+(\w+)\s*\(/g
  while ((m = methodRe.exec(content)) !== null) functions.push(m[1])

  return { imports: [...new Set(imports)], classes, functions: functions.slice(0, 30), exports: [], components: [], routes: [], models: [] }
}

// ─── C/C++ ANALYZER ───────────────────────────────────────────────────────────
const analyzeC = (content) => {
  const imports = []
  const functions = []
  let m

  const includeRe = /#include\s+[<"]([^>"]+)[>"]/g
  while ((m = includeRe.exec(content)) !== null) imports.push(m[1])

  const funcRe = /\b(\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g
  while ((m = funcRe.exec(content)) !== null) {
    if (!['if','while','for','switch'].includes(m[2])) functions.push(m[2])
  }

  return { imports: [...new Set(imports)], functions: functions.slice(0, 30), classes: [], exports: [], components: [], routes: [], models: [] }
}

// ─── MAIN ANALYZER DISPATCHER ─────────────────────────────────────────────────
const analyzeFile = (filePath, content) => {
  const ext  = path.extname(filePath).toLowerCase()
  const lang = EXTENSION_MAP[ext] || 'unknown'

  let parsed = { imports: [], exports: [], functions: [], classes: [], components: [], routes: [], models: [] }

  // Only analyze source files with content
  if (content && content.length < 500_000) {
    try {
      if (['javascript','typescript'].includes(lang)) parsed = analyzeJavaScript(content, filePath)
      else if (lang === 'python')  parsed = analyzePython(content)
      else if (lang === 'java')    parsed = analyzeJava(content)
      else if (['c','cpp'].includes(lang)) parsed = analyzeC(content)
    } catch { /* skip parse errors — never crash on uploaded code */ }
  }

  return {
    language: lang,
    fileType: classifyFileType(filePath, content || ''),
    ...parsed,
  }
}

// ─── PATH UTILITIES ────────────────────────────────────────────────────────────

/** Returns true if any path segment is in the ignored-dirs set */
const shouldIgnorePath = (relativePath) => {
  const segments = relativePath.replace(/\\/g, '/').split('/')
  return segments.some(seg => IGNORED_DIRS.has(seg))
}

/** Returns true if the file extension is a supported source extension */
const isSupportedFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  return SOURCE_EXTENSIONS.has(ext)
}

/**
 * Resolve an import path to a known file path in the project.
 * Very lightweight — only resolves relative imports.
 */
const resolveImport = (importStr, sourceFile, allPaths) => {
  if (!importStr.startsWith('.')) return null   // external package — not a project file

  const dir     = path.dirname(sourceFile).replace(/\\/g, '/')
  const base    = path.join(dir, importStr).replace(/\\/g, '/')
  const exts    = ['.js','.jsx','.ts','.tsx','.py','.java']
  const suffixes= ['', '/index.js','/index.jsx','/index.ts','/index.tsx']

  for (const suffix of suffixes) {
    const candidate = base + suffix
    if (allPaths.has(candidate)) return candidate
    for (const ext of exts) {
      const c2 = candidate + ext
      if (allPaths.has(c2)) return c2
    }
  }
  return null
}

/**
 * Build dependency edges between files from their resolved imports.
 * Returns array of { sourceFile, targetFile, relationship, confidence }.
 */
const buildDependencies = (analyzedFiles) => {
  const pathSet = new Set(analyzedFiles.map(f => f.path))
  const deps    = []

  for (const file of analyzedFiles) {
    for (const imp of (file.imports || [])) {
      const target = resolveImport(imp, file.path, pathSet)
      if (target && target !== file.path) {
        deps.push({
          sourceFile:   file.path,
          targetFile:   target,
          relationship: 'imports',
          confidence:   100,
        })
      }
    }
  }
  return deps
}

module.exports = { analyzeFile, shouldIgnorePath, isSupportedFile, buildDependencies, EXTENSION_MAP, SOURCE_EXTENSIONS }
