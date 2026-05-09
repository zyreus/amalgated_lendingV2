import { laravelRequest, formatLaravelUnreachableError } from './lendingLaravelApi.js'
import { deriveApplicantFromExtended, deriveProductApiFields } from '../components/loan/amalgatedPayloadMerge.js'
import { publicChatJson } from './adminChatApi.js'

/** Merge `extendedApplication` into flat fields used by public multipart endpoints. */
function withExtendedApplicationDerived(source) {
  const ext = source?.extendedApplication
  if (!ext || typeof ext !== 'object') return source
  const d = deriveApplicantFromExtended(ext, source)
  const px = deriveProductApiFields(ext)
  return {
    ...source,
    fullName: d.fullName,
    email: d.email,
    phone: d.phone,
    address: d.address,
    city: d.city,
    province: d.province,
    loanAmount: d.loanAmount,
    loanTerm: d.loanTerm,
    propertyLocation: px.propertyLocation || source.propertyLocation,
    propertyValue: px.propertyValue || source.propertyValue,
    tinNumber: px.tinNumber || source.tinNumber,
    destinationCountry: px.destinationCountry || source.destinationCountry,
    travelDate: px.travelDate || source.travelDate,
    travelPurpose: px.travelPurpose || source.travelPurpose || source.purpose,
    employerName: px.employerName || source.employerName,
    monthlySalary: px.monthlySalary || source.monthlySalary,
    monthlyPension: px.monthlyPension || source.monthlyPension,
    age: px.age || source.age,
    pensionType: px.pensionType || source.pensionType,
    stencilText: px.stencilText || source.stencilText,
  }
}

function buildApplicationPayload(source) {
  const base = {
    full_name: source.fullName || null,
    email: source.email || null,
    phone: source.phone || null,
    date_of_birth: source.dateOfBirth || null,
    address: source.address || null,
    city: source.city || null,
    province: source.province || null,
    employment_status: source.employmentStatus || null,
    employer_name: source.employerName || null,
    monthly_income: source.monthlyIncome || null,
    years_employed: source.yearsEmployed || null,
    loan_type: source.loanType || null,
    loan_amount: source.loanAmount || null,
    loan_term_months: source.loanTerm || null,
    selected_interest_rate: source.selectedInterestRate ?? null,
    selected_rate_type: source.selectedRateType || null,
    purpose: source.purpose || null,
    id_type: source.idType || null,
    id_number: source.idNumber || null,
  }
  if (source.extendedApplication && typeof source.extendedApplication === 'object') {
    base.extended_application_form = source.extendedApplication
  }
  if (source.coMakerStatement && typeof source.coMakerStatement === 'object') {
    base.co_maker_statement = source.coMakerStatement
  }
  if (source.privacyConsent && typeof source.privacyConsent === 'object') {
    base.privacy_consent = {
      agreed: Boolean(source.privacyConsent.agreed),
      agreed_at: source.privacyConsent.agreedAt || null,
      policy_version: source.privacyConsent.version || null,
    }
  }
  const slug = String(source.loanProductSlug ?? source.loan_product_slug ?? '').trim()
  if (slug) base.loan_product_slug = slug
  return base
}

export async function postPublicInquiry(payload) {
  const source = payload || {}
  const preferredLoanType = String(source.preferredLoanType || source.loanType || '').trim()
  const estimatedLoanAmount = String(source.estimatedLoanAmount || '').trim()
  const contactNumber = String(source.contactNumber || source.phone || '').trim()
  const messageParts = ['Website borrower inquiry']
  if (preferredLoanType) messageParts.push(`Preferred loan type: ${preferredLoanType}`)
  if (estimatedLoanAmount) messageParts.push(`Estimated amount: PHP ${estimatedLoanAmount}`)
  if (contactNumber) messageParts.push(`Contact number: ${contactNumber}`)

  const { res, data } = await publicChatJson('/api/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: String(source.name || '').trim(),
      email: String(source.email || '').trim(),
      phone: contactNumber,
      company: String(source.organization || source.company || '').trim(),
      message: messageParts.filter(Boolean).join('\n\n'),
      source_page: '/contact',
    }),
  })
  if (!res) throw new Error('Unable to reach inquiry service. Please try again in a moment.')
  if (!res.ok) throw new Error(data?.message || `Inquiry submit failed (HTTP ${res.status})`)
  return data
}

