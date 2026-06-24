import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from './AdminUi.jsx'
import { applicationStatusLabel, formatCurrencyPhp } from './applications/applicationStatus.js'

function numOrEmpty(v) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : ''
}

function computeLoanablePreview(appraised, market, pct) {
  const base = Number(appraised) > 0 ? Number(appraised) : Number(market)
  const p = Number(pct)
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(p) || p <= 0) return null
  return Math.round(base * (p / 100) * 100) / 100
}

/**
 * Single authoritative loan evaluation form (staff only).
 */
export default function LoanEvaluationPanel({
  loanId,
  loanType,
  loanStatus,
  requestedAmount,
  approvedAmount: savedApprovedAmount,
  approvalNotes: savedApprovalNotes = '',
  realEstateDetail = null,
  amountModifierName = null,
  amountModifiedAt = null,
  canEdit = false,
  onSaved,
}) {
  const { showToast } = useToast()
  const [approvedPrincipal, setApprovedPrincipal] = useState('')
  const [evaluationRemarks, setEvaluationRemarks] = useState('')
  const [appraisedValue, setAppraisedValue] = useState('')
  const [loanablePercentage, setLoanablePercentage] = useState('')
  const [saving, setSaving] = useState(false)

  const isRealEstate = loanType === 'real_estate'
  const legacyRequested = Number(requestedAmount) > 0 ? Number(requestedAmount) : null

  useEffect(() => {
    setApprovedPrincipal(savedApprovedAmount != null ? String(savedApprovedAmount) : '')
    setEvaluationRemarks(savedApprovalNotes || realEstateDetail?.evaluation_remarks || '')
    setAppraisedValue(numOrEmpty(realEstateDetail?.appraised_value))
    setLoanablePercentage(numOrEmpty(realEstateDetail?.loanable_percentage))
  }, [savedApprovedAmount, savedApprovalNotes, realEstateDetail])

  const previewLoanable = useMemo(
    () => computeLoanablePreview(appraisedValue, realEstateDetail?.market_value, loanablePercentage),
    [appraisedValue, realEstateDetail?.market_value, loanablePercentage],
  )

  const exceedsRequested = legacyRequested != null && Number(approvedPrincipal) > legacyRequested

  const save = async () => {
    const parsed = Number(String(approvedPrincipal).replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast('Enter a valid approved loan amount.', 'error')
      return
    }

    setSaving(true)
    try {
      await api(`/loans/${loanId}/approved-amount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_principal: parsed,
          approval_notes: evaluationRemarks.trim() || null,
        }),
      })

      if (isRealEstate) {
        const appraisalPayload = {
          appraised_value: appraisedValue !== '' ? Number(appraisedValue) : null,
          loanable_percentage: loanablePercentage !== '' ? Number(loanablePercentage) : null,
          evaluation_remarks: evaluationRemarks.trim() || null,
        }
        if (previewLoanable != null && !appraisalPayload.loanable_value) {
          appraisalPayload.loanable_value = previewLoanable
        }
        await api(`/loans/${loanId}/property-appraisal`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appraisalPayload),
        })
      }

      showToast('Loan evaluation saved.', 'success')
      onSaved?.()
    } catch (e) {
      if (e?.body?.warning === 'amount_exceeds_requested') {
        showToast(e.message || 'Approved amount exceeds legacy requested amount. Override permission required.', 'error')
      } else {
        showToast(e.message || 'Failed to save loan evaluation.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const inputClass = `${admin.input} ${!canEdit ? 'opacity-80' : ''}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loan evaluation</h2>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-[#1F2937] dark:text-gray-200">
          {applicationStatusLabel(loanStatus)}
        </span>
      </div>

      <p className={`text-xs ${admin.textMuted}`}>
        Determine the official loan amount after property appraisal, credit investigation, and product rules. Borrowers do not enter a loan amount during application.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {legacyRequested != null ? (
          <div>
            <label className={`text-xs font-medium ${admin.textMuted}`}>Legacy requested amount</label>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">{formatCurrencyPhp(legacyRequested)}</p>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>From older applications — read only</p>
          </div>
        ) : null}

        {isRealEstate ? (
          <>
            <div>
              <label className={`text-xs font-medium ${admin.textMuted}`} htmlFor="evaluation-appraised-value">
                Appraised property value
              </label>
              <input
                id="evaluation-appraised-value"
                type="number"
                min="0"
                step="0.01"
                value={appraisedValue}
                onChange={(e) => setAppraisedValue(e.target.value)}
                readOnly={!canEdit}
                className={`mt-1 w-full ${inputClass}`}
              />
            </div>
            <div>
              <label className={`text-xs font-medium ${admin.textMuted}`} htmlFor="evaluation-loanable-pct">
                Loanable percentage (%)
              </label>
              <input
                id="evaluation-loanable-pct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={loanablePercentage}
                onChange={(e) => setLoanablePercentage(e.target.value)}
                readOnly={!canEdit}
                className={`mt-1 w-full ${inputClass}`}
              />
            </div>
            <div className={legacyRequested != null ? '' : 'sm:col-span-2'}>
              <label className={`text-xs font-medium ${admin.textMuted}`}>Maximum loanable amount</label>
              <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                {previewLoanable != null ? formatCurrencyPhp(previewLoanable) : '—'}
              </p>
              <p className={`mt-1 text-xs ${admin.textMuted}`}>Appraised value × loanable percentage</p>
            </div>
          </>
        ) : null}

        <div>
          <label className={`text-xs font-medium ${admin.textMuted}`} htmlFor="evaluation-approved-amount">
            Approved loan amount
          </label>
          <input
            id="evaluation-approved-amount"
            type="number"
            min="0"
            step="0.01"
            value={approvedPrincipal}
            onChange={(e) => setApprovedPrincipal(e.target.value)}
            readOnly={!canEdit}
            className={`mt-1 w-full ${inputClass}`}
          />
          <p className={`mt-1 text-xs ${admin.textMuted}`}>Official amount used for amortization, release, and collections</p>
          {exceedsRequested ? (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Exceeds legacy requested amount — override permission required when approving.
            </p>
          ) : null}
          {amountModifierName ? (
            <p className={`mt-2 text-xs ${admin.textMuted}`}>
              Last modified by {amountModifierName}
              {amountModifiedAt ? ` · ${String(amountModifiedAt)}` : ''}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className={`text-xs font-medium ${admin.textMuted}`} htmlFor="evaluation-remarks">
            Evaluation remarks
          </label>
          <textarea
            id="evaluation-remarks"
            rows={3}
            value={evaluationRemarks}
            onChange={(e) => setEvaluationRemarks(e.target.value)}
            readOnly={!canEdit}
            placeholder="Credit investigation notes, appraisal summary, conditions…"
            className={`mt-1 w-full ${inputClass}`}
          />
        </div>
      </div>

      {canEdit ? (
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save evaluation'}
        </button>
      ) : null}
    </div>
  )
}
