import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin, TableSkeletonRows, EmptyTableRow } from '../components/AdminUi.jsx'
import { ADMIN_ROLE_BADGE, ADMIN_ROLE_BADGE_FALLBACK } from '../utils/roleBadges.js'

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'U'
  return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
}

export default function UsersPage() {
  const { showToast } = useToast()
  const { can, user: adminUser } = useAdminApiAuth()
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [qSearch, setQSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [creating, setCreating] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' })
  const [resetting, setResetting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [actionOpenId, setActionOpenId] = useState(null)
  const [roles, setRoles] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    is_active: true,
    role_ids: [],
  })
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    is_active: true,
    role_ids: [],
  })

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), per_page: '30' })
      if (qSearch.trim()) q.set('search', qSearch.trim())
      if (statusFilter !== 'all') q.set('is_active', statusFilter === 'active' ? 'true' : 'false')
      if (roleFilter) q.set('role_slug', roleFilter)
      const res = await api(`/users?${q.toString()}`)
      setData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const id = setTimeout(() => setQSearch(search), 250)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    load(1)
  }, [qSearch, statusFilter, roleFilter])

  useEffect(() => {
    if (!can('users.manage')) return
    ;(async () => {
      try {
        const res = await api('/roles')
        setRoles(res.data || [])
      } catch {
        setRoles([])
      }
    })()
  }, [can])

  const rows = data?.data || []
  const canResetPasswords = can('roles.manage') || can('users.manage')
  const canDeleteUsers = can('users.manage')
  const roleOptions = useMemo(() => roles.map((r) => ({ id: r.id, slug: r.slug, name: r.name })), [roles])

  const toggleRole = (roleId, setFn = setForm) => {
    setFn((prev) => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId) ? prev.role_ids.filter((id) => id !== roleId) : [...prev.role_ids, roleId],
    }))
  }

  const confirmDelete = async (u) => {
    if (!canDeleteUsers || !u?.id) return
    if (adminUser?.id != null && Number(u.id) === Number(adminUser.id)) {
      showToast('You cannot delete your own account.', 'error')
      return
    }
    if (!window.confirm(`Permanently delete ${u.name} (${u.email})? This cannot be undone.`)) return
    setDeletingId(u.id)
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' })
      showToast('User account deleted.', 'success')
      load(data?.current_page || 1)
    } catch (err) {
      showToast(err.message || 'Failed to delete user.', 'error')
    } finally {
      setDeletingId(null)
      setActionOpenId(null)
    }
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim()) {
      showToast('Name, username, email, and password are required.', 'error')
      return
    }
    setCreating(true)
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || null,
          is_active: form.is_active,
          role_ids: form.role_ids,
        }),
      })
      showToast('User created successfully.', 'success')
      setShowCreate(false)
      setForm({ name: '', username: '', email: '', password: '', phone: '', is_active: true, role_ids: [] })
      load(1)
    } catch (e2) {
      showToast(e2.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const openResetModal = (user) => {
    setResetTarget(user)
    setResetForm({ password: '', confirmPassword: '' })
    setActionOpenId(null)
  }

  const submitResetPassword = async (e) => {
    e.preventDefault()
    if (!resetTarget?.id) return
    if (!resetForm.password.trim()) return showToast('New password is required.', 'error')
    if (resetForm.password.length < 8) return showToast('Password must be at least 8 characters.', 'error')
    if (resetForm.password !== resetForm.confirmPassword) return showToast('Passwords do not match.', 'error')
    setResetting(true)
    try {
      await api(`/users/${resetTarget.id}`, { method: 'PUT', body: JSON.stringify({ password: resetForm.password }) })
      showToast(`Password updated for ${resetTarget.name}.`, 'success')
      setResetTarget(null)
    } catch (err) {
      showToast(err.message || 'Failed to update password.', 'error')
    } finally {
      setResetting(false)
    }
  }

  const exportUsers = async (format) => {
    const q = new URLSearchParams({ format })
    if (qSearch.trim()) q.set('search', qSearch.trim())
    if (statusFilter !== 'all') q.set('is_active', statusFilter === 'active' ? 'true' : 'false')
    if (roleFilter) q.set('role_slug', roleFilter)
    try {
      const token = localStorage.getItem('admin_token') || ''
      const res = await fetch(`/api/v1/users-export?${q.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-export.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      showToast(e.message || 'Export failed.', 'error')
    }
  }

  const openEdit = (u) => {
    setEditingUser(u)
    setEditForm({
      name: u.name || '',
      username: u.username || '',
      email: u.email || '',
      phone: u.phone || '',
      is_active: !!u.is_active,
      role_ids: (u.roles || []).map((r) => r.id),
    })
    setActionOpenId(null)
  }

  const saveEdit = async () => {
    if (!editingUser?.id) return
    setSavingEdit(true)
    try {
      await api(`/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      showToast('User updated.', 'success')
      setEditingUser(null)
      load(data?.current_page || 1)
    } catch (e) {
      showToast(e.message || 'Failed to update user.', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleActivation = async (u, nextActive) => {
    try {
      await api(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ is_active: nextActive }) })
      showToast(nextActive ? 'Account activated.' : 'Account disabled.', 'success')
      setActionOpenId(null)
      load(data?.current_page || 1)
    } catch (e) {
      showToast(e.message || 'Failed to update account status.', 'error')
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Users Management</h1>
          <p className={admin.pageSubtitle}>Premium control center for account governance, role assignment, and borrower/staff lifecycle.</p>
        </div>
        {can('users.manage') ? (
          <button type="button" onClick={() => setShowCreate(true)} className={admin.btnPrimary}>
            + Create User
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center dark:border-[#1F2937] dark:bg-[#0F172A]">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, username..." className={`min-w-0 w-full flex-1 sm:min-w-[220px] ${admin.input}`} />
        <select className={`${admin.input} w-full sm:w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className={`${admin.input} w-full sm:w-52`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {roleOptions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
        </select>
        <button type="button" className={admin.btnSecondary} onClick={() => load(1)}>Filter</button>
        <button type="button" className={admin.btnSecondary} onClick={() => exportUsers('csv')}>Export CSV</button>
        <button type="button" className={admin.btnSecondary} onClick={() => exportUsers('pdf')}>Export PDF</button>
      </div>

      <div className={`hidden lg:block ${admin.tableWrap} rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#1F2937] dark:bg-[#0F172A]`}>
        <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin720}`}>
          <thead className="sticky top-0 z-10 bg-white dark:bg-[#0F172A]">
            <tr className={admin.thead}>
              <th className={admin.tableCell}>User</th>
              <th className={admin.tableCell}>Email</th>
              <th className={admin.tableCell}>Roles</th>
              <th className={`${admin.tableCell} tabular-nums`}>Loans</th>
              <th className={admin.tableCell}>Status</th>
              <th className={`${admin.tableCell} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <TableSkeletonRows cols={6} rows={6} /> : rows.length === 0 ? <EmptyTableRow colSpan={6} message="No users found." /> : rows.map((u) => (
              <tr key={u.id} className={admin.tbodyRow}>
                <td className={`${admin.tableCell} font-medium`}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-700">{initials(u.name)}</span>
                    <div className="min-w-0">
                      <span className="block truncate">{u.name}</span>
                      <span className={`block truncate text-xs ${admin.tableMuted}`}>@{u.username || '—'}</span>
                    </div>
                  </div>
                  {u.loans_count > 0 ? <Link className="mt-0.5 inline-block text-xs font-normal text-red-600 hover:underline dark:text-red-400" to={`/admin/borrowers/${u.id}`}>Borrower profile →</Link> : null}
                </td>
                <td className={`${admin.tableCell} ${admin.tableMuted}`}>{u.email}</td>
                <td className={admin.tableCell}>
                  <div className="flex flex-wrap gap-1.5">
                    {(u.roles || []).length ? (u.roles || []).map((r) => <span key={r.id} className={`inline-flex rounded-full px-2 py-0.5 text-xs ring-1 ${ADMIN_ROLE_BADGE[r.slug] || ADMIN_ROLE_BADGE_FALLBACK}`}>{r.name}</span>) : <span className={admin.tableMuted}>—</span>}
                  </div>
                </td>
                <td className={`${admin.tableCell} tabular-nums ${admin.tableMuted}`}>{u.loans_count != null ? u.loans_count : '—'}</td>
                <td className={admin.tableCell}>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${u.is_active ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-[#1F2937] dark:text-gray-400'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className={`${admin.tableCell} text-right`}>
                  <div className="relative inline-flex items-center justify-end gap-2">
                    {canResetPasswords ? <button type="button" onClick={() => openResetModal(u)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]">Change Password</button> : null}
                    <button type="button" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100" onClick={() => setActionOpenId((id) => (id === u.id ? null : u.id))}>More</button>
                    {actionOpenId === u.id ? (
                      <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-gray-200 bg-white p-1.5 text-left shadow-xl dark:border-[#1F2937] dark:bg-[#111827]">
                        <button type="button" className="w-full rounded-lg px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-[#1F2937]" onClick={() => openEdit(u)}>Edit user</button>
                        <button type="button" className="w-full rounded-lg px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-[#1F2937]" onClick={() => openEdit(u)}>Assign roles</button>
                        <button type="button" className="w-full rounded-lg px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-[#1F2937]" onClick={() => toggleActivation(u, !u.is_active)}>{u.is_active ? 'Disable account' : 'Activate account'}</button>
                        {canDeleteUsers && adminUser?.id != null && Number(u.id) !== Number(adminUser.id) ? <button type="button" className="w-full rounded-lg px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30" onClick={() => confirmDelete(u)}>Delete user</button> : null}
                      </div>
                    ) : null}
                    {canDeleteUsers && adminUser?.id != null && Number(u.id) !== Number(adminUser.id) ? <button type="button" disabled={deletingId === u.id} onClick={() => confirmDelete(u)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60">{deletingId === u.id ? 'Deleting…' : 'Delete'}</button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.last_page > 1 ? (
        <div className="flex gap-2">
          <button type="button" disabled={data.current_page <= 1} onClick={() => load(data.current_page - 1)} className={admin.paginationBtn}>Previous</button>
          <button type="button" disabled={data.current_page >= data.last_page} onClick={() => load(data.current_page + 1)} className={admin.paginationBtn}>Next</button>
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-[85]">
          <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setShowCreate(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl dark:bg-[#111827]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create User</h2>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>Create account, assign roles, and set activation state.</p>
            <form className="mt-4 space-y-3 pb-24" onSubmit={submitCreate}>
              <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Full name *" className={`w-full ${admin.input}`} />
              <input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} placeholder="Username *" className={`w-full ${admin.input}`} />
              <input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="Email *" type="email" className={`w-full ${admin.input}`} />
              <div className="flex gap-2">
                <input value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} placeholder="Password *" type={showPwd ? 'text' : 'password'} className={`w-full ${admin.input}`} />
                <button type="button" className={admin.btnSecondary} onClick={() => setShowPwd((v) => !v)}>{showPwd ? 'Hide' : 'Show'}</button>
              </div>
              <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Phone number" className={`w-full ${admin.input}`} />
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))} /> Active account</label>
              <div className={admin.insetPanel}>
                <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Role assignment</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.map((r) => <label key={r.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100"><input type="checkbox" checked={form.role_ids.includes(r.id)} onChange={() => toggleRole(r.id)} /><span>{r.name}</span><span className={`text-xs ${admin.textMuted}`}>({r.slug})</span></label>)}
                </div>
              </div>
            </form>
            <div className="fixed bottom-0 right-0 flex w-full max-w-lg gap-2 border-t border-gray-200 bg-white p-4 dark:border-[#1F2937] dark:bg-[#111827]">
              <button type="button" disabled={creating} className={`${admin.btnPrimary} flex-1 disabled:opacity-50`} onClick={submitCreate}>{creating ? 'Creating…' : 'Create User'}</button>
              <button type="button" onClick={() => setShowCreate(false)} className={`${admin.btnSecondary} flex-1`}>Cancel</button>
            </div>
          </aside>
        </div>
      ) : null}

      {editingUser ? (
        <div className={admin.modalOverlay}>
          <div className={`${admin.modalCard} max-w-xl`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit User</h2>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>{editingUser.email}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={admin.input} value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} placeholder="Full name" />
              <input className={admin.input} value={editForm.username} onChange={(e) => setEditForm((s) => ({ ...s, username: e.target.value }))} placeholder="Username" />
              <input className={admin.input} value={editForm.email} onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))} placeholder="Email" />
              <input className={admin.input} value={editForm.phone} onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Phone" />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((s) => ({ ...s, is_active: e.target.checked }))} /> Active account</label>
            <div className={`${admin.insetPanel} mt-3`}>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Assign roles</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {roles.map((r) => <label key={r.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.role_ids.includes(r.id)} onChange={() => toggleRole(r.id, setEditForm)} /><span>{r.name}</span></label>)}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" className={admin.btnPrimary} disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</button>
              <button type="button" className={admin.btnSecondary} onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {resetTarget ? (
        <div className={admin.modalOverlay}>
          <div className={`${admin.modalCard} max-w-md`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Change User Password</h2>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>Action for <span className="font-semibold">{resetTarget.name}</span> ({resetTarget.email})</p>
            <form className="mt-4 space-y-3" onSubmit={submitResetPassword}>
              <input value={resetForm.password} onChange={(e) => setResetForm((s) => ({ ...s, password: e.target.value }))} placeholder="New password (minimum 8 characters)" type="password" className={`w-full ${admin.input}`} />
              <input value={resetForm.confirmPassword} onChange={(e) => setResetForm((s) => ({ ...s, confirmPassword: e.target.value }))} placeholder="Confirm new password" type="password" className={`w-full ${admin.input}`} />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={resetting} className={`${admin.btnPrimary} disabled:opacity-50`}>{resetting ? 'Updating…' : 'Update Password'}</button>
                <button type="button" onClick={() => setResetTarget(null)} className={admin.btnSecondary}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
