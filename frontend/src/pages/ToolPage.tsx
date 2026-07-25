import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Link2, Mail, MessageSquareWarning, Lock, ShieldQuestion, FileWarning, QrCode, Upload } from 'lucide-react'
import { api } from '../services/api'
import RiskCard from '../components/RiskCard'

const CONFIG: Record<string, any> = {
  url: { title: 'Malicious URL Detector', icon: Link2, desc: 'Paste any link to check for phishing, malware, and impersonation.' },
  email: { title: 'AI Phishing Email Detector', icon: Mail, desc: 'Paste email content to spot credential theft and spoofing.' },
  message: { title: 'SMS / WhatsApp Scam Detector', icon: MessageSquareWarning, desc: 'Check suspicious texts for banking, OTP, and lottery scams.' },
  password: { title: 'Password Security Checker', icon: Lock, desc: 'See how strong your password really is — nothing is stored.' },
  breach: { title: 'Data Breach Checker', icon: ShieldQuestion, desc: 'Check if your email has appeared in known breaches.' },
  file: { title: 'Malware File Analyzer', icon: FileWarning, desc: 'Upload a file for a heuristic safety pre-check.' },
  qr: { title: 'QR Code Scam Detector', icon: QrCode, desc: 'Upload a QR image to see where it really leads.' },
}

export default function ToolPage() {
  const { tool = 'url' } = useParams()
  const cfg = CONFIG[tool] || CONFIG.url
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  // form state
  const [url, setUrl] = useState('')
  const [emailBody, setEmailBody] = useState(''); const [sender, setSender] = useState(''); const [subject, setSubject] = useState('')
  const [msg, setMsg] = useState('')
  const [pw, setPw] = useState(''); const [pwLive, setPwLive] = useState(0)
  const [breachEmail, setBreachEmail] = useState('')

  async function run(fn: () => Promise<any>) {
    setScanning(true); setError(''); setResult(null)
    try { setResult(await fn()) } catch (e: any) { setError(e.message) } finally { setScanning(false) }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    run(() => tool === 'qr' ? api.scanQr(file) : api.scanFile(file))
  }

  function onPwChange(v: string) {
    setPw(v)
    let s = 0
    if (v.length >= 12) s += 30; else if (v.length >= 8) s += 15
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s += 20
    if (/\d/.test(v)) s += 20
    if (/[^a-zA-Z0-9]/.test(v)) s += 20
    setPwLive(Math.max(0, Math.min(100, s)))
  }

  return (
    <div>
      <div className="mb-8">
        <div className="text-teal text-[12.5px] font-semibold uppercase tracking-wide mb-2">Security Tools</div>
        <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
          <cfg.icon size={26} className="text-teal" /> {cfg.title}
        </h1>
        <p className="text-muted text-[14px]">{cfg.desc}</p>
      </div>

      <div className="glass p-6 max-w-2xl mb-8">
        {tool === 'url' && (
          <>
            <input className="input-field mb-4" placeholder="https://example.com/login" value={url} onChange={e => setUrl(e.target.value)} />
            <button className="btn btn-primary" disabled={!url || scanning} onClick={() => run(() => api.scanUrl(url))}>{scanning ? 'Scanning…' : 'Scan URL'}</button>
          </>
        )}
        {tool === 'email' && (
          <>
            <input className="input-field mb-3" placeholder="Sender email address" value={sender} onChange={e => setSender(e.target.value)} />
            <input className="input-field mb-3" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
            <textarea className="input-field min-h-[110px] mb-4" placeholder="Paste the full email text here..." value={emailBody} onChange={e => setEmailBody(e.target.value)} />
            <button className="btn btn-primary" disabled={!emailBody || scanning} onClick={() => run(() => api.scanEmail(emailBody, sender, subject))}>{scanning ? 'Analyzing…' : 'Analyze Email'}</button>
          </>
        )}
        {tool === 'message' && (
          <>
            <textarea className="input-field min-h-[110px] mb-4" placeholder="Paste the SMS or WhatsApp message here..." value={msg} onChange={e => setMsg(e.target.value)} />
            <button className="btn btn-primary" disabled={!msg || scanning} onClick={() => run(() => api.scanMessage(msg))}>{scanning ? 'Analyzing…' : 'Analyze Message'}</button>
          </>
        )}
        {tool === 'password' && (
          <>
            <input className="input-field mb-2" type="password" placeholder="Type a password to test" value={pw} onChange={e => onPwChange(e.target.value)} />
            <div className="h-1.5 rounded-full bg-white/10 mb-4 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pwLive}%`, background: pwLive < 40 ? '#FF4D6A' : pwLive < 70 ? '#FFB020' : '#2ED47A' }} />
            </div>
            <button className="btn btn-primary" disabled={!pw || scanning} onClick={() => run(() => api.scanPassword(pw))}>{scanning ? 'Checking…' : 'Check Strength'}</button>
          </>
        )}
        {tool === 'breach' && (
          <>
            <input className="input-field mb-4" placeholder="you@example.com" value={breachEmail} onChange={e => setBreachEmail(e.target.value)} />
            <button className="btn btn-primary" disabled={!breachEmail || scanning} onClick={() => run(() => api.scanBreach(breachEmail))}>{scanning ? 'Checking…' : 'Check for Breaches'}</button>
          </>
        )}
        {(tool === 'file' || tool === 'qr') && (
          <label className="border-2 border-dashed border-white/15 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-teal transition-colors">
            <Upload size={24} className="text-muted mb-2" />
            <div className="text-[13.5px] font-semibold">{tool === 'qr' ? 'Upload QR code image' : 'Upload a file to analyze'}</div>
            <div className="text-[11.5px] text-muted mt-1">{tool === 'qr' ? 'PNG, JPG up to 5MB' : 'Never upload highly sensitive files'}</div>
            <input type="file" className="hidden" onChange={handleFile} />
          </label>
        )}
      </div>

      {error && <div className="text-danger text-sm mb-6 max-w-2xl">{error}</div>}
      {result && <RiskCard result={result} />}
    </div>
  )
}
