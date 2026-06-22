import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../admin/api/client.js'
import { admin as ui } from '../admin/components/AdminUi.jsx'
import { DarkTableSkeleton } from '../components/AppSkeletons.jsx'
import { getAuthUser } from '../auth/session.js'
import { logoutAndRedirect } from '../components/ProtectedRoute.jsx'
import CollectorWellnessView from '../components/wellness/CollectorWellnessView.jsx'

export default function CollectorDashboardPage() {
  const navigate = useNavigate()
  const user = getAuthUser()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusById, setStatusById] = useState({})
  const [savingId, setSavingId] = useState(null)

  const loadPayments = async () => {
    setLoading(true)
    try {
      const res = await api('/payments?per_page=10')
      const rows = res?.data?.data ?? []
      const next = Array.isArray(rows) ? rows : []
      setPayments(next)
      const seed = {}
      next.forEach((p) => {
        seed[p.id] = p.status === 'paid' ? 'paid' : 'pending'
      })
      setStatusById(seed)
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPayments()
  }, [])

  const saveStatus = async (paymentId) => {
    const status = statusById[paymentId]
    if (!status) return
    setSavingId(paymentId)
    try {
      await api(`/payments/${paymentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, auto_mint_receipt_numbers: true }),
      })
      await loadPayments()
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl min-w-0 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-red-400">Collector Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold">Hello, {user?.name || 'Collector'}</h1>
          <p className="mt-2 text-sm text-white/60">Monitor borrower wellness, due dates, and collection priorities.</p>
          <Link to="/admin/collector-wellness" className="mt-3 inline-block text-sm font-semibold text-red-400 hover:underline">
            Open collector wellness view →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-1">
          <CollectorWellnessView canViewPortfolio={false} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <h2 className="text-sm font-semibold">Recent payment records</h2>
          {loading ? (
            <DarkTableSkeleton rows={5} cols={5} />
          ) : payments.length === 0 ? (
            <p className="mt-4 text-sm text-white/50">No payment records found.</p>
          ) : (
            <div className={`${ui.tableScroll} mt-4`}>
              <table className={`${ui.tableBase} min-w-[720px] text-left text-white`}>
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Loan #</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Due date</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Amount</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Status</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className={ui.tableCell}>#{p.loan_id}</td>
                      <td className={ui.tableCell}>{p.due_date || '—'}</td>
                      <td className={ui.tableCell}>₱{Number(p.amount_due || 0).toLocaleString()}</td>
                      <td className={ui.tableCell}>
                        <select
                          value={statusById[p.id] || 'pending'}
                          onChange={(e) => setStatusById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="rounded border border-white/15 bg-black px-2 py-1 text-xs text-white"
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className={ui.tableCell}>
                        <button
                          type="button"
                          onClick={() => saveStatus(p.id)}
                          disabled={savingId === p.id}
                          className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {savingId === p.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => logoutAndRedirect(navigate)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
