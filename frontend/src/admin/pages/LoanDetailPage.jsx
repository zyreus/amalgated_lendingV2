import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'
import { AdminPageSkeleton } from '../../components/AppSkeletons.jsx'
import { getLaravelStorageFileUrl, resolvePublicFileUrl } from '../../utils/lendingLaravelApi.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { applicationStatusLabel, normalizeApplicationStatus, applicationStatusBadgeClass, formatCurrencyPhp } from '../components/applications/applicationStatus.js'
import { clearApplicationsCache } from '../services/applicationsService.js'
import CreditWellnessSummaryPanel from '../../components/wellness/CreditWellnessSummaryPanel.jsx'
import LoanDocumentManagerPanel from '../components/LoanDocumentManagerPanel.jsx'
import PropertyAppraisalPanel from '../components/PropertyAppraisalPanel.jsx'
import LoanEvaluationPanel from '../components/LoanEvaluationPanel.jsx'
import CollateralInformationPanel from '../components/CollateralInformationPanel.jsx'
import UniversalCoMakerModule from '../../shared/coMaker/UniversalCoMakerModule.jsx'
import { DEFAULT_CO_MAKER_DOCUMENT_CATEGORIES } from '../../shared/coMaker/coMakerSchema.js'

function mergeLoanFromApi(res) {
  if (!res?.loan) return null
  return {
    ...res.loan,
    last_decision_email: res.last_loan_decision_email ?? null,
  }
}

function describeDecisionEmailStatus(row) {
  if (!row?.status) return 'No decision email logged yet.'
  const st = String(row.status)
  const map = {
    queued: 'Queued — the notification worker will send this shortly.',
    sent: 'Delivered successfully.',
    failed: 'Sending failed — check API logs and mail configuration.',
    skipped_duplicate: 'Skipped as a duplicate send (already delivered).',
  }
  const base = map[st] || `Status: ${st}.`
  const extra = []
  if (row.recipient_email) extra.push(`Recipient: ${row.recipient_email}`)
  if (row.transport_detail) extra.push(`Transport: ${row.transport_detail}`)
  if (row.sent_at) extra.push(`Sent: ${row.sent_at}`)
  if (row.error_message) extra.push(`Detail: ${row.error_message}`)
  return [base, ...extra].join(' ')
}

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

