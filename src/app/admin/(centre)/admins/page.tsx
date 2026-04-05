'use client'

import { useEffect, useState } from 'react'

interface AdminUser {
  _id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'support' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/admins')
    if (res.ok) {
      const data = await res.json()
      setAdmins(data.admins ?? [])
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return }
    setShowForm(false)
    setForm({ email: '', name: '', password: '', role: 'support' })
    await load()
    setSaving(false)
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isActive ? 'deactivate' : 'activate' }),
    })
    await load()
  }

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    support: 'Support',
    billing_viewer: 'Billing Viewer',
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Admin Users</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage admin access and roles</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Admin
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Create Admin User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required minLength={8}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="support">Support</option>
                <option value="billing_viewer">Billing Viewer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-zinc-400 hover:text-white text-sm px-4 py-2 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Admin</th>
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Last Login</th>
              <th className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {admins.map(a => (
              <tr key={a._id} className="hover:bg-zinc-800/30">
                <td className="px-5 py-3">
                  <div className="text-white font-medium">{a.name}</div>
                  <div className="text-zinc-500 text-xs">{a.email}</div>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs bg-violet-950/40 text-violet-400 px-2 py-0.5 rounded-full">
                    {ROLE_LABELS[a.role] ?? a.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500 text-xs">
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggleActive(a._id, a.isActive)}
                    className={`text-xs transition-colors ${a.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                  >
                    {a.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
