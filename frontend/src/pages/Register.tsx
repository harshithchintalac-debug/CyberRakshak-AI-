import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldAlert, Eye, EyeOff, ShieldCheck, Users, Lock, Play, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LANGUAGES = [
  ['en', 'English'], ['hi', 'Hindi'], ['te', 'Telugu'], ['ta', 'Tamil'], ['kn', 'Kannada'],
  ['ml', 'Malayalam'], ['mr', 'Marathi'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['pa', 'Punjabi'],
  ['or', 'Odia'], ['ur', 'Urdu'],
]

function pwScore(pw: string) {
  let s = 0
  if (pw.length >= 12) s += 30; else if (pw.length >= 8) s += 15
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 20
  if (/\d/.test(pw)) s += 20
  if (/[^a-zA-Z0-9]/.test(pw)) s += 20
  if (/(.)\1{2,}/.test(pw)) s -= 15
  return Math.max(0, Math.min(100, s))
}

export default function Register() {
  const [form, setForm] = useState({ full_name: '', username: '', email: '', password: '', confirm: '', preferred_language: 'en', accept_terms: false })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const score = pwScore(form.password)
  const scoreColor = score < 40 ? '#FF4D6A' : score < 70 ? '#FFB020' : '#2ED47A'

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!form.accept_terms) { setError('Please accept the Terms and Conditions'); return }
    setLoading(true)
    try {
      const { confirm, ...payload } = form
      await register(payload)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] bg-[#05060b]">
      {/* Column 1: Cyberpunk Landing Screen (Hidden on small viewports) */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#0c1122] to-[#05060b] p-10 select-none border-r border-white/5">
        {/* Glowing Background Radial Shadows */}
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0,217,192,0.15), transparent 50%), radial-gradient(circle at 20% 80%, rgba(124,108,240,0.12), transparent 45%)' }} />

        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center gap-3 self-start">
          <span className="font-display font-extrabold text-[15px] text-white">CyberRakshak <span className="text-teal">AI</span></span>
        </div>

        {/* Center Canvas Area with large background text & SVG Robot */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center py-6 w-full">
          {/* Layered Big Background Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
            <div className="text-[7.5vw] font-display font-extrabold uppercase tracking-widest text-white/[0.03] leading-none">
              CYBER
            </div>
            <div className="text-[7.5vw] font-display font-extrabold uppercase tracking-widest leading-none mt-1"
                 style={{ WebkitTextStroke: '1px rgba(255, 255, 255, 0.05)', color: 'transparent' }}>
              RAKSHAK AI
            </div>
          </div>

          {/* Glowing Cyberpunk SVG Robot Avatar */}
          <div className="relative z-10 flex flex-col items-center gap-6 mt-4">
            <div className="relative animate-float-robot">
              <svg width="220" height="220" viewBox="0 0 100 100" fill="none" className="drop-shadow-[0_0_25px_rgba(0,217,192,0.25)]">
                {/* Outer Circular Particle Rings */}
                <circle cx="50" cy="50" r="45" stroke="rgba(0, 217, 192, 0.15)" strokeWidth="0.5" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="48" stroke="rgba(124, 108, 240, 0.1)" strokeWidth="0.5" strokeDasharray="6 2" className="animate-spin" style={{ animationDuration: '20s' }} />

                {/* Cybernetic Helmet / Headset Body */}
                <path d="M25,50 C25,28 35,22 50,22 C65,22 75,28 75,50 C75,53 76,57 73,62 C70,67 67,69 66,74 C65,77 59,81 50,81 C41,81 35,77 34,74 C33,69 30,67 27,62 C24,57 25,53 25,50 Z" fill="#0b0e17" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
                
                {/* Glowing Blue Neon Face Shield Profile */}
                <path d="M30,48 C30,32 37,27 50,27 C63,27 70,32 70,48 C70,55 68,60 66,63 C63,67 59,69 50,69 C41,69 37,67 34,63 C32,60 30,55 30,48 Z" fill="#080a10" stroke="#00D9C0" strokeWidth="1.5" className="animate-pulse" style={{ animationDuration: '3s' }} />
                
                {/* Neon Orange Collar Highlight */}
                <path d="M36,78 C42,83 46,84 50,84 C54,84 58,83 64,78" stroke="#7C6CF0" strokeWidth="1.5" strokeLinecap="round" />

                {/* Glowing Horizontal Visor / Neon Blue Eyes */}
                <rect x="36" y="44" width="28" height="3" rx="1.5" fill="#00D9C0" className="animate-pulse" style={{ animationDuration: '1.5s' }} />
                <rect x="42" y="49" width="16" height="1.5" rx="0.75" fill="#7C6CF0" />
                
                {/* Headset Earcups (Orange glows) */}
                <rect x="21" y="42" width="4" height="14" rx="2" fill="#7C6CF0" stroke="#00D9C0" strokeWidth="0.5" />
                <rect x="75" y="42" width="4" height="14" rx="2" fill="#7C6CF0" stroke="#00D9C0" strokeWidth="0.5" />
              </svg>
            </div>

            {/* Pulsing Action pill */}
            <button className="btn text-[12px] px-5 py-2 rounded-full border border-teal/20 bg-teal/10 text-teal hover:bg-teal/20 transition-all font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,217,192,0.15)] mt-2">
              GET PROTECTED NOW <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Bottom Widgets Row */}
        <div className="relative z-10 flex items-end justify-between w-full mt-auto">
          {/* Left stats list */}
          <div className="flex flex-col gap-4 max-w-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-teal">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-white leading-none">Enterprise Security</h4>
                <p className="text-[11px] text-muted mt-1">Core protection standards</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-violet">
                <Users size={18} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-white leading-none">Trusted Globally</h4>
                <p className="text-[11px] text-muted mt-1">1000+ protected endpoints</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-safe">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="text-[13.5px] font-bold text-white leading-none">24/7 AI Shield</h4>
                <p className="text-[11px] text-muted mt-1">Constant heuristic audits</p>
              </div>
            </div>
          </div>

          {/* Right Multimedia Widget card */}
          <div className="w-52 glass p-3.5 flex flex-col gap-3 border border-white/5 hover:border-teal/30 transition-all duration-300 rounded-2xl">
            <div className="text-[11.5px] font-semibold text-white leading-tight">
              Protect What Matters Most — Your Digital World
            </div>
            {/* Simulated Live Camera Player box */}
            <div className="h-28 rounded-xl bg-[#080b12] border border-white/5 relative overflow-hidden flex items-center justify-center group cursor-pointer">
              {/* keygrid backdrop details */}
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#00d9c0_1px,transparent_1px)] [background-size:10px_10px]" />
              <div className="absolute w-8 h-8 rounded-full bg-teal/20 flex items-center justify-center text-teal group-hover:scale-110 transition-transform shadow-md z-10">
                <Play size={14} fill="#00D9C0" />
              </div>
              <div className="absolute bottom-2 left-2 text-[9px] text-teal font-mono bg-black/60 px-1.5 py-0.5 rounded border border-teal/10">
                CAM_01 // LIVE
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Column 2: Sign-up Card Section */}
      <div className="flex items-center justify-center p-6 relative overflow-hidden my-6">
        {/* Glow ambient background detail for mobile */}
        <div className="absolute inset-0 opacity-20 pointer-events-none lg:hidden" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0,217,192,0.1), transparent 60%)' }} />

        <div className="glass w-full max-w-md p-8 border border-white/5 relative z-10">
          <h2 className="font-display text-xl font-bold mb-1 text-white">Create your account</h2>
          <p className="text-muted text-[13px] mb-6">No technical skills required — just sign up and stay protected.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input className="input-field" placeholder="Full Name" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
            <input className="input-field" placeholder="Username" value={form.username} onChange={e => set('username', e.target.value.replace(/\s/g, ''))} required />
            <input className="input-field" type="email" placeholder="Email Address" value={form.email} onChange={e => set('email', e.target.value)} required />

            <div>
              <div className="relative">
                <input className="input-field pr-10" type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={e => set('password', e.target.value)} required />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password && (
                <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor }} />
                </div>
              )}
            </div>
            <input className="input-field" type={showPw ? 'text' : 'password'} placeholder="Confirm Password" value={form.confirm} onChange={e => set('confirm', e.target.value)} required />

            <select className="input-field" value={form.preferred_language} onChange={e => set('preferred_language', e.target.value)}>
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>

            <label className="flex items-start gap-2 text-[12.5px] text-muted">
              <input type="checkbox" checked={form.accept_terms} onChange={e => set('accept_terms', e.target.checked)} className="mt-0.5 text-teal" />
              I accept the Terms and Conditions and Privacy Policy
            </label>

            {error && <div className="text-danger text-[13px]">{error}</div>}
            <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Creating account…' : 'Create Account'}</button>
          </form>
          <p className="text-center text-[13px] text-muted mt-6">Already have an account? <Link to="/login" className="text-teal font-medium">Log in</Link></p>
        </div>
      </div>
    </div>
  )
}
