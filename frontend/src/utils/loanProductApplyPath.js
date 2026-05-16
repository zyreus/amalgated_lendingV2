/** Map public loan product slug to SPA apply route (mirrors `LoanProductsPage`). */
export function loanProductApplyPath(slug) {
  const s = String(slug || '').toLowerCase()
  if (s === 'chattel-mortgage') return '/loans/chattel-mortgage'
  if (s === 'real-estate-mortgage') return '/loans/real-estate-mortgage'
  if (s === 'salary-loan') return '/loans/salary-loan'
  if (s === 'travel-assistance-loan') return '/loans/travel-assistance-loan'
  if (s === 'sss-pension-loan') return '/loans/sss-pension-loan'
  return `/apply?product=${encodeURIComponent(slug)}`
}
