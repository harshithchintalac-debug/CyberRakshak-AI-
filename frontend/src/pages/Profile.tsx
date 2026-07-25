import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const LANGUAGES = [['en', 'English'], ['hi', 'Hindi'], ['te', 'Telugu'], ['ta', 'Tamil'], ['kn', 'Kannada'], ['ml', 'Malayalam']]

export default function Profile() {
  const { user, refreshUser, logout } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [lang, setLang] = useState(user?.preferred_language || 'en')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const [curPw, setCurPw] = useState(''); const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const [deletePw, setDeletePw] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function saveProfile() {
    setMsg(''); setError('')
    try {
      await api.updateMe({ full_name: fullName, username, preferred_language: lang })
      await refreshUser()
      setMsg('Profile updated')
    } catch (e: any) { setError(e.message) }
  }

  async function changePw() {
    setPwMsg('')
    try {
      await api.changePassword({ current_password: curPw, new_password: newPw })
      setPwMsg('Password changed successfully')
      setCurPw(''); setNewPw('')
    } catch (e: any) { setPwMsg(e.message) }
  }

  async function deleteAccount() {
    try { await api.deleteAccount(deletePw); logout() } catch (e: any) { setError(e.message) }
  }

  if (!user) return null

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <div className="text-teal text-[12.5px] font-semibold uppercase tracking-wide mb-2">Account</div>
        <h1 className="font-display text-3xl font-bold mb-2">Profile</h1>
      </div>

      <div className="glass p-6 mb-6">
        <h3 className="font-display font-semibold mb-4">Profile Details</h3>
        <div className="flex flex-col gap-3">
          <input className="input-field" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" />
          <input className="input-field" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
          <input className="input-field opacity-60" value={user.email} disabled />
          <select className="input-field" value={lang} onChange={e => setLang(e.target.value)}>
            {LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
          {msg && <div className="text-safe text-[13px]">{msg}</div>}
          {error && <div className="text-danger text-[13px]">{error}</div>}
          <button onClick={saveProfile} className="btn btn-primary self-start">Save Changes</button>
        </div>
      </div>

      <div className="glass p-6 mb-6">
        <h3 className="font-display font-semibold mb-4">Change Password</h3>
        <div className="flex flex-col gap-3">
          <input className="input-field" type="password" placeholder="Current password" value={curPw} onChange={e => setCurPw(e.target.value)} />
          <input className="input-field" type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          {pwMsg && <div className="text-[13px]" style={{ color: pwMsg.includes('success') ? '#2ED47A' : '#FF4D6A' }}>{pwMsg}</div>}
          <button onClick={changePw} className="btn btn-ghost self-start">Update Password</button>
        </div>
      </div>

      <div className="glass p-6 border-danger/30">
        <h3 className="font-display font-semibold mb-2 text-danger">Delete Account</h3>
        <p className="text-[13px] text-muted mb-4">This permanently deletes your account and all associated data. This cannot be undone.</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="btn text-[13px] px-4 py-2 border border-danger text-danger">Delete My Account</button>
        ) : (
          <div className="flex flex-col gap-3">
            <input className="input-field" type="password" placeholder="Confirm your password" value={deletePw} onChange={e => setDeletePw(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={deleteAccount} className="btn text-[13px] px-4 py-2 bg-danger text-white">Confirm Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost text-[13px] px-4 py-2">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
