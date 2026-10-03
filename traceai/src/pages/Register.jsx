import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Defined at module level — NOT inside Register — so React never treats it as
// a new component type on re-render and inputs keep their focus.
function RegisterField({ id, label, type = 'text', placeholder, autoComplete, form, errors, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={form[id]}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border rounded-lg placeholder-gray-300
          focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
          ${errors[id] ? 'border-danger-400 bg-danger-50' : 'border-gray-200'}`}
      />
      {errors[id] && (
        <p className="mt-1 text-xs text-danger-500">{errors[id]}</p>
      )}
    </div>
  )
}

export default function Register() {
  const { registerWithBackend } = useAuth()
  const navigate = useNavigate()

  const [form, setForm]    = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors]= useState({})
  const [apiError, setApi] = useState('')
  const [loading, setLoad] = useState(false)

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
    setErrors((p) => ({ ...p, [e.target.name]: '' }))
    setApi('')
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name = 'Name is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email.'
    if (!form.password)     e.password = 'Password is required.'
    else if (form.password.length < 6) e.password = 'Min. 6 characters.'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoad(true)
    try {
      await registerWithBackend(form.name.trim(), form.email.trim(), form.password)
      navigate('/dashboard')
    } catch (err) {
      setApi(err.message || 'Registration failed.')
    } finally {
      setLoad(false)
    }
  }

  const fieldProps = { form, errors, onChange: handleChange }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">Start tracing your requirements today</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <RegisterField id="name"     label="Full name"         placeholder="Jane Smith"        autoComplete="name"         {...fieldProps} />
        <RegisterField id="email"    label="Email address"     type="email"    placeholder="jane@example.com"  autoComplete="email"        {...fieldProps} />
        <RegisterField id="password" label="Password"          type="password" placeholder="Min. 6 characters" autoComplete="new-password" {...fieldProps} />
        <RegisterField id="confirm"  label="Confirm password"  type="password" placeholder="Repeat password"   autoComplete="new-password" {...fieldProps} />

        {apiError && (
          <p role="alert" className="text-xs text-danger-500 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
            disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
            : <UserPlus size={16} aria-hidden="true" />
          }
          {loading ? 'Creating…' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-500 font-medium hover:text-primary-700 no-underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
