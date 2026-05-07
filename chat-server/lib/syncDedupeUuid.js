/**
 * Namespace-style deterministic UUID so Laravel `dedupe_key` stays stable across sync retries.
 * Format matches RFC 4122 variant bits (validated by Laravel `uuid` rule).
 */
import { createHash } from 'crypto'

export function deterministicSyncUuid(segment, parts) {
  const h = createHash('sha256')
  h.update(String(segment || 'seg'))
  for (const p of parts || []) {
    h.update('\u001e')
    h.update(Buffer.from(String(p), 'utf8'))
  }
  const buf = h.digest().subarray(0, 16)
  buf[6] = (buf[6] & 0x0f) | 0x50
  buf[8] = (buf[8] & 0x3f) | 0x80
  const hex = buf.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
