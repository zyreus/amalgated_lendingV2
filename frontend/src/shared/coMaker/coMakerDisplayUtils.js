function composeCoMakerName(cm) {
  if (!cm || typeof cm !== 'object') return ''
  const explicit = String(cm.full_name || '').trim()
  if (explicit) return explicit
  const parts = [cm.first_name, cm.middle_name, cm.last_name, cm.suffix]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.join(' ')
}

function normalizeCoMakerRecord(cm) {
  if (!cm || typeof cm !== 'object') return null
  const fullName = composeCoMakerName(cm)
  const email = String(cm.email || '').trim()
  const phone = String(cm.contact_number || cm.phone || '').trim()
  const relationship = String(cm.relationship_to_borrower || '').trim()
  const address = String(cm.complete_address || cm.address || '').trim()
  const employer = String(cm.employer_business_name || '').trim()
  const occupation = String(cm.occupation || '').trim()
  const monthlyIncome = cm.monthly_income

  if (!fullName && !email && !phone && !relationship) return null

  return {
    id: cm.id ?? null,
    full_name: fullName || 'Co-maker',
    email,
    contact_number: phone,
    relationship_to_borrower: relationship,
    complete_address: address,
    employer_business_name: employer,
    occupation,
    monthly_income: monthlyIncome,
    civil_status: cm.civil_status || '',
    employment_status: cm.employment_status || '',
  }
}

/**
 * Resolve co-makers from loan application API payload (structured table + legacy fields).
 */
export function resolveCoMakersFromLoanApplication(loanApplication, applicationPayload = null) {
  const payload = applicationPayload && typeof applicationPayload === 'object' ? applicationPayload : {}
  const app = loanApplication && typeof loanApplication === 'object' ? loanApplication : null
  if (!app) return []

  const fromTable = Array.isArray(app.co_makers) ? app.co_makers : Array.isArray(app.coMakers) ? app.coMakers : []
  const normalized = fromTable.map(normalizeCoMakerRecord).filter(Boolean)
  if (normalized.length) return normalized

  const linkedUser = app.co_maker || app.coMaker
  if (linkedUser && typeof linkedUser === 'object') {
    const row = normalizeCoMakerRecord({
      full_name: linkedUser.name,
      email: linkedUser.email,
      contact_number: app.co_maker_phone,
    })
    if (row) return [row]
  }

  const legacy = normalizeCoMakerRecord({
    full_name: app.co_maker_name || payload.co_maker_name,
    email: app.co_maker_email || payload.co_maker_email,
    contact_number: app.co_maker_phone || payload.co_maker_phone,
  })
  return legacy ? [legacy] : []
}

function formatIncome(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n)) return String(value)
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Rows for admin "Submitted form" panels.
 */
export function coMakerSubmittedFormRows(coMakers) {
  const rows = []
  const list = Array.isArray(coMakers) ? coMakers : []
  list.forEach((cm, index) => {
    const prefix = list.length > 1 ? `Co-maker ${index + 1} — ` : 'Co-maker — '
    const push = (suffix, value) => {
      if (value == null || value === '') return
      rows.push({
        key: `co_maker_${index}_${suffix}`,
        label: `${prefix}${suffix}`,
        value: String(value),
      })
    }
    push('Name', cm.full_name)
    push('Email', cm.email)
    push('Contact number', cm.contact_number)
    push('Relationship', cm.relationship_to_borrower)
    push('Address', cm.complete_address)
    push('Employment / business', cm.employer_business_name)
    push('Occupation', cm.occupation)
    const income = formatIncome(cm.monthly_income)
    if (income) push('Monthly income', income)
    push('Civil status', cm.civil_status)
    push('Employment status', cm.employment_status)
  })
  return rows
}
