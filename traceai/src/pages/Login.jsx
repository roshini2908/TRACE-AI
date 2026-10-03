import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEMO_EMAIL    = 'demo@traceai.com'
const DEMO_PASSWORD = 'demo123'

export default function Login() {
  const { loginWithBackend } = useAuth()
  const navigate = useNavigate()

  const [form, setForm]           = useState({ email: '', password: '' })
  const [showPassword, setShow]   = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginWithBackend(form.email.trim(), form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => setForm({ email: DEMO_EMAIL, password: DEMO_PASSWORD })

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your TraceAI account</p>
      </div>

      <div className="mb-5 p-3 bg-primary-50 border border-primary-100 rounded-lg">
        <p className="text-xs text-primary-700 font-medium mb-1">Demo credentials</p>
        <p className="text-xs text-primary-600 font-mono">demo@traceai.com / demo123</p>
        <button onClick={fillDemo} className="mt-1.5 text-xs text-primary-600 underline hover:text-primary-800">
          Fill automatically
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required
            value={form.email} onChange={handleChange} placeholder="you@example.com"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent placeholder-gray-300" />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
              value={form.password} onChange={handleChange} placeholder="••••••••"
              className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent placeholder-gray-300" />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setShow((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex justify-end mt-1">
            <Link to="/forgot-password" className="text-xs text-primary-500 hover:text-primary-700 no-underline">Forgot password?</Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-danger-500 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <LogIn size={16} />}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary-500 font-medium hover:text-primary-700 no-underline">Create one</Link>
      </p>
    </div>
  )
}