export async function postAliLaravelApplication(payload) {
  const source = withExtendedApplicationDerived(payload || {})
  const principal = Number(source.loanAmount || 0)
  const termMonths = Number(source.loanTerm || 0)
  const applicationPayload = buildApplicationPayload(source)

  if (source.facePhotoFile instanceof File) {
    const fd = new FormData()
    fd.append('name', String(source.fullName || '').trim())
    fd.append('email', String(source.email || '').trim())
    fd.append('phone', String(source.phone || '').trim())
    fd.append('password', String(source.borrowerPassword || ''))
    fd.append('principal', String(principal))
    fd.append('term_months', String(termMonths))
    fd.append('application_payload', JSON.stringify(applicationPayload))
    fd.append('face_photo', source.facePhotoFile, source.facePhotoFile.name || 'face.jpg')
    if (source.docPayslip instanceof File) {
      fd.append('doc_payslip', source.docPayslip, source.docPayslip.name || 'payslip.pdf')
    }
    if (source.docProofOfIncome instanceof File) {
      fd.append('doc_proof_of_income', source.docProofOfIncome, source.docProofOfIncome.name || 'proof-of-income.pdf')
    }
    if (source.docGovernmentId instanceof File) {
      fd.append('doc_government_id', source.docGovernmentId, source.docGovernmentId.name || 'government-id.pdf')
    }

    const { res, lastError } = await laravelRequest('/public/loan-applications', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: fd,
    })
    if (!res) throw new Error(formatLaravelUnreachableError(lastError))
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      let msg = data?.message || data?.error
      if (!msg && data?.errors && typeof data.errors === 'object') {
        const flat = Object.values(data.errors).flat()
        if (flat.length) msg = flat.join(' ')
      }
      throw new Error(msg || `Application submit failed (HTTP ${res.status})`)
    }
    return data
  }

  const requestBody = {
    name: String(source.fullName || '').trim(),
    email: String(source.email || '').trim(),
    phone: String(source.phone || '').trim(),
    password: String(source.borrowerPassword || ''),
    principal,
    term_months: termMonths,
    application_payload: applicationPayload,
  }

  const { res, lastError } = await laravelRequest('/public/loan-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || `Application submit failed (HTTP ${res.status})`)
  return data
}

/**
 * Chattel mortgage: multipart with extended KYC + co-maker (existing user id OR inline person).
 */
