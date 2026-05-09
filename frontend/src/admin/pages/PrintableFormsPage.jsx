import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getToken } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin, EmptyTableRow, TableSkeletonRows } from '../components/AdminUi.jsx'
import { laravelApiBases, getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'

function buildApiUrl(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (base === '' || base == null) return `/api/v1${p}`
  return `${String(base).replace(/\/$/, '')}${p}`
}

async function postPdfBlob(path, jsonBody) {
  const token = getToken()
  const bases = laravelApiBases()
  let lastErr = null
  for (const b of bases) {
    try {
      const res = await fetch(buildApiUrl(b, path), {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          Accept: 'application/pdf',
        },
        body: JSON.stringify(jsonBody ?? {}),
      })
      if (res.ok) return await res.blob()
      lastErr = new Error(await res.text().catch(() => `HTTP ${res.status}`))
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('Could not generate PDF.')
}

export default function PrintableFormsPage() {
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const allowed = can('forms.printable.manage')

  const [tab, setTab] = useState('forms')
  const [formsData, setFormsData] = useState(null)
  const [logsData, setLogsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [edit, setEdit] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    form_key: '',
    title: '',
    category: 'lending',
    branch: '',
    description: '',
    pdf_version: '1.0.0',
    status: 'active',
    watermark_enabled: false,
    sort_order: 0,
  })

  const loadForms = useCallback(
    async (searchVal, categoryVal) => {
      if (!allowed) return
      setLoading(true)
      try {
        const q = new URLSearchParams({ per_page: '50' })
        if (String(searchVal || '').trim()) q.set('search', String(searchVal).trim())
        if (String(categoryVal || '').trim()) q.set('category', String(categoryVal).trim())
        const res = await api(`/printable-forms?${q}`)
        setFormsData(res.data)
      } catch (e) {
        showToast(e.message, 'error')
      } finally {
        setLoading(false)
      }
    },
    [allowed, showToast],
  )

  const loadLogs = useCallback(async () => {
    if (!allowed) return
    setLogsLoading(true)
    try {
      const res = await api('/printable-form-logs?per_page=40')
      setLogsData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLogsLoading(false)
    }
  }, [allowed, showToast])

  useEffect(() => {
    if (!allowed) return
    void loadForms('', '')
  }, [allowed, loadForms])

  useEffect(() => {
    if (!allowed || tab !== 'logs') return
    loadLogs()
  }, [allowed, tab, loadLogs])

  const rows = formsData?.data || []
  const logRows = logsData?.data || []

  const saveEdit = async () => {
    if (!edit?.id) return
    try {
      await api(`/printable-forms/${edit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: edit.title,
          category: edit.category,
          branch: edit.branch || null,
          description: edit.description || null,
          pdf_version: edit.pdf_version,
          status: edit.status,
          watermark_enabled: !!edit.watermark_enabled,
          sort_order: Number(edit.sort_order) || 0,
        }),
      })
      showToast('Form updated.', 'success')
      setEdit(null)
      loadForms(search, category)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const createFormSubmit = async () => {
    try {
      await api('/printable-forms', {
        method: 'POST',
        body: JSON.stringify({
          form_key: createForm.form_key.trim(),
          title: createForm.title.trim(),
          category: createForm.category.trim() || 'lending',
          branch: createForm.branch.trim() || null,
          description: createForm.description.trim() || null,
          pdf_version: createForm.pdf_version.trim() || '1.0.0',
          status: createForm.status,
          watermark_enabled: !!createForm.watermark_enabled,
          sort_order: Number(createForm.sort_order) || 0,
        }),
      })
      showToast('Form created.', 'success')
      setCreateOpen(false)
      setCreateForm({
        form_key: '',
        title: '',
        category: 'lending',
        branch: '',
        description: '',
        pdf_version: '1.0.0',
        status: 'active',
        watermark_enabled: false,
        sort_order: 0,
      })
      loadForms(search, category)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const uploadTemplate = async (formId, file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('template', file)
    try {
      await api(`/printable-forms/${formId}/upload-template`, { method: 'POST', body: fd })
      showToast('Template uploaded (stored under private/master_templates).', 'success')
      loadForms(search, category)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const testPdf = async (formId) => {
    try {
      const blob = await postPdfBlob(`/printable-forms/${formId}/test-pdf`, {
        fields: {},
        watermark: false,
        inline: true,
      })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      showToast(e.message || 'Test PDF failed.', 'error')
    }
  }

  const deleteForm = async (row) => {
    if (!window.confirm(`Delete "${row.title}"?`)) return
    try {
      await api(`/printable-forms/${row.id}`, { method: 'DELETE' })
      showToast('Deleted.', 'success')
      loadForms(search, category)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const tabs = useMemo(
    () => [
      { id: 'forms', label: 'Printable PDF forms' },
      { id: 'logs', label: 'PDF activity logs' },
    ],
    [],
  )

  if (!allowed) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className={admin.cardNoHover + ' p-8'}>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You do not have permission to manage printable PDF forms (<code>forms.printable.manage</code>).
          </p>
        </div>
      </div>
    )
  }

  const actionBtn =
    'inline-flex rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]'

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Printable PDF forms</h1>
          <p className={`mt-1 ${admin.pageSubtitle}`}>
            Manage downloadable lending templates, versions, branch assignment, and audit logs.
          </p>
        </div>
        <button type="button" className={admin.btnPrimary} onClick={() => setCreateOpen(true)}>
          Add form definition
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-[#1F2937]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tab === t.id
                ? 'rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
            }
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'forms' ? (
        <>
          <div className={`${admin.card} mb-4 flex flex-wrap gap-3 p-4`}>
            <input
              type="search"
              placeholder="Search title or key…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={admin.input}
            />
            <input
              type="text"
              placeholder="Category filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={admin.input}
            />
            <button type="button" className={admin.btnSecondary} onClick={() => loadForms(search, category)}>
              Apply
            </button>
          </div>

          <div className={`${admin.tableWrap}`}>
            <div className={admin.tableScroll}>
              <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin900}`}>
                <thead>
                  <tr className={admin.thead}>
                    <th className={admin.tableCell}>Title</th>
                    <th className={admin.tableCell}>Key</th>
                    <th className={admin.tableCell}>Category</th>
                    <th className={admin.tableCell}>Branch</th>
                    <th className={admin.tableCell}>Version</th>
                    <th className={admin.tableCell}>Status</th>
                    <th className={admin.tableCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeletonRows cols={7} rows={6} />
                  ) : rows.length === 0 ? (
                    <EmptyTableRow colSpan={7} message="No printable forms defined." />
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className={admin.tbodyRow}>
                        <td className={`${admin.tableCell} font-medium`}>{r.title}</td>
                        <td className={`${admin.tableCell} ${admin.tableMuted}`}>
                          <code className="text-xs">{r.form_key}</code>
                        </td>
                        <td className={`${admin.tableCell} ${admin.tableMuted}`}>{r.category}</td>
                        <td className={`${admin.tableCell} ${admin.tableMuted}`}>{r.branch || '—'}</td>
                        <td className={`${admin.tableCell} ${admin.tableMuted}`}>{r.pdf_version}</td>
                        <td className={`${admin.tableCell} ${admin.tableMuted}`}>{r.status}</td>
                        <td className={admin.tableCell}>
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" className={actionBtn} onClick={() => setEdit(r)}>
                              Edit
                            </button>
                            <button type="button" className={actionBtn} onClick={() => testPdf(r.id)}>
                              Test PDF
                            </button>
                            <label className={actionBtn + ' cursor-pointer'}>
                              Upload
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                className="hidden"
                                onChange={(e) => uploadTemplate(r.id, e.target.files?.[0])}
                              />
                            </label>
                            <button type="button" className={actionBtn} onClick={() => deleteForm(r)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className={admin.tableWrap}>
          <div className={admin.tableScroll}>
            <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin800}`}>
              <thead>
                <tr className={admin.thead}>
                  <th className={admin.tableCell}>When</th>
                  <th className={admin.tableCell}>Form</th>
                  <th className={admin.tableCell}>Action</th>
                  <th className={admin.tableCell}>Actor</th>
                  <th className={admin.tableCell}>IP</th>
                  <th className={admin.tableCell}>File</th>
                </tr>
              </thead>
              <tbody>
                {logsLoading ? (
                  <TableSkeletonRows cols={6} rows={8} />
                ) : logRows.length === 0 ? (
                  <EmptyTableRow colSpan={6} message="No PDF activity yet." />
                ) : (
                  logRows.map((log) => (
                    <tr key={log.id} className={admin.tbodyRow}>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>{log.created_at || '—'}</td>
                      <td className={admin.tableCell}>{log.form?.title || log.printable_form_id}</td>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>{log.action}</td>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>{log.user?.name || log.actor_type}</td>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>{log.ip_address || '—'}</td>
                      <td className={admin.tableCell}>
                        {log.storage_path ? (
                          <a
                            className="font-semibold text-red-700 hover:underline dark:text-red-400"
                            href={getLaravelStorageFileUrl(log.storage_path)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-[#111827]`}>
            <h3 className="text-lg font-semibold">Edit form</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase text-gray-500">Title</label>
              <input className={admin.input} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              <label className="block text-xs font-semibold uppercase text-gray-500">Category</label>
              <input className={admin.input} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
              <label className="block text-xs font-semibold uppercase text-gray-500">Branch (blank = all branches)</label>
              <input className={admin.input} value={edit.branch || ''} onChange={(e) => setEdit({ ...edit, branch: e.target.value })} />
              <label className="block text-xs font-semibold uppercase text-gray-500">PDF version</label>
              <input className={admin.input} value={edit.pdf_version} onChange={(e) => setEdit({ ...edit, pdf_version: e.target.value })} />
              <label className="block text-xs font-semibold uppercase text-gray-500">Status</label>
              <select className={admin.input} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!edit.watermark_enabled}
                  onChange={(e) => setEdit({ ...edit, watermark_enabled: e.target.checked })}
                />
                Watermark PDFs (CONFIDENTIAL)
              </label>
              <label className="block text-xs font-semibold uppercase text-gray-500">Sort order</label>
              <input
                type="number"
                className={admin.input}
                value={edit.sort_order}
                onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })}
              />
              <label className="block text-xs font-semibold uppercase text-gray-500">Description</label>
              <textarea className={admin.input + ' min-h-[88px]'} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={admin.btnSecondary} onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="button" className={admin.btnPrimary} onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-[#111827]`}>
            <h3 className="text-lg font-semibold">New form definition</h3>
            <p className="mt-1 text-xs text-gray-500">
              <code>form_key</code> must match a Blade template mapping (e.g. main_loan_application) or defaults to the main loan layout.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase text-gray-500">form_key</label>
              <input
                className={admin.input}
                placeholder="main_loan_application"
                value={createForm.form_key}
                onChange={(e) => setCreateForm({ ...createForm, form_key: e.target.value })}
              />
              <label className="block text-xs font-semibold uppercase text-gray-500">Title</label>
              <input className={admin.input} value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
              <label className="block text-xs font-semibold uppercase text-gray-500">Category</label>
              <input className={admin.input} value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={admin.btnSecondary} onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="button" className={admin.btnPrimary} onClick={createFormSubmit}>
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
