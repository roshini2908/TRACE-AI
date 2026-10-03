export default function Logo({ size = 'md', showTagline = false }) {
  const sizes = {
    sm: { icon: 24, title: 'text-lg', tagline: 'text-xs' },
    md: { icon: 32, title: 'text-xl', tagline: 'text-xs' },
    lg: { icon: 40, title: 'text-2xl', tagline: 'text-sm' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Icon mark */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#2864B4" />
        {/* Top node — requirement */}
        <circle cx="16" cy="7" r="3" fill="white" />
        {/* Bottom-left node — component */}
        <circle cx="8" cy="23" r="3" fill="#1E9191" />
        {/* Bottom-right node — component */}
        <circle cx="24" cy="23" r="3" fill="#6E46AA" />
        {/* Edges */}
        <line x1="16" y1="10" x2="8" y2="20" stroke="white" strokeWidth="1.5" strokeDasharray="2.5 2" />
        <line x1="16" y1="10" x2="24" y2="20" stroke="white" strokeWidth="1.5" strokeDasharray="2.5 2" />
        <line x1="8" y1="23" x2="24" y2="23" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="2 2" />
      </svg>

      {/* Text */}
      <div className="flex flex-col leading-tight">
        <span className={`${s.title} font-bold text-primary-600 tracking-tight`}>
          Trace<span className="text-purple-500">AI</span>
        </span>
        {showTagline && (
          <span className={`${s.tagline} text-gray-400 font-normal`}>
            Understand the Impact
          </span>
        )}
      </div>
    </div>
  )
}
