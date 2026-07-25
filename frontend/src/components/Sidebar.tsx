import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ScanLine, Mail, Link2, FileWarning, QrCode,
  MessageSquareWarning, ImageIcon, Video, Bot, ShieldCheck,
  Newspaper, LifeBuoy, User, LogOut, ShieldAlert
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/scanner', label: 'Unified Scanner', icon: ScanLine },
  { to: '/scanner/email', label: 'Phishing Detector', icon: Mail },
  { to: '/scanner/url', label: 'URL Scanner', icon: Link2 },
  { to: '/scanner/file', label: 'File Analyzer', icon: FileWarning },
  { to: '/scanner/qr', label: 'QR Scanner', icon: QrCode },
  { to: '/scanner/message', label: 'Scam Detector', icon: MessageSquareWarning },
  { to: '/ai-image', label: 'AI Image', icon: ImageIcon },
  { to: '/ai-video', label: 'AI Video', icon: Video },
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/safety-score', label: 'Safety Score', icon: ShieldCheck },
  { to: '/news', label: 'Threat News', icon: Newspaper },
  { to: '/incident-response', label: 'Emergency Help', icon: LifeBuoy },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  // Get user avatar initials
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'

  return (
    <header className="glass sticky top-0 left-0 right-0 z-50 w-full px-6 py-3 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-opacity-70">
      {/* Left Brand Identity */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* User Profile Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-teal to-violet flex items-center justify-center font-bold text-white text-[12px] border border-white/10 shadow-sm flex-shrink-0">
          {user?.profile_picture || user?.avatar_url ? (
            <img src={user.profile_picture || user.avatar_url || ''} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Brand Text */}
        <span className="font-display font-bold text-[15px] text-white whitespace-nowrap">
          CyberRakshak <span className="text-teal">AI</span>
        </span>
      </div>

      {/* Center Navigation Links */}
      <nav className="flex-1 flex items-center gap-2 overflow-x-auto mx-6 px-2 scrollbar-none">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl border transition-all duration-200 flex-shrink-0 ${
                isActive
                  ? 'bg-teal/10 text-teal border-teal/20 shadow-[0_0_15px_rgba(0,217,192,0.08)]'
                  : 'text-muted border-transparent hover:text-white hover:bg-white/5'
              }`
            }
            title={item.label}
          >
            <item.icon size={19} />
            <span className="text-[10px] font-bold tracking-wide uppercase">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Right Account details */}
      <div className="flex items-center gap-4 flex-shrink-0 border-l border-white/5 pl-4">
        {user && (
          <div className="flex flex-col text-right">
            <span className="text-[12.5px] font-bold text-white leading-none">{user.full_name}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-[11px] text-muted hover:text-danger transition-colors font-medium mt-1 self-end"
            >
              <LogOut size={12} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
