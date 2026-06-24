import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, UserPlus } from 'lucide-react'
import { borrowerApi } from '../../borrower/api/client.js'
import { api as adminApi } from '../../admin/api/client.js'
import { DocumentUploadZone, Field, FormSection, selectInputClass, textInputClass } from '../../borrower/components/LoanApplicationUi.jsx'
import { resolvePublicFileUrl } from '../../utils/lendingLaravelApi.js'
import {
  CO_MAKER_CIVIL_STATUSES,
  CO_MAKER_EMPLOYMENT_STATUSES,
  CO_MAKER_EMPTY_FORM,
  CO_MAKER_GENDERS,
  CO_MAKER_ID_TYPES,
  CO_MAKER_RELATIONSHIPS,
  CO_MAKER_VERIFICATION_LABELS,
  DEFAULT_CO_MAKER_DOCUMENT_CATEGORIES,
  computeAgeFromBirthdate,
  coMakerFromApi,
  coMakerToPayload,
  formatCoMakerIncome,
  validateCoMakerForm,
} from './coMakerSchema.js'

const MAX_UPLOAD_MB = 20

function logCoMaker(event, payload = {}) {
  if (import.meta.env.DEV) {
    console.log(`[CoMaker] ${event}`, payload)
  }
}

function SectionHeading({ title }) {
  return (
    <h4 className="border-b border-gray-100 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-[#1F2937] dark:text-gray-400">
      {title}
    </h4>
  )
}

