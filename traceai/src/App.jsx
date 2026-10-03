import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'

// Layouts
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'

// Public pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'

// Protected pages
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetails from './pages/ProjectDetails'
import Requirements from './pages/Requirements'
import RequirementDetails from './pages/RequirementDetails'
import VersionComparison from './pages/VersionComparison'
import Components from './pages/Components'
import Traceability from './pages/Traceability'
import AIAnalysis from './pages/AIAnalysis'
import DependencyGraph from './pages/DependencyGraph'
import AnalysisHistory from './pages/AnalysisHistory'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import CodebaseAnalyzer from './pages/CodebaseAnalyzer'

// Guard for protected routes — must be inside AuthProvider
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Redirect logged-in users away from auth pages
function RequireGuest({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing */}
      <Route path="/" element={<Landing />} />

      {/* Auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login"    element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/register" element={<RequireGuest><Register /></RequireGuest>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Protected app pages */}
      <Route
        element={
          <RequireAuth>
            <AppProvider>
              <AppLayout />
            </AppProvider>
          </RequireAuth>
        }
      >
        <Route path="/dashboard"                               element={<Dashboard />} />
        <Route path="/projects"                                element={<Projects />} />
        <Route path="/projects/:projectId"                     element={<ProjectDetails />} />
        <Route path="/requirements"                            element={<Requirements />} />
        <Route path="/requirements/:requirementId"             element={<RequirementDetails />} />
        <Route path="/requirements/:requirementId/compare"     element={<VersionComparison />} />
        <Route path="/components"                              element={<Components />} />
        <Route path="/traceability"                            element={<Traceability />} />
        <Route path="/ai-analysis"                             element={<AIAnalysis />} />
        <Route path="/graph"                                   element={<DependencyGraph />} />
        <Route path="/history"                                 element={<AnalysisHistory />} />
        <Route path="/reports"                                 element={<Reports />} />
        <Route path="/settings"                                element={<Settings />} />
        <Route path="/codebase"                                element={<CodebaseAnalyzer />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
