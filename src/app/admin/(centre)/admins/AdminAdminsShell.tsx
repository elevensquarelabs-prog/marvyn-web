type AdminUser = {
  _id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

type FormState = {
  email: string
  name: string
  password: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  support: 'Support',
  billing_viewer: 'Billing Viewer',
}

const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-[#F8E4DA] text-[#9B482A]',
  support: 'bg-[#E6F5F1] text-[#0D8C79]',
  billing_viewer: 'bg-[#F0E5DE] text-[#7D6156]',
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('en-IN') : 'Never'
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
  return letters || 'A'
}

export function AdminAdminsShell({
  admins,
  showForm,
  form,
  error,
  saving,
  onToggleForm,
  onFormChange,
  onSubmit,
  onCancel,
  onToggleActive,
}: {
  admins: AdminUser[]
  showForm: boolean
  form: FormState
  error: string
  saving: boolean
  onToggleForm: () => void
  onFormChange: (next: FormState) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onToggleActive: (id: string, isActive: boolean) => void
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#9C7A6E]">
            Admin access
          </p>
          <div className="space-y-2">
            <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl font-semibold tracking-[-0.04em] text-[#221814] sm:text-5xl">
              Admin Users
            </h1>
            <p className="text-sm leading-6 text-[#7C6258]">
              Manage admin access and roles
            </p>
          </div>
        </div>

        <button
          onClick={onToggleForm}
          className="inline-flex w-fit items-center justify-center rounded-full bg-[linear-gradient(135deg,#9B482A_0%,#D97757_100%)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(155,72,42,0.2)] transition hover:-translate-y-0.5"
        >
          {showForm ? 'Hide Form' : 'New Admin'}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={onSubmit}
          className="mb-8 rounded-[1.75rem] border border-[#E6D8CF] bg-white/88 p-6 shadow-[0_20px_60px_rgba(73,40,28,0.08)]"
        >
          <div className="mb-6 space-y-2">
            <h2 className="text-lg font-semibold text-[#2B1C17]">Create Admin User</h2>
            <p className="text-sm text-[#7C6258]">
              Add a new internal operator with a scoped admin role.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8F6A5B]">
                Name
              </span>
              <input
                value={form.name}
                onChange={event => onFormChange({ ...form, name: event.target.value })}
                required
                className="w-full rounded-2xl border border-[#E1D1C8] bg-[#FFF8F3] px-4 py-3 text-sm text-[#2B1C17] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8F6A5B]">
                Email
              </span>
              <input
                type="email"
                value={form.email}
                onChange={event => onFormChange({ ...form, email: event.target.value })}
                required
                className="w-full rounded-2xl border border-[#E1D1C8] bg-[#FFF8F3] px-4 py-3 text-sm text-[#2B1C17] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8F6A5B]">
                Password
              </span>
              <input
                type="password"
                value={form.password}
                onChange={event => onFormChange({ ...form, password: event.target.value })}
                required
                minLength={8}
                className="w-full rounded-2xl border border-[#E1D1C8] bg-[#FFF8F3] px-4 py-3 text-sm text-[#2B1C17] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8F6A5B]">
                Role
              </span>
              <select
                value={form.role}
                onChange={event => onFormChange({ ...form, role: event.target.value })}
                className="w-full rounded-2xl border border-[#E1D1C8] bg-[#FFF8F3] px-4 py-3 text-sm text-[#2B1C17] outline-none transition focus:border-[#D97757]"
              >
                <option value="support">Support</option>
                <option value="billing_viewer">Billing Viewer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-[#F1B8AE] bg-[#FFF0ED] px-4 py-3 text-sm text-[#8F2D19]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#9B482A_0%,#D97757_100%)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:-translate-y-0.5 disabled:opacity-55"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-full border border-[#E1D1C8] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#7D6156] transition hover:border-[#D97757]/40 hover:text-[#2B1C17]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-[1.75rem] border border-[#E6D8CF] bg-white/88 shadow-[0_20px_60px_rgba(73,40,28,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-[#EEE2DA] bg-[#FCF8F4]">
              <tr>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Admin</th>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Role</th>
                <th className="px-6 py-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Last login</th>
                <th className="px-6 py-5 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C7A6E]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1E7E0]">
              {admins.map(admin => (
                <tr key={admin._id} className="transition hover:bg-[#FFF9F5]">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5E2D8] text-sm font-semibold text-[#8A4729]">
                        {initials(admin.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#2B1C17]">{admin.name}</div>
                        <div className="truncate text-xs text-[#8D7166]">{admin.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${ROLE_STYLES[admin.role] ?? 'bg-[#F0E5DE] text-[#7D6156]'}`}>
                      {ROLE_LABELS[admin.role] ?? admin.role}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-[#6F564C]">
                    {formatDate(admin.lastLoginAt)}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-end gap-4 text-xs font-semibold uppercase tracking-[0.16em]">
                      <button
                        onClick={() => onToggleActive(admin._id, admin.isActive)}
                        className={admin.isActive ? 'text-[#B3472F] transition hover:opacity-70' : 'text-[#0D8C79] transition hover:opacity-70'}
                      >
                        {admin.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