export async function postChattelMortgageApplication(payload) {
  const source = withExtendedApplicationDerived(payload || {})
  const principal = Number(source.loanAmount || 0)
  const termMonths = Number(source.loanTerm || 0)
  const applicationPayload = buildApplicationPayload(source)
  applicationPayload.loan_type = applicationPayload.loan_type || 'Chattel Mortgage Loan'

  const fd = new FormData()
  fd.append('name', String(source.fullName || '').trim())
  fd.append('email', String(source.email || '').trim())
  fd.append('phone', String(source.phone || '').trim())
  fd.append('password', String(source.borrowerPassword || ''))
  fd.append('principal', String(principal))
  fd.append('term_months', String(termMonths))
  fd.append('application_payload', JSON.stringify(applicationPayload))
  if (source.tinNumber != null && String(source.tinNumber).trim() !== '') {
    fd.append('tin_number', String(source.tinNumber).trim())
  }
  if (source.stencilText != null && String(source.stencilText).trim() !== '') {
    fd.append('stencil_text', String(source.stencilText).trim())
  }
  if (source.coMakerId != null && String(source.coMakerId).trim() !== '') {
    fd.append('co_maker_id', String(source.coMakerId).trim())
  } else {
    fd.append('co_maker_name', String(source.coMakerName || '').trim())
    fd.append('co_maker_email', String(source.coMakerEmail || '').trim())
    fd.append('co_maker_phone', String(source.coMakerPhone || '').trim())
  }

  const fileFields = [
    ['doc_application_form', source.docApplicationForm],
    ['doc_or_cr', source.docOrCr],
    ['doc_picture_2x2', source.docPicture2x2],
    ['doc_bank_statement', source.docBankStatement],
    ['doc_proof_of_billing', source.docProofOfBilling],
    ['doc_proof_of_income', source.docProofOfIncome],
    ['doc_stencil', source.docStencil],
    ['doc_marriage_contract', source.docMarriageContract],
    ['doc_tin', source.docTin],
  ]
  for (const [key, file] of fileFields) {
    if (file instanceof File) {
      fd.append(key, file, file.name || 'upload')
    }
  }
  const gov = source.docGovernmentIds
  if (Array.isArray(gov)) {
    gov.forEach((f) => {
      if (f instanceof File) fd.append('doc_government_id[]', f, f.name || 'id')
    })
  }

  const { res, lastError } = await laravelRequest('/public/chattel-mortgage/apply', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: fd,
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data?.message || data?.error
    if (!msg && data?.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    throw new Error(msg || `Application submit failed (HTTP ${res.status})`)
  }
  return data
}

/**
 * Real estate mortgage (REM): property details + CTC + tax declaration required.
 */
export async function postRealEstateMortgageApplication(payload) {
  const source = withExtendedApplicationDerived(payload || {})
  const principal = Number(source.loanAmount || 0)
  const termMonths = Number(source.loanTerm || 0)
  const applicationPayload = buildApplicationPayload(source)
  applicationPayload.loan_type = applicationPayload.loan_type || 'Real Estate Mortgage Loan'

  const fd = new FormData()
  fd.append('name', String(source.fullName || '').trim())
  fd.append('email', String(source.email || '').trim())
  fd.append('phone', String(source.phone || '').trim())
  fd.append('password', String(source.borrowerPassword || ''))
  fd.append('principal', String(principal))
  fd.append('term_months', String(termMonths))
  fd.append('application_payload', JSON.stringify(applicationPayload))
  fd.append('property_location', String(source.propertyLocation || '').trim())
  fd.append('property_value', String(source.propertyValue ?? ''))
  if (source.tinNumber != null && String(source.tinNumber).trim() !== '') {
    fd.append('tin_number', String(source.tinNumber).trim())
  }

  const fileFields = [
    ['doc_application_form', source.docApplicationForm],
    ['doc_ctc', source.docCtc],
    ['doc_tax_declaration', source.docTaxDeclaration],
    ['doc_picture_2x2', source.docPicture2x2],
    ['doc_vicinity_map', source.docVicinityMap],
    ['doc_bank_statement', source.docBankStatement],
    ['doc_proof_of_billing', source.docProofOfBilling],
    ['doc_proof_of_income', source.docProofOfIncome],
    ['doc_marriage_contract', source.docMarriageContract],
    ['doc_tin', source.docTin],
    ['doc_tax_clearance', source.docTaxClearance],
  ]
  for (const [key, file] of fileFields) {
    if (file instanceof File) {
      fd.append(key, file, file.name || 'upload')
    }
  }
  const gov = source.docGovernmentIds
  if (Array.isArray(gov)) {
    gov.forEach((f) => {
      if (f instanceof File) fd.append('doc_government_id[]', f, f.name || 'id')
    })
  }

  const { res, lastError } = await laravelRequest('/public/real-estate-mortgage/apply', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: fd,
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data?.message || data?.error
    if (!msg && data?.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    throw new Error(msg || `Application submit failed (HTTP ${res.status})`)
  }
  return data
}

/**
 * Salary loan: co-maker required; borrower + co-maker IDs and payslips; principal capped by monthly salary × 6 (server-enforced).
 */
export async function postSalaryLoanApplication(payload) {
  const source = withExtendedApplicationDerived(payload || {})
  const principal = Number(source.loanAmount || 0)
  const termMonths = Number(source.loanTerm || 0)
  const applicationPayload = buildApplicationPayload({
    ...source,
    monthlyIncome: source.monthlySalary ?? source.monthlyIncome,
  })
  applicationPayload.loan_type = applicationPayload.loan_type || 'Salary Loan'

  const fd = new FormData()
  fd.append('name', String(source.fullName || '').trim())
  fd.append('email', String(source.email || '').trim())
  fd.append('phone', String(source.phone || '').trim())
  fd.append('password', String(source.borrowerPassword || ''))
  fd.append('principal', String(principal))
  fd.append('term_months', String(termMonths))
  fd.append('application_payload', JSON.stringify(applicationPayload))
  fd.append('employer_name', String(source.employerName || '').trim())
  fd.append('monthly_salary', String(source.monthlySalary ?? ''))
  if (source.coMakerId != null && String(source.coMakerId).trim() !== '') {
    fd.append('co_maker_id', String(source.coMakerId).trim())
  } else {
    fd.append('co_maker_name', String(source.coMakerName || '').trim())
    fd.append('co_maker_email', String(source.coMakerEmail || '').trim())
    fd.append('co_maker_phone', String(source.coMakerPhone || '').trim())
  }

  const singleFiles = [
    ['doc_application_form', source.docApplicationForm],
    ['doc_payslip_borrower', source.docPayslipBorrower],
    ['doc_payslip_co_maker', source.docPayslipCoMaker],
    ['doc_proof_of_billing', source.docProofOfBilling],
    ['doc_barangay_certification', source.docBarangayCertification],
  ]
  for (const [key, file] of singleFiles) {
    if (file instanceof File) {
      fd.append(key, file, file.name || 'upload')
    }
  }

  const borrowerGov = source.docBorrowerGovernmentIds
  if (Array.isArray(borrowerGov)) {
    borrowerGov.forEach((f) => {
      if (f instanceof File) fd.append('doc_borrower_government_id[]', f, f.name || 'id')
    })
  }
  const coMakerGov = source.docCoMakerGovernmentIds
  if (Array.isArray(coMakerGov)) {
    coMakerGov.forEach((f) => {
      if (f instanceof File) fd.append('doc_co_maker_government_id[]', f, f.name || 'id')
    })
  }

  const { res, lastError } = await laravelRequest('/public/salary-loan/apply', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: fd,
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data?.message || data?.error
    if (!msg && data?.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    throw new Error(msg || `Application submit failed (HTTP ${res.status})`)
  }
  return data
}

/**
 * Travel assistance: 4 bank statement files, travel details, required TIN ID upload.
 */
export async function postTravelAssistanceLoanApplication(payload) {
  const source = withExtendedApplicationDerived(payload || {})
  const principal = Number(source.loanAmount || 0)
  const termMonths = Number(source.loanTerm || 0)
  const applicationPayload = buildApplicationPayload(source)
  applicationPayload.loan_type = applicationPayload.loan_type || 'Travel Assistance Loan'

  const fd = new FormData()
  fd.append('name', String(source.fullName || '').trim())
  fd.append('email', String(source.email || '').trim())
  fd.append('phone', String(source.phone || '').trim())
  fd.append('password', String(source.borrowerPassword || ''))
  fd.append('principal', String(principal))
  fd.append('term_months', String(termMonths))
  fd.append('application_payload', JSON.stringify(applicationPayload))
  fd.append('destination_country', String(source.destinationCountry || '').trim())
  fd.append('travel_date', String(source.travelDate || '').trim())
  fd.append('purpose', String(source.travelPurpose || source.purpose || '').trim())
  if (source.tinNumber != null && String(source.tinNumber).trim() !== '') {
    fd.append('tin_number', String(source.tinNumber).trim())
  }

  const singleFiles = [
    ['doc_application_form', source.docApplicationForm],
    ['doc_or_cr', source.docOrCr],
    ['doc_picture_2x2', source.docPicture2x2],
    ['doc_tin', source.docTin],
    ['doc_proof_of_billing', source.docProofOfBilling],
  ]
  for (const [key, file] of singleFiles) {
    if (file instanceof File) {
      fd.append(key, file, file.name || 'upload')
    }
  }

  const gov = source.docGovernmentIds
  if (Array.isArray(gov)) {
    gov.forEach((f) => {
      if (f instanceof File) fd.append('doc_government_id[]', f, f.name || 'id')
    })
  }

  const bankStmts = source.docBankStatements
  if (Array.isArray(bankStmts)) {
    bankStmts.forEach((f) => {
      if (f instanceof File) fd.append('doc_bank_statement[]', f, f.name || 'statement')
    })
  }

  const { res, lastError } = await laravelRequest('/public/travel-assistance-loan/apply', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: fd,
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data?.message || data?.error
    if (!msg && data?.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    throw new Error(msg || `Application submit failed (HTTP ${res.status})`)
  }
  return data
}

/**
 * Travel Assistance — full wizard (POST /api/v1/loan/apply).
 * @param {{ wizard: object, password: string, termsAccepted: boolean, signatureData?: string, signatureDate?: string, files?: object }} payload
 */
export async function postTravelLoanWizardApplication(payload) {
  const { wizard, password, termsAccepted, signatureData, signatureDate, files = {} } = payload || {}
  const fd = new FormData()
  fd.append('wizard_payload', JSON.stringify(wizard))
  fd.append('terms_accepted', termsAccepted ? '1' : '0')
  fd.append('password', String(password || ''))
  if (signatureData) fd.append('signature_data', signatureData)
  if (signatureDate) fd.append('signature_date', signatureDate)

  const pp = files.passport_photos || []
  ;[0, 1, 2].forEach((i) => {
    if (pp[i] instanceof File) fd.append(`passport_photo_${i + 1}`, pp[i], pp[i].name || `photo_${i + 1}`)
  })
  const single = [
    ['passport_copy', files.passport_copy],
    ['valid_id_1', files.valid_id_1],
    ['valid_id_2', files.valid_id_2],
    ['community_tax_certificate', files.community_tax_certificate],
    ['residence_sketch', files.residence_sketch],
  ]
  for (const [key, file] of single) {
    if (file instanceof File) fd.append(key, file, file.name || key)
  }

  const { res, lastError } = await laravelRequest('/loan/apply', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: fd,
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data?.message || data?.error
    if (!msg && data?.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    throw new Error(msg || `Application submit failed (HTTP ${res.status})`)
  }
  return data
}

/**
 * SSS/GSIS pension loan: age max 70, 4 bank months, required pension verification upload; co-maker optional.
 */
export async function postSssPensionLoanApplication(payload) {
  const source = withExtendedApplicationDerived(payload || {})
  const principal = Number(source.loanAmount || 0)
  const termMonths = Number(source.loanTerm || 0)
  const applicationPayload = buildApplicationPayload(source)
  applicationPayload.loan_type = applicationPayload.loan_type || 'SSS Pension Loan'

  const fd = new FormData()
  fd.append('name', String(source.fullName || '').trim())
  fd.append('email', String(source.email || '').trim())
  fd.append('phone', String(source.phone || '').trim())
  fd.append('password', String(source.borrowerPassword || ''))
  fd.append('principal', String(principal))
  fd.append('term_months', String(termMonths))
  fd.append('application_payload', JSON.stringify(applicationPayload))
  fd.append('pension_type', String(source.pensionType || '').trim().toUpperCase())
  fd.append('monthly_pension', String(source.monthlyPension ?? ''))
  fd.append('age', String(source.age ?? ''))

  if (source.coMakerId != null && String(source.coMakerId).trim() !== '') {
    fd.append('co_maker_id', String(source.coMakerId).trim())
  } else if (source.includeCoMaker) {
    fd.append('co_maker_name', String(source.coMakerName || '').trim())
    fd.append('co_maker_email', String(source.coMakerEmail || '').trim())
    fd.append('co_maker_phone', String(source.coMakerPhone || '').trim())
  }

  const singleFiles = [
    ['doc_application_form', source.docApplicationForm],
    ['doc_birth_certificate_psa', source.docBirthCertificatePsa],
    ['doc_picture_2x2', source.docPicture2x2],
    ['doc_proof_of_billing', source.docProofOfBilling],
    ['doc_pension_verification', source.docPensionVerification],
    ['doc_marriage_contract', source.docMarriageContract],
  ]
  for (const [key, file] of singleFiles) {
    if (file instanceof File) {
      fd.append(key, file, file.name || 'upload')
    }
  }

  const gov = source.docGovernmentIds
  if (Array.isArray(gov)) {
    gov.forEach((f) => {
      if (f instanceof File) fd.append('doc_government_id[]', f, f.name || 'id')
    })
  }

  const bankStmts = source.docBankStatements
  if (Array.isArray(bankStmts)) {
    bankStmts.forEach((f) => {
      if (f instanceof File) fd.append('doc_bank_statement[]', f, f.name || 'statement')
    })
  }

  const { res, lastError } = await laravelRequest('/public/sss-pension-loan/apply', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: fd,
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data?.message || data?.error
    if (!msg && data?.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    throw new Error(msg || `Application submit failed (HTTP ${res.status})`)
  }
  return data
}

