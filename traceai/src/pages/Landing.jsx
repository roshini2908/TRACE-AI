import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch, Brain, CheckCircle, Shield } from 'lucide-react'
import Logo from '../components/common/Logo'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 no-underline px-3 py-1.5">
            Sign In
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 no-underline transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-gradient-to-b from-primary-50 to-white">
        <span className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <Brain size={13} aria-hidden="true" /> AI-Powered Traceability
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 max-w-3xl text-balance leading-tight">
          Understand the Impact Before You Change the Code.
        </h1>
        <p className="mt-5 text-lg text-gray-500 max-w-2xl text-balance">
          TraceAI uses requirement traceability and AI-assisted analysis to identify software
          components that may be affected when requirements change.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-primary-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-700 no-underline transition-colors shadow-sm"
          >
            Explore Demo <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 no-underline transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Workflow visual */}
        <div className="mt-16 flex flex-wrap justify-center items-center gap-2 text-sm font-medium">
          {[
            { label: 'Requirement', color: 'bg-primary-100 text-primary-700' },
            { label: 'Version Change', color: 'bg-orange-100 text-orange-700' },
            { label: 'AI Analysis', color: 'bg-purple-100 text-purple-700' },
            { label: 'Affected Components', color: 'bg-teal-100 text-teal-700' },
            { label: 'Human Verification', color: 'bg-green-100 text-green-700' },
          ].map((step, i, arr) => (
            <span key={step.label} className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg ${step.color}`}>{step.label}</span>
              {i < arr.length - 1 && <ArrowRight size={14} className="text-gray-300" aria-hidden="true" />}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-12">
            Built for Software Development Teams
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FileText2, title: 'Requirement Versioning', desc: 'Track every change to your requirements with a full version history and semantic diff.' },
              { icon: Brain, title: 'AI Semantic Analysis', desc: 'AI compares requirement versions and identifies what conceptually changed — not just text differences.' },
              { icon: GitBranch, title: 'Traceability Matrix', desc: 'Link requirements to components, APIs, services, tests, and databases in a structured matrix.' },
              { icon: Shield, title: 'Human-in-the-Loop', desc: 'Every AI suggestion requires human verification. Accept, reject, or flag for review.' },
              { icon: Share2Icon, title: 'Visual Impact Graph', desc: 'Explore the dependency graph to understand how a requirement change propagates through the system.' },
              { icon: CheckCircle, title: 'Coverage Reports', desc: 'Generate traceability coverage, impact, and missing-link reports from a single place.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card hover:shadow-card-hover transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-primary-600" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-primary-600 text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to trace your impact?</h2>
        <p className="text-primary-200 mb-8 max-w-xl mx-auto">
          Sign in with the demo account to explore the full TraceAI workflow.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 bg-white text-primary-700 font-bold px-6 py-3 rounded-xl no-underline hover:bg-primary-50 transition-colors"
        >
          Open Demo <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-5 px-6 border-t border-gray-100 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} TraceAI — Understand the Impact Before You Change the Code.
      </footer>
    </div>
  )
}

// Inline icon wrappers to avoid extra imports
function FileText2(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  )
}
function Share2Icon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}
