import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={28} className="text-green-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-sm text-gray-500 mb-6">
          If <strong>{email}</strong> is registered, a reset link will be sent shortly.
          <br />
          <span className="text-xs text-gray-400 mt-1 block">(This is a demo — no email is actually sent.)</span>
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-800 no-underline"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we'll send a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                         placeholder-gray-300"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                     disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
            : <Mail size={16} aria-hidden="true" />
          }
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 no-underline"
        >
          <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
        </Link>
      </div>
    </div>
  )
}
