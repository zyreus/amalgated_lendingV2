import { formatCurrencyPhp } from './applications/applicationStatus.js'
import { admin } from './AdminUi.jsx'
import { coMakerSubmittedFormRows, resolveCoMakersFromLoanApplication } from '../../shared/coMaker/coMakerDisplayUtils.js'

const CURRENCY_LABEL_HINTS = /amount|salary|income|pension|cost|fee|value|expense/i

function formatReviewValue(label, value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!text) return null

  if (CURRENCY_LABEL_HINTS.test(label)) {
    const n = Number(String(text).replace(/,/g, ''))
    if (Number.isFinite(n)) return formatCurrencyPhp(n)
  }

  if (label.toLowerCase().includes('date') && text.length >= 10) {
    return text.slice(0, 10)
  }

  return text
}

function SectionBlock({ title, fields }) {
  if (!fields?.length) return null
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{title}</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const formatted = formatReviewValue(field.label, field.value)
          if (!formatted) return null
          return (
            <div key={`${title}-${field.label}`}>
              <dt className={`text-xs ${admin.textMuted}`}>{field.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-gray-900 dark:text-gray-100">{formatted}</dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

export default function BorrowerApplicationReviewPanel({ application, applicationPayload = null, coMakers = [] }) {
  if (!application) return null

  const portalSections = application.portal_review_sections || []
  const resolvedCoMakers =
    coMakers.length > 0 ? coMakers : resolveCoMakersFromLoanApplication(application, applicationPayload)
  const coMakerRows = coMakerSubmittedFormRows(resolvedCoMakers)
  const coMakerFields = coMakerRows.map((row) => ({ label: row.label, value: row.value }))

  const confirmedAmount =
    application.loan_amount != null && Number(application.loan_amount) > 0
      ? [{ label: 'Confirmed loan amount (staff)', value: application.loan_amount }]
      : []

  const hasContent = portalSections.length > 0 || coMakerFields.length > 0 || confirmedAmount.length > 0

  if (!hasContent) {
    return (
      <div className={`text-sm ${admin.cardNoHover}`}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Submitted application details</h2>
        <p className={`mt-2 text-sm ${admin.textMuted}`}>No borrower portal form data was captured on this application.</p>
      </div>
    )
  }

  const loanTypeLabel = String(application.loan_type || '').replace(/_/g, ' ')

  return (
    <div className={`space-y-6 text-sm ${admin.cardNoHover}`}>
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Submitted application details</h2>
        <p className={`mt-1 text-xs ${admin.textMuted}`}>
          Application #{application.id}
          {loanTypeLabel ? ` · ${loanTypeLabel}` : ''}
          {application.submitted_at ? ` · Submitted ${String(application.submitted_at)}` : ''}
        </p>
      </div>

      {confirmedAmount.length ? <SectionBlock title="Staff-confirmed amount" fields={confirmedAmount} /> : null}

      {portalSections.map((section) => (
        <SectionBlock key={section.title} title={section.title} fields={section.fields} />
      ))}

      {coMakerFields.length ? <SectionBlock title="Co-maker information" fields={coMakerFields} /> : null}
    </div>
  )
}