function CoMakerSummaryCard({ cm, index, readOnly, isExpanded, onToggle, onEdit, onRemove, statusLabel, status, children }) {
  return (
    <li className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-[#1F2937] dark:bg-[#0F172A]/30">
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button type="button" className="flex flex-1 items-start gap-2 text-left" onClick={onToggle}>
            {isExpanded ? <ChevronUp className="mt-0.5 size-4 shrink-0 text-gray-400" /> : <ChevronDown className="mt-0.5 size-4 shrink-0 text-gray-400" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Co-Maker #{index + 1}</p>
              <dl className="mt-2 grid gap-1.5 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Name</dt>
                  <dd className="font-medium">{cm.full_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Relationship</dt>
                  <dd>{cm.relationship_to_borrower || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Contact</dt>
                  <dd>{cm.contact_number || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Income</dt>
                  <dd>{formatCoMakerIncome(cm.monthly_income)}</dd>
                </div>
              </dl>
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : status === 'rejected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : status === 'requires_resubmission'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {statusLabel}
            </span>
            {!readOnly ? (
              <>
                <button type="button" onClick={onEdit} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold dark:border-[#374151]">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 dark:border-red-800 dark:text-red-300"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {children}
    </li>
  )
}

function CoMakerFormFields({ form, setForm, readOnly, compact = false }) {
  const age = computeAgeFromBirthdate(form.date_of_birth)

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const onAddressChange = (value) => {
    setForm((prev) => ({ ...prev, complete_address: value, house_street: value }))
  }

  if (compact) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First Name" required>
          <input className={textInputClass()} value={form.first_name} disabled={readOnly} onChange={(e) => onChange('first_name', e.target.value)} />
        </Field>
        <Field label="Middle Name">
          <input className={textInputClass()} value={form.middle_name} disabled={readOnly} onChange={(e) => onChange('middle_name', e.target.value)} />
        </Field>
        <Field label="Last Name" required>
          <input className={textInputClass()} value={form.last_name} disabled={readOnly} onChange={(e) => onChange('last_name', e.target.value)} />
        </Field>
        <Field label="Suffix">
          <input className={textInputClass()} value={form.suffix} disabled={readOnly} onChange={(e) => onChange('suffix', e.target.value)} placeholder="Jr., Sr., III" />
        </Field>
        <Field label="Date of Birth" required>
          <input type="date" className={textInputClass()} value={form.date_of_birth} disabled={readOnly} onChange={(e) => onChange('date_of_birth', e.target.value)} />
        </Field>
        <Field label="Gender" required>
          <select className={selectInputClass()} value={form.gender} disabled={readOnly} onChange={(e) => onChange('gender', e.target.value)}>
            <option value="">Select gender</option>
            {CO_MAKER_GENDERS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Civil Status" required>
          <select className={selectInputClass()} value={form.civil_status} disabled={readOnly} onChange={(e) => onChange('civil_status', e.target.value)}>
            <option value="">Select civil status</option>
            {CO_MAKER_CIVIL_STATUSES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Age">
          <input className={textInputClass()} value={age} readOnly disabled placeholder="Auto-computed" />
        </Field>
        <Field label="Contact Number" required>
          <input className={textInputClass()} value={form.contact_number} disabled={readOnly} onChange={(e) => onChange('contact_number', e.target.value)} />
        </Field>
        <Field label="Email Address">
          <input type="email" className={textInputClass()} value={form.email} disabled={readOnly} onChange={(e) => onChange('email', e.target.value)} />
        </Field>
        <Field label="Relationship to Borrower" required>
          <select className={selectInputClass()} value={form.relationship_to_borrower} disabled={readOnly} onChange={(e) => onChange('relationship_to_borrower', e.target.value)}>
            <option value="">Select relationship</option>
            {CO_MAKER_RELATIONSHIPS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Employment Status" required>
          <select className={selectInputClass()} value={form.employment_status} disabled={readOnly} onChange={(e) => onChange('employment_status', e.target.value)}>
            <option value="">Select employment status</option>
            {CO_MAKER_EMPLOYMENT_STATUSES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Occupation">
          <input className={textInputClass()} value={form.occupation} disabled={readOnly} onChange={(e) => onChange('occupation', e.target.value)} />
        </Field>
        <Field label="Employer / Business Name">
          <input className={textInputClass()} value={form.employer_business_name} disabled={readOnly} onChange={(e) => onChange('employer_business_name', e.target.value)} />
        </Field>
        <Field label="Monthly Income">
          <input type="number" min="0" className={textInputClass()} value={form.monthly_income} disabled={readOnly} onChange={(e) => onChange('monthly_income', e.target.value)} />
        </Field>
        <Field label="Valid ID Type" required>
          <select className={selectInputClass()} value={form.valid_id_type} disabled={readOnly} onChange={(e) => onChange('valid_id_type', e.target.value)}>
            <option value="">Select ID type</option>
            {CO_MAKER_ID_TYPES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Valid ID Number" required>
          <input className={textInputClass()} value={form.valid_id_number} disabled={readOnly} onChange={(e) => onChange('valid_id_number', e.target.value)} />
        </Field>
        <Field label="Complete Address" required className="md:col-span-2">
          <textarea
            className={textInputClass()}
            rows={2}
            value={form.complete_address || form.house_street}
            disabled={readOnly}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="House no., street, building"
          />
        </Field>
        <Field label="Province" required>
          <input className={textInputClass()} value={form.province} disabled={readOnly} onChange={(e) => onChange('province', e.target.value)} />
        </Field>
        <Field label="City / Municipality" required>
          <input className={textInputClass()} value={form.city_municipality} disabled={readOnly} onChange={(e) => onChange('city_municipality', e.target.value)} />
        </Field>
        <Field label="Barangay" required>
          <input className={textInputClass()} value={form.barangay} disabled={readOnly} onChange={(e) => onChange('barangay', e.target.value)} />
        </Field>
        <Field label="Postal Code">
          <input className={textInputClass()} value={form.postal_code} disabled={readOnly} onChange={(e) => onChange('postal_code', e.target.value)} />
        </Field>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <SectionHeading title="Personal Information" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First Name" required>
            <input className={textInputClass()} value={form.first_name} disabled={readOnly} onChange={(e) => onChange('first_name', e.target.value)} />
          </Field>
          <Field label="Middle Name">
            <input className={textInputClass()} value={form.middle_name} disabled={readOnly} onChange={(e) => onChange('middle_name', e.target.value)} />
          </Field>
          <Field label="Last Name" required>
            <input className={textInputClass()} value={form.last_name} disabled={readOnly} onChange={(e) => onChange('last_name', e.target.value)} />
          </Field>
          <Field label="Suffix">
            <input className={textInputClass()} value={form.suffix} disabled={readOnly} onChange={(e) => onChange('suffix', e.target.value)} placeholder="Jr., Sr., III" />
          </Field>
          <Field label="Date of Birth" required>
            <input type="date" className={textInputClass()} value={form.date_of_birth} disabled={readOnly} onChange={(e) => onChange('date_of_birth', e.target.value)} />
          </Field>
          <Field label="Age">
            <input className={textInputClass()} value={age} readOnly disabled placeholder="Auto-computed" />
          </Field>
          <Field label="Gender" required>
            <select className={selectInputClass()} value={form.gender} disabled={readOnly} onChange={(e) => onChange('gender', e.target.value)}>
              <option value="">Select</option>
              {CO_MAKER_GENDERS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Civil Status" required>
            <select className={selectInputClass()} value={form.civil_status} disabled={readOnly} onChange={(e) => onChange('civil_status', e.target.value)}>
              <option value="">Select</option>
              {CO_MAKER_CIVIL_STATUSES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Contact Information" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mobile Number" required>
            <input className={textInputClass()} value={form.contact_number} disabled={readOnly} onChange={(e) => onChange('contact_number', e.target.value)} />
          </Field>
          <Field label="Alternate Mobile Number">
            <input className={textInputClass()} value={form.alternate_contact_number} disabled={readOnly} onChange={(e) => onChange('alternate_contact_number', e.target.value)} />
          </Field>
          <Field label="Email Address" className="md:col-span-2">
            <input type="email" className={textInputClass()} value={form.email} disabled={readOnly} onChange={(e) => onChange('email', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Address Information" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="House No. / Street" required className="md:col-span-2">
            <input className={textInputClass()} value={form.house_street} disabled={readOnly} onChange={(e) => onChange('house_street', e.target.value)} />
          </Field>
          <Field label="Barangay" required>
            <input className={textInputClass()} value={form.barangay} disabled={readOnly} onChange={(e) => onChange('barangay', e.target.value)} />
          </Field>
          <Field label="Municipality / City" required>
            <input className={textInputClass()} value={form.city_municipality} disabled={readOnly} onChange={(e) => onChange('city_municipality', e.target.value)} />
          </Field>
          <Field label="Province" required>
            <input className={textInputClass()} value={form.province} disabled={readOnly} onChange={(e) => onChange('province', e.target.value)} />
          </Field>
          <Field label="ZIP Code">
            <input className={textInputClass()} value={form.postal_code} disabled={readOnly} onChange={(e) => onChange('postal_code', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Relationship to Borrower" />
        <Field label="Relationship to Borrower" required>
          <select className={selectInputClass()} value={form.relationship_to_borrower} disabled={readOnly} onChange={(e) => onChange('relationship_to_borrower', e.target.value)}>
            <option value="">Select relationship</option>
            {CO_MAKER_RELATIONSHIPS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Employment / Income Information" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Employment Status" required>
            <select className={selectInputClass()} value={form.employment_status} disabled={readOnly} onChange={(e) => onChange('employment_status', e.target.value)}>
              <option value="">Select</option>
              {CO_MAKER_EMPLOYMENT_STATUSES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Occupation">
            <input className={textInputClass()} value={form.occupation} disabled={readOnly} onChange={(e) => onChange('occupation', e.target.value)} />
          </Field>
          <Field label="Employer / Business Name">
            <input className={textInputClass()} value={form.employer_business_name} disabled={readOnly} onChange={(e) => onChange('employer_business_name', e.target.value)} />
          </Field>
          <Field label="Length of Employment">
            <input className={textInputClass()} value={form.length_of_employment} disabled={readOnly} onChange={(e) => onChange('length_of_employment', e.target.value)} placeholder="e.g. 3 years" />
          </Field>
          <Field label="Monthly Income">
            <input type="number" min="0" className={textInputClass()} value={form.monthly_income} disabled={readOnly} onChange={(e) => onChange('monthly_income', e.target.value)} />
          </Field>
          <Field label="Other Source of Income" className="md:col-span-2">
            <textarea className={textInputClass()} rows={2} value={form.other_income_source} disabled={readOnly} onChange={(e) => onChange('other_income_source', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Identification Information" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Valid ID Type" required>
            <select className={selectInputClass()} value={form.valid_id_type} disabled={readOnly} onChange={(e) => onChange('valid_id_type', e.target.value)}>
              <option value="">Select ID type</option>
              {CO_MAKER_ID_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Valid ID Number" required>
            <input className={textInputClass()} value={form.valid_id_number} disabled={readOnly} onChange={(e) => onChange('valid_id_number', e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  )
}

function CoMakerDocuments({ coMaker, documentCategories, readOnly, apiMode, applicationId, loanId, onUpdated, onError }) {
  const [uploadingKey, setUploadingKey] = useState('')
  const [draggingDocKey, setDraggingDocKey] = useState('')

  const uploadDoc = async (category, file) => {
    if (!file) return
    const uploadKey = `${coMaker.id}-${category}`
    setUploadingKey(uploadKey)
    try {
      const body = new FormData()
      body.append('file', file)
      if (apiMode === 'admin') {
        body.append('document_category', category)
        body.append('co_maker_id', String(coMaker.id))
        await adminApi(`/loans/${loanId}/documents`, { method: 'POST', body })
      } else {
        await borrowerApi(
          `/borrower/loan-applications/${applicationId}/co-makers/${coMaker.id}/documents/${category}`,
          { method: 'POST', body },
        )
      }
      await onUpdated?.()
    } catch (e) {
      onError?.(e.message || 'Document upload failed.')
    } finally {
      setUploadingKey('')
    }
  }

  const removeDoc = async (documentId) => {
    try {
      if (apiMode === 'admin') {
        await adminApi(`/loans/${loanId}/documents/${documentId}`, { method: 'DELETE' })
      } else {
        await borrowerApi(
          `/borrower/loan-applications/${applicationId}/co-makers/${coMaker.id}/documents/${documentId}`,
          { method: 'DELETE' },
        )
      }
      await onUpdated?.()
    } catch (e) {
      onError?.(e.message || 'Could not remove document.')
    }
  }

  return (
    <ul className="space-y-4">
      {Object.entries(documentCategories).map(([category, meta]) => {
        const items = (coMaker.documents_by_category?.[category] || []).map((doc) => ({
          path: doc.file_path,
          url: doc.file_url,
          name: doc.original_name,
          id: doc.id,
          mime_type: doc.mime_type,
          verification_status: doc.verification_status,
        }))
        const uploadKey = `${coMaker.id}-${category}`
        return (
          <DocumentUploadZone
            key={category}
            docKey={category}
            meta={{ ...meta, multiple: meta.multiple !== false }}
            dragging={draggingDocKey === uploadKey}
            onDragState={(k) => setDraggingDocKey(k === category ? uploadKey : '')}
            onUpload={(_, file) => uploadDoc(category, file)}
            onRemove={(_, path) => {
              const doc = items.find((d) => d.path === path)
              if (doc?.id) removeDoc(doc.id)
            }}
            uploadedItems={items}
            resolveUrl={resolvePublicFileUrl}
            uploading={uploadingKey === uploadKey}
            canRemove={!readOnly && items.every((d) => d.verification_status !== 'verified')}
            maxMb={MAX_UPLOAD_MB}
          />
        )
      })}
    </ul>
  )
}

/**
 * Universal co-maker module — borrower and admin modes share one implementation.
 */
export default function UniversalCoMakerModule({
  applicationId = null,
  loanId = null,
  coMakers = [],
  documentCategories = DEFAULT_CO_MAKER_DOCUMENT_CATEGORIES,
  onUpdated,
  onCoMakersChange,
  onError,
  readOnly = false,
  apiMode = 'borrower',
  canReview = false,
}) {
  const categories = useMemo(
    () => (Object.keys(documentCategories || {}).length ? documentCategories : DEFAULT_CO_MAKER_DOCUMENT_CATEGORIES),
    [documentCategories],
  )
  const [editingId, setEditingId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [form, setForm] = useState({ ...CO_MAKER_EMPTY_FORM })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(coMakers[0]?.id ?? null)
  const [reviewNotes, setReviewNotes] = useState({})

  const resetForm = () => {
    setEditingId(null)
    setAddingNew(false)
    setForm({ ...CO_MAKER_EMPTY_FORM })
    setFormError('')
  }

  const startEdit = (cm) => {
    setEditingId(cm.id)
    setForm(coMakerFromApi(cm))
    setExpandedId(cm.id)
    setFormError('')
  }

  const applyCoMakersChange = (nextCoMakers) => {
    logCoMaker('State updated', { currentCoMakerCount: nextCoMakers.length })
    onCoMakersChange?.(nextCoMakers)
  }

  const saveCoMaker = async () => {
    logCoMaker('Add Co-Maker clicked', {
      applicationId,
      loanId,
      editingId,
      currentCoMakerCount: coMakers.length,
    })

    const validationErrors = validateCoMakerForm(form)
    if (validationErrors.length) {
      const message = validationErrors.map((e) => `• ${e}`).join('\n')
      setFormError(message)
      onError?.(validationErrors.join(' '))
      logCoMaker('Validation failed', { errors: validationErrors, currentCoMakerCount: coMakers.length })
      return
    }

    if (apiMode === 'borrower' && !applicationId) {
      const message = 'Application is not ready yet. Please wait a moment and try again.'
      setFormError(message)
      onError?.(message)
      logCoMaker('Save blocked — missing applicationId')
      return
    }

    if (apiMode === 'admin' && !loanId) {
      const message = 'Loan record is not available for co-maker entry.'
      setFormError(message)
      onError?.(message)
      return
    }

    setFormError('')
    setSaving(true)
    try {
      const payload = coMakerToPayload(form)
      let savedCoMaker = null

      if (apiMode === 'admin') {
        const res = editingId
          ? await adminApi(`/loans/${loanId}/co-makers/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
          : await adminApi(`/loans/${loanId}/co-makers`, { method: 'POST', body: JSON.stringify(payload) })
        savedCoMaker = res.co_maker
      } else {
        const res = editingId
          ? await borrowerApi(`/borrower/loan-applications/${applicationId}/co-makers/${editingId}`, {
              method: 'PUT',
              body: JSON.stringify(payload),
            })
          : await borrowerApi(`/borrower/loan-applications/${applicationId}/co-makers`, {
              method: 'POST',
              body: JSON.stringify(payload),
            })
        savedCoMaker = res.co_maker
      }

      logCoMaker('Validation passed — database record created', {
        coMakerId: savedCoMaker?.id,
        currentCoMakerCount: editingId ? coMakers.length : coMakers.length + 1,
      })

      if (savedCoMaker) {
        const nextCoMakers = editingId
          ? coMakers.map((cm) => (cm.id === editingId ? savedCoMaker : cm))
          : [...coMakers, savedCoMaker]
        applyCoMakersChange(nextCoMakers)
        setExpandedId(savedCoMaker.id)
      }

      resetForm()
      await onUpdated?.()
      logCoMaker('Relationship loaded after refresh', { currentCoMakerCount: savedCoMaker ? (editingId ? coMakers.length : coMakers.length + 1) : coMakers.length })
    } catch (e) {
      const message = e.message || 'Could not save co-maker.'
      setFormError(message)
      onError?.(message)
      logCoMaker('Save failed', { message, currentCoMakerCount: coMakers.length })
    } finally {
      setSaving(false)
    }
  }

  const removeCoMaker = async (id) => {
    if (!window.confirm('Remove this co-maker and all attached documents?')) return
    try {
      if (apiMode === 'admin') {
        await adminApi(`/loans/${loanId}/co-makers/${id}`, { method: 'DELETE' })
      } else {
        await borrowerApi(`/borrower/loan-applications/${applicationId}/co-makers/${id}`, { method: 'DELETE' })
      }
      if (editingId === id) resetForm()
      applyCoMakersChange(coMakers.filter((cm) => cm.id !== id))
      await onUpdated?.()
      logCoMaker('Co-maker removed', { coMakerId: id, currentCoMakerCount: coMakers.length - 1 })
    } catch (e) {
      onError?.(e.message || 'Could not remove co-maker.')
    }
  }

  const reviewCoMaker = async (id, status) => {
    try {
      await adminApi(`/loans/${loanId}/co-makers/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          verification_status: status,
          review_notes: reviewNotes[id] || '',
        }),
      })
      await onUpdated?.()
    } catch (e) {
      onError?.(e.message || 'Review action failed.')
    }
  }

  const showAddForm = !readOnly && (editingId !== null || coMakers.length === 0 || addingNew)

  return (
    <div className="space-y-6">
      <FormSection
        title="Co-Maker Information"
        description="Add one or more co-makers who will support this loan application. Each co-maker needs complete details and required documents."
        icon={UserPlus}
      >
        {coMakers.length > 0 ? (
          <ul className="mb-6 space-y-3">
            {coMakers.map((cm, index) => {
              const status = cm.verification_status || 'pending'
              const statusLabel = CO_MAKER_VERIFICATION_LABELS[status] || status
              const isExpanded = expandedId === cm.id
              return (
                <CoMakerSummaryCard
                  key={cm.id}
                  cm={cm}
                  index={index}
                  readOnly={readOnly}
                  isExpanded={isExpanded}
                  status={status}
                  statusLabel={statusLabel}
                  onToggle={() => setExpandedId(isExpanded ? null : cm.id)}
                  onEdit={() => startEdit(cm)}
                  onRemove={() => removeCoMaker(cm.id)}
                >
                  {isExpanded ? (
                    <div className="space-y-6 border-t border-gray-100 p-4 dark:border-[#1F2937]">
                      {editingId === cm.id && !readOnly ? (
                        <CoMakerFormFields form={form} setForm={setForm} readOnly={false} />
                      ) : (
                        <CoMakerFormFields form={coMakerFromApi(cm)} setForm={() => {}} readOnly />
                      )}

                      <div>
                        <SectionHeading title="Co-Maker Documents" />
                        <div className="mt-4">
                          <CoMakerDocuments
                            coMaker={cm}
                            documentCategories={categories}
                            readOnly={readOnly}
                            apiMode={apiMode}
                            applicationId={applicationId}
                            loanId={loanId}
                            onUpdated={onUpdated}
                            onError={onError}
                          />
                        </div>
                      </div>

                      {canReview && apiMode === 'admin' ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Officer review</p>
                          <textarea
                            className={`${textInputClass()} mt-2`}
                            rows={2}
                            placeholder="Review notes or document request details"
                            value={reviewNotes[cm.id] ?? cm.review_notes ?? ''}
                            onChange={(e) => setReviewNotes((p) => ({ ...p, [cm.id]: e.target.value }))}
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => reviewCoMaker(cm.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                              Approve
                            </button>
                            <button type="button" onClick={() => reviewCoMaker(cm.id, 'rejected')} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
                              Reject
                            </button>
                            <button type="button" onClick={() => reviewCoMaker(cm.id, 'requires_resubmission')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                              Request additional documents
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CoMakerSummaryCard>
              )
            })}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">No co-makers added yet. At least one co-maker is required for this loan product.</p>
        )}

        {showAddForm && editingId === null ? (
          <div className="space-y-4">
            {formError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                <p className="font-semibold">Please fix the following before adding this co-maker:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {formError.split(/\n/).filter(Boolean).map((line) => (
                    <li key={line}>{line.replace(/^•\s*/, '')}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Fields marked with * are required, including gender, employment status, valid ID, and relationship.
            </p>
            <CoMakerFormFields form={form} setForm={setForm} readOnly={false} compact={apiMode === 'borrower'} />
            <button
              type="button"
              disabled={saving}
              onClick={saveCoMaker}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
            >
              <Plus className="size-4" />
              Add Co-Maker
            </button>
          </div>
        ) : null}

        {showAddForm && editingId !== null ? (
          <div className="space-y-4 border-t border-gray-100 pt-6 dark:border-[#1F2937]">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Editing co-maker</p>
            {formError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {formError}
              </p>
            ) : null}
            <CoMakerFormFields form={form} setForm={setForm} readOnly={false} compact={apiMode === 'borrower'} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={saveCoMaker}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
              >
                Save Changes
              </button>
              <button type="button" onClick={resetForm} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium dark:border-[#374151]">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {!readOnly && coMakers.length > 0 && editingId === null && !addingNew ? (
          <button
            type="button"
            onClick={() => {
              setForm({ ...CO_MAKER_EMPTY_FORM })
              setAddingNew(true)
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-brand-primary/40 px-5 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5"
          >
            <Plus className="size-4" />
            Add another co-maker
          </button>
        ) : null}
      </FormSection>
    </div>
  )
}
