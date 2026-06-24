/** Universal co-maker field options — product-agnostic. */

export const CO_MAKER_RELATIONSHIPS = [
  'Spouse', 'Parent', 'Child', 'Sibling', 'Relative', 'Friend',
  'Business Partner', 'Co-Employee', 'Guarantor', 'Other',
]

export const CO_MAKER_EMPLOYMENT_STATUSES = [
  'Employed', 'Self-Employed', 'Business Owner', 'Pensioner', 'OFW', 'Unemployed', 'Other',
]

export const CO_MAKER_GENDERS = ['Female', 'Male', 'Prefer not to say']

export const CO_MAKER_CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']

export const CO_MAKER_ID_TYPES = [
  'PhilSys ID', 'UMID', "Driver's License", 'Passport', 'PRC ID',
  "Voter's ID", 'Senior Citizen ID', 'Postal ID', 'Other',
]

export const CO_MAKER_VERIFICATION_LABELS = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  requires_resubmission: 'Requires resubmission',
}

export const DEFAULT_CO_MAKER_DOCUMENT_CATEGORIES = {
  valid_id: { label: 'Valid ID', required: true, multiple: true },
  selfie_with_valid_id: { label: 'Selfie with Valid ID', required: true, multiple: true },
  proof_of_income: { label: 'Proof of Income', required: true, multiple: true },
  proof_of_billing: { label: 'Proof of Billing', required: true, multiple: true },
  signature_specimen: { label: 'Signature Specimen', required: true, multiple: true },
  supporting_documents: { label: 'Supporting Documents', required: false, multiple: true },
}

export const CO_MAKER_EMPTY_FORM = {
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  date_of_birth: '',
  gender: '',
  civil_status: '',
  contact_number: '',
  alternate_contact_number: '',
  email: '',
  house_street: '',
  complete_address: '',
  barangay: '',
  city_municipality: '',
  province: '',
  postal_code: '',
  relationship_to_borrower: '',
  employment_status: '',
  occupation: '',
  employer_business_name: '',
  length_of_employment: '',
  monthly_income: '',
  other_income_source: '',
  valid_id_type: '',
  valid_id_number: '',
}

export function computeAgeFromBirthdate(birthdate) {
  if (!birthdate) return ''
  const dob = new Date(birthdate)
  if (Number.isNaN(dob.getTime())) return ''
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1
  return age >= 0 ? String(age) : ''
}

/**
 * Resolve whether co-makers are required for the current application.
 */
export function resolveRequiresCoMakers({ loanType, selectedProduct, schema }) {
  const productRules = selectedProduct?.rules
  if (productRules && typeof productRules.requires_co_makers === 'boolean') {
    return productRules.requires_co_makers
  }
  const cfg = selectedProduct?.calculator_config
  if (cfg && typeof cfg.requires_co_makers === 'boolean') {
    return cfg.requires_co_makers
  }
  return (schema?.loan_types_requiring_co_makers || []).includes(loanType)
}

export function coMakerFromApi(cm) {
  if (!cm) return { ...CO_MAKER_EMPTY_FORM }
  return {
    first_name: cm.first_name || '',
    middle_name: cm.middle_name || '',
    last_name: cm.last_name || '',
    suffix: cm.suffix || '',
    date_of_birth: cm.date_of_birth || '',
    gender: cm.gender || '',
    civil_status: cm.civil_status || '',
    contact_number: cm.contact_number || '',
    alternate_contact_number: cm.alternate_contact_number || '',
    email: cm.email || '',
    house_street: cm.house_street || cm.complete_address || cm.address || '',
    complete_address: cm.complete_address || cm.house_street || cm.address || '',
    barangay: cm.barangay || '',
    city_municipality: cm.city_municipality || '',
    province: cm.province || '',
    postal_code: cm.postal_code || '',
    relationship_to_borrower: cm.relationship_to_borrower || '',
    employment_status: cm.employment_status || '',
    occupation: cm.occupation || '',
    employer_business_name: cm.employer_business_name || '',
    length_of_employment: cm.length_of_employment || '',
    monthly_income: cm.monthly_income != null ? String(cm.monthly_income) : '',
    other_income_source: cm.other_income_source || '',
    valid_id_type: cm.valid_id_type || '',
    valid_id_number: cm.valid_id_number || '',
  }
}

export function coMakerToPayload(form) {
  const age = computeAgeFromBirthdate(form.date_of_birth)
  const street = (form.house_street || form.complete_address || '').trim()
  const addressParts = [street, form.barangay, form.city_municipality, form.province, form.postal_code].filter(Boolean)
  return {
    ...form,
    house_street: street,
    age: age !== '' ? Number(age) : null,
    monthly_income: form.monthly_income !== '' ? Number(form.monthly_income) : null,
    complete_address: addressParts.join(', '),
  }
}

/** Client-side validation mirroring BorrowerCoMakerController rules. */
export function validateCoMakerForm(form) {
  const errors = []
  const required = (value, label) => {
    if (value == null || String(value).trim() === '') errors.push(`${label} is required.`)
  }

  required(form.first_name, 'First name')
  required(form.last_name, 'Last name')
  required(form.date_of_birth, 'Date of birth')
  required(form.gender, 'Gender')
  if (form.gender && !CO_MAKER_GENDERS.includes(form.gender)) {
    errors.push('Select a valid gender.')
  }
  required(form.civil_status, 'Civil status')
  if (form.civil_status && !CO_MAKER_CIVIL_STATUSES.includes(form.civil_status)) {
    errors.push('Select a valid civil status.')
  }
  required(form.contact_number, 'Contact number')
  const street = (form.house_street || form.complete_address || '').trim()
  if (!street) errors.push('Complete address is required.')
  required(form.barangay, 'Barangay')
  required(form.city_municipality, 'City / municipality')
  required(form.province, 'Province')
  required(form.relationship_to_borrower, 'Relationship to borrower')
  if (form.relationship_to_borrower && !CO_MAKER_RELATIONSHIPS.includes(form.relationship_to_borrower)) {
    errors.push('Select a valid relationship from the dropdown.')
  }
  required(form.employment_status, 'Employment status')
  if (form.employment_status && !CO_MAKER_EMPLOYMENT_STATUSES.includes(form.employment_status)) {
    errors.push('Select a valid employment status.')
  }
  required(form.valid_id_type, 'Valid ID type')
  if (form.valid_id_type && !CO_MAKER_ID_TYPES.includes(form.valid_id_type)) {
    errors.push('Select a valid ID type.')
  }
  required(form.valid_id_number, 'Valid ID number')

  if (form.date_of_birth) {
    const dob = new Date(form.date_of_birth)
    if (Number.isNaN(dob.getTime()) || dob >= new Date()) {
      errors.push('Date of birth must be a valid date in the past.')
    }
  }

  return errors
}

export function formatCoMakerIncome(value) {
  if (value == null || value === '') return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function coMakerDisplayName(formOrRecord) {
  const parts = [formOrRecord.first_name, formOrRecord.middle_name, formOrRecord.last_name]
    .map((p) => (p || '').trim())
    .filter(Boolean)
  let name = parts.join(' ')
  const suffix = (formOrRecord.suffix || '').trim()
  if (suffix) name = `${name} ${suffix}`.trim()
  return name || formOrRecord.full_name || 'Co-Maker'
}
