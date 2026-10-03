import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, FileText, Layers,
  GitBranch, Brain, Share2, History, BarChart2,
  Settings, LogOut, X, Code2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import Logo from '../common/Logo'

const NAV_ITEMS = [
  { label: 'Dashboard',          icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Projects',           icon: FolderOpen,      to: '/projects' },
  { label: 'Requirements',       icon: FileText,         to: '/requirements' },
  { label: 'Components',         icon: Layers,           to: '/components' },
  { label: 'Traceability',       icon: GitBranch,        to: '/traceability' },
  { label: 'AI Analysis',        icon: Brain,            to: '/ai-analysis' },
  { label: 'Codebase Analyzer',  icon: Code2,            to: '/codebase' },
  { label: 'Graph',              icon: Share2,           to: '/graph' },
  { label: 'History',            icon: History,          to: '/history' },
  { label: 'Reports',            icon: BarChart2,        to: '/reports' },
  { label: 'Settings',           icon: Settings,         to: '/settings' },
]

export default function Sidebar() {
  const { logout, user } = useAuth()
  const { sidebarOpen, closeSidebar } = useApp()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 w-60 flex flex-col bg-white border-r border-gray-100 shadow-sidebar
        transform transition-transform duration-200 ease-in-out
        lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      aria-label="Sidebar navigation"
    >
      {/* Logo area */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <Logo size="md" />
        <button
          className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={closeSidebar}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
            aria-current={({ isActive }) => isActive ? 'page' : undefined}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-600 text-xs font-bold uppercase">
              {user?.name?.charAt(0) || 'D'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name || 'Demo User'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email || 'demo@traceai.com'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="nav-item w-full text-danger-500 hover:text-danger-600 hover:bg-danger-50"
          aria-label="Sign out"
        >
          <LogOut size={17} strokeWidth={1.75} aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
