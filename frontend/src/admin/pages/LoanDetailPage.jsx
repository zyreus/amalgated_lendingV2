import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'
import { AdminPageSkeleton } from '../../components/AppSkeletons.jsx'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'

function describeLoanRate(loan) {
  const annual = Number(loan?.annual_interest_rate)
  const pl = loan?.application_payload
  const rt = pl?.selected_rate_type
  const m = pl?.selected_interest_rate != null ? Number(pl.selected_interest_rate) : NaN
  if (rt === 'monthly' && Number.isFinite(m) && m > 0 && Number.isFinite(annual)) {
    return `${m.toFixed(2)}%/mo (nominal annual ${annual.toFixed(2)}%)`
  }
  if (Number.isFinite(annual) && annual > 0) {
    return `${annual.toFixed(2)}%/yr`
  }
  return '—'
}

export default function LoanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const [loan, setLoan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [staff, setStaff] = useState([])
  const [officerId, setOfficerId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/loans/${id}`)
      setLoan(res.loan)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    if (!can('loans.assign')) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api('/users?per_page=100')
        const rows = res?.data?.data ?? res?.data ?? []
        const allowedRoleSlugs = new Set([
          'super-admin',
          'admin',
          'admin-staff',
          'collector',
          'loan-officer',
        ])
        const filtered = (Array.isArray(rows) ? rows : []).filter((u) => {
          const roles = Array.isArray(u?.roles) ? u.roles : []
          return roles.some((r) => {
            const slug = String(r?.slug || '').toLowerCase()
            const name = String(r?.name || '').toLowerCase()
            return (
              allowedRoleSlugs.has(slug) ||
              name.includes('admin') ||
              name.includes('collector') ||
              name.includes('loan officer')
            )
          })
        })
        if (!cancelled) setStaff(filtered)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [can])

  useEffect(() => {
    if (loan?.assigned_officer_id) {
      setOfficerId(String(loan.assigned_officer_id))
    } else {
      setOfficerId('')
    }
  }, [loan?.assigned_officer_id])

  const approve = async () => {
    try {
      await api(`/loans/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ admin_notes: notes || null }),
      })
      showToast('Loan approved & schedule generated.', 'success')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const assignOfficer = async () => {
    if (!officerId) {
      showToast('Select an officer', 'error')
      return
    }
    try {
      await api(`/loans/${id}/assign-officer`, {
        method: 'PATCH',
        body: JSON.stringify({ officer_id: Number(officerId) }),
      })
      showToast('Loan officer assigned.', 'success')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const reject = async () => {
    try {
      await api(`/loans/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason: rejectReason || 'Rejected' }),
      })
      showToast('Loan rejected.', 'success')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (loading || !loan) {
    return <AdminPageSkeleton />
  }

  const payments = loan.payments || []

  return (
    <div className="w-full min-w-0 space-y-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-red-600 hover:underline dark:text-red-400"
      >
        ← Back
      </button>

      <div>
        <h1 className={admin.pageTitle}>Loan #{loan.id}</h1>
        <p className={`mt-1 text-sm capitalize ${admin.textMuted}`}>Status: {loan.status}</p>
      </div>

      {loan.status === 'pending' && can('loans.approve') && (
        <div className={`grid gap-4 p-5 lg:grid-cols-2 ${admin.cardNoHover}`}>
          <div>
            <label className={`text-xs font-medium ${admin.textMuted}`}>Admin notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`mt-1 w-full ${admin.input}`}
              rows={3}
            />
            <button
              type="button"
              onClick={approve}
              className="mt-3 rounded-xl bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-700"
            >
              Approve &amp; generate schedule
            </button>
          </div>
          <div>
            <label className={`text-xs font-medium ${admin.textMuted}`}>Reject reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={`mt-1 w-full ${admin.input}`}
              rows={3}
            />
            <button
              type="button"
              onClick={reject}
              className="mt-3 rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 dark:border-red-500/50 dark:text-red-300"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`text-sm ${admin.cardNoHover}`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower</h2>
          <p className="mt-2 text-gray-800 dark:text-gray-100">{loan.borrower?.name}</p>
          <p className={admin.textMuted}>{loan.borrower?.email}</p>
          <p className={`mt-4 ${admin.textMuted}`}>
            Principal ₱{Number(loan.principal).toLocaleString()} · {loan.term_months} months · Rate:{' '}
            {describeLoanRate(loan)}
          </p>
          {loan.monthly_payment != null && Number(loan.monthly_payment) > 0 && (
            <p className={`mt-2 ${admin.textMuted}`}>
              Est. monthly payment: ₱{Number(loan.monthly_payment).toLocaleString()}
            </p>
          )}
          {loan.outstanding_balance != null && (
            <p className={`mt-1 ${admin.textMuted}`}>
              Outstanding: ₱{Number(loan.outstanding_balance).toLocaleString()}
            </p>
          )}
        </div>

        <div className={admin.cardNoHover}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loan officer</h2>
          {loan.assigned_officer && (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Current: {loan.assigned_officer.name} ({loan.assigned_officer.email})
            </p>
          )}
          {can('loans.assign') ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className={`text-xs font-medium ${admin.textMuted}`} htmlFor="officer-select">
                  Assign officer
                </label>
                <select
                  id="officer-select"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  className={`mt-1 w-full ${admin.input}`}
                >
                  <option value="">Select user…</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={assignOfficer}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Save
              </button>
            </div>
          ) : (
            <p className={`mt-2 text-xs ${admin.textMuted}`}>You do not have permission to assign officers.</p>
          )}
        </div>
      </div>

      {(loan.face_photo_path || (Array.isArray(loan.kyc_documents) && loan.kyc_documents.length > 0)) ? (
        <div className={`text-sm ${admin.cardNoHover}`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Application KYC</h2>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>
            Face capture and documents from the online application (stored on the lending API).
          </p>
          {loan.face_photo_path ? (
            <div className="mt-4">
              <p className={`text-xs font-medium ${admin.textMuted}`}>Face photo</p>
              <a
                href={getLaravelStorageFileUrl(loan.face_photo_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block"
              >
                <img
                  src={getLaravelStorageFileUrl(loan.face_photo_path)}
                  alt="Applicant face"
                  className="max-h-56 rounded-lg border border-gray-200 object-contain dark:border-[#1F2937]"
                />
              </a>
              {loan.face_capture_at ? (
                <p className={`mt-1 text-xs ${admin.textMuted}`}>Captured: {String(loan.face_capture_at)}</p>
              ) : null}
            </div>
          ) : null}
          {Array.isArray(loan.kyc_documents) && loan.kyc_documents.length > 0 ? (
            <div className="mt-4">
              <p className={`text-xs font-medium ${admin.textMuted}`}>Documents</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {loan.kyc_documents.map((doc, idx) => (
                  <li key={doc.key || doc.path || idx}>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{doc.label || 'Document'}: </span>
                    <a
                      href={getLaravelStorageFileUrl(doc.path)}
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
      ) : null}

      {loan.loan_application ? (
        <div className={`text-sm ${admin.cardNoHover}`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {loan.loan_application.loan_type === 'real_estate'
              ? 'Real estate mortgage package'
              : loan.loan_application.loan_type === 'salary'
                ? 'Salary loan package'
                : loan.loan_application.loan_type === 'travel_assistance'
                  ? 'Travel assistance package'
                  : loan.loan_application.loan_type === 'sss_pension'
                    ? 'SSS / GSIS pension package'
                    : 'Chattel mortgage package'}
          </h2>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>
            Application #{loan.loan_application.id} · Type: {loan.loan_application.loan_type || 'chattel'}
          </p>
          {loan.loan_application.loan_type === 'real_estate' && loan.loan_application.property_location ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Property location:{' '}
              <span className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                {loan.loan_application.property_location}
              </span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'real_estate' &&
          loan.loan_application.property_value != null &&
          String(loan.loan_application.property_value) !== '' ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Estimated property value:{' '}
              <span className="text-gray-900 dark:text-gray-100">
                ₱{Number(loan.loan_application.property_value).toLocaleString()}
              </span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'salary' && loan.loan_application.employer_name ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Employer:{' '}
              <span className="text-gray-900 dark:text-gray-100">{loan.loan_application.employer_name}</span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'salary' &&
          loan.loan_application.monthly_salary != null &&
          String(loan.loan_application.monthly_salary) !== '' ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Declared monthly salary:{' '}
              <span className="text-gray-900 dark:text-gray-100">
                ₱{Number(loan.loan_application.monthly_salary).toLocaleString()}
              </span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'travel_assistance' && loan.loan_application.destination_country ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Destination:{' '}
              <span className="text-gray-900 dark:text-gray-100">{loan.loan_application.destination_country}</span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'travel_assistance' && loan.loan_application.travel_date ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Travel date:{' '}
              <span className="text-gray-900 dark:text-gray-100">{String(loan.loan_application.travel_date)}</span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'travel_assistance' && loan.loan_application.purpose ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Travel purpose:{' '}
              <span className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">{loan.loan_application.purpose}</span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'sss_pension' && loan.loan_application.pension_type ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Pension type:{' '}
              <span className="text-gray-900 dark:text-gray-100">{loan.loan_application.pension_type}</span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'sss_pension' &&
          loan.loan_application.monthly_pension != null &&
          String(loan.loan_application.monthly_pension) !== '' ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Monthly pension:{' '}
              <span className="text-gray-900 dark:text-gray-100">
                ₱{Number(loan.loan_application.monthly_pension).toLocaleString()}
              </span>
            </p>
          ) : null}
          {loan.loan_application.loan_type === 'sss_pension' && loan.loan_application.age != null ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Declared age: <span className="text-gray-900 dark:text-gray-100">{loan.loan_application.age}</span>
            </p>
          ) : null}
          {loan.loan_application.tin_number ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              TIN: <span className="text-gray-900 dark:text-gray-100">{loan.loan_application.tin_number}</span>
            </p>
          ) : null}
          {loan.loan_application.stencil_text ? (
            <p className={`mt-2 text-sm ${admin.textMuted}`}>
              Stencil:{' '}
              <span className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">{loan.loan_application.stencil_text}</span>
            </p>
          ) : null}
          {Array.isArray(loan.loan_application.documents) && loan.loan_application.documents.length > 0 ? (
            <ul className="mt-3 list-inside list-disc space-y-1">
              {loan.loan_application.documents.map((d) => (
                <li key={d.id}>
                  <span className="font-medium capitalize text-gray-800 dark:text-gray-100">
                    {(d.document_type || 'doc').replace(/_/g, ' ')}:{' '}
                  </span>
                  <a
                    href={getLaravelStorageFileUrl(d.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 hover:underline dark:text-red-400"
                  >
                    {d.original_name || 'Open'}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {payments.length > 0 && (
        <div className={admin.tableWrap}>
          <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin720}`}>
            <thead>
              <tr className={admin.thead}>
                <th className={admin.tableCell}>#</th>
                <th className={admin.tableCell}>Due</th>
                <th className={admin.tableCell}>Amount</th>
                <th className={admin.tableCell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className={admin.tbodyRow}>
                  <td className={admin.tableCell}>{p.installment_no}</td>
                  <td className={admin.tableCell}>{p.due_date}</td>
                  <td className={admin.tableCell}>₱{Number(p.amount_due).toLocaleString()}</td>
                  <td className={`${admin.tableCell} capitalize`}>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
