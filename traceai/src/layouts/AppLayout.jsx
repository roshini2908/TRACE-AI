import { Outlet } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import Toast from '../components/common/Toast'

export default function AppLayout() {
  const { sidebarOpen, closeSidebar, toast } = useApp()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 focus:outline-none"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>

      {/* Global toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
