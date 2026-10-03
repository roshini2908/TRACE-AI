import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, ChevronDown, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { notificationsAPI } from '../../services/api'

export default function TopBar() {
  const { user, logout } = useAuth()
  const { toggleSidebar } = useApp()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery]           = useState('')
  const [showNotifications, setShowNotif]       = useState(false)
  const [showUserMenu, setShowUser]             = useState(false)
  const [notifications, setNotifications]       = useState([])
  const [unreadCount, setUnreadCount]           = useState(0)

  // Load notifications from backend
  const loadNotifications = async () => {
    try {
      const res = await notificationsAPI.getAll()
      setNotifications(res.data.data.notifications)
      setUnreadCount(res.data.data.unreadCount)
    } catch { /* silent — non-critical */ }
  }

  useEffect(() => { loadNotifications() }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/requirements?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch { /* silent */ }
  }

  const markOneRead = async (id) => {
    try {
      await notificationsAPI.markRead(id)
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* silent */ }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <header className="h-14 flex items-center gap-4 px-4 bg-white border-b border-gray-100 flex-shrink-0">
      <button className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" onClick={toggleSidebar} aria-label="Open sidebar">
        <Menu size={20} />
      </button>

      <form onSubmit={handleSearch} className="flex-1 max-w-md" role="search">
        <label htmlFor="global-search" className="sr-only">Search</label>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input id="global-search" type="search" placeholder="Search requirements, components…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
        </div>
      </form>

      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setShowNotif(v => !v); setShowUser(false) }}
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label={`Notifications — ${unreadCount} unread`} aria-expanded={showNotifications}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">{unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Notifications</h2>
                {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-primary-500 hover:text-primary-700 font-medium">Mark all read</button>}
              </div>
              <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {notifications.length === 0 && <li className="px-4 py-6 text-center text-xs text-gray-400">No notifications</li>}
                {notifications.map(n => (
                  <li key={n._id} onClick={() => markOneRead(n._id)}
                    className={`px-4 py-3 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${n.read ? '' : 'bg-primary-50/40'}`}>
                    <p className={`${n.read ? 'text-gray-600' : 'text-gray-800 font-medium'} leading-snug`}>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button onClick={() => { setShowUser(v => !v); setShowNotif(false) }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-expanded={showUserMenu} aria-label="User menu">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-600 text-xs font-bold uppercase">{user?.name?.charAt(0) || 'D'}</span>
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.name || 'Demo User'}</span>
            <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
              <div className="py-1">
                <button onClick={() => { navigate('/settings'); setShowUser(false) }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Settings size={14} /> Settings
                </button>
                <button onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-danger-500 hover:bg-danger-50 transition-colors">
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(showNotifications || showUserMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotif(false); setShowUser(false) }} aria-hidden="true" />
      )}
    </header>
  )
}
