import { useCallback, useEffect, useState } from 'react'
import { FileStack, Plus, Trash2 } from 'lucide-react'
import { api } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { admin } from '../../components/AdminUi.jsx'
import SettingsField from '../components/SettingsField.jsx'
import { SettingsAccordion, settingsInputClass } from '../components/SettingsPrimitives.jsx'

function emptyRow(key = '') {
  return {
    key: key || `custom_doc_${Date.now()}`,
    label: '',
    description: '',
    required: true,
    multiple: true,
    accepted: '',
  }
}

function rowsFromRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object') return []
  return Object.entries(requirements).map(([key, meta]) => ({
    key,
    label: meta?.label || key,
    description: meta?.description || '',
    required: meta?.required !== false,
    multiple: meta?.multiple !== false,
    accepted: Array.isArray(meta?.accepted) ? meta.accepted.join(', ') : '',
  }))
}

function requirementsFromRows(rows) {
  const out = {}
  rows.forEach((row) => {
    const key = String(row.key || '').trim()
    if (!key) return
    const accepted = String(row.accepted || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    out[key] = {
      label: String(row.label || key).trim() || key,
      description: String(row.description || '').trim() || undefined,
      required: !!row.required,
      multiple: row.multiple !== false,
      ...(accepted.length ? { accepted } : {}),
    }
  })
  return out
}

const DEFAULT_ROWS = {
  valid_government_id: { label: 'Valid Government ID', required: true, multiple: true },
  proof_of_income: { label: 'Proof of Income', required: true, multiple: true },
  proof_of_billing: { label: 'Proof of Billing', required: true, multiple: true },
  certificate_of_employment: { label: 'Certificate of Employment', required: false, multiple: true },
  passport: { label: 'Passport', required: false, multiple: true },
  supporting_documents: { label: 'Other Supporting Documents', required: false, multiple: true },
}

export default function TravelLoanDocumentRequirementsSettings({ readOnly = false }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState(null)
  const [productBase, setProductBase] = useState(null)
  const [rows, setRows] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('/loan-products')
      const list = Array.isArray(res?.data) ? res.data : []
      const product = list.find((p) => p.slug === 'travel-assistance-loan')
      if (!product) {
        setProductId(null)
        setProductBase(null)
        setRows([])
        return
      }
      const requirements = product.rules?.document_requirements
      setProductId(product.id)
      setProductBase(product)
      setRows(rowsFromRequirements(requirements).length ? rowsFromRequirements(requirements) : rowsFromRequirements(DEFAULT_ROWS))
    } catch (e) {
      showToast(e.message || 'Failed to load travel document requirements.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addRow = () => setRows((prev) => [...prev, emptyRow()])

  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index))

  const save = async () => {
    if (!productId || !productBase || readOnly) return
    setSaving(true)
    try {
      const rules = {
        ...(productBase.rules || {}),
        document_requirements: requirementsFromRows(rows),
      }
      await api(`/loan-products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productBase,
          rules,
        }),
      })
      showToast('Travel loan document requirements saved.', 'success')
      await load()
    } catch (e) {
      showToast(e.message || 'Failed to save document requirements.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsAccordion
      title="Travel Loan Document Requirements"
      subtitle="Configure borrower-facing uploads for Travel Assistance Loan. Agency documents (itinerary, flight, hotel) are handled internally after application."
      icon={FileStack}
    >
      {loading ? (
        <p className={`text-sm ${admin.textMuted}`}>Loading document requirements…</p>
      ) : !productId ? (
        <p className={`text-sm ${admin.textMuted}`}>Travel Assistance Loan product not found. Seed loan products first.</p>
      ) : (
        <div className="space-y-4">
          <p className={`text-xs ${admin.textMuted}`}>
            Only list documents borrowers can realistically provide at application. Travel itinerary, flight booking, and hotel reservation are optional internal documents uploaded by staff later.
          </p>
          <ul className="space-y-4">
            {rows.map((row, index) => (
              <li
                key={`${row.key}-${index}`}
                className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/30"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Requirement {index + 1}</p>
                  {!readOnly && rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                  <SettingsField label="Document key" htmlFor={`tdoc-key-${index}`} helper="Stable identifier used for uploads (e.g. proof_of_income).">
                    <input
                      id={`tdoc-key-${index}`}
                      className={`w-full ${settingsInputClass}`}
                      value={row.key}
                      onChange={(e) => updateRow(index, { key: e.target.value })}
                      disabled={readOnly}
                    />
                  </SettingsField>
                  <SettingsField label="Display label" htmlFor={`tdoc-label-${index}`}>
                    <input
                      id={`tdoc-label-${index}`}
                      className={`w-full ${settingsInputClass}`}
                      value={row.label}
                      onChange={(e) => updateRow(index, { label: e.target.value })}
                      disabled={readOnly}
                    />
                  </SettingsField>
                  <SettingsField label="Description" htmlFor={`tdoc-desc-${index}`} className="md:col-span-2">
                    <textarea
                      id={`tdoc-desc-${index}`}
                      rows={2}
                      className={`w-full ${settingsInputClass}`}
                      value={row.description}
                      onChange={(e) => updateRow(index, { description: e.target.value })}
                      disabled={readOnly}
                    />
                  </SettingsField>
                  <SettingsField label="Accepted examples (comma-separated)" htmlFor={`tdoc-acc-${index}`} className="md:col-span-2">
                    <input
                      id={`tdoc-acc-${index}`}
                      className={`w-full ${settingsInputClass}`}
                      value={row.accepted}
                      onChange={(e) => updateRow(index, { accepted: e.target.value })}
                      placeholder="Payslip, ITR, Water bill"
                      disabled={readOnly}
                    />
                  </SettingsField>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(e) => updateRow(index, { required: e.target.checked })}
                      disabled={readOnly}
                    />
                    Required for submission
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={row.multiple}
                      onChange={(e) => updateRow(index, { multiple: e.target.checked })}
                      disabled={readOnly}
                    />
                    Allow multiple file uploads
                  </label>
                </div>
              </li>
            ))}
          </ul>
          {!readOnly ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-[#374151] dark:bg-[#111827] dark:text-gray-100"
              >
                <Plus className="size-4" />
                Add requirement
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save document requirements'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </SettingsAccordion>
  )
}
