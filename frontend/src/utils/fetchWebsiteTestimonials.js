import { laravelRequest } from './lendingLaravelApi.js'

/**
 * Approved + consent testimonials (same source as admin “publish to website”).
 * `meta` totals are computed over the full eligible set, not only `limit` rows.
 */
export async function fetchWebsiteTestimonials(limit = 12) {
  const safe = Math.min(24, Math.max(1, Math.floor(Number(limit)) || 12))
  const { res } = await laravelRequest(`/public/website/testimonials?limit=${safe}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!res?.ok) {
    return {
      ok: false,
      data: [],
      meta: { review_count: 0, rating_value: null },
    }
  }

  const body = await res.json().catch(() => ({}))
  const rows = Array.isArray(body?.data) ? body.data : []
  const reviewCount = Number(body?.meta?.review_count)
  const ratingValue = body?.meta?.rating_value

  return {
    ok: true,
    data: rows,
    meta: {
      review_count: Number.isFinite(reviewCount) ? reviewCount : rows.length,
      rating_value: ratingValue != null && !Number.isNaN(Number(ratingValue)) ? Number(ratingValue) : null,
    },
  }
}
