/**
 * Clamp a rating to the 1–5 star scale (0 allowed for empty display).
 */
export function clampRating(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(5, Math.max(0, n))
}

/**
 * Per-star fill amounts (0–1) for a decimal rating, e.g. 4.3 → [1,1,1,1,0.3].
 */
export function starFillLevels(value) {
  const rating = clampRating(value)
  return [1, 2, 3, 4, 5].map((star) => Math.min(1, Math.max(0, rating - star + 1)))
}

/**
 * Prefer API aggregate; fall back to averaging loaded review rows.
 */
export function computeAverageRating(metaRating, items = []) {
  if (metaRating != null && !Number.isNaN(Number(metaRating))) {
    return clampRating(metaRating)
  }
  const rows = Array.isArray(items) ? items.filter((it) => Number.isFinite(Number(it?.rating))) : []
  if (rows.length === 0) return null
  const sum = rows.reduce((acc, it) => acc + clampRating(it.rating), 0)
  return clampRating(sum / rows.length)
}
