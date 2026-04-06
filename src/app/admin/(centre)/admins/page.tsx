'use client'

import { useEffect, useState } from 'react'
import { AdminAdminsShell } from './AdminAdminsShell'

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

  return (
    <AdminAdminsShell
      admins={admins}
      showForm={showForm}
      form={form}
      error={error}
      saving={saving}
      onToggleForm={() => setShowForm(!showForm)}
      onFormChange={setForm}
      onSubmit={handleCreate}
      onCancel={() => setShowForm(false)}
      onToggleActive={toggleActive}
    />
  )
}
