import { LOAN_PRODUCT_KEYS } from '../components/loan/loanProductDocuments.js'

/** @typedef {import('../components/loan/PublicLoanProductPage.jsx').PublicLoanProductConfig} PublicLoanProductConfig */

/** @type {Record<string, PublicLoanProductConfig>} */
export const PUBLIC_LOAN_PRODUCT_CONFIG = {
  'chattel-mortgage': {
    slug: 'chattel-mortgage',
    title: 'Chattel Mortgage Loan',
    iconKey: 'vehicle',
    tier: 'blue',
    fallbackRateLabel: '3.88% per month (standard)',
    description: 'Vehicle and movable asset financing with OR/CR collateral and flexible terms.',
    infoItems: [
      { label: 'Collateral', value: 'OR/CR (vehicle or movable asset)' },
      {
        label: 'Co-maker',
        value: 'Required — separate contact details or existing borrower account',
      },
      {
        label: 'Requirements summary',
        value:
          'Application form, 2 government IDs, OR/CR copy, 2×2 photo, stencil details, bank statement, proof of billing, and proof of income.',
        span: 2,
      },
    ],
    features: [
      { title: 'Vehicle financing', body: 'Finance cars, motorcycles, and other registered movable assets.' },
      { title: 'Structured terms', body: 'Choose terms that fit your budget with transparent monthly rates.' },
      { title: 'Secure portal apply', body: 'Complete your application, uploads, and signatures in the Borrower Portal.' },
    ],
    productKey: LOAN_PRODUCT_KEYS.CHATTEL_MORTGAGE,
    eligibility: [
      'Filipino resident with valid government ID',
      'Vehicle or movable asset with OR/CR for collateral',
      'Qualified co-maker with separate contact details',
      'Proof of income and billing address',
      'Ability to provide all required uploads before submission',
    ],
  },
  'real-estate-mortgage': {
    slug: 'real-estate-mortgage',
    title: 'Real Estate Mortgage',
    iconKey: 'home',
    tier: 'purple',
    fallbackRateLabel: '3.88% per month (standard)',
    description: 'Property-backed financing for residential or commercial real estate with branch-guided documentation.',
    infoItems: [
      { label: 'Collateral', value: 'Real property / clean title (per branch instruction)' },
      { label: 'Max term', value: 'Up to 60 months (subject to approval)' },
      {
        label: 'Requirements summary',
        value:
          'Application form, IDs, CTC, tax documents, vicinity map, bank statement, proof of billing, proof of income, and TIN.',
        span: 2,
      },
    ],
    features: [
      { title: 'Property-backed limits', body: 'Loan amounts aligned with property value and credit review.' },
      { title: 'Flexible purpose', body: 'New loan, re-loan, or renewal options captured in your application.' },
      { title: 'Guided document prep', body: 'Review the checklist here, then upload securely after sign-in.' },
    ],
    productKey: LOAN_PRODUCT_KEYS.REAL_ESTATE_MORTGAGE,
    eligibility: [
      'Clear property documentation and location details',
      'Stable income and proof of billing',
      'Valid government-issued IDs',
      'Tax and community tax requirements as applicable',
      'Final approval subject to appraisal and credit review',
    ],
  },
  'salary-loan': {
    slug: 'salary-loan',
    title: 'Salary Loan',
    iconKey: 'briefcase',
    tier: 'green',
    fallbackRateLabel: '1.50% per month',
    description:
      'For salaried employees with a qualified co-maker; principal capped at 6× monthly gross salary.',
    infoItems: [
      { label: 'Co-maker', value: 'Required' },
      { label: 'Principal cap', value: 'Up to 6× monthly gross salary' },
      {
        label: 'Requirements summary',
        value: 'Borrower and co-maker IDs, payslips, proof of billing, barangay certification, and signed application.',
        span: 2,
      },
    ],
    features: [
      { title: 'Salary-based cap', body: 'Loan amount automatically aligned with documented monthly income.' },
      { title: 'Fast document list', body: 'Prepare payslips and IDs before you sign in to apply.' },
      { title: 'Co-maker support', body: 'Capture co-maker details and uploads inside the Borrower Portal.' },
    ],
    productKey: LOAN_PRODUCT_KEYS.SALARY_LOAN,
    eligibility: [
      'Documented employment and stable income',
      'Qualified co-maker (co-maker statement required)',
      'Loan amount within policy limits',
      'All required uploads ready before final submission',
    ],
  },
  'travel-assistance-loan': {
    slug: 'travel-assistance-loan',
    title: 'Travel Assistance Loan',
    iconKey: 'plane',
    tier: 'orange',
    fallbackRateLabel: '3.50% per month',
    description: 'Short-term assistance for qualified travel plans with destination, date, and purpose on file.',
    infoItems: [
      { label: 'Term', value: 'Typically 1 month (product-specific)' },
      { label: 'Max amount', value: 'Up to ₱2,000,000 (subject to approval)' },
      {
        label: 'Requirements summary',
        value:
          'IDs, 2×2 photo, TIN, proof of billing, four months of bank statements, disbursement account, and travel details.',
        span: 2,
      },
    ],
    features: [
      { title: 'Travel-focused', body: 'Capture destination, travel date, and purpose in your portal application.' },
      { title: 'Statement uploads', body: 'Upload consecutive bank statements securely after registration.' },
      { title: 'Status tracking', body: 'Follow review progress and notifications from your dashboard.' },
    ],
    productKey: LOAN_PRODUCT_KEYS.TRAVEL_ASSISTANCE,
    eligibility: [
      'Valid government-issued IDs and proof of billing',
      'Recent bank statements (four consecutive months)',
      'Designated disbursement account',
      'Travel details documented in the application',
      'Terms acceptance and signatures completed in the portal',
    ],
  },
  'sss-pension-loan': {
    slug: 'sss-pension-loan',
    title: 'SSS / Pension Loan',
    iconKey: 'shield',
    tier: 'green',
    fallbackRateLabel: '1.50% per month',
    description: 'For qualified pensioners with verification documents and optional co-maker where required.',
    infoItems: [
      { label: 'Eligible borrowers', value: 'SSS / GSIS pensioners (subject to verification)' },
      { label: 'Age policy', value: 'Per product safe age and limit (see branch guidance)' },
      {
        label: 'Requirements summary',
        value:
          'PSA birth certificate, pension verification, IDs, proof of billing, bank statements, and signed application.',
        span: 2,
      },
    ],
    features: [
      { title: 'Pension verification', body: 'Upload pension proof and identity documents in one secure flow.' },
      { title: 'Optional co-maker', body: 'Add co-maker details when required by branch policy.' },
      { title: 'Application history', body: 'View past submissions and status from your borrower dashboard.' },
    ],
    productKey: LOAN_PRODUCT_KEYS.SSS_PENSION,
    eligibility: [
      'Active pensioner with verifiable SSS/GSIS benefits',
      'Valid government-issued IDs',
      'Recent bank statements and proof of billing',
      'Age within product safe limits',
      'Co-maker documents if applicable',
    ],
  },
}

export function getPublicLoanProductConfig(slug) {
  return PUBLIC_LOAN_PRODUCT_CONFIG[String(slug || '').toLowerCase()] || null
}
