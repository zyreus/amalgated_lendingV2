/**
 * Loan products excluded from public listings (loan products page, home preview, apply dropdown).
 * Direct routes (e.g. /loans/real-estate-mortgage) may still work if configured in the router.
 */
/** Legacy / duplicate catalog rows only — keep admin “Loan products” list aligned with public apply flows. */
const HIDDEN_SLUGS = new Set([
  'rem',
  'travel-abroad',
  'salary-aci',
])

export function filterLoanProductsForDisplay(products) {
  if (!Array.isArray(products)) return []
  return products.filter((p) => !HIDDEN_SLUGS.has(String(p.slug || '').toLowerCase()))
}
