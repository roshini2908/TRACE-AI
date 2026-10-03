import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react'

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
}

const STYLES = {
  success: 'bg-green-500 text-white',
  error:   'bg-danger-500 text-white',
  warning: 'bg-orange-500 text-white',
  info:    'bg-primary-500 text-white',
}

export default function Toast({ message, type = 'success' }) {
  const Icon = ICONS[type] || Info
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3
        rounded-xl shadow-lg max-w-sm text-sm font-medium
        animate-slide-in ${STYLES[type]}
      `}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
