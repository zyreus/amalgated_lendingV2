/** Map public loan product slug to borrower wizard `loan_type`. */
const SLUG_TO_LOAN_TYPE = {
  'chattel-mortgage': 'chattel',
  'real-estate-mortgage': 'real_estate',
  'salary-loan': 'salary',
  appliance: 'appliance',
  'travel-assistance-loan': 'travel_assistance',
  'sss-pension-loan': 'sss_pension',
  'gsis-pension-loan': 'sss_pension',
  'pension-loan': 'sss_pension',
}

const LOAN_TYPE_TO_APPLICATION_ROUTE = {
  salary: '/borrower/loan-application/salary-loan',
  chattel: '/borrower/loan-application/chattel-mortgage',
  real_estate: '/borrower/loan-application/real-estate-mortgage',
  sss_pension: '/borrower/loan-application/pension-loan',
  travel_assistance: '/borrower/loan-application/travel-assistance',
}

export function loanTypeFromProductSlug(slug) {
  const s = String(slug || '').toLowerCase()
  return SLUG_TO_LOAN_TYPE[s] || null
}

/** Post-login destination for starting a loan application in the portal. */
export function borrowerApplyRedirectPath(productSlug) {
  const loanType = loanTypeFromProductSlug(productSlug)
  if (LOAN_TYPE_TO_APPLICATION_ROUTE[loanType]) return LOAN_TYPE_TO_APPLICATION_ROUTE[loanType]
  const params = new URLSearchParams()
  if (loanType) params.set('loan_type', loanType)
  const qs = params.toString()
  return qs ? `/borrower/apply-loan?${qs}` : '/borrower/apply-loan'
}

function authQueryString(productSlug, basePath) {
  const params = new URLSearchParams()
  params.set('redirect', borrowerApplyRedirectPath(productSlug))
  if (productSlug) params.set('product', String(productSlug))
  return `${basePath}?${params.toString()}`
}

export function borrowerLoginApplyPath(productSlug) {
  return authQueryString(productSlug, '/borrower/login')
}

export function borrowerRegisterApplyPath(productSlug) {
  return authQueryString(productSlug, '/borrower/register')
}

/** Preserve redirect/product when switching between login and register. */
export function borrowerAuthHandoffSearchParams(searchParams) {
  const next = new URLSearchParams()
  const redirect = searchParams.get('redirect')
  const product = searchParams.get('product')
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    next.set('redirect', redirect)
  }
  if (product) next.set('product', product)
  const qs = next.toString()
  return qs ? `?${qs}` : ''
}
