import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: JSX.Element, adminOnly?: boolean }) {
  const { loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-muted">Loading…</div>
  return children
}
