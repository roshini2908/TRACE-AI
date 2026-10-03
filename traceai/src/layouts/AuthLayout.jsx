import { Outlet, Link } from 'react-router-dom'
import Logo from '../components/common/Logo'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="px-6 py-4 border-b border-gray-100 bg-white">
        <Link to="/" className="inline-flex items-center no-underline">
          <Logo size="sm" />
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} TraceAI. All rights reserved.
      </footer>
    </div>
  )
}
