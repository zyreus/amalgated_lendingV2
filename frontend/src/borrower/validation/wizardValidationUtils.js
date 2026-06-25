/** @typedef {{ key: string, label: string, section?: string, sectionTitle?: string, stepId?: number, required?: boolean, required_if?: object, type?: string, borrower_readonly?: boolean }} WizardFieldDef */
/** @typedef {{ key: string, label: string, sectionTitle: string, required?: boolean }} WizardDocDef */

function normalizeLabel(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function formatSectionTitle(section) {
  if (!section) return 'Application'
  return String(section)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function addGroupItem(grouped, sectionTitle, item) {
  const title = sectionTitle || 'Application'
  if (!grouped.has(title)) grouped.set(title, [])
  const list = grouped.get(title)
  const exists = list.some((row) => row.type === item.type && row.key === item.key && row.label === item.label)
  if (!exists) list.push(item)
}

/**
 * Build lookup maps from wizard schema for error parsing and client validation.
 */
export function buildWizardValidationRegistry({
  schema,
  loanType,
  steps = [],
  docDefs = {},
  propertyDocDefs = {},
  documentsStepDefs = {},
}) {
  /** @type {Map<string, WizardFieldDef>} */
  const fieldsByKey = new Map()
  /** @type {Map<string, { key: string, label: string, sectionTitle: string }>} */
  const docsByKey = new Map()
  /** @type {Map<string, { type: 'field' | 'doc', key: string }>} */
  const labelToTarget = new Map()

  for (const step of steps) {
    const section = step.section
    const sectionTitle = step.title || formatSectionTitle(section)
    const rows = schema?.product_application_fields?.[loanType]?.[section] || []
    for (const field of rows) {
      const entry = { ...field, section, sectionTitle, stepId: Number(step.id) }
      fieldsByKey.set(field.key, entry)
      labelToTarget.set(normalizeLabel(field.label), { type: 'field', key: field.key })
    }
  }

  const mergeDocs = (defs, sectionTitle = 'Documents') => {
    for (const [key, meta] of Object.entries(defs || {})) {
      const label = meta?.label || key
      docsByKey.set(key, { key, label, sectionTitle, required: meta?.required !== false })
      labelToTarget.set(normalizeLabel(label), { type: 'doc', key })
    }
  }

  mergeDocs(docDefs)
  mergeDocs(propertyDocDefs, 'Property Documents')
  mergeDocs(documentsStepDefs)

  return { fieldsByKey, docsByKey, labelToTarget, steps }
}

function findFieldByLabel(registry, label) {
  const target = registry.labelToTarget.get(normalizeLabel(label))
  if (target?.type === 'field') return registry.fieldsByKey.get(target.key) || null
  for (const field of registry.fieldsByKey.values()) {
    if (normalizeLabel(field.label) === normalizeLabel(label)) return field
  }
  return null
}

function findDocByLabel(registry, label) {
  const target = registry.labelToTarget.get(normalizeLabel(label))
  if (target?.type === 'doc') return registry.docsByKey.get(target.key) || null
  for (const doc of registry.docsByKey.values()) {
    if (normalizeLabel(doc.label) === normalizeLabel(label)) return doc
  }
  return null
}

/**
 * Parse flat API / client error strings into grouped modal data + field/doc maps.
 */
export function parseValidationErrors(errorMessages, registry, { currentStepTitle = 'Application' } = {}) {
  const grouped = new Map()
  /** @type {Record<string, string>} */
  const fieldErrors = {}
  /** @type {Record<string, string>} */
  const docErrors = {}
  /** @type {{ type: string, key: string, section?: string } | null} */
  let firstTarget = null

  const rememberFirst = (target) => {
    if (!firstTarget && target?.key) firstTarget = target
  }

  for (const raw of errorMessages || []) {
    const msg = String(raw || '').trim()
    if (!msg) continue

    let matched = false

    const docMatch = msg.match(/^Missing document:\s*(.+)$/i)
    if (docMatch) {
      const doc = findDocByLabel(registry, docMatch[1].trim())
      const label = doc?.label || docMatch[1].trim()
      const key = doc?.key || `doc:${normalizeLabel(label)}`
      docErrors[key] = 'Required document'
      addGroupItem(grouped, doc?.sectionTitle || 'Documents', { type: 'doc', key, label })
      rememberFirst({ type: 'doc', key, section: 'documents' })
      matched = true
    }

    if (!matched) {
      const reqMatch = msg.match(/^(.+?)\s+is required\.?$/i)
      if (reqMatch) {
        const field = findFieldByLabel(registry, reqMatch[1].trim())
        if (field) {
          fieldErrors[field.key] = msg
          addGroupItem(grouped, field.sectionTitle, { type: 'field', key: field.key, label: field.label })
          rememberFirst({ type: 'field', key: field.key, section: field.section })
          matched = true
        }
      }
    }

    if (!matched && /loan product/i.test(msg)) {
      fieldErrors.loan_product_id = msg
      addGroupItem(grouped, 'Loan Details', { type: 'field', key: 'loan_product_id', label: 'Loan Product' })
      rememberFirst({ type: 'field', key: 'loan_product_id', section: 'loan' })
      matched = true
    }

    if (!matched && /term/i.test(msg) && /month/i.test(msg)) {
      fieldErrors.term_months = msg
      addGroupItem(grouped, 'Loan Details', { type: 'field', key: 'term_months', label: 'Loan Term' })
      rememberFirst({ type: 'field', key: 'term_months', section: 'loan' })
      matched = true
    }

    if (!matched && /loan amount/i.test(msg)) {
      fieldErrors.loan_amount = msg
      addGroupItem(grouped, 'Loan Details', {
        type: 'field',
        key: 'loan_amount',
        label: 'Loan Amount (PHP)',
      })
      rememberFirst({ type: 'field', key: 'loan_amount', section: 'loan' })
      matched = true
    }

    if (!matched && /privacy policy/i.test(msg)) {
      fieldErrors.privacy_consent = msg
      addGroupItem(grouped, 'Review & Submit', { type: 'field', key: 'privacy_consent', label: 'Privacy Policy agreement' })
      rememberFirst({ type: 'field', key: 'privacy_consent', section: 'review' })
      matched = true
    }

    if (!matched && /co-maker/i.test(msg)) {
      const short = msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : msg
      fieldErrors.co_makers = msg
      addGroupItem(grouped, 'Co-Maker Information', {
        type: 'general',
        key: 'co_makers',
        label: short || msg,
      })
      rememberFirst({ type: 'general', key: 'co_makers', section: 'co_makers' })
      matched = true
    }

    if (!matched) {
      addGroupItem(grouped, currentStepTitle, { type: 'general', key: `_msg_${grouped.size}`, label: msg })
      if (!firstTarget) rememberFirst({ type: 'general', key: 'general', section: 'general' })
    }
  }

  return {
    grouped: Array.from(grouped.entries()).map(([section, items]) => ({ section, items })),
    fieldErrors,
    docErrors,
    firstTarget,
  }
}

function isEmptyValue(value) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'object' && 'agreed' in value) return !value.agreed
  return false
}

