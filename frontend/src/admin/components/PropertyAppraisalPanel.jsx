import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from './AdminUi.jsx'

const PROPERTY_TYPES = ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Lot Only', 'Other']

function numOrEmpty(v) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : ''
}

/** Staff property verification — loan amounts and valuation live on Loan Evaluation tab. */
export default function PropertyAppraisalPanel({
  loanId,
  detail = null,
  borrowerSubmission = null,
  canEdit = false,
  onSaved,
}) {
  const { showToast } = useToast()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const source = detail || borrowerSubmission || {}

  useEffect(() => {
    setForm({
      property_type: source.property_type || '',
      title_number: source.title_number || '',
      tax_declaration_number: source.tax_declaration_number || '',
      property_address: source.property_address || '',
      lot_area: numOrEmpty(source.lot_area),
      floor_area: numOrEmpty(source.floor_area),
      market_value: numOrEmpty(source.market_value),
      assessed_value: numOrEmpty(source.assessed_value),
    })
  }, [detail, borrowerSubmission])

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    if (!loanId) return
    setSaving(true)
    try {
      await api(`/loans/${loanId}/property-appraisal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      showToast('Property verification saved.', 'success')
      onSaved?.()
    } catch (e) {
      showToast(e.message || 'Failed to save property verification.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = `${admin.input} ${!canEdit ? 'opacity-80' : ''}`

  return (
    <div className="space-y-6">
      {borrowerSubmission ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower-submitted information</h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {borrowerSubmission.property_type ? (
              <div><dt className={`text-xs ${admin.textMuted}`}>Property type</dt><dd>{borrowerSubmission.property_type}</dd></div>
            ) : null}
            {borrowerSubmission.property_address ? (
              <div className="sm:col-span-2"><dt className={`text-xs ${admin.textMuted}`}>Location</dt><dd>{borrowerSubmission.property_address}</dd></div>
            ) : null}
            {borrowerSubmission.property_description ? (
              <div className="sm:col-span-2"><dt className={`text-xs ${admin.textMuted}`}>Description</dt><dd>{borrowerSubmission.property_description}</dd></div>
            ) : null}
            {borrowerSubmission.title_number ? (
              <div><dt className={`text-xs ${admin.textMuted}`}>Title no.</dt><dd>{borrowerSubmission.title_number}</dd></div>
            ) : null}
            {borrowerSubmission.tax_declaration_number ? (
              <div><dt className={`text-xs ${admin.textMuted}`}>Tax dec. no.</dt><dd>{borrowerSubmission.tax_declaration_number}</dd></div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Property verification</h3>
        <p className={`mt-1 text-xs ${admin.textMuted}`}>
          Verified property details from title, tax records, and site inspection. Loan amount and appraisal values are set on the Loan Evaluation tab.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Property type</span>
            <select
              value={form.property_type}
              onChange={(e) => onChange('property_type', e.target.value)}
              disabled={!canEdit}
              className={`mt-1 w-full ${inputClass}`}
            >
              <option value="">Select type</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Title number</span>
            <input type="text" value={form.title_number} onChange={(e) => onChange('title_number', e.target.value)} readOnly={!canEdit} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="block text-sm">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Tax declaration number</span>
            <input type="text" value={form.tax_declaration_number} onChange={(e) => onChange('tax_declaration_number', e.target.value)} readOnly={!canEdit} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Property address</span>
            <textarea value={form.property_address} onChange={(e) => onChange('property_address', e.target.value)} readOnly={!canEdit} rows={2} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="block text-sm">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Lot area (sqm)</span>
            <input type="number" min="0" step="0.01" value={form.lot_area} onChange={(e) => onChange('lot_area', e.target.value)} readOnly={!canEdit} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="block text-sm">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Floor area (sqm)</span>
            <input type="number" min="0" step="0.01" value={form.floor_area} onChange={(e) => onChange('floor_area', e.target.value)} readOnly={!canEdit} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="block text-sm">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Market value</span>
            <input type="number" min="0" step="0.01" value={form.market_value} onChange={(e) => onChange('market_value', e.target.value)} readOnly={!canEdit} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="block text-sm">
            <span className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Assessed value</span>
            <input type="number" min="0" step="0.01" value={form.assessed_value} onChange={(e) => onChange('assessed_value', e.target.value)} readOnly={!canEdit} className={`mt-1 w-full ${inputClass}`} />
          </label>
        </div>

        {detail?.evaluator || detail?.evaluated_at ? (
          <p className={`mt-3 text-xs ${admin.textMuted}`}>
            Last verified
            {detail?.evaluator?.name ? ` by ${detail.evaluator.name}` : ''}
            {detail?.evaluated_at ? ` · ${new Date(detail.evaluated_at).toLocaleString()}` : ''}
          </p>
        ) : null}

        {canEdit ? (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save property verification'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
