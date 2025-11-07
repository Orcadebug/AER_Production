import { useEffect, useState } from 'react'
import { Settings, Camera, Send } from 'lucide-react'

type Cfg = { token?: string; convexSite?: string }

declare global {
  interface Window {
    aer: any
  }
}

export default function App() {
  const [cfg, setCfg] = useState<Cfg>({})
  const [history, setHistory] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const c = await window.aer.loadConfig()
      setCfg(c)
      const h = await window.aer.listHistory()
      setHistory(h)
    })()
  }, [])

  const save = async () => {
    await window.aer.saveConfig(cfg)
  }

  const capture = async () => {
    setSaving(true)
    try {
      await window.aer.captureNow()
      const h = await window.aer.listHistory()
      setHistory(h)
    } finally {
      setSaving(false)
    }
  }

  const openSettings = async () => {
    await window.aer.openSettingsPage()
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Aer Capture</h1>
        <button className="btn-outline inline-flex items-center gap-2" onClick={openSettings}>
          <Settings className="w-4 h-4" /> Aer Settings
        </button>
      </header>

      <section className="card space-y-3">
        <h2 className="font-semibold">Authentication</h2>
        <p className="text-sm text-gray-500">
          Paste your Aer token from Settings (format: <code>aer_...</code>). All uploads use HTTPS.
        </p>
        <div className="flex gap-2">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="aer_..."
            value={cfg.token || ''}
            onChange={(e) => setCfg({ ...cfg, token: e.target.value })}
          />
          <button className="btn" onClick={save}>Save</button>
        </div>
        <div className="flex gap-2 items-center text-xs text-gray-500">
          <span>Convex site:</span>
          <input
            className="border rounded px-2 py-1"
            placeholder="https://honorable-porpoise-222.convex.site"
            value={cfg.convexSite || ''}
            onChange={(e) => setCfg({ ...cfg, convexSite: e.target.value })}
          />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Capture</h2>
        <div className="flex gap-2">
          <button className="btn inline-flex items-center gap-2" onClick={capture} disabled={saving}>
            <Camera className="w-4 h-4" /> {saving ? 'Capturing…' : 'Capture Screen'}
          </button>
          <div className="text-sm text-gray-500">Global hotkey: Ctrl/Cmd + Alt + Y</div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Recent Captures</h2>
        {history.length === 0 ? (
          <div className="text-sm text-gray-500">No captures yet.</div>
        ) : (
          <ul className="space-y-2">
            {history.map((h: any) => (
              <li key={h.id} className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {new Date(h.createdAt).toLocaleString()} • {h.ok ? 'Saved' : 'Failed'} • {h.textPreview}
                </div>
                <button className="btn-outline inline-flex items-center gap-1" onClick={capture}>
                  <Send className="w-3 h-3" /> Re-send
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