function fieldIsRequired(field, formData) {
  if (field.borrower_readonly) return false
  if (field.required) return true
  const cond = field.required_if
  if (!cond || typeof cond !== 'object') return false
  return Object.entries(cond).every(([key, expected]) => formData[key] === expected)
}

/**
 * Client-side validation for the active wizard step (mirrors server rules where possible).
 */
export function validateCurrentStepClient({
  step,
  steps,
  registry,
  formData,
  app,
  currentSection,
  docDefs = {},
  propertyDocDefs = {},
  documentsStepDefs = {},
  shouldShowField = () => true,
  isBorrowerHiddenField = () => false,
  requiresCoMakers = false,
}) {
  const errors = []
  const stepConfig = steps.find((s) => Number(s.id) === Number(step))
  const section = stepConfig?.section || currentSection
  const stepTitle = stepConfig?.title || formatSectionTitle(section)

  if (section === 'co_makers') {
    if (requiresCoMakers && !(app?.co_makers || []).length) {
      errors.push('Add at least one co-maker before continuing.')
    }
    return parseValidationErrors(errors, registry, { currentStepTitle: stepTitle })
  }

  if (section === 'documents' || section === 'property') {
    const defs = section === 'property' ? propertyDocDefs : documentsStepDefs
    for (const [key, meta] of Object.entries(defs)) {
      if (meta?.required === false) continue
      const uploaded = (app?.documents?.[key]?.urls || app?.documents?.[key]?.paths || []).length > 0
      if (!uploaded) errors.push(`Missing document: ${meta.label || key}`)
    }
    return parseValidationErrors(errors, registry, { currentStepTitle: stepTitle })
  }

  if (section === 'review') {
    if (!formData?.privacy_consent?.agreed) {
      errors.push('You must agree to the Privacy Policy to proceed with your loan application.')
    }
    const parsed = parseValidationErrors(errors, registry, { currentStepTitle: stepTitle })
    if (parsed.fieldErrors && errors.length) {
      parsed.fieldErrors.privacy_consent = errors[0]
    }
    return parsed
  }

  const rows = []
  for (const field of registry.fieldsByKey.values()) {
    if (field.section !== section) continue
    if (isBorrowerHiddenField(field)) continue
    if (!shouldShowField(field)) continue
    rows.push(field)
  }

  for (const field of rows) {
    if (!fieldIsRequired(field, formData)) continue
    const value = field.key === 'loan_amount' && field.borrower_readonly ? app?.loan_amount : formData[field.key]
    if (isEmptyValue(value)) {
      errors.push(`${field.label} is required.`)
    }
  }

  if (section === 'loan') {
    if (!formData.loan_product_id) errors.push('Loan product is required.')
    if (!formData.term_months || Number(formData.term_months) <= 0) errors.push('Term in months is required.')
  }

  return parseValidationErrors(errors, registry, { currentStepTitle: stepTitle })
}

