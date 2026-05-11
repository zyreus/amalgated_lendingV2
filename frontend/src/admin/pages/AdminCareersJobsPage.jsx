import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin, TableSkeletonRows, EmptyTableRow } from '../components/AdminUi.jsx'

const emptyJob = {
  title: '',
  slug: '',
  employment_type: 'full_time',
  status: 'draft',
  department_id: '',
  branch_id: '',
  salary_currency: 'PHP',
  salary_min: '',
  salary_max: '',
  application_deadline: '',
  qualifications: '',
  responsibilities: '',
  requirements: '',
  benefits: '',
  application_instructions: '',
  seo_title: '',
  seo_description: '',
}

export default function AdminCareersJobsPage() {
  const { can } = useAdminApiAuth()
  const { showToast } = useToast()
  const view = can('careers.view')
  const manage = can('careers.manage')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyJob)
  const [dept, setDept] = useState([])
  const [branches, setBranches] = useState([])
  const [saving, setSaving] = useState(false)

  const loadMeta = useCallback(async () => {
    if (!view) return
    try {
      const [d, b] = await Promise.all([api('/admin/careers/departments'), api('/admin/careers/branches')])
      setDept(d.data || [])
      setBranches(b.data || [])
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [view, showToast])

  const load = useCallback(async () => {
    if (!view) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (q.trim()) params.set('q', q.trim())
      const res = await api(`/admin/careers/jobs?${params}`)
      setData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [view, page, statusFilter, q, showToast])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    setModal('new')
    setForm(emptyJob)
  }

  const openEdit = (row) => {
    setModal('edit')
    setForm({
      ...emptyJob,
      _id: row.id,
      title: row.title || '',
      slug: row.slug || '',
      employment_type: row.employment_type || 'full_time',
      status: row.status || 'draft',
      department_id: row.department_id != null ? String(row.department_id) : '',
      branch_id: row.branch_id != null ? String(row.branch_id) : '',
      salary_currency: row.salary_currency || 'PHP',
      salary_min: row.salary_min != null ? String(row.salary_min) : '',
      salary_max: row.salary_max != null ? String(row.salary_max) : '',
      application_deadline: row.application_deadline || '',
      qualifications: row.qualifications || '',
      responsibilities: row.responsibilities || '',
      requirements: row.requirements || '',
      benefits: row.benefits || '',
      application_instructions: row.application_instructions || '',
      seo_title: row.seo_title || '',
      seo_description: row.seo_description || '',
    })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!manage) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || null,
        employment_type: form.employment_type.trim(),
        status: form.status,
        department_id: form.department_id ? Number(form.department_id) : null,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        salary_currency: form.salary_currency.trim() || 'PHP',
        salary_min: form.salary_min === '' ? null : Number(form.salary_min),
        salary_max: form.salary_max === '' ? null : Number(form.salary_max),
        application_deadline: form.application_deadline || null,
        qualifications: form.qualifications || null,
        responsibilities: form.responsibilities || null,
        requirements: form.requirements || null,
        benefits: form.benefits || null,
        application_instructions: form.application_instructions || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
      }
      if (modal === 'new') {
        await api('/admin/careers/jobs', { method: 'POST', body: JSON.stringify(payload) })
        showToast('Job created.', 'success')
      } else {
        await api(`/admin/careers/jobs/${form._id}`, { method: 'PUT', body: JSON.stringify(payload) })
        showToast('Job updated.', 'success')
      }
      setModal(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const publish = async (id) => {
    if (!manage) return
    try {
      await api(`/admin/careers/jobs/${id}/publish`, { method: 'POST', body: '{}' })
      showToast('Job published to the website.', 'success')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const unpublish = async (id) => {
    if (!manage) return
    try {
      await api(`/admin/careers/jobs/${id}/unpublish`, { method: 'POST', body: '{}' })
      showToast('Job removed from public listings (draft).', 'success')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const remove = async (id) => {
    if (!manage || !window.confirm('Delete this job post? Applications remain in the database.')) return
    try {
      await api(`/admin/careers/jobs/${id}`, { method: 'DELETE' })
      showToast('Job deleted.', 'success')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (!view) {
    return <p className="text-sm text-gray-600">You do not have careers access.</p>
  }

  const rows = data?.data || []

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Careers — job posts</h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/admin/careers" className="font-medium text-blue-700 hover:underline">
              Back to careers dashboard
            </Link>
          </p>
        </div>
        {manage ? (
          <button type="button" className={admin.btnPrimary} onClick={openNew}>
            New job
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs font-medium text-gray-600">
          Status
          <select
            className={`${admin.input} mt-1 min-w-[140px]`}
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(e.target.value)
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="block min-w-[200px] flex-1 text-xs font-medium text-gray-600">
          Search
          <input
            className={`${admin.input} mt-1 w-full`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                load()
              }
            }}
            placeholder="Title or slug"
          />
        </label>
        <button type="button" className={admin.btnSecondary} onClick={() => { setPage(1); load() }}>
          Search
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200/90 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Apps</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableSkeletonRows cols={5} />
            ) : rows.length === 0 ? (
              <EmptyTableRow colSpan={5} message="No job posts yet." />
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                  <td className="px-4 py-3 text-gray-700">{row.status}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">{row.applications_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">{row.application_deadline || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {manage ? (
                        <>
                          <button
                            type="button"
                            className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </button>
                          {row.status !== 'published' ? (
                            <button
                              type="button"
                              className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
                              onClick={() => publish(row.id)}
                            >
                              Publish
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
                              onClick={() => unpublish(row.id)}
                            >
                              Unpublish
                            </button>
                          )}
                          <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => remove(row.id)}>
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.last_page > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className={admin.btnSecondary}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {data.current_page} of {data.last_page}
          </span>
          <button
            type="button"
            className={admin.btnSecondary}
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">{modal === 'new' ? 'New job' : 'Edit job'}</h2>
            <form className="mt-4 space-y-3" onSubmit={save}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                  Title
                  <input className={`${admin.input} mt-1 w-full`} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                  Slug (optional)
                  <input className={`${admin.input} mt-1 w-full`} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Department
                  <select
                    className={`${admin.input} mt-1 w-full`}
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    <option value="">—</option>
                    {dept.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Branch
                  <select
                    className={`${admin.input} mt-1 w-full`}
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  >
                    <option value="">—</option>
                    {branches.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Employment type
                  <input
                    className={`${admin.input} mt-1 w-full`}
                    value={form.employment_type}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Status
                  <select
                    className={`${admin.input} mt-1 w-full`}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Application deadline
                  <input
                    type="date"
                    className={`${admin.input} mt-1 w-full`}
                    value={form.application_deadline}
                    onChange={(e) => setForm({ ...form, application_deadline: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Salary currency
                  <input className={`${admin.input} mt-1 w-full`} value={form.salary_currency} onChange={(e) => setForm({ ...form, salary_currency: e.target.value })} />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Salary min
                  <input className={`${admin.input} mt-1 w-full`} value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Salary max
                  <input className={`${admin.input} mt-1 w-full`} value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} />
                </label>
              </div>
              {['qualifications', 'responsibilities', 'requirements', 'benefits', 'application_instructions'].map((field) => (
                <label key={field} className="block text-xs font-medium capitalize text-gray-600">
                  {field.replace('_', ' ')}
                  <textarea
                    className={`${admin.input} mt-1 min-h-[72px] w-full`}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                </label>
              ))}
              <label className="block text-xs font-medium text-gray-600">
                SEO title
                <input className={`${admin.input} mt-1 w-full`} value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                SEO description
                <textarea className={`${admin.input} mt-1 w-full`} value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={admin.btnSecondary} onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="submit" className={admin.btnPrimary} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
