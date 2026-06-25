import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'
import { AdminPageSkeleton } from '../../components/AppSkeletons.jsx'
import { getLaravelStorageFileUrl, resolvePublicFileUrl } from '../../utils/lendingLaravelApi.js'
import { applicationPayloadRows } from '../utils/loanApplicationPayloadDisplay.js'
import {
  coMakerSubmittedFormRows,
  resolveCoMakersFromLoanApplication,
} from '../../shared/coMaker/coMakerDisplayUtils.js'
import BorrowerUploadedFilesPanel from '../components/BorrowerUploadedFilesPanel.jsx'
import CreditWellnessSummaryPanel from '../../components/wellness/CreditWellnessSummaryPanel.jsx'

function formatDateTime(iso) {
  if (iso == null || iso === '') return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return String(iso)
  }
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'B'
  const first = parts[0]?.[0] || ''
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''
  return `${first}${second}`.toUpperCase()
}

function isImagePath(path) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(path || ''))
}

function fallbackAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Borrower')}&background=fee2e2&color=b91c1c&size=96&bold=true`
}

export default function BorrowerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const [borrower, setBorrower] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api(`/borrowers/${id}`)
        if (!cancelled) setBorrower(res.borrower)
      } catch (e) {
        showToast(e.message, 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, showToast])

  const loans = useMemo(() => {
    const list = borrower?.loans || []
    return [...list].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))
  }, [borrower?.loans])

  const livenessRows = useMemo(() => {
    const list = borrower?.liveness_verifications || borrower?.livenessVerifications || []
    return Array.isArray(list) ? [...list].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0)) : []
  }, [borrower])

  const faceRows = useMemo(() => {
    const list = borrower?.face_verifications || borrower?.faceVerifications || []
    return Array.isArray(list) ? [...list].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0)) : []
  }, [borrower])

  const rbacRoles = useMemo(() => {
    const r = borrower?.roles
    return Array.isArray(r) ? r : []
  }, [borrower])

  const submitBorrowerPassword = async (e) => {
    e.preventDefault()
    if (!borrower?.id) return
    if (!passwordForm.password.trim()) {
      showToast('New password is required.', 'error')
      return
    }
    if (passwordForm.password.length < 8) {
      showToast('Password must be at least 8 characters.', 'error')
      return
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      showToast('Passwords do not match.', 'error')
      return
    }
    setPasswordSubmitting(true)
    try {
      await api(`/users/${borrower.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: passwordForm.password }),
      })
      showToast(`Password updated for ${borrower.name || 'borrower'}. They can sign in with the new password.`, 'success')
      setShowPasswordModal(false)
      setPasswordForm({ password: '', confirmPassword: '' })
    } catch (err) {
      showToast(err.message || 'Failed to update password.', 'error')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const handleDeleteBorrower = async () => {
    if (!borrower?.id || !can('borrowers.delete') || deleting) return
    if (loans.length > 0) {
      showToast('Cannot delete a borrower who has loan records.', 'error')
      return
    }
    const ok = window.confirm(
      `Delete borrower account for "${borrower.name}" (${borrower.email})? This cannot be undone.`,
    )
    if (!ok) return
    setDeleting(true)
    try {
      await api(`/borrowers/${borrower.id}`, { method: 'DELETE', body: '{}' })
      showToast('Borrower account deleted.', 'success')
      navigate('/admin/borrowers')
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleResendVerification = async () => {
    if (!borrower?.id || resendBusy || borrower.email_verified_at) return
    setResendBusy(true)
    try {
      const res = await api(`/users/${borrower.id}/resend-verification`, { method: 'POST', body: '{}' })
      showToast(res.message || 'Verification email queued for borrower.', 'success')
    } catch (e) {
      showToast(e.message || 'Could not send verification email.', 'error')
    } finally {
      setResendBusy(false)
    }
  }

  if (loading || !borrower) {
    return <AdminPageSkeleton />
  }

  const statCard = `${admin.cardNoHover} p-4`
  const borrowerAvatarUrl = isImagePath(borrower.profile_photo_path)
    ? getLaravelStorageFileUrl(borrower.profile_photo_path)
    : isImagePath(borrower.id_document_path)
      ? getLaravelStorageFileUrl(borrower.id_document_path)
      : null

  return (
    <div className="w-full min-w-0 space-y-8">
      <Link to="/admin/borrowers" className="text-sm text-red-600 hover:underline dark:text-red-400">
        ← Borrowers
      </Link>

      <div className="flex items-center gap-3">
        {borrowerAvatarUrl ? (
          <img
            src={borrowerAvatarUrl}
            alt={borrower.name || 'Borrower'}
            className="h-12 w-12 rounded-full border border-gray-200 object-cover dark:border-[#374151]"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = fallbackAvatar(borrower.name || 'Borrower')
            }}
          />
        ) : (
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
            {initials(borrower.name || 'Borrower')}
          </span>
        )}
        <div>
          <h1 className={admin.pageTitle}>{borrower.name}</h1>
          <p className={`mt-1 text-sm ${admin.textMuted}`}>{borrower.email}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={statCard}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${admin.textMuted}`}>Credit score</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {borrower.credit_score != null ? Number(borrower.credit_score).toFixed(0) : '—'}
          </p>
        </div>
        <div className={statCard}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${admin.textMuted}`}>Risk level</p>
          <p className="mt-2 text-lg font-medium capitalize text-gray-900 dark:text-gray-100">
            {borrower.risk_level || '—'}
          </p>
        </div>
        <div className={statCard}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${admin.textMuted}`}>Loans</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{loans.length}</p>
        </div>
      </div>

      {can('borrowers.view') ? (
        <CreditWellnessSummaryPanel borrowerId={id} variant="full" />
      ) : null}

      {can('borrowers.delete') ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/25">
          <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">Delete borrower account</h2>
          <p className={`mt-1 text-xs text-red-900/85 dark:text-red-200/85`}>
            Permanently removes this user from the system. Only allowed when there are no loans and no application history
            on file.
          </p>
          <button
            type="button"
            disabled={deleting || loans.length > 0}
            title={loans.length > 0 ? 'This borrower has loan records and cannot be deleted from here.' : undefined}
            onClick={handleDeleteBorrower}
            className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      ) : null}

      <div className={admin.cardNoHover}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower profile</h2>
        <p className={`mt-1 text-xs ${admin.textMuted}`}>
          Account and contact data from the users table (portal profile and admin CRM).
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="border-b border-gray-100 pb-3 dark:border-[#1F2937] sm:col-span-2">
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Borrower ID</dt>
            <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">{borrower.id}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Full name</dt>
            <dd className="mt-1 text-gray-900 dark:text-gray-100">{borrower.name || '—'}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Username</dt>
            <dd className="mt-1 text-gray-900 dark:text-gray-100">{borrower.username || '—'}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Email</dt>
            <dd className="mt-1 text-gray-900 dark:text-gray-100">{borrower.email || '—'}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Phone</dt>
            <dd className="mt-1 text-gray-900 dark:text-gray-100">{borrower.phone || '—'}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Primary role (column)</dt>
            <dd className="mt-1 capitalize text-gray-900 dark:text-gray-100">{borrower.role || '—'}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Account status</dt>
            <dd className="mt-1 text-gray-900 dark:text-gray-100">
              {borrower.is_active === false ? 'Inactive' : 'Active'}
            </dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Email verified</dt>
            <dd className="mt-1 text-gray-900 dark:text-gray-100">
              {borrower.email_verified_at ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                  Verified {formatDateTime(borrower.email_verified_at)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                  Pending
                </span>
              )}
            </dd>
            {!borrower.email_verified_at && can('users.manage') ? (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendBusy}
                className="mt-2 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                {resendBusy ? 'Sending...' : 'Resend verification email'}
              </button>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <dt className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>RBAC roles</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {rbacRoles.length === 0 ? (
                <span className={`text-sm ${admin.textMuted}`}>None</span>
              ) : (
                rbacRoles.map((role) => (
                  <span
                    key={role.id ?? role.slug}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-800 dark:border-[#374151] dark:bg-[#1F2937] dark:text-gray-200"
                  >
                    {role.name || role.slug || 'Role'}
                  </span>
                ))
              )}
            </dd>
          </div>
        </dl>
      </div>

      <BorrowerUploadedFilesPanel borrowerId={borrower.id} canVerifyDocs={can('loans.approve')} showToast={showToast} />

      {can('users.manage') ? (
        <div className={admin.cardNoHover}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower portal password</h2>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>
            Set a new password for this account so the borrower can sign in with username or email. Requires the{' '}
            <span className="font-medium">Manage users</span> permission (e.g. Super Admin).
          </p>
          <button
            type="button"
            onClick={() => {
              setPasswordForm({ password: '', confirmPassword: '' })
              setShowPasswordModal(true)
            }}
            className={`${admin.btnSecondary} mt-4`}
          >
            Set borrower password…
          </button>
        </div>
      ) : null}

      {livenessRows.length > 0 ? (
        <div className={admin.cardNoHover}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Liveness verification</h2>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>Recent checks from the borrower portal (AWS Rekognition).</p>
          <div className={`${admin.tableWrap} mt-4`}>
            <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin560}`}>
              <thead>
                <tr className={admin.thead}>
                  <th className={admin.tableCell}>ID</th>
                  <th className={admin.tableCell}>Status</th>
                  <th className={admin.tableCell}>Similarity</th>
                  <th className={admin.tableCell}>When</th>
                </tr>
              </thead>
              <tbody>
                {livenessRows.map((row) => (
                  <tr key={row.id} className={admin.tbodyRow}>
                    <td className={`${admin.tableCell} font-mono text-xs`}>#{row.id}</td>
                    <td className={`${admin.tableCell} capitalize`}>{row.status || '—'}</td>
                    <td className={`${admin.tableCell} tabular-nums`}>
                      {row.similarity_score != null ? `${Number(row.similarity_score).toFixed(1)}%` : '—'}
                    </td>
                    <td className={`${admin.tableCell} text-xs`}>{formatDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {faceRows.length > 0 ? (
        <div className={admin.cardNoHover}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Face recognition</h2>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>Single-image matches vs loan KYC photo (AWS Rekognition).</p>
          <div className={`${admin.tableWrap} mt-4`}>
            <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin560}`}>
              <thead>
                <tr className={admin.thead}>
                  <th className={admin.tableCell}>ID</th>
                  <th className={admin.tableCell}>Status</th>
                  <th className={admin.tableCell}>Similarity</th>
                  <th className={admin.tableCell}>When</th>
                </tr>
              </thead>
              <tbody>
                {faceRows.map((row) => (
                  <tr key={row.id} className={admin.tbodyRow}>
                    <td className={`${admin.tableCell} font-mono text-xs`}>#{row.id}</td>
                    <td className={`${admin.tableCell} capitalize`}>{row.status || '—'}</td>
                    <td className={`${admin.tableCell} tabular-nums`}>
                      {row.similarity_score != null ? `${Number(row.similarity_score).toFixed(1)}%` : '—'}
                    </td>
                    <td className={`${admin.tableCell} text-xs`}>{formatDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {loans.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loan applications &amp; KYC</h2>
          <p className={`text-xs ${admin.textMuted}`}>
            Per-application data lives on each loan (<code className="rounded bg-black/5 px-1 dark:bg-white/10">application_payload</code>, face
            photo, KYC documents).
          </p>
          {loans.map((ln) => {
            const payload = ln.application_payload
            const loanApplication = ln.loan_application || ln.loanApplication
            const coMakers = resolveCoMakersFromLoanApplication(loanApplication, payload)
            const rows = [
              ...applicationPayloadRows(payload),
              ...coMakerSubmittedFormRows(coMakers),
            ]
            const hasKyc =
              Boolean(ln.face_photo_path) || (Array.isArray(ln.kyc_documents) && ln.kyc_documents.length > 0)

            return (
              <div key={ln.id} className={`${admin.cardNoHover} space-y-5`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Loan{' '}
                      <Link className="text-red-600 hover:underline dark:text-red-400" to={`/admin/loans/${ln.id}`}>
                        #{ln.id}
                      </Link>
                    </h3>
                    <p className={`mt-1 text-xs ${admin.textMuted}`}>
                      ₱{Number(ln.principal).toLocaleString()} · {ln.term_months} mo ·{' '}
                      <span className="capitalize">{ln.status}</span>
                      {ln.created_at ? (
                        <>
                          {' '}
                          · Submitted {formatDateTime(ln.created_at)}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {ln.print_application_url ? (
                      <a
                        href={ln.print_application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                      >
                        Print form
                      </a>
                    ) : null}
                    {ln.print_statement_url ? (
                      <a
                        href={ln.print_statement_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                      >
                        Statement of Account (SOA)
                      </a>
                    ) : null}
                    <Link
                      className={`text-xs font-medium ${admin.textMuted} hover:text-gray-900 dark:hover:text-gray-100`}
                      to={`/admin/loans/${ln.id}`}
                    >
                      Open loan →
                    </Link>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Applicant / Co-maker</p>
                    <dl className="mt-3 grid gap-2 text-sm">
                      <div className="grid grid-cols-1 gap-0.5 border-b border-gray-100 pb-2 dark:border-[#1F2937] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4">
                        <dt className={admin.textMuted}>Applicant</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          <div>{borrower.name || '—'}</div>
                          <div className={`text-xs ${admin.textMuted}`}>{borrower.email || '—'}</div>
                        </dd>
                      </div>
                      <div className="grid grid-cols-1 gap-0.5 border-b border-gray-100 pb-2 dark:border-[#1F2937] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4">
                        <dt className={admin.textMuted}>Co-maker{coMakers.length > 1 ? 's' : ''}</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {coMakers.length === 0 ? (
                            'No co-maker'
                          ) : (
                            <ul className="space-y-3">
                              {coMakers.map((cm, cmIndex) => (
                                <li key={cm.id || `cm-${cmIndex}`}>
                                  <div className="font-medium">{cm.full_name}</div>
                                  {cm.email ? <div className={`text-xs ${admin.textMuted}`}>{cm.email}</div> : null}
                                  {cm.contact_number ? (
                                    <div className={`text-xs ${admin.textMuted}`}>{cm.contact_number}</div>
                                  ) : null}
                                  {cm.relationship_to_borrower ? (
                                    <div className={`text-xs ${admin.textMuted}`}>
                                      Relationship: {cm.relationship_to_borrower}
                                    </div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>Submitted form</p>
                    {rows.length === 0 ? (
                      <p className={`mt-2 text-sm ${admin.textMuted}`}>No extended application fields for this loan.</p>
                    ) : (
                      <dl className="mt-3 grid gap-2 text-sm">
                        {rows.map((r) => (
                          <div
                            key={r.key}
                            className="grid grid-cols-1 gap-0.5 border-b border-gray-100 pb-2 dark:border-[#1F2937] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4"
                          >
                            <dt className={`${admin.textMuted}`}>{r.label}</dt>
                            <dd className="text-gray-900 dark:text-gray-100">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    <p className={`text-xs font-medium uppercase tracking-wider ${admin.textMuted}`}>
                      Identity verification
                    </p>
                    {!hasKyc ? (
                      <p className={`mt-2 text-sm ${admin.textMuted}`}>No face photo or uploaded documents on file.</p>
                    ) : (
                      <div className="mt-3 space-y-4">
                        {ln.face_photo_path ? (
                          <div>
                            <p className={`text-xs ${admin.textMuted}`}>Face photo</p>
                            <a
                              href={getLaravelStorageFileUrl(ln.face_photo_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block"
                            >
                              <img
                                src={getLaravelStorageFileUrl(ln.face_photo_path)}
                                alt="Applicant face"
                                className="max-h-48 rounded-lg border border-gray-200 object-contain dark:border-[#1F2937]"
                                loading="lazy"
                                decoding="async"
                              />
                            </a>
                            {ln.face_capture_at ? (
                              <p className={`mt-1 text-xs ${admin.textMuted}`}>Captured: {String(ln.face_capture_at)}</p>
                            ) : null}
                          </div>
                        ) : null}
                        {Array.isArray(ln.kyc_documents) && ln.kyc_documents.length > 0 ? (
                          <div>
                            <p className={`text-xs ${admin.textMuted}`}>Documents</p>
                            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                              {ln.kyc_documents.map((doc, idx) => (
                                <li key={doc.key || doc.path || idx}>
                                  <span className="font-medium text-gray-800 dark:text-gray-100">
                                    {doc.label || 'Document'}:{' '}
                                  </span>
                                  <a
                                    href={resolvePublicFileUrl(doc.url || doc.path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-red-600 hover:underline dark:text-red-400"
                                  >
                                    {doc.original_name || 'Open file'}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={`${admin.cardNoHover} text-sm ${admin.textMuted}`}>No loan applications for this borrower yet.</div>
      )}

      <div className={admin.cardNoHover}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loan history</h2>
        <div className={`${admin.tableWrap} mt-4`}>
          <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin720}`}>
            <thead>
              <tr className={admin.thead}>
                <th className={admin.tableCell}>ID</th>
                <th className={admin.tableCell}>Principal</th>
                <th className={admin.tableCell}>Term</th>
                <th className={admin.tableCell}>Status</th>
                <th className={admin.tableCell}>Submitted</th>
                <th className={`${admin.tableCell} text-right`}> </th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${admin.tableCell} py-8 ${admin.textMuted}`}>
                    No loans yet.
                  </td>
                </tr>
              ) : (
                loans.map((ln) => (
                  <tr key={ln.id} className={admin.tbodyRow}>
                    <td className={admin.tableCell}>
                      <Link
                        className="text-red-600 hover:underline dark:text-red-400"
                        to={`/admin/loans/${ln.id}`}
                      >
                        #{ln.id}
                      </Link>
                    </td>
                    <td className={`${admin.tableCell} tabular-nums`}>₱{Number(ln.principal).toLocaleString()}</td>
                    <td className={`${admin.tableCell} tabular-nums`}>{ln.term_months} mo</td>
                    <td className={`${admin.tableCell} capitalize`}>{ln.status}</td>
                    <td className={`${admin.tableCell} text-xs`}>{formatDateTime(ln.created_at)}</td>
                    <td className={`${admin.tableCell} text-right`}>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {ln.print_application_url ? (
                          <a
                            href={ln.print_application_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                          >
                            Print
                          </a>
                        ) : null}
                        {ln.print_statement_url ? (
                          <a
                            href={ln.print_statement_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                          >
                            Statement of Account (SOA)
                          </a>
                        ) : null}
                        <Link
                          className={`text-xs ${admin.textMuted} hover:text-gray-900 dark:hover:text-gray-100`}
                          to={`/admin/loans/${ln.id}`}
                        >
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPasswordModal ? (
        <div className={admin.modalOverlay}>
          <div className={`${admin.modalCard} max-w-md`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Set borrower password</h2>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>
              New password for <span className="font-semibold">{borrower.name}</span> ({borrower.email}) — borrower portal sign-in.
            </p>
            <form className="mt-4 space-y-3" onSubmit={submitBorrowerPassword}>
              <input
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="New password (minimum 8 characters)"
                type="password"
                autoComplete="new-password"
                className={`w-full ${admin.input}`}
              />
              <input
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                placeholder="Confirm new password"
                type="password"
                autoComplete="new-password"
                className={`w-full ${admin.input}`}
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={passwordSubmitting} className={`${admin.btnPrimary} disabled:opacity-50`}>
                  {passwordSubmitting ? 'Updating…' : 'Update password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false)
                    setPasswordForm({ password: '', confirmPassword: '' })
                  }}
                  className={admin.btnSecondary}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
