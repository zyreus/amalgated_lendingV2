import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  )
}

export default function AdminCareersDashboardPage() {
  const { can } = useAdminApiAuth()
  const { showToast } = useToast()
  const allowed = can('careers.view')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!allowed) return
    setLoading(true)
    try {
      const res = await api('/admin/careers/dashboard')
      setData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [allowed, showToast])

  useEffect(() => {
    load()
  }, [load])

  if (!allowed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        You do not have permission to view the careers module. Ask an administrator to grant{' '}
        <code className="rounded bg-white/80 px-1">careers.view</code>.
      </div>
    )
  }

  const jobs = data?.jobs || {}
  const applicants = data?.applicants || {}
  const trends = data?.trends?.applications_by_month || {}
  const trendMax = Math.max(1, ...Object.values(trends).map((n) => Number(n) || 0))

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Careers</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Hiring overview, pipeline health, and trends. Manage postings and applicants from the links below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/careers/jobs" className={admin.btnSecondary}>
            Job posts
          </Link>
          <Link to="/admin/careers/applications" className={admin.btnSecondary}>
            Applicants
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading dashboard…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Job inventory</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Live on website" value={jobs.active_listed ?? 0} hint="Published & accepting / open deadline" />
              <StatCard label="Draft" value={jobs.draft ?? 0} />
              <StatCard label="Closed" value={jobs.closed ?? 0} />
              <StatCard label="Archived" value={jobs.archived ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Applicant pipeline</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total applications" value={applicants.total_applications ?? 0} />
              <StatCard label="Interview scheduled" value={applicants.interview_scheduled ?? 0} />
              <StatCard label="Hired" value={applicants.hired ?? 0} />
              <StatCard label="Rejected" value={applicants.rejected ?? 0} />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">Applications trend (last 6 months)</h2>
            <div className="mt-4 flex h-40 items-end gap-2">
              {Object.keys(trends).length === 0 ? (
                <p className="text-sm text-gray-500">No application volume in this window yet.</p>
              ) : (
                Object.entries(trends).map(([month, count]) => {
                  const h = Math.round((Number(count) / trendMax) * 100)
                  return (
                    <div key={month} className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full max-w-[3rem] rounded-t-md bg-blue-600/90"
                        style={{ height: `${Math.max(8, h)}%` }}
                        title={`${month}: ${count}`}
                      />
                      <span className="text-[10px] font-medium text-gray-500">{month.slice(5)}</span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
