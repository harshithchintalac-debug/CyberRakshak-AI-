import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud, Link as LinkIcon, Search, RefreshCw, FileWarning, Mail,
  MessageSquareWarning, QrCode, Lock, ShieldQuestion, Loader2
} from 'lucide-react'
import { api } from '../services/api'
import RiskCard from '../components/RiskCard'

const TOOLS = [
  { to: '/scanner/url', title: 'Malicious URL Detector', icon: LinkIcon, desc: 'Check any link for phishing, malware, and impersonation.' },
  { to: '/scanner/email', title: 'AI Phishing Email Detector', icon: Mail, desc: 'Paste email content to spot credential theft and spoofing.' },
  { to: '/scanner/message', title: 'SMS / WhatsApp Scam Detector', icon: MessageSquareWarning, desc: 'Check texts for banking, OTP, and lottery scams.' },
  { to: '/scanner/qr', title: 'QR Code Scam Detector', icon: QrCode, desc: 'Upload a QR image to see where it really leads.' },
  { to: '/scanner/file', title: 'Malware File Analyzer', icon: FileWarning, desc: 'Upload a file for a heuristic safety pre-check.' },
  { to: '/scanner/password', title: 'Password Security Checker', icon: Lock, desc: 'See how strong your password really is.' },
  { to: '/scanner/breach', title: 'Data Breach Checker', icon: ShieldQuestion, desc: 'Check if your email appeared in known breaches.' },
]

export default function UnifiedScanner() {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'search'>('file')
  const [urlInput, setUrlInput] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [result, setResult] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUrlScan(e: React.FormEvent) {
    e.preventDefault()
    if (!urlInput.trim() || scanning) return
    setScanning(true); setError(''); setResult(null)
    try {
      const r = await api.scanUnified(urlInput)
      setResult(r)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchInput.trim() || scanning) return
    setScanning(true); setError(''); setResult(null)
    try {
      const r = await api.scanUnified(searchInput)
      setResult(r)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  async function processFile(file: File) {
    setScanning(true); setError(''); setResult(null)
    try {
      const isImg = file.type.startsWith('image/')
      const r = isImg ? await api.scanQr(file) : await api.scanFile(file)
      setResult(r)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="flex flex-col items-center justify-center gap-10 py-6 max-w-4xl mx-auto">
      {/* Title Header */}
      <div className="text-center flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal bg-clip-text text-transparent glow-title">
          CyberRakshak Unified Scanner
        </h1>
        <p className="text-muted text-[14.5px] max-w-lg mx-auto leading-relaxed">
          Analyze files, URLs, domains, and suspicious texts against local emulators, heuristics, and VirusTotal reputation databases.
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center border-b border-white/5 w-full max-w-xl justify-center gap-12 text-[14.5px] font-bold">
        <button
          onClick={() => { setActiveTab('file'); setResult(null); setError('') }}
          className={`pb-4 px-2 flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'file' ? 'border-teal text-teal' : 'border-transparent text-muted hover:text-white'
          }`}
        >
          <UploadCloud size={16} /> FILE
        </button>
        <button
          onClick={() => { setActiveTab('url'); setResult(null); setError('') }}
          className={`pb-4 px-2 flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'url' ? 'border-teal text-teal' : 'border-transparent text-muted hover:text-white'
          }`}
        >
          <LinkIcon size={16} /> URL
        </button>
        <button
          onClick={() => { setActiveTab('search'); setResult(null); setError('') }}
          className={`pb-4 px-2 flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'search' ? 'border-teal text-teal' : 'border-transparent text-muted hover:text-white'
          }`}
        >
          <Search size={16} /> SEARCH
        </button>
      </div>

      {/* Tab Contents Frame */}
      <div className="w-full max-w-2xl min-h-[220px]">
        {scanning ? (
          <div className="glass p-12 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="animate-spin text-teal" size={32} />
            <div>
              <div className="font-semibold text-white text-[15px] mb-1">Analyzing content...</div>
              <div className="text-muted text-[12.5px]">Running heuristics, file parsing, sandbox checks, and VirusTotal APIs</div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'file' && (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`glass p-10 flex flex-col items-center justify-center gap-4 text-center border-2 border-dashed transition-all cursor-pointer ${
                  isDragOver ? 'border-teal bg-teal/5' : 'border-white/10 hover:border-teal/30 hover:bg-white/[0.01]'
                }`}
              >
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
                <UploadCloud size={48} className="text-muted/60 group-hover:text-teal transition-colors" />
                <div>
                  <button className="btn btn-primary text-[13px] px-5 py-2.5 mb-2 font-semibold">Choose file</button>
                  <p className="text-muted text-[13px]">Drag and drop file here, or scan screenshots / QR codes</p>
                </div>
              </div>
            )}

            {activeTab === 'url' && (
              <form onSubmit={handleUrlScan} className="glass p-8 flex flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <LinkIcon size={18} />
                  </div>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    className="input-field pl-10 pr-4 py-3.5 !rounded-xl text-[14.5px]"
                    placeholder="Search or scan a URL link..."
                    autoFocus
                  />
                </div>
                <div className="flex justify-between items-center text-[12.5px] text-muted px-1 mt-1">
                  <span>Enter a link address to audit brand spoofing and reputation.</span>
                  <button type="submit" disabled={!urlInput.trim()} className="btn btn-primary !py-2 !px-4 text-[13px] disabled:opacity-40">
                    Scan URL
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'search' && (
              <form onSubmit={handleSearch} className="glass p-8 flex flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    className="input-field pl-10 pr-4 py-3.5 !rounded-xl text-[14.5px]"
                    placeholder="Search for an IP address, domain, file hash, or text..."
                    autoFocus
                  />
                </div>
                <div className="flex justify-between items-center text-[12.5px] text-muted px-1 mt-1">
                  <span>Queries the security analyzer for threat records or indicators.</span>
                  <button type="submit" disabled={!searchInput.trim()} className="btn btn-primary !py-2 !px-4 text-[13px] disabled:opacity-40">
                    Search
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* Error & Results Display */}
      {error && (
        <div className="w-full max-w-2xl p-4 rounded-xl bg-danger/10 border border-danger/25 text-danger text-sm">
          {error}
        </div>
      )}
      
      {result && (
        <div className="w-full max-w-2xl fade-in">
          <RiskCard result={result} />
        </div>
      )}

      {/* Tool Grid Session */}
      <div className="w-full mt-10">
        <h2 className="font-display text-lg font-bold text-white mb-6 uppercase tracking-wider glow-title-safe self-start">
          Or audit specific threat vectors
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOLS.map(t => (
            <Link key={t.to} to={t.to} className="glass p-5 hover:border-teal/30 hover:-translate-y-1 transition-all duration-300 block">
              <div className="w-10 h-10 rounded-xl bg-teal/10 text-teal flex items-center justify-center mb-3">
                <t.icon size={18} />
              </div>
              <div className="font-bold text-[14.5px] text-white mb-1.5">{t.title}</div>
              <div className="text-[12.5px] text-muted leading-relaxed">{t.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
