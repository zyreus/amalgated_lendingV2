/** Map public loan product slug to borrower wizard `loan_type`. */
const SLUG_TO_LOAN_TYPE = {
  'chattel-mortgage': 'chattel',
  'real-estate-mortgage': 'real_estate',
  'salary-loan': 'salary',
  'travel-assistance-loan': 'travel_assistance',
  'sss-pension-loan': 'sss_pension',
}

export function loanTypeFromProductSlug(slug) {
  const s = String(slug || '').toLowerCase()
  return SLUG_TO_LOAN_TYPE[s] || null
}

/** Post-login destination for starting a loan application in the portal. */
export function borrowerApplyRedirectPath(productSlug) {
  const loanType = loanTypeFromProductSlug(productSlug)
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
