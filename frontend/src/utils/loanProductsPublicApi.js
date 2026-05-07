import { laravelRequest, formatLaravelUnreachableError } from './lendingLaravelApi.js'
import { filterLoanProductsForDisplay } from './loanProductDisplayFilter.js'

/**
 * Public loan catalog (no auth). Uses `/api/v1/public/...` with same base resolution as admin.
 */
export async function getLoanProducts() {
  const { res, lastError } = await laravelRequest('/public/loan-products')
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = raw.message || raw.error || `HTTP ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : 'Failed to load loan products.')
  }
  const rows = Array.isArray(raw.data) ? raw.data : []
  return filterLoanProductsForDisplay(rows)
}

/**
 * @param {{ slug: string, term_months: number, monthly_pension?: number, principal?: number }} payload
 * Pension products: pass monthly_pension. Others: pass principal (desired loan amount).
 */
export async function postLoanCalculator(payload) {
  const body = {
    slug: payload.slug,
    term_months: Number(payload.term_months),
  }
  if (payload.include_fees === true) {
    body.include_fees = true
  }
  if (payload.monthly_pension != null && payload.monthly_pension !== '') {
    body.monthly_pension = Number(payload.monthly_pension)
  }
  if (payload.principal != null && payload.principal !== '') {
    body.principal = Number(payload.principal)
  }
  const { res, lastError } = await laravelRequest('/public/loan-products/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = raw.message || `HTTP ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : 'Calculation failed.')
  }
  return raw
}
