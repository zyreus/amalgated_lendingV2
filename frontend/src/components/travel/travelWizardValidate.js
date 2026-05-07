const MAX_LOAN = 2_000_000

export function validateTravelWizardClient(wizard, { termsAccepted, files }) {
  const errors = {}

  const req = (prefix, key, label, v) => {
    if (v == null || String(v).trim() === '') errors[`${prefix}.${key}`] = `${label} is required.`
  }

  const L = wizard.loan || {}
  req('loan', 'amount_of_loan', 'Amount of loan', L.amount_of_loan)
  if (L.amount_of_loan && Number(L.amount_of_loan) > MAX_LOAN) {
    errors['loan.amount_of_loan'] = `Maximum loan is ₱${MAX_LOAN.toLocaleString()}.`
  }
  req('loan', 'purpose_of_loan', 'Purpose of loan', L.purpose_of_loan)
  if (L.purpose_of_loan && String(L.purpose_of_loan).trim().length < 10) {
    errors['loan.purpose_of_loan'] = 'Purpose must be at least 10 characters.'
  }
  req('loan', 'country_destination', 'Country / destination', L.country_destination)
  req('loan', 'travel_date', 'Travel date', L.travel_date)
  if (L.travel_date) {
    const t = new Date(`${L.travel_date}T12:00:00`)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    if (t < start) errors['loan.travel_date'] = 'Travel date must be today or in the future.'
  }

  const P = wizard.personal || {}
  ;[
    ['email', 'Email'],
    ['last_name', 'Last name'],
    ['first_name', 'First name'],
    ['birthday', 'Birthday'],
    ['place_of_birth', 'Place of birth'],
    ['civil_status', 'Civil status'],
    ['gender', 'Gender'],
    ['citizenship', 'Citizenship'],
    ['mother_maiden_name', "Mother's maiden name"],
    ['home_address', 'Home address'],
    ['barangay', 'Barangay'],
    ['city', 'City'],
    ['province', 'Province'],
    ['zip_code', 'ZIP code'],
    ['move_in_date', 'Move-in date'],
    ['residence_type', 'Residence type'],
    ['mobile_no', 'Mobile number'],
  ].forEach(([k, lab]) => req('personal', k, lab, P[k]))

  const E = wizard.employment || {}
  req('employment', 'employment_type', 'Employment type', E.employment_type)
  req('employment', 'tin', 'TIN', E.tin)
  req('employment', 'sss_gsis', 'SSS / GSIS', E.sss_gsis)
  req('employment', 'employer_name', 'Employer name', E.employer_name)
  req('employment', 'employer_address', 'Employer address', E.employer_address)
  req('employment', 'employer_tel', 'Employer telephone', E.employer_tel)
  req('employment', 'start_date', 'Start date', E.start_date)
  req('employment', 'position', 'Position', E.position)

  if (!termsAccepted) errors.terms = 'You must agree to the Terms and Conditions.'
  if (!files?.residence_sketch || !(files.residence_sketch instanceof File)) {
    errors['files.residence_sketch'] = 'Please upload a sketch of residence.'
  }
  const pp = files?.passport_photos || []
  if (![0, 1, 2].every((i) => pp[i] instanceof File)) {
    errors['files.passport_photos'] = 'Please upload all three passport photos.'
  }
  if (!(files?.passport_copy instanceof File)) errors['files.passport_copy'] = 'Passport copy is required.'
  if (!(files?.valid_id_1 instanceof File) || !(files?.valid_id_2 instanceof File)) {
    errors['files.valid_ids'] = 'Please upload two valid IDs.'
  }
  if (!(files?.community_tax_certificate instanceof File)) {
    errors['files.community_tax_certificate'] = 'Community tax certificate is required.'
  }

  return errors
}
