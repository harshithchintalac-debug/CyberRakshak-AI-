import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import UnifiedScanner from './pages/UnifiedScanner'
import ToolPage from './pages/ToolPage'
import AIAssistant from './pages/AIAssistant'
import AIImageAnalyzer from './pages/AIImageAnalyzer'
import AIVideoAnalyzer from './pages/AIVideoAnalyzer'
import ScanHistory from './pages/ScanHistory'
import SafetyScore from './pages/SafetyScore'
import News from './pages/News'
import IncidentResponse from './pages/IncidentResponse'
import Profile from './pages/Profile'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/register" element={<Navigate to="/dashboard" replace />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scanner" element={<UnifiedScanner />} />
        <Route path="/scanner/:tool" element={<ToolPage />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/ai-image" element={<AIImageAnalyzer />} />
        <Route path="/ai-video" element={<AIVideoAnalyzer />} />
        <Route path="/history" element={<ScanHistory />} />
        <Route path="/safety-score" element={<SafetyScore />} />
        <Route path="/news" element={<News />} />
        <Route path="/incident-response" element={<IncidentResponse />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