export function scrollToWizardTarget(target, { behavior = 'smooth' } = {}) {
  if (!target?.key) return false

  let el = null
  if (target.type === 'field') {
    el = document.getElementById(`wizard-field-${target.key}`)
  } else if (target.type === 'doc') {
    el = document.querySelector(`[data-wizard-doc="${target.key}"]`)
  } else if (target.section) {
    el = document.querySelector(`[data-wizard-section="${target.section}"]`)
  }

  if (!el) return false

  el.scrollIntoView({ behavior, block: 'center' })
  const focusable = el.querySelector('input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])')
  if (focusable && typeof focusable.focus === 'function') {
    setTimeout(() => focusable.focus({ preventScroll: true }), 280)
  }
  return true
}

export function buildStepStatusMap({ steps, currentStep, completedStepIds = new Set(), errorStepIds = new Set() }) {
  const currentIndex = steps.findIndex((s) => Number(s.id) === Number(currentStep))
  return steps.reduce((acc, s, index) => {
    const id = Number(s.id)
    if (errorStepIds.has(id)) acc[id] = 'error'
    else if (index < currentIndex || completedStepIds.has(id)) acc[id] = 'complete'
    else if (id === Number(currentStep)) acc[id] = 'current'
    else acc[id] = 'pending'
    return acc
  }, {})
}

const LEGACY_GROUP_TITLES = {
  personal: 'Personal Information',
  borrower: 'Borrower Information',
  employment: 'Employment Information',
  income: 'Income Information',
  loan: 'Loan Details',
  address: 'Address Information',
  business: 'Business Information',
  vehicle: 'Vehicle Information',
  references: 'Character References',
  beneficiary: 'Beneficiary Information',
  spouse: 'Spouse Information',
}

/**
 * Registry for the legacy BorrowerLoanWizardPage (wizard_common fields).
 */
