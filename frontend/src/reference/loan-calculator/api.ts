import type { ComputeLoanInput, ComputeLoanResult, LoanProductLite } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`)
  return data as T
}

export async function fetchPublicLoanProducts(): Promise<LoanProductLite[]> {
  const payload = await request<{ data?: LoanProductLite[] }>('/public/loan-products', { method: 'GET' })
  return Array.isArray(payload?.data) ? payload.data : []
}

export async function quickComputeLoan(input: ComputeLoanInput): Promise<ComputeLoanResult> {
  const payload = await request<{ data: ComputeLoanResult }>('/public/loan-computations/quick', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.data
}
