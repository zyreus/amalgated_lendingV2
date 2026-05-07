import { useEffect, useState } from 'react'
import type { LoanProductLite } from '../types'
import { fetchPublicLoanProducts } from '../api'

export function AdminLoanProductManager() {
  const [rows, setRows] = useState<LoanProductLite[]>([])

  useEffect(() => {
    fetchPublicLoanProducts().then(setRows).catch(() => setRows([]))
  }, [])

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-base font-semibold">Admin Loan Products</h3>
      <p className="mt-1 text-sm text-gray-600">Reference scaffold for product management UI + rate verification.</p>
      <div className="mt-3 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Code</th>
              <th className="text-left">Name</th>
              <th className="text-left">Rate</th>
              <th className="text-left">Max Term</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.code ?? '-'}</td>
                <td>{r.name}</td>
                <td>
                  {r.interest_rate}% {r.rate_type}
                </td>
                <td>{r.max_term ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
