import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from '../components/AdminUi.jsx'

const ROLE_TONE = {
  'super-admin': 'from-red-50 to-white border-red-200',
  'loan-officer': 'from-blue-50 to-white border-blue-200',
  collector: 'from-purple-50 to-white border-purple-200',
  borrower: 'from-amber-50 to-white border-amber-200',
  accountant: 'from-indigo-50 to-white border-indigo-200',
}

export default function RolesPage() {
  const { showToast } = useToast()
  const [roles, setRoles] = useState([])
  const [perms, setPerms] = useState([])
  const [permSearch, setPermSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState(null)
  const [permIds, setPermIds] = useState([])
  const [savingRole, setSavingRole] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', slug: '', description: '' })
  const [creatingRole, setCreatingRole] = useState(false)
  const [newPerm, setNewPerm] = useState({ name: '', slug: '', group_name: '' })
  const [creatingPerm, setCreatingPerm] = useState(false)

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([api('/roles'), api('/permissions')])
      setRoles(r.data || [])
      setPerms(p.data || [])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const openEditRole = (role) => {
    setEditingRole(role)
    setPermIds((role.permissions || []).map((x) => x.id))
  }

  const togglePerm = (id) => {
    setPermIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const saveRole = async () => {
    if (!editingRole) return
    setSavingRole(true)
    try {
      await api(`/roles/${editingRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permission_ids: permIds }),
      })
      showToast('Role updated successfully.', 'success')
      setEditingRole(null)
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSavingRole(false)
    }
  }

  const createPermission = async (e) => {
    e.preventDefault()
    if (!newPerm.name.trim() || !newPerm.slug.trim()) {
      showToast('Name and slug are required.', 'error')
      return
    }
    setCreatingPerm(true)
    try {
      await api('/permissions', {
        method: 'POST',
        body: JSON.stringify({
          name: newPerm.name.trim(),
          slug: newPerm.slug.trim(),
          group_name: newPerm.group_name.trim() || null,
        }),
      })
      showToast('Permission created successfully.', 'success')
      setNewPerm({ name: '', slug: '', group_name: '' })
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setCreatingPerm(false)
    }
  }

  const createRole = async (e) => {
    e.preventDefault()
    if (!newRole.name.trim() || !newRole.slug.trim()) {
      showToast('Role name and slug are required.', 'error')
      return
    }
    setCreatingRole(true)
    try {
      await api('/roles', { method: 'POST', body: JSON.stringify(newRole) })
      showToast('Role created successfully.', 'success')
      setNewRole({ name: '', slug: '', description: '' })
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setCreatingRole(false)
    }
  }

  const filteredPerms = perms.filter((p) => {
    if (!permSearch.trim()) return true
    const q = permSearch.toLowerCase()
    return String(p.name || '').toLowerCase().includes(q) || String(p.slug || '').toLowerCase().includes(q) || String(p.group_name || '').toLowerCase().includes(q)
  })

  const groupedPerms = filteredPerms.reduce((acc, p) => {
    const key = p.group_name || 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const deletePermission = async (p) => {
    if (!window.confirm(`Delete permission “${p.name}” (${p.slug})? Roles will lose this grant.`)) return
    try {
      await api(`/permissions/${p.id}`, { method: 'DELETE' })
      showToast('Permission removed.', 'success')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className={admin.pageTitle}>Roles & Permissions</h1>
        <p className={admin.pageSubtitle}>
          Modern RBAC control center for role grants, module access, and secure permission governance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${admin.cardNoHover} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Roles</h2>
          <form onSubmit={createRole} className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className={admin.input} placeholder="Role name" value={newRole.name} onChange={(e) => setNewRole((s) => ({ ...s, name: e.target.value }))} />
            <input className={admin.input} placeholder="slug" value={newRole.slug} onChange={(e) => setNewRole((s) => ({ ...s, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
            <button type="submit" disabled={creatingRole} className={`${admin.btnPrimary} disabled:opacity-50`}>{creatingRole ? 'Adding…' : 'Add role'}</button>
          </form>
          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((k) => (
                <div key={k} className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-[#1F2937]" />
              ))}
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {roles.map((role) => (
                <li
                  key={role.id}
                  className={`rounded-2xl border bg-gradient-to-br px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md ${ROLE_TONE[role.slug] || 'from-gray-50 to-white border-gray-200'} dark:border-[#1F2937] dark:from-[#0F172A]/70 dark:to-[#111827]`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{role.name}</p>
                      <p className={`text-xs ${admin.textMuted}`}>{role.slug}</p>
                      <p className={`mt-1 text-xs ${admin.textMuted}`}>
                        {(role.permissions || []).length} permission(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditRole(role)}
                      className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]"
                    >
                      Manage Permissions
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className={`${admin.cardNoHover} p-6`}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Permission Catalog</h2>
            <input className={`mt-3 w-full ${admin.input}`} placeholder="Search permissions..." value={permSearch} onChange={(e) => setPermSearch(e.target.value)} />
            <div className="mt-3 max-h-[min(420px,60vh)] overflow-y-auto">
              {Object.entries(groupedPerms).map(([group, items]) => (
                <div key={group} className="mb-4 rounded-xl border border-gray-200 dark:border-[#1F2937]">
                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-300">
                    {group} ({items.length})
                  </div>
                  <ul className="space-y-0 text-sm">
                    {items.map((p) => (
                      <li key={p.id} className="flex flex-col gap-2 border-b border-gray-100 px-3 py-2 text-gray-800 last:border-b-0 dark:border-[#1F2937]/80 dark:text-gray-100/90 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <span className="block break-words">{p.name}</span>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
                          <code className="text-xs break-all text-red-600 dark:text-red-400/95">{p.slug}</code>
                          <button type="button" onClick={() => deletePermission(p)} className="shrink-0 rounded px-2 py-0.5 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-600/15">Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <form onSubmit={createPermission} className="mt-5 space-y-3 border-t border-gray-200 pt-5 dark:border-[#1F2937] sm:pb-1">
              <p className={`text-xs font-medium uppercase tracking-wide ${admin.textMuted}`}>Add New Permission</p>
              <input
                className={`w-full ${admin.input}`}
                placeholder="Permission Name"
                value={newPerm.name}
                onChange={(e) => setNewPerm((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                className={`w-full ${admin.input}`}
                placeholder="Slug (e.g. reports.export)"
                value={newPerm.slug}
                onChange={(e) => setNewPerm((s) => ({ ...s, slug: e.target.value.toLowerCase().replace(/\s+/g, '.') }))}
              />
              <input
                className={`w-full ${admin.input}`}
                placeholder="Group (optional)"
                value={newPerm.group_name}
                onChange={(e) => setNewPerm((s) => ({ ...s, group_name: e.target.value }))}
              />
              <button type="submit" disabled={creatingPerm} className={`${admin.btnPrimary} disabled:opacity-50`}>
                {creatingPerm ? 'Saving…' : 'Add Permission'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {editingRole && (
        <div className={admin.modalOverlay}>
          <div className="my-6 max-h-[min(90vh,880px)] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-xl border border-gray-200 bg-white p-6 shadow-2xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit — {editingRole.name}</h3>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>{editingRole.slug}</p>
            <div className="mt-4 space-y-2">
              {filteredPerms.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 transition hover:bg-gray-50 dark:border-[#1F2937]/60 dark:hover:bg-[#0F172A]/80"
                >
                  <input
                    type="checkbox"
                    checked={permIds.includes(p.id)}
                    onChange={() => togglePerm(p.id)}
                    className="rounded border-gray-300 dark:border-[#374151]"
                  />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">{p.name}</span>
                  <code className="text-xs text-red-600 dark:text-red-400/90">{p.slug}</code>
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={saveRole} disabled={savingRole} className={`${admin.btnPrimary} disabled:opacity-50`}>
                {savingRole ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditingRole(null)} className={admin.btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
