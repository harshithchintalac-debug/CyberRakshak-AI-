import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { api } from '../services/api'
import {
  LayoutDashboard, ScanLine, Mail, Link2, FileWarning, QrCode,
  MessageSquareWarning, ImageIcon, Video, Bot, ShieldCheck,
  Newspaper, LifeBuoy, History, ArrowRight, ShieldAlert, CheckCircle2
} from 'lucide-react'

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.dashboardSummary().then(setSummary).catch(e => setError(e.message))
    api.scanHistory(8).then(r => setHistory(r.items)).catch(() => {})
  }, [])

  const catData = summary ? Object.entries(summary.category_counts || {}).map(([k, v]) => ({ name: k, count: v })) : []

  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* SECTION 1: Welcome Header */}
      <div className="flex flex-col gap-2">
        <div className="text-teal text-[12px] font-bold uppercase tracking-widest mb-1 glow-title">Command Overview</div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal bg-clip-text text-transparent">
          Welcome back, {summary?.welcome_name || 'Agent'}
        </h1>
        <p className="text-muted text-[14px] max-w-xl">
          Your centralized cybersecurity hub. View safety metrics, run scans, and interact with threat intelligence utilities below.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
          {error}
        </div>
      )}

      {/* SECTION 2: Key Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Cyber Safety Score" value={summary?.safety_score ?? '—'} accent="teal" description="Overall protection rating" />
        <StatCard label="Total Scans Run" value={summary?.total_scans ?? '—'} accent="violet" description="Verified security checks" />
        <StatCard label="Threats Intercepted" value={summary?.threats_detected ?? '—'} accent="danger" description="Blocked malicious domains/files" />
        <StatCard label="AI Core Chats" value={summary?.total_conversations ?? '—'} accent="safe" description="Active advisor sessions" />
      </div>

      {summary?.safety_score == null && (
        <div className="glass p-6 flex items-center justify-between flex-wrap gap-4 border-l-4 border-l-teal shadow-lg">
          <div>
            <h4 className="font-semibold text-[15px] text-white mb-1">Protection Assessment Required</h4>
            <p className="text-[13px] text-muted">Complete your first safety score query to identify latent digital vulnerabilities.</p>
          </div>
          <Link to="/safety-score" className="btn btn-primary text-[13px] px-5 py-2.5 flex items-center gap-2">
            Get Score <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* SECTION 3: Quick Scan Launchpad */}
      <div className="flex flex-col gap-6">
        <div className="border-b border-white/5 pb-2">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider glow-title-violet">Security Scanners</h2>
          <p className="text-muted text-[12.5px]">Analyze digital entry points for scam indicators or indicators of compromise.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <LaunchCard
            to="/scanner"
            title="Unified Scanner"
            description="Enter URLs, emails, or messages in a single input box to run instant heuristic checks."
            icon={ScanLine}
            accent="teal"
          />
          <LaunchCard
            to="/scanner/email"
            title="Phishing Detector"
            description="Paste suspect email headers or content to identify brand impersonation and spoofing."
            icon={Mail}
            accent="violet"
          />
          <LaunchCard
            to="/scanner/url"
            title="URL Scan Engine"
            description="Scan suspicious links against rule lists and the VirusTotal reputation scanner."
            icon={Link2}
            accent="teal"
          />
          <LaunchCard
            to="/scanner/file"
            title="Sandbox File Analyzer"
            description="Upload binary executables to check hash reputation and emulate low-level system call traces."
            icon={FileWarning}
            accent="danger"
          />
          <LaunchCard
            to="/scanner/qr"
            title="QR Code Scan"
            description="Extract and evaluate QR code redirect links to prevent physical phishing vectors."
            icon={QrCode}
            accent="violet"
          />
          <LaunchCard
            to="/scanner/message"
            title="Scam SMS Detector"
            description="Audit WhatsApp or SMS text logs against common urgency tactics and bait phrases."
            icon={MessageSquareWarning}
            accent="danger"
          />
        </div>
      </div>

      {/* SECTION 4: AI Media Forensics & Support */}
      <div className="flex flex-col gap-6">
        <div className="border-b border-white/5 pb-2">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider glow-title-safe">AI Forensics & Advisors</h2>
          <p className="text-muted text-[12.5px]">Use neural classification models to evaluate synthetic media and chat with security cores.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <LaunchCard
            to="/ai-image"
            title="AI Image Classifier"
            description="Submit screenshots or photos to classify artificial vs. authentic media using neural detectors."
            icon={ImageIcon}
            accent="safe"
          />
          <LaunchCard
            to="/ai-video"
            title="AI Video Forensics"
            description="Upload videos to analyze frame consistency and check for deepfake synthetic manipulations."
            icon={Video}
            accent="violet"
          />
          <LaunchCard
            to="/assistant"
            title="CyberAssistant Chat"
            description="Ask our localized multilingual AI model questions regarding scams, hacks, or safety guidelines."
            icon={Bot}
            accent="teal"
          />
        </div>
      </div>

      {/* SECTION 5: Detailed Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6 flex flex-col h-[340px]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display font-semibold text-[14.5px] text-white">Recent Activity Log</h4>
            <Link to="/history" className="text-[12px] text-teal hover:underline flex items-center gap-1">
              Full Logs <History size={12} />
            </Link>
          </div>
          {history.length === 0 ? (
            <div className="text-muted text-[13px] my-auto text-center">No scans yet. <Link to="/scanner" className="text-teal underline">Run one now →</Link></div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col divide-y divide-border1">
              {history.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-3 text-[13px]">
                  <div className="truncate max-w-[70%]">
                    <div className="font-semibold text-white truncate">{s.label}</div>
                    <div className="text-muted/70 text-[11.5px] font-mono truncate">{s.target}</div>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                    style={{ background: riskBg(s.risk), color: riskColor(s.risk) }}>{s.risk}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass p-6 h-[340px] flex flex-col">
          <h4 className="font-display font-semibold text-[14.5px] text-white mb-4">Scan Category Breakdown</h4>
          {catData.length > 0 ? (
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#8B93A7', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8B93A7', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#131A2B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#00D9C0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-muted text-[13px] my-auto text-center">No category metrics logged yet.</div>}
        </div>
      </div>

      {/* SECTION 6: Threat Intel & Assistance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6 border border-white/5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Newspaper size={18} className="text-teal" />
            <h4 className="font-semibold text-[15px] text-white">Cyber Threat Feed</h4>
          </div>
          <div className="flex flex-col gap-3">
            <ThreatItem title="Level3Blue Flags New Cloudflare Phishing Tunnel Campaign" time="3 hours ago" severity="High" />
            <ThreatItem title="Undetected APK Dropper Targeting Mobile Banking Portals" time="Yesterday" severity="Critical" />
            <ThreatItem title="OTP Scam Wave Impersonating National Post Logistics" time="2 days ago" severity="Medium" />
          </div>
          <Link to="/news" className="text-[12px] text-teal hover:underline mt-2 inline-flex items-center gap-1 font-semibold">
            Read Threat News <ArrowRight size={12} />
          </Link>
        </div>

        <div className="glass p-6 border border-white/5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <LifeBuoy size={18} className="text-violet" />
            <h4 className="font-semibold text-[15px] text-white">Emergency Response Help</h4>
          </div>
          <p className="text-[13px] text-muted leading-relaxed">
            If you have been scammed, lost access to your accounts, shared a passcode/OTP, or suspect a banking fraud:
          </p>
          <div className="flex flex-col gap-2 text-[12.5px] text-white">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-teal flex-shrink-0" />
              <span>Call Cyber Crime Helpline (National Portal)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-teal flex-shrink-0" />
              <span>Freeze cards and verify transactions with your bank portal</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-teal flex-shrink-0" />
              <span>Follow incident recovery blueprints immediately</span>
            </div>
          </div>
          <Link to="/incident-response" className="btn btn-ghost text-[12.5px] py-2.5 mt-2 justify-center">
            View Emergency Blueprints
          </Link>
        </div>
      </div>
    </div>
  )
}

function riskColor(r: string) { return ({ safe: '#2ED47A', low: '#2ED47A', medium: '#FFB020', high: '#FF4D6A', critical: '#FF2748' } as any)[r] || '#8B93A7' }
function riskBg(r: string) { return riskColor(r) + '22' }

function StatCard({ label, value, accent, description }: { label: string, value: any, accent: string, description: string }) {
  const colors: any = { teal: '#00D9C0', violet: '#7C6CF0', danger: '#FF4D6A', safe: '#2ED47A' }
  return (
    <div className="glass p-6 text-center border-t-2" style={{ borderTopColor: colors[accent] }}>
      <div className="font-display font-extrabold text-3xl mb-1.5" style={{ color: colors[accent] }}>{value}</div>
      <div className="text-[13px] font-semibold text-white mb-0.5">{label}</div>
      <div className="text-[11px] text-muted">{description}</div>
    </div>
  )
}

function LaunchCard({ to, title, description, icon: Icon, accent }: { to: string, title: string, description: string, icon: any, accent: string }) {
  const accentColors: any = {
    teal: 'text-teal hover:border-teal/30 hover:shadow-[0_0_20px_rgba(0,217,192,0.08)]',
    violet: 'text-violet hover:border-violet/30 hover:shadow-[0_0_20px_rgba(124,108,240,0.08)]',
    danger: 'text-danger hover:border-danger/30 hover:shadow-[0_0_20px_rgba(255,77,106,0.08)]',
    safe: 'text-safe hover:border-safe/30 hover:shadow-[0_0_20px_rgba(46,212,122,0.08)]'
  }
  return (
    <Link to={to} className={`glass p-5 flex flex-col gap-3 group border border-white/5 transition-all duration-300 hover:-translate-y-1 ${accentColors[accent]}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
          <Icon size={18} />
        </div>
        <h3 className="font-display font-bold text-[14px] text-white group-hover:text-teal transition-colors">{title}</h3>
      </div>
      <p className="text-[12px] text-muted leading-relaxed flex-1">{description}</p>
      <div className="text-[11.5px] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform self-start mt-1">
        Launch Engine <ArrowRight size={12} />
      </div>
    </Link>
  )
}

function ThreatItem({ title, time, severity }: { title: string, time: string, severity: 'Medium' | 'High' | 'Critical' }) {
  const sevColors: any = { Medium: 'bg-warning/15 text-warning', High: 'bg-danger/15 text-danger', Critical: 'bg-danger/25 text-danger font-bold border border-danger/20' }
  return (
    <div className="flex items-start justify-between gap-3 text-[12.5px] py-1">
      <div>
        <div className="text-white font-medium hover:text-teal cursor-pointer transition-colors leading-snug">{title}</div>
        <div className="text-muted/60 text-[11px] mt-0.5">{time}</div>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full ${sevColors[severity]}`}>{severity}</span>
    </div>
  )
}
