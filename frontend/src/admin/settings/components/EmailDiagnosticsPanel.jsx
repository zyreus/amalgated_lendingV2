import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { admin } from '../../components/AdminUi.jsx'
import { FieldLabel, settingsInputClass } from './SettingsPrimitives.jsx'

export default function EmailDiagnosticsPanel({ emailSettings, onPatchEmailSettings, readOnly = false }) {
  const { showToast } = useToast()
  const [smtpStatus, setSmtpStatus] = useState(null)
  const [smtpHealth, setSmtpHealth] = useState(null)
  const [smtpPortProbe, setSmtpPortProbe] = useState([])
  const [testEmailTo, setTestEmailTo] = useState('')
  const [emailOpsLoading, setEmailOpsLoading] = useState(false)
  const [emailLogs, setEmailLogs] = useState([])
  const [emailAnalytics, setEmailAnalytics] = useState(null)

  const refreshSmtpDiagnostics = async () => {
    setEmailOpsLoading(true)
    try {
      const [statusRes, healthRes, logsRes, analyticsRes] = await Promise.all([
        api('/admin/email/status'),
        api('/admin/email/health').catch(() => ({ health: { ok: false, message: 'Health check unavailable' } })),
        api('/admin/email/logs?limit=25').catch(() => ({ email_logs: [] })),
        api('/admin/email/analytics').catch(() => ({ analytics: null })),
      ])
      setSmtpStatus(statusRes.smtp || null)
      setSmtpHealth(healthRes.health || null)
      setSmtpPortProbe(Array.isArray(healthRes.port_probe) ? healthRes.port_probe : [])
      setEmailLogs(logsRes.email_logs || [])
      setEmailAnalytics(analyticsRes.analytics || null)
    } catch (e) {
      showToast(e.message || 'Could not load SMTP status', 'error')
    } finally {
      setEmailOpsLoading(false)
    }
  }

  useEffect(() => {
    refreshSmtpDiagnostics()
  }, [])

  const retryFailedEmails = async () => {
    setEmailOpsLoading(true)
    try {
      const res = await api('/admin/email/retry', {
        method: 'POST',
        body: JSON.stringify({ retry_all_failed: true }),
      })
      showToast(res.message || 'Retry completed', res.ok ? 'success' : 'error')
      await refreshSmtpDiagnostics()
    } catch (e) {
      showToast(e.message || 'Retry failed', 'error')
    } finally {
      setEmailOpsLoading(false)
    }
  }

  const sendTestEmail = async () => {
    const to = testEmailTo.trim()
    if (!to) {
      showToast('Enter a recipient email for the test.', 'error')
      return
    }
    setEmailOpsLoading(true)
    try {
      const res = await api('/admin/email/test', { method: 'POST', body: JSON.stringify({ to }) })
      showToast(res.message || 'Test email sent', 'success')
    } catch (e) {
      showToast(e.message || 'Test email failed', 'error')
    } finally {
      setEmailOpsLoading(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Mail provider</p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Google Workspace SMTP</h3>
            <p className={`mt-1 max-w-xl text-sm ${admin.textMuted}`}>
              Credentials are configured in server <code className="text-xs">MAIL_*</code> environment variables only.
            </p>
          </div>
          <button type="button" onClick={refreshSmtpDiagnostics} disabled={emailOpsLoading} className={`${admin.btnSecondary} shrink-0`}>
            {emailOpsLoading ? 'Checking…' : 'Refresh status'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Configured</p>
            <p className={`mt-0.5 text-sm font-medium ${smtpStatus?.configured ? 'text-emerald-600' : 'text-amber-600'}`}>
              {smtpStatus?.configured ? 'Yes' : 'No — set MAIL_* in .env'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">SMTP health</p>
            <p className={`mt-0.5 text-sm font-medium ${smtpHealth?.ok ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-300'}`}>
              {smtpHealth?.ok ? `OK (${smtpHealth.latency_ms ?? '—'} ms)` : String(smtpHealth?.message || '—').slice(0, 48)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">From</p>
            <p className="mt-0.5 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
              {smtpStatus?.from_name || emailSettings.smtp_from_name} &lt;{smtpStatus?.from_address || emailSettings.smtp_from_email}&gt;
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Host</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200">
              {smtpStatus?.host || emailSettings.smtp_host}:{smtpStatus?.port || emailSettings.smtp_port}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FieldLabel label="Send test email" htmlFor="smtp-test-to" helper="Verifies live SMTP from the API server." />
            <input
              id="smtp-test-to"
              type="email"
              className={`w-full ${settingsInputClass}`}
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <button type="button" onClick={sendTestEmail} disabled={emailOpsLoading} className={`${admin.btnPrimary} sm:mb-0.5`}>
            Send test
          </button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <FieldLabel label="From name" htmlFor="smtp-fromname" />
          <input
            id="smtp-fromname"
            className={`mt-1 w-full ${admin.input}`}
            value={emailSettings.smtp_from_name}
            onChange={(e) => onPatchEmailSettings({ smtp_from_name: e.target.value })}
            disabled={readOnly}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel label="From email" htmlFor="smtp-fromemail" />
          <input
            id="smtp-fromemail"
            className={`mt-1 w-full ${admin.input}`}
            value={emailSettings.smtp_from_email}
            onChange={(e) => onPatchEmailSettings({ smtp_from_email: e.target.value })}
            placeholder="support@amalgatedlending.com"
            disabled={readOnly}
          />
        </div>
        <div className="min-w-0 md:col-span-2">
          <FieldLabel label="Email template subjects" helper="Default subjects for automated loan emails." htmlFor="tmpl-submitted" />
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <input
              id="tmpl-submitted"
              className={admin.input}
              value={emailSettings.template_loan_submitted_subject}
              onChange={(e) => onPatchEmailSettings({ template_loan_submitted_subject: e.target.value })}
              placeholder="Loan Application Submitted"
              disabled={readOnly}
            />
            <input
              className={admin.input}
              value={emailSettings.template_loan_approved_subject}
              onChange={(e) => onPatchEmailSettings({ template_loan_approved_subject: e.target.value })}
              placeholder="Loan Approved"
              disabled={readOnly}
            />
            <input
              className={admin.input}
              value={emailSettings.template_loan_rejected_subject}
              onChange={(e) => onPatchEmailSettings({ template_loan_rejected_subject: e.target.value })}
              placeholder="Loan Rejected"
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {emailAnalytics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Sent (24h)</p>
            <p className="mt-0.5 text-sm font-medium text-emerald-600">{emailAnalytics.sent_last_24_hours ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Failed (7d)</p>
            <p className="mt-0.5 text-sm font-medium text-amber-600">{emailAnalytics.failed_last_7_days ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Queue depth</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200">{emailAnalytics.notifications_queue_depth ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#1F2937] dark:bg-[#111827]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Period</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200">{emailAnalytics.period_days ?? 30} days</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent delivery log</p>
            <p className={`mt-0.5 text-xs ${admin.textMuted}`}>Failed, queued, and recent sent messages.</p>
          </div>
          {(emailAnalytics?.failed_last_7_days ?? 0) > 0 ? (
            <button type="button" onClick={retryFailedEmails} disabled={emailOpsLoading} className={admin.btnSecondary}>
              Retry failed
            </button>
          ) : null}
        </div>
        {emailLogs.length === 0 ? (
          <p className={`mt-4 text-sm ${admin.textMuted}`}>No delivery records yet.</p>
        ) : (
          <div className="mt-3 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-[#0F172A]">
                <tr>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Recipient</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((row) => (
                  <tr key={row.id} className="border-t border-gray-200 text-gray-700 dark:border-[#1F2937] dark:text-gray-300">
                    <td className="py-2 pr-2">
                      <span
                        className={
                          row.status === 'sent'
                            ? 'text-emerald-600'
                            : row.status === 'failed'
                              ? 'text-red-600'
                              : 'text-amber-600'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2">{row.notification_type}</td>
                    <td className="max-w-[140px] truncate py-2 pr-2">{row.recipient_email}</td>
                    <td className="py-2 text-gray-500">{row.sent_at || row.updated_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
