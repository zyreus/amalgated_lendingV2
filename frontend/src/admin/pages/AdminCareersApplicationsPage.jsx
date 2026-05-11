import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, downloadAdminFile } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin, TableSkeletonRows, EmptyTableRow } from '../components/AdminUi.jsx'

const STATUSES = ['new', 'under_review', 'interview_scheduled', 'passed', 'rejected', 'hired']

export default function AdminCareersApplicationsPage() {
  const { can } = useAdminApiAuth()
  const { showToast } = useToast()
  const view = can('careers.view')
  const manage = can('careers.manage')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [jobId, setJobId] = useState('')
  const [q, setQ] = useState('')

  const loadJobs = useCallback(async () => {
    if (!view) return
    try {
      const res = await api('/admin/careers/jobs?per_page=100')
      setJobs(res.data?.data || [])
    } catch {
      /* ignore */
    }
  }, [view])

  const load = useCallback(async () => {
    if (!view) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (status) params.set('status', status)
      if (jobId) params.set('job_id', jobId)
      if (q.trim()) params.set('q', q.trim())
      const res = await api(`/admin/careers/applications?${params}`)
      setData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [view, page, status, jobId, q, showToast])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = async () => {
    if (!manage) return
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (jobId) params.set('job_id', jobId)
      const qs = params.toString()
      await downloadAdminFile(`/admin/careers/applications-export${qs ? `?${qs}` : ''}`, 'careers-applications.csv')
      showToast('Export started.', 'success')
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
          <h1 className={admin.pageTitle}>Careers — applicants</h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/admin/careers" className="font-medium text-blue-700 hover:underline">
              Back to careers dashboard
            </Link>
          </p>
        </div>
        {manage ? (
          <button type="button" className={admin.btnSecondary} onClick={exportCsv}>
            Export CSV
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs font-medium text-gray-600">
          Status
          <select
            className={`${admin.input} mt-1 min-w-[160px]`}
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value)
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Job
          <select
            className={`${admin.input} mt-1 min-w-[200px]`}
            value={jobId}
            onChange={(e) => {
              setPage(1)
              setJobId(e.target.value)
            }}
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={String(j.id)}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[180px] flex-1 text-xs font-medium text-gray-600">
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
            placeholder="Name, email, phone"
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
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableSkeletonRows cols={5} />
            ) : rows.length === 0 ? (
              <EmptyTableRow colSpan={5} message="No applications match your filters." />
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {row.applicant?.first_name} {row.applicant?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">{row.applicant?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{row.job?.title}</td>
                  <td className="px-4 py-3 text-gray-700">{row.status?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-600">{row.applied_at ? new Date(row.applied_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/careers/applications/${row.id}`}
                      className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.last_page > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" className={admin.btnSecondary} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
    </div>
  )
}
