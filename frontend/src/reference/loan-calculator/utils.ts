export function formatPeso(value: number | null | undefined): string {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  const amount = Number(value || 0)
  return `${amount.toFixed(digits)}%`
}