const DOC_VERIFY_OPTIONS = [
  { value: 'pending', label: 'Pending review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'requires_resubmission', label: 'Requires resubmission' },
]

function verificationPillClass(status) {
  switch (status) {
    case 'verified':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-100'
    case 'rejected':
      return 'bg-red-100 text-red-900 dark:bg-red-900/35 dark:text-red-100'
    case 'requires_resubmission':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-100'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }
}

function buildApplicantUploads(loan) {
  const list = []
  if (!loan) return list

  const reviews =
    loan.document_reviews && typeof loan.document_reviews === 'object' && !Array.isArray(loan.document_reviews)
      ? loan.document_reviews
      : {}

  const push = ({ kind = 'file', label, path, url = null, originalName, loanDocumentId = null, record = null, coMakerId = null }) => {
    if (!path || typeof path !== 'string') return

    let reviewStatus = 'pending'
    let reviewNotes = ''
    if (record) {
      reviewStatus = record.verification_status || reviewStatus
      reviewNotes = record.review_notes || ''
    }
    const pathRev = reviews[path]
    if (pathRev && typeof pathRev === 'object' && pathRev.status) {
      reviewStatus = pathRev.status
      if (pathRev.notes != null && pathRev.notes !== '') {
        reviewNotes = pathRev.notes
      }
    }

    const key = loanDocumentId ? `ld-${loanDocumentId}` : `${kind}-${label}-${path}`

    list.push({
      key,
      kind,
      label,
      path,
      url,
      originalName: originalName || 'Open file',
      loanDocumentId,
      reviewStatus,
      reviewNotes,
      coMakerId,
    })
  }

  if (loan.face_photo_path) {
    push({
      kind: 'face',
      label: 'Face photo (liveness)',
      path: loan.face_photo_path,
      url: loan.face_photo_url,
      originalName: 'Face capture',
    })
  }

  const kycWithUrls = Array.isArray(loan.kyc_documents_with_urls) ? loan.kyc_documents_with_urls : null
  if (kycWithUrls?.length) {
    kycWithUrls.forEach((doc, idx) => {
      push({
        label: doc?.label || `KYC document ${idx + 1}`,
        path: doc?.path,
        url: doc?.url,
        originalName: doc?.original_name,
      })
    })
  } else if (Array.isArray(loan.kyc_documents)) {
    loan.kyc_documents.forEach((doc, idx) => {
      push({
        label: doc?.label || `KYC document ${idx + 1}`,
        path: doc?.path,
        originalName: doc?.original_name,
      })
    })
  }

  const app = loan.loan_application || null
  if (app) {
    const payloadDocs = app.documents_payload
    const payloadUrls = app.documents_payload_urls
    if (payloadDocs && typeof payloadDocs === 'object' && !Array.isArray(payloadDocs)) {
      Object.entries(payloadDocs).forEach(([docKey, value]) => {
        const arr = Array.isArray(value) ? value : [value]
        const urlArr = Array.isArray(payloadUrls?.[docKey]) ? payloadUrls[docKey] : payloadUrls?.[docKey] ? [payloadUrls[docKey]] : []
        arr.forEach((path, idx) => {
          push({
            label: `${String(docKey).replace(/_/g, ' ')}${arr.length > 1 ? ` #${idx + 1}` : ''}`,
            path,
            url: urlArr[idx] || null,
            originalName: `Open ${docKey}`,
          })
        })
      })
    }

    const records = Array.isArray(app.documents_records) ? app.documents_records : []
    records.forEach((d) => {
      push({
        label: (d?.document_type || 'Document').replace(/_/g, ' '),
        path: d?.file_path,
        url: d?.file_url,
        originalName: d?.original_name || 'Open',
        loanDocumentId: d?.id ?? null,
        record: d,
        coMakerId: d?.co_maker_id ?? null,
      })
    })

    push({
      label: 'Applicant signature',
      path: app.applicant_signature_path || app.applicant_signature,
      url: app.applicant_signature_url,
      originalName: 'Open applicant signature',
    })
    push({
      label: 'Spouse signature',
      path: app.spouse_signature_path || app.spouse_signature,
      url: app.spouse_signature_url,
      originalName: 'Open spouse signature',
    })
    push({
      label: 'Co-maker signature',
      path: app.comaker_signature_path || app.comaker_signature,
      url: app.comaker_signature_url,
      originalName: 'Open co-maker signature',
    })
  }

  return list
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
  const [reviewEdits, setReviewEdits] = useState({})
  const [confirmLoanAction, setConfirmLoanAction] = useState(null)
  const [activeTab, setActiveTab] = useState('borrower')
  const [approvedPrincipal, setApprovedPrincipal] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [amountWarning, setAmountWarning] = useState('')
  const [savingAmount, setSavingAmount] = useState(false)
  const [documentPermissions, setDocumentPermissions] = useState({})
  const [structuredCoMakers, setStructuredCoMakers] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const [res, coMakerRes] = await Promise.all([
        api(`/loans/${id}`),
        api(`/loans/${id}/co-makers`).catch(() => ({ data: [] })),
      ])
      setLoan(mergeLoanFromApi(res))
      setDocumentPermissions(res.document_permissions || {})
      setStructuredCoMakers(coMakerRes?.data || [])
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
    if (!loan) return
    const requested = loan.requested_principal ?? loan.loan_application?.loan_amount ?? loan.principal
    const approved = loan.approved_principal ?? loan.loan_application?.approved_amount ?? loan.principal
    setApprovedPrincipal(approved != null ? String(approved) : '')
    setApprovalNotes(loan.approval_notes || '')
  }, [loan?.id, loan?.approved_principal, loan?.requested_principal, loan?.approval_notes])

  useEffect(() => {
    if (loan?.assigned_officer_id) {
      setOfficerId(String(loan.assigned_officer_id))
    } else {
      setOfficerId('')
    }
  }, [loan?.assigned_officer_id])

  const buildApprovalPayload = () => {
    const payload = {
      admin_notes: notes?.trim() ? notes.trim() : null,
      approval_notes: approvalNotes?.trim() ? approvalNotes.trim() : null,
    }
    const parsed = Number(String(approvedPrincipal).replace(/,/g, ''))
    if (Number.isFinite(parsed) && parsed > 0) {
      payload.approved_principal = parsed
    }
    return payload
  }

  const runApprove = async (forceOverride = false) => {
    try {
      const payload = buildApprovalPayload()
      if (forceOverride) payload.force_amount_override = true
      const res = await api(`/loans/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setLoan(mergeLoanFromApi(res))
      clearApplicationsCache()
      const em = res?.last_loan_decision_email
      showToast(
        `Loan approved & schedule generated. ${em ? describeDecisionEmailStatus(em) : 'Borrower email queued.'}`,
        'success',
      )
      void load()
    } catch (e) {
      if (e?.body?.warning === 'amount_exceeds_requested' && can('loans.approve_amount_override')) {
        setAmountWarning(e.message)
        setConfirmLoanAction('approve-override')
        return
      }
      showToast(e.message, 'error')
      throw e
    }
  }

  const runPreApprove = async (forceOverride = false) => {
    try {
      const payload = buildApprovalPayload()
      if (forceOverride) payload.force_amount_override = true
      const res = await api(`/applications/${id}/pre-approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setLoan(mergeLoanFromApi(res))
      clearApplicationsCache()
      const em = res.last_loan_pre_approval_email
      showToast(
        em
          ? `Application pre-approved. ${describeDecisionEmailStatus(em)}`
          : 'Application pre-approved. Borrower portal and email notifications queued.',
        'success',
      )
      void load()
    } catch (e) {
      if (e?.body?.warning === 'amount_exceeds_requested' && can('loans.approve_amount_override')) {
        setAmountWarning(e.message)
        setConfirmLoanAction('pre-approve-override')
        return
      }
      showToast(e.message, 'error')
      throw e
    }
  }

  const runReturnToPending = async () => {
    try {
      const res = await api(`/applications/${id}/return-to-pending`, {
        method: 'POST',
        body: JSON.stringify({ admin_notes: notes?.trim() ? notes.trim() : null }),
      })
      setLoan(mergeLoanFromApi(res))
      clearApplicationsCache()
      showToast('Application returned to pending.', 'success')
      void load()
    } catch (e) {
      showToast(e.message, 'error')
      throw e
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

  const saveApprovedAmount = async (forceOverride = false) => {
    const parsed = Number(String(approvedPrincipal).replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast('Enter a valid approved loan amount.', 'error')
      return
    }
    setSavingAmount(true)
    try {
      const payload = {
        approved_principal: parsed,
        approval_notes: approvalNotes?.trim() ? approvalNotes.trim() : null,
      }
      if (forceOverride) payload.force_amount_override = true
      const res = await api(`/loans/${id}/approved-amount`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setLoan((prev) => ({ ...prev, ...res.loan }))
      clearApplicationsCache()
      showToast(
        res.audit_message
          || (res.ledger_rebuilt
            ? 'Loan amount updated and repayment schedule rebuilt.'
            : 'Loan amount and computations updated. Existing collections were preserved.'),
        'success',
      )
      void load()
    } catch (e) {
      if (e?.body?.warning === 'amount_exceeds_requested' && can('loans.approve_amount_override')) {
        setAmountWarning(e.message)
        setConfirmLoanAction('save-amount-override')
        return
      }
      showToast(e.message, 'error')
    } finally {
      setSavingAmount(false)
    }
  }

  const runReject = async () => {
    const reason = rejectReason?.trim() || ''
    if (!reason) {
      showToast('Enter a rejection reason.', 'error')
      throw new Error('validation')
    }
    try {
      const res = await api(`/loans/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason: reason }),
      })
      setLoan(mergeLoanFromApi(res))
      clearApplicationsCache()
      const em = res?.last_loan_decision_email
      showToast(
        `Loan rejected. ${em ? describeDecisionEmailStatus(em) : 'Borrower email queued.'}`,
        'success',
      )
      void load()
    } catch (e) {
      if (e.message !== 'validation') showToast(e.message, 'error')
      throw e
    }
  }

  const applicantUploads = useMemo(() => buildApplicantUploads(loan), [loan])
  const borrowerUploads = useMemo(
    () => applicantUploads.filter((u) => !u.coMakerId && u.kind !== 'comaker-only'),
    [applicantUploads],
  )
  const coMakerUploads = useMemo(
    () => applicantUploads.filter((u) => Boolean(u.coMakerId)),
    [applicantUploads],
  )
  const structuredBorrowerDocs = useMemo(() => {
    const records = loan?.loan_application?.documents_records || []
    return records.filter((d) => !d.co_maker_id)
  }, [loan])
  const structuredCoMakerDocs = useMemo(() => {
    const records = loan?.loan_application?.documents_records || []
    return records.filter((d) => d.co_maker_id)
  }, [loan])

  useEffect(() => {
    if (!loan) return
    const next = {}
    applicantUploads.forEach((u) => {
      next[u.key] = { status: u.reviewStatus || 'pending', notes: u.reviewNotes || '' }
    })
    setReviewEdits(next)
  }, [loan, applicantUploads])

  const saveDocReview = async (doc) => {
    const edit = reviewEdits[doc.key]
    if (!edit) return
    try {
      await api(`/loans/${id}/document-review`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(doc.loanDocumentId ? { loan_document_id: doc.loanDocumentId } : { storage_path: doc.path }),
          status: edit.status,
          notes: edit.notes?.trim() ? edit.notes.trim() : null,
        }),
      })
      showToast('Document verification saved.', 'success')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (loading || !loan) {
    return <AdminPageSkeleton />
  }

  const payments = loan.payments || []
  const app = loan.loan_application || null
  const isPensionLoan =
    app?.loan_type === 'sss_pension' || loan.application_payload?.loan_product_slug === 'sss-pension-loan'
  const isSalaryLoan =
    app?.loan_type === 'salary' || loan.application_payload?.loan_product_slug === 'salary-loan'
  const isAmortizationOnlyBorrowerCard = isPensionLoan || isSalaryLoan

  const requestedAmount = Number(loan.requested_principal ?? app?.loan_amount ?? 0) > 0
    ? (loan.requested_principal ?? app?.loan_amount ?? loan.principal)
    : null
  const approvedAmount = loan.approved_principal ?? app?.approved_amount ?? (Number(loan.principal) > 0 ? loan.principal : null)
  const realEstateDetail = app?.real_estate_detail || app?.realEstateDetail || null
  const borrowerPropertyInfo = app?.loan_type === 'real_estate'
    ? {
        property_type: app?.form_data?.property_type ?? realEstateDetail?.property_type,
        property_address: app?.form_data?.property_address ?? realEstateDetail?.property_address,
        property_description: app?.form_data?.property_description ?? realEstateDetail?.property_description,
        title_number: app?.form_data?.title_number ?? realEstateDetail?.title_number,
        tax_declaration_number: app?.form_data?.tax_declaration_number ?? realEstateDetail?.tax_declaration_number,
      }
    : null
  const coMakers = structuredCoMakers.length
    ? structuredCoMakers
    : app?.co_makers?.length
      ? app.co_makers
      : app?.co_maker_name
        ? [{ full_name: app.co_maker_name, email: app.co_maker_email, contact_number: app.co_maker_phone }]
        : []
  const normalizedStatus = normalizeApplicationStatus(loan.status)
  const canApproveFlow = ['pending', 'partially-approved', 'for-evaluation', 'under-review'].includes(normalizedStatus)
  const canEditAmount = (can('loans.edit_amount') || can('loans.approve')) && !['rejected', 'cancelled', 'completed'].includes(normalizedStatus)
  const amountModifierName = loan.amount_modifier?.name || null
  const amountModifiedAt = loan.amount_modified_at || null

  const LOAN_TABS = [
    { id: 'borrower', label: 'Borrower Information' },
    { id: 'borrower-docs', label: 'Borrower Documents' },
    { id: 'comakers', label: 'Co-Maker Information' },
    { id: 'comaker-docs', label: 'Co-Maker Documents' },
    { id: 'collateral', label: 'Collateral Information' },
    { id: 'evaluation', label: 'Loan Evaluation' },
    { id: 'approval-history', label: 'Approval History' },
    { id: 'release', label: 'Release Information' },
  ]

  return (
    <div className="w-full min-w-0 space-y-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-red-600 hover:underline dark:text-red-400"
      >
        ← Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={admin.pageTitle}>Loan #{loan.id}</h1>
          <p className={`mt-1 text-sm ${admin.textMuted}`}>
            Status:{' '}
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${applicationStatusBadgeClass(loan.status)}`}>
              {applicationStatusLabel(loan.status)}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1 dark:border-[#1F2937]">
        {LOAN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#1F2937]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {canApproveFlow && can('loans.approve') && (
        <div className={`grid gap-4 p-5 lg:grid-cols-2 ${admin.cardNoHover}`}>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {requestedAmount != null ? (
                <div>
                  <label className={`text-xs font-medium ${admin.textMuted}`}>Legacy requested amount</label>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{formatCurrencyPhp(requestedAmount)}</p>
                </div>
              ) : null}
              <div>
                <label className={`text-xs font-medium ${admin.textMuted}`}>Approved loan amount</label>
                <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                  {approvedAmount != null ? formatCurrencyPhp(approvedAmount) : 'Pending evaluation'}
                </p>
              </div>
            </div>
            <p className={`text-xs ${admin.textMuted}`}>
              Set the approved amount and evaluation remarks on the <strong>Loan Evaluation</strong> tab before approving.
            </p>
            <label className={`text-xs font-medium ${admin.textMuted}`}>Admin notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`mt-1 w-full ${admin.input}`}
              rows={2}
            />
            <button
              type="button"
              onClick={() => setConfirmLoanAction(normalizedStatus === 'pending' ? 'pre-approve' : 'approve')}
              className="mt-1 rounded-xl bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-700"
            >
              {normalizedStatus === 'pending' ? 'Partially Approve' : 'Approve & Release'}
            </button>
            {normalizedStatus === 'partially-approved' ? (
              <button
                type="button"
                onClick={() => setConfirmLoanAction('return-pending')}
                className="ml-2 mt-1 rounded-xl border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-100"
              >
                Return to pending
              </button>
            ) : null}
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
              onClick={() => setConfirmLoanAction('reject')}
              className="mt-3 rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 dark:border-red-500/50 dark:text-red-300"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {loan.last_decision_email ? (
        <div className={`text-sm ${admin.cardNoHover}`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower decision email</h2>
          <p className={`mt-2 text-sm ${admin.textMuted}`}>{describeDecisionEmailStatus(loan.last_decision_email)}</p>
        </div>
      ) : null}

      {(activeTab === 'borrower' || activeTab === 'collateral') && (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`text-sm ${admin.cardNoHover} ${activeTab !== 'borrower' ? 'hidden' : ''}`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower</h2>
          {loan.borrower?.id ? (
            <Link
              to={`/admin/borrowers/${loan.borrower.id}`}
              className="mt-2 inline-block text-gray-800 hover:underline dark:text-gray-100"
            >
              {loan.borrower?.name}
            </Link>
          ) : (
            <p className="mt-2 text-gray-800 dark:text-gray-100">{loan.borrower?.name}</p>
          )}
          <p className={admin.textMuted}>{loan.borrower?.email}</p>
          <p className={`mt-4 ${admin.textMuted}`}>
            {loan.term_months} months · Rate: {describeLoanRate(loan)}
          </p>
          {loan.monthly_payment != null && Number(loan.monthly_payment) > 0 && (
            <p className={`mt-2 ${admin.textMuted}`}>
              {isAmortizationOnlyBorrowerCard ? 'Monthly amortization' : 'Est. monthly payment'}: ₱
              {Number(loan.monthly_payment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          {!isAmortizationOnlyBorrowerCard && loan.monthly_payment != null && Number(loan.monthly_payment) > 0 && (
            <p className={`mt-1 ${admin.textMuted}`}>
              Est. semi-monthly payment: ₱{(Number(loan.monthly_payment) / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          {!isAmortizationOnlyBorrowerCard && loan.total_deductions != null && (
            <p className={`mt-1 ${admin.textMuted}`}>
              Deductions: ₱{Number(loan.total_deductions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Net proceeds: ₱
              {Number(loan.net_proceeds || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          {!isAmortizationOnlyBorrowerCard && loan?.application_payload?.monthly_pension != null && loan.monthly_payment != null && (
            <p className={`mt-1 ${admin.textMuted}`}>
              Remaining pension after deduction: ₱
              {(Number(loan.application_payload.monthly_pension) - Number(loan.monthly_payment)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      )}

      {loan.borrower?.id && can('borrowers.view') && activeTab === 'borrower' ? (
        <CreditWellnessSummaryPanel borrowerId={loan.borrower.id} variant="full" />
      ) : null}

      {activeTab === 'evaluation' && (
        <div className={`text-sm ${admin.cardNoHover}`}>
          <LoanEvaluationPanel
            loanId={loan.id}
            loanType={app?.loan_type}
            loanStatus={loan.status}
            requestedAmount={requestedAmount}
            applicationLoanAmount={app?.loan_amount}
            approvedAmount={approvedAmount}
            approvalNotes={loan.approval_notes || ''}
            realEstateDetail={realEstateDetail}
            amountModifierName={amountModifierName}
            amountModifiedAt={amountModifiedAt}
            canEdit={canEditAmount}
            onSaved={load}
          />
        </div>
      )}

      {activeTab === 'approval-history' && (
        <div className={`text-sm ${admin.cardNoHover}`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Approval history</h2>
          {Array.isArray(loan.approval_history) && loan.approval_history.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {[...loan.approval_history].reverse().map((entry, idx) => (
                <li key={idx} className="rounded-lg border border-gray-100 p-3 dark:border-[#1F2937]">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{entry.event || 'Status change'}</p>
                  <p className={`mt-1 text-xs ${admin.textMuted}`}>{entry.at}</p>
                  {entry.user_name ? <p className={`text-xs ${admin.textMuted}`}>By: {entry.user_name}</p> : null}
                  {entry.previous_approved_principal != null ? (
                    <p className={`text-xs ${admin.textMuted}`}>
                      Amount: {formatCurrencyPhp(entry.previous_approved_principal)} → {formatCurrencyPhp(entry.approved_principal)}
                    </p>
                  ) : entry.approved_principal != null ? (
                    <p className={`text-xs ${admin.textMuted}`}>Amount: {formatCurrencyPhp(entry.approved_principal)}</p>
                  ) : null}
                  {entry.notes ? <p className={`mt-1 text-xs ${admin.textMuted}`}>{entry.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-2 ${admin.textMuted}`}>No approval history recorded yet.</p>
          )}
        </div>
      )}

      {activeTab === 'release' && (
        <div className={`text-sm ${admin.cardNoHover}`}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Release information</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className={`text-xs ${admin.textMuted}`}>Release date</dt><dd>{loan.disbursed_at ? String(loan.disbursed_at) : '—'}</dd></div>
            <div><dt className={`text-xs ${admin.textMuted}`}>Released amount</dt><dd className="font-semibold">{formatCurrencyPhp(loan.net_proceeds ?? approvedAmount)}</dd></div>
            <div><dt className={`text-xs ${admin.textMuted}`}>Released by</dt><dd>{loan.releaser?.name || loan.approver?.name || '—'}</dd></div>
            <div><dt className={`text-xs ${admin.textMuted}`}>Gross approved principal</dt><dd>{formatCurrencyPhp(approvedAmount)}</dd></div>
          </dl>
        </div>
      )}

      {activeTab === 'comakers' && (
        <UniversalCoMakerModule
          loanId={loan.id}
          coMakers={coMakers}
          documentCategories={DEFAULT_CO_MAKER_DOCUMENT_CATEGORIES}
          onUpdated={load}
          onError={(msg) => showToast(msg, 'error')}
          readOnly={!can('loans.comakers.manage') && !can('loans.approve')}
          apiMode="admin"
          canReview={can('loans.approve') || can('loans.comakers.manage')}
        />
      )}

      {activeTab === 'collateral' && app && (
        <div className="space-y-6">
          {app.loan_type === 'real_estate' ? (
            <div className={`text-sm ${admin.cardNoHover}`}>
              <PropertyAppraisalPanel
                loanId={loan.id}
                detail={realEstateDetail}
                borrowerSubmission={borrowerPropertyInfo}
                canEdit={can('loans.approve')}
                onSaved={load}
              />
            </div>
          ) : (
            <CollateralInformationPanel application={app} />
          )}
        </div>
      )}

      {activeTab === 'borrower-docs' ? (
        <div className={`space-y-6 text-sm`}>
          <div className={admin.cardNoHover}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Structured borrower documents</h2>
            <div className="mt-4">
              <LoanDocumentManagerPanel
                loanId={loan.id}
                documents={structuredBorrowerDocs}
                permissions={documentPermissions}
                onChanged={load}
                canReview={can('loans.approve')}
              />
            </div>
          </div>
          {borrowerUploads.length > 0 ? (
            <div className={admin.cardNoHover}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Portal & KYC uploads</h2>
              <p className={`mt-1 text-xs ${admin.textMuted}`}>
                Wizard uploads, KYC attachments, and signatures. Verification changes are audit-logged.
              </p>
              <ul className="mt-4 space-y-6 border-t border-gray-100 pt-4 dark:border-[#1F2937]">
                {borrowerUploads.map((doc) => {
                  const edit = reviewEdits[doc.key] || { status: doc.reviewStatus, notes: doc.reviewNotes }
                  const displayStatus = edit.status || doc.reviewStatus || 'pending'
                  const fileUrl = resolvePublicFileUrl(doc.url || doc.path)
                  return (
                    <li key={doc.key} className="list-none">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{doc.label}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${verificationPillClass(displayStatus)}`}>
                              {String(displayStatus).replace(/_/g, ' ')}
                            </span>
                          </div>
                          {doc.kind === 'face' ? (
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                              <img src={fileUrl} alt="Applicant face" className="max-h-56 rounded-lg border border-gray-200 object-contain dark:border-[#1F2937]" loading="lazy" decoding="async" />
                            </a>
                          ) : (
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 hover:underline dark:text-red-400">
                              {doc.originalName || 'Open file'}
                            </a>
                          )}
                        </div>
                        {can('loans.approve') ? (
                          <div className="w-full min-w-[220px] max-w-md space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#111827]/60">
                            <label className={`text-[10px] font-semibold uppercase tracking-wide ${admin.textMuted}`}>Verification</label>
                            <select value={edit.status || 'pending'} onChange={(e) => setReviewEdits((prev) => ({ ...prev, [doc.key]: { ...edit, status: e.target.value } }))} className={`w-full ${admin.input}`}>
                              {DOC_VERIFY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <textarea placeholder="Review notes (optional)" value={edit.notes ?? ''} onChange={(e) => setReviewEdits((prev) => ({ ...prev, [doc.key]: { ...edit, notes: e.target.value } }))} rows={2} className={`w-full ${admin.input}`} />
                            <button type="button" onClick={() => saveDocReview(doc)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Save review</button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'comaker-docs' ? (
        <div className={`space-y-6 text-sm`}>
          <div className={admin.cardNoHover}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Co-maker structured documents</h2>
            {coMakers.length === 0 ? (
              <p className={`mt-2 ${admin.textMuted}`}>No co-maker documents on file.</p>
            ) : (
              coMakers.map((cm) => (
                <div key={cm.id || cm.full_name} className="mt-4 border-t border-gray-100 pt-4 dark:border-[#1F2937]">
                  <LoanDocumentManagerPanel
                    loanId={loan.id}
                    documents={structuredCoMakerDocs.filter((d) => Number(d.co_maker_id) === Number(cm.id))}
                    permissions={documentPermissions}
                    coMakerLabel={cm.full_name}
                    onChanged={load}
                    canReview={can('loans.approve')}
                  />
                </div>
              ))
            )}
          </div>
          {coMakerUploads.length > 0 ? (
            <div className={admin.cardNoHover}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Additional co-maker files</h2>
              <ul className="mt-4 space-y-4">
                {coMakerUploads.map((doc) => {
                  const fileUrl = resolvePublicFileUrl(doc.url || doc.path)
                  return (
                    <li key={doc.key}>
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="text-sm text-red-600 hover:underline dark:text-red-400">
                        {doc.label} — {doc.originalName || 'Open file'}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {loan.loan_application && activeTab !== 'collateral' ? (
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
        </div>
      ) : null}

      <ConfirmModal
        open={confirmLoanAction === 'save-amount-override'}
        onClose={() => setConfirmLoanAction(null)}
        title="Override requested amount?"
        description={amountWarning || 'Approved amount exceeds requested. Confirm Super Admin override.'}
        confirmLabel="Override & save amount"
        tone="warning"
        onConfirm={() => saveApprovedAmount(true)}
      />
      <ConfirmModal
        open={confirmLoanAction === 'pre-approve-override'}
        onClose={() => setConfirmLoanAction(null)}
        title="Override requested amount?"
        description={amountWarning || 'Approved amount exceeds requested. Confirm Super Admin override.'}
        confirmLabel="Override & partially approve"
        tone="warning"
        onConfirm={() => runPreApprove(true)}
      />
      <ConfirmModal
        open={confirmLoanAction === 'approve-override'}
        onClose={() => setConfirmLoanAction(null)}
        title="Override requested amount?"
        description={amountWarning || 'Approved amount exceeds requested. Confirm Super Admin override.'}
        confirmLabel="Override & approve"
        tone="warning"
        onConfirm={() => runApprove(true)}
      />
      <ConfirmModal
        open={confirmLoanAction === 'pre-approve'}
        onClose={() => setConfirmLoanAction(null)}
        title="Pre-approve this application?"
        description="This will move the application into the pre-approved queue. The borrower will be notified in their portal and by email to wait for final approval and schedule an office visit to confirm their loan application."
        confirmLabel="Pre-Approve"
        tone="success"
        onConfirm={runPreApprove}
      />
      <ConfirmModal
        open={confirmLoanAction === 'approve'}
        onClose={() => setConfirmLoanAction(null)}
        title="Approve this loan?"
        description="This will generate the repayment schedule, mark the application approved, and queue a decision email to the borrower. Continue?"
        confirmLabel="Approve"
        tone="success"
        onConfirm={runApprove}
      />
      <ConfirmModal
        open={confirmLoanAction === 'return-pending'}
        onClose={() => setConfirmLoanAction(null)}
        title="Return to pending?"
        description="This will move the pre-approved application back to pending review."
        confirmLabel="Return to pending"
        tone="default"
        onConfirm={runReturnToPending}
      />
      <ConfirmModal
        open={confirmLoanAction === 'reject'}
        onClose={() => setConfirmLoanAction(null)}
        title="Reject this application?"
        description="The borrower will be notified by email (queued) with the rejection reason you entered."
        confirmLabel="Reject application"
        tone="danger"
        onConfirm={runReject}
      />

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
