import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, downloadAdminFile } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'

const STATUSES = ['new', 'under_review', 'interview_scheduled', 'passed', 'rejected', 'hired']

export default function AdminCareerApplicationDetailPage() {
  const { id } = useParams()
  const { can } = useAdminApiAuth()
  const { showToast } = useToast()
  const view = can('careers.view')
  const manage = can('careers.manage')
  const [row, setRow] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [interviewFeedback, setInterviewFeedback] = useState('')
  const [sendAuto, setSendAuto] = useState(true)
  const [recruiterId, setRecruiterId] = useState('')
  const [saving, setSaving] = useState(false)
  const [iv, setIv] = useState({
    scheduled_at: '',
    timezone: 'Asia/Manila',
    location: '',
    meeting_link: '',
    interviewer_name: '',
    notes: '',
    send_invitation_email: true,
  })

  const load = useCallback(async () => {
    if (!view || !id) return
    setLoading(true)
    try {
      const res = await api(`/admin/careers/applications/${id}`)
      const d = res.data
      setRow(d)
      setStatus(d.status || '')
      setInternalNotes(d.internal_notes || '')
      setInterviewFeedback(d.interview_feedback || '')
      setSendAuto(Boolean(d.send_automated_emails))
      setRecruiterId(d.recruiter_id != null ? String(d.recruiter_id) : '')
      try {
        const lr = await api(`/admin/careers/email-logs?application_id=${id}&per_page=20`)
        setLogs(lr.data?.data || [])
      } catch {
        setLogs([])
      }
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [view, id, showToast])

  useEffect(() => {
    load()
  }, [load])

  const savePipeline = async (e) => {
    e.preventDefault()
    if (!manage) return
    setSaving(true)
    try {
      await api(`/admin/careers/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          internal_notes: internalNotes || null,
          interview_feedback: interviewFeedback || null,
          send_automated_emails: sendAuto,
          recruiter_id: recruiterId === '' ? null : Number(recruiterId),
        }),
      })
      showToast('Application updated.', 'success')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const scheduleInterview = async (e) => {
    e.preventDefault()
    if (!manage) return
    setSaving(true)
    try {
      await api(`/admin/careers/applications/${id}/interviews`, {
        method: 'POST',
        body: JSON.stringify({
          scheduled_at: iv.scheduled_at,
          timezone: iv.timezone,
          location: iv.location || null,
          meeting_link: iv.meeting_link || null,
          interviewer_name: iv.interviewer_name || null,
          notes: iv.notes || null,
          send_invitation_email: iv.send_invitation_email,
        }),
      })
      showToast('Interview scheduled.', 'success')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const downloadResume = async () => {
    if (!manage) return
    try {
      await downloadAdminFile(`/admin/careers/applications/${id}/resume`, row?.resume_original_name || 'resume.pdf')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (!view) {
    return <p className="text-sm text-gray-600">You do not have careers access.</p>
  }

  if (loading && !row) {
    return <p className="text-sm text-gray-500">Loading…</p>
  }

  if (!row) {
    return (
      <p className="text-sm text-gray-600">
        Application not found.{' '}
        <Link to="/admin/careers/applications" className="text-blue-700 hover:underline">
          Back to list
        </Link>
      </p>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <div>
        <Link to="/admin/careers/applications" className="text-sm font-medium text-blue-700 hover:underline">
          ← Applicants
        </Link>
        <h1 className={`${admin.pageTitle} mt-2`}>
          {row.applicant?.first_name} {row.applicant?.last_name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {row.job?.title} · Applied {row.applied_at ? new Date(row.applied_at).toLocaleString() : '—'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Applicant</h2>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">Email</dt>
              <dd>{row.applicant?.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">Phone</dt>
              <dd>{row.applicant?.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">Portfolio</dt>
              <dd>
                {row.applicant?.portfolio_url ? (
                  <a href={row.applicant.portfolio_url} className="text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                    {row.applicant.portfolio_url}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
          {row.cover_letter ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase text-gray-500">Cover letter</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{row.cover_letter}</p>
            </div>
          ) : null}
          {row.has_resume && manage ? (
            <button type="button" className={`${admin.btnSecondary} mt-4`} onClick={downloadResume}>
              Download resume
            </button>
          ) : null}
        </section>

        <section className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Pipeline & notes</h2>
          <form className="mt-3 space-y-3" onSubmit={savePipeline}>
            <label className="block text-xs font-medium text-gray-600">
              Status
              <select className={`${admin.input} mt-1 w-full`} value={status} onChange={(e) => setStatus(e.target.value)} disabled={!manage}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Recruiter user ID (optional)
              <input
                className={`${admin.input} mt-1 w-full`}
                value={recruiterId}
                onChange={(e) => setRecruiterId(e.target.value)}
                disabled={!manage}
                placeholder="Staff user id"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={sendAuto} onChange={(e) => setSendAuto(e.target.checked)} disabled={!manage} />
              Send automated emails on status changes
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Internal notes
              <textarea
                className={`${admin.input} mt-1 min-h-[100px] w-full`}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                disabled={!manage}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Interview feedback
              <textarea
                className={`${admin.input} mt-1 min-h-[80px] w-full`}
                value={interviewFeedback}
                onChange={(e) => setInterviewFeedback(e.target.value)}
                disabled={!manage}
              />
            </label>
            {manage ? (
              <button type="submit" className={admin.btnPrimary} disabled={saving}>
                {saving ? 'Saving…' : 'Save pipeline'}
              </button>
            ) : null}
          </form>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Interviews</h2>
        {row.interviews?.length ? (
          <ul className="mt-3 space-y-2 text-sm text-gray-800">
            {row.interviews.map((i) => (
              <li key={i.id} className="rounded-lg border border-gray-100 p-3">
                <strong>{i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : ''}</strong>
                {i.location ? <span className="text-gray-600"> · {i.location}</span> : null}
                {i.meeting_link ? (
                  <div>
                    <a href={i.meeting_link} className="text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                      Meeting link
                    </a>
                  </div>
                ) : null}
                {i.notes ? <p className="mt-1 text-gray-700">{i.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No interviews logged yet.</p>
        )}
        {manage ? (
          <form className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2" onSubmit={scheduleInterview}>
            <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
              Scheduled at (ISO or local datetime)
              <input
                type="datetime-local"
                className={`${admin.input} mt-1 w-full`}
                value={iv.scheduled_at}
                onChange={(e) => setIv({ ...iv, scheduled_at: e.target.value })}
                required
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Timezone
              <input className={`${admin.input} mt-1 w-full`} value={iv.timezone} onChange={(e) => setIv({ ...iv, timezone: e.target.value })} />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Interviewer name
              <input
                className={`${admin.input} mt-1 w-full`}
                value={iv.interviewer_name}
                onChange={(e) => setIv({ ...iv, interviewer_name: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
              Location
              <input className={`${admin.input} mt-1 w-full`} value={iv.location} onChange={(e) => setIv({ ...iv, location: e.target.value })} />
            </label>
            <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
              Meeting link
              <input className={`${admin.input} mt-1 w-full`} value={iv.meeting_link} onChange={(e) => setIv({ ...iv, meeting_link: e.target.value })} />
            </label>
            <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
              Notes
              <textarea className={`${admin.input} mt-1 w-full`} value={iv.notes} onChange={(e) => setIv({ ...iv, notes: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={iv.send_invitation_email}
                onChange={(e) => setIv({ ...iv, send_invitation_email: e.target.checked })}
              />
              Email interview invitation to applicant
            </label>
            <button type="submit" className={admin.btnSecondary} disabled={saving}>
              Add interview
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Email automation log</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-500">
                    No messages logged for this application.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3">{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</td>
                    <td className="py-2 pr-3">{l.template_key}</td>
                    <td className="py-2 pr-3">{l.to_email}</td>
                    <td className="py-2 pr-3">{l.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