export function buildLegacyWizardValidationRegistry({
  groupedCommon = {},
  docDefs = {},
  steps = [],
  loanFields = [],
}) {
  const fieldsByKey = new Map()
  const docsByKey = new Map()
  const labelToTarget = new Map()

  for (const [group, rows] of Object.entries(groupedCommon)) {
    const sectionTitle = LEGACY_GROUP_TITLES[group] || formatSectionTitle(group)
    for (const row of rows) {
      const entry = { ...row, section: group, sectionTitle, stepId: 1 }
      fieldsByKey.set(row.key, entry)
      labelToTarget.set(normalizeLabel(row.label), { type: 'field', key: row.key })
    }
  }

  const loanExtras = [
    { key: 'loan_product_id', label: 'Loan Product', section: 'loan', sectionTitle: 'Loan Details' },
    { key: 'term_months', label: 'Loan Term', section: 'loan', sectionTitle: 'Loan Details' },
    { key: 'application_nature', label: 'Application Nature', section: 'loan', sectionTitle: 'Loan Details' },
    { key: 'age', label: 'Age', section: 'loan', sectionTitle: 'Loan Details' },
    { key: 'loan_amount', label: 'Loan Amount', section: 'loan', sectionTitle: 'Loan Details' },
    { key: 'loan_purpose', label: 'Loan Purpose', section: 'loan', sectionTitle: 'Loan Details' },
  ]
  for (const field of loanExtras) {
    fieldsByKey.set(field.key, { ...field, stepId: 1, required: true })
    labelToTarget.set(normalizeLabel(field.label), { type: 'field', key: field.key })
  }

  for (const row of loanFields) {
    const entry = { ...row, section: 'loan_type', sectionTitle: 'Loan Details', stepId: 1 }
    fieldsByKey.set(row.key, entry)
    labelToTarget.set(normalizeLabel(row.label), { type: 'field', key: row.key })
  }

  for (const [key, meta] of Object.entries(docDefs)) {
    const label = meta?.label || key
    docsByKey.set(key, { key, label, sectionTitle: 'Documents', required: meta?.required !== false })
    labelToTarget.set(normalizeLabel(label), { type: 'doc', key })
  }

  return { fieldsByKey, docsByKey, labelToTarget, steps }
}

export function validateLegacyWizardStep({ step, registry, formData, app, docDefs = {} }) {
  const errors = []
  const stepConfig = registry.steps?.find((s) => Number(s.id) === Number(step))
  const stepTitle = stepConfig?.title || 'Application'

  if (Number(step) === 1) {
    for (const field of registry.fieldsByKey.values()) {
      if (!field.required) continue
      if (isEmptyValue(formData[field.key])) errors.push(`${field.label} is required.`)
    }
    if (!formData.loan_product_id) errors.push('Loan product is required.')
    if (!formData.term_months || Number(formData.term_months) <= 0) errors.push('Term in months is required.')
    for (const field of registry.fieldsByKey.values()) {
      if (field.section !== 'loan_type' || !field.required) continue
      if (isEmptyValue(formData[field.key])) errors.push(`${field.label} is required.`)
    }
  }

  if (Number(step) === 2) {
    for (const [key, meta] of Object.entries(docDefs)) {
      if (meta?.required === false) continue
      const uploaded = (app?.documents?.[key]?.urls || app?.documents?.[key]?.paths || []).length > 0
      if (!uploaded) errors.push(`Missing document: ${meta.label || key}`)
    }
  }

  if (Number(step) === 4) {
    if (!formData?.privacy_consent?.agreed) {
      errors.push('You must agree to the Privacy Policy to proceed with your loan application.')
    }
    const parsed = parseValidationErrors(errors, registry, { currentStepTitle: stepTitle })
    if (errors.length) parsed.fieldErrors.privacy_consent = errors[0]
    return parsed
  }

  return parseValidationErrors(errors, registry, { currentStepTitle: stepTitle })
}
