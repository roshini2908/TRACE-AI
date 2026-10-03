import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Bell, Brain, Info } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const [aiPrefs, setAiPrefs] = useState({ provider: 'gemini', mode: 'balanced', showConfidence: true, requireVerification: true })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    localStorage.setItem('traceai_ai_prefs', JSON.stringify(aiPrefs))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Section = ({ icon: Icon, title, children }) => (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-50">
        <Icon size={16} className="text-primary-600" />
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )

  const Row = ({ label, sub, children }) => (
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-sm font-medium text-gray-800">{label}</p>{sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}</div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)} aria-pressed={value}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-primary-500' : 'bg-gray-200'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  )

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <Section icon={User} title="Profile">
        <Row label="Name"><span className="text-sm text-gray-600">{user?.name || '—'}</span></Row>
        <Row label="Email"><span className="text-sm text-gray-600">{user?.email || '—'}</span></Row>
        <Row label="Role"><span className="badge bg-primary-100 text-primary-700 capitalize">{user?.role || 'user'}</span></Row>
      </Section>

      <Section icon={Brain} title="AI Preferences">
        <Row label="AI Provider" sub="Backend integration only — API key is never exposed to browser.">
          <select value={aiPrefs.provider} onChange={e => setAiPrefs(p => ({...p, provider: e.target.value}))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="gemini">Gemini</option>
            <option value="mock">Mock (Demo)</option>
          </select>
        </Row>
        <Row label="Analysis Mode">
          <select value={aiPrefs.mode} onChange={e => setAiPrefs(p => ({...p, mode: e.target.value}))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="balanced">Balanced</option>
            <option value="conservative">Conservative</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </Row>
        <Row label="Show AI Confidence" sub="Display confidence percentages on AI suggestions.">
          <Toggle value={aiPrefs.showConfidence} onChange={v => setAiPrefs(p => ({...p, showConfidence: v}))} />
        </Row>
        <Row label="Require Human Verification" sub="All AI suggestions must be verified before being treated as confirmed.">
          <Toggle value={aiPrefs.requireVerification} onChange={v => setAiPrefs(p => ({...p, requireVerification: v}))} />
        </Row>
        <button onClick={handleSave}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm py-2 rounded-lg transition-colors">
          {saved ? '✓ Saved!' : 'Save Preferences'}
        </button>
      </Section>

      <Section icon={Info} title="Application">
        {[['Application','TraceAI'],['Version','1.0.0'],['Backend','http://localhost:5000'],['Database','MongoDB'],['AI Provider','Gemini (configurable)']].map(([k,v]) => (
          <Row key={k} label={k}><span className="text-sm text-gray-500">{v}</span></Row>
        ))}
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mt-2">
          <p className="text-xs text-orange-700 font-medium">Security Note</p>
          <p className="text-xs text-orange-600 mt-0.5">The Gemini API key is stored only on the backend server and is never exposed to this browser client.</p>
        </div>
      </Section>
    </div>
  )
}
