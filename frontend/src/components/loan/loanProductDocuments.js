/**
 * Checklists shown beside each product’s official Amalgated application + uploads.
 * Keys match {@link LOAN_PRODUCT_KEYS}.
 */
export const LOAN_PRODUCT_KEYS = {
  CHATTEL_MORTGAGE: 'chattel_mortgage',
  REAL_ESTATE_MORTGAGE: 'real_estate_mortgage',
  SALARY_LOAN: 'salary_loan',
  APPLIANCE_LOAN: 'appliance_loan',
  TRAVEL_ASSISTANCE: 'travel_assistance',
  SSS_PENSION: 'sss_pension',
  GSIS_PENSION: 'gsis_pension',
}

export const LOAN_PRODUCT_DOCUMENT_CHECKLISTS = {
  [LOAN_PRODUCT_KEYS.CHATTEL_MORTGAGE]: [
    'Signed loan application form (template or digital)',
    'Two (2) valid government-issued IDs (borrower)',
    'Photocopy of OR/CR (collateral)',
    '2×2 ID picture',
    'Stencil details (vehicle/engine) or stencil file upload',
    'Co-maker: full contact details or existing borrower user ID; co-maker IDs if applicable',
    'Bank statement / passbook (recent)',
    'Proof of billing (e.g. electricity, water)',
    'Proof of income',
    'Optional: marriage contract, TIN ID or TIN number',
  ],
  [LOAN_PRODUCT_KEYS.REAL_ESTATE_MORTGAGE]: [
    'Signed loan application form',
    'Two (2) valid government-issued IDs',
    'Community Tax Certificate (CTC)',
    'Tax declaration & tax clearance (as applicable)',
    '2×2 ID picture',
    'Vicinity map / sketch of property location',
    'Bank statement / passbook',
    'Proof of billing',
    'Proof of income',
    'TIN number or TIN ID',
    'Optional: marriage contract',
    'Property title / clean title documentation (per branch instruction)',
  ],
  [LOAN_PRODUCT_KEYS.SALARY_LOAN]: [
    'Signed loan application form',
    'Latest payslip — borrower',
    'Latest payslip — co-maker',
    'Proof of billing',
    'Barangay certification',
    'Two (2) valid government IDs — borrower',
    'Two (2) valid government IDs — co-maker',
  ],
  [LOAN_PRODUCT_KEYS.APPLIANCE_LOAN]: [
    'Valid government-issued ID',
    'Proof of billing',
    'Proof of income',
    'Quotation or invoice from approved partner store',
  ],
  [LOAN_PRODUCT_KEYS.TRAVEL_ASSISTANCE]: [
    'Signed loan application form',
    'Two (2) valid government-issued IDs',
    '2×2 ID picture',
    'TIN ID',
    'Proof of billing',
    'Four (4) consecutive months of bank statements (one file per month)',
    'Landbank (or designated) account for disbursement',
    'OR/CR if applicable (per branch)',
    'Travel destination, date, and purpose (captured in the form)',
  ],
  [LOAN_PRODUCT_KEYS.SSS_PENSION]: [
    'Signed loan application form',
    'PSA birth certificate',
    'Optional: marriage contract',
    '2×2 ID picture',
    'Proof of billing',
    'Pension verification (SSS/GSIS)',
    'Two (2) valid government-issued IDs',
    'Four (4) months of bank statements (one file per month)',
    'If co-maker: co-maker contact details and IDs as applicable',
  ],
  [LOAN_PRODUCT_KEYS.GSIS_PENSION]: [
    'GSIS ID',
    'Pension voucher',
    'Recent bank statement',
    'Valid government-issued ID',
  ],
}

export function getLoanProductDocumentList(key) {
  return LOAN_PRODUCT_DOCUMENT_CHECKLISTS[key] || []
}

/** Map API slug to checklist key for Apply page / dynamic routing. */
export function documentProductKeyFromSlug(slug) {
  const s = String(slug || '').toLowerCase()
  if (s.includes('chattel')) return LOAN_PRODUCT_KEYS.CHATTEL_MORTGAGE
  if (s.includes('real-estate') || s === 'rem') return LOAN_PRODUCT_KEYS.REAL_ESTATE_MORTGAGE
  if (s.includes('salary-loan') || (s.includes('salary') && !s.includes('aci'))) return LOAN_PRODUCT_KEYS.SALARY_LOAN
  if (s.includes('appliance')) return LOAN_PRODUCT_KEYS.APPLIANCE_LOAN
  if (s.includes('travel')) return LOAN_PRODUCT_KEYS.TRAVEL_ASSISTANCE
  if (s.includes('gsis')) return LOAN_PRODUCT_KEYS.GSIS_PENSION
  if (s.includes('pension') || s.includes('sss')) return LOAN_PRODUCT_KEYS.SSS_PENSION
  return null
}
