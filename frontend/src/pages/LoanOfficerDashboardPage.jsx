import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../admin/api/client.js'
import { admin as ui } from '../admin/components/AdminUi.jsx'
import { DarkTableSkeleton } from '../components/AppSkeletons.jsx'
import { getAuthUser } from '../auth/session.js'
import { logoutAndRedirect } from '../components/ProtectedRoute.jsx'
import CreditWellnessSummaryPanel from '../components/wellness/CreditWellnessSummaryPanel.jsx'
import RiskBadge from '../components/wellness/RiskBadge.jsx'
import WellnessReportsPanel from '../components/wellness/WellnessReportsPanel.jsx'

export default function LoanOfficerDashboardPage() {
  const navigate = useNavigate()
  const user = getAuthUser()
  const [pendingLoans, setPendingLoans] = useState([])
  const [wellnessByBorrower, setWellnessByBorrower] = useState({})
  const [portfolio, setPortfolio] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [loansRes, portRes] = await Promise.all([
          api('/loans?status=pending&per_page=8'),
          api('/credit-wellness/portfolio').catch(() => null),
        ])
        const rows = loansRes?.data?.data ?? []
        const list = Array.isArray(rows) ? rows : []
        setPendingLoans(list)
        if (portRes?.ok) setPortfolio(portRes.data)

        const wellnessMap = {}
        await Promise.all(
          list.slice(0, 5).map(async (l) => {
            const bid = l.borrower?.id
            if (!bid) return
            try {
              const w = await api(`/borrowers/${bid}/credit-wellness`)
              if (w?.ok) wellnessMap[bid] = w.data?.dashboard ?? w.data?.wellness
            } catch { /* skip */ }
          }),
        )
        setWellnessByBorrower(wellnessMap)
      } catch {
        setPendingLoans([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl min-w-0 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-red-400">Loan Officer Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold">Hello, {user?.name || 'Officer'}</h1>
          <p className="mt-2 text-sm text-white/60">Review applications with credit wellness intelligence for better lending decisions.</p>
          <Link to="/admin/credit-wellness" className="mt-3 inline-block text-sm font-semibold text-red-400 hover:underline">
            Open full wellness overview →
          </Link>
        </div>

        {portfolio ? (
          <div className="grid gap-4 sm:grid-cols-4">
            <MiniKpi label="Borrowers tracked" value={portfolio.total_borrowers} />
            <MiniKpi label="Avg. wellness" value={portfolio.avg_wellness_score} />
            <MiniKpi label="High-risk" value={portfolio.high_risk_borrowers?.length ?? 0} accent="text-red-400" />
            <MiniKpi label="Top performers" value={portfolio.top_performers?.length ?? 0} accent="text-emerald-400" />
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pending applications — wellness preview</h2>
            <Link to="/admin/applications" className="text-xs text-red-400 hover:underline">View all →</Link>
          </div>
          {loading ? (
            <DarkTableSkeleton rows={5} cols={5} />
          ) : pendingLoans.length === 0 ? (
            <p className="mt-4 text-sm text-white/50">No pending loans found.</p>
          ) : (
            <div className={`${ui.tableScroll} mt-4`}>
              <table className={`${ui.tableBase} min-w-[800px] text-left text-white`}>
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Loan #</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Borrower</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Principal</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Wellness</th>
                    <th className={`${ui.tableCell} text-left text-[11px] font-semibold uppercase tracking-wider`}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLoans.map((l) => {
                    const w = wellnessByBorrower[l.borrower?.id]
                    return (
                      <tr key={l.id} className="border-b border-white/5">
                        <td className={ui.tableCell}>
                          <Link to={`/admin/loans/${l.id}`} className="text-red-400 hover:underline">#{l.id}</Link>
                        </td>
                        <td className={`${ui.tableCell} break-words`}>{l.borrower?.name || '—'}</td>
                        <td className={ui.tableCell}>₱{Number(l.principal || 0).toLocaleString()}</td>
                        <td className={ui.tableCell}>{w ? `${w.wellness_score}/100` : '—'}</td>
                        <td className={ui.tableCell}>
                          {w ? <RiskBadge level={w.default_risk_level || w.risk_level} /> : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pendingLoans[0]?.borrower?.id ? (
          <div className="rounded-2xl border border-white/10 bg-white p-1">
            <CreditWellnessSummaryPanel borrowerId={pendingLoans[0].borrower.id} variant="full" linkToDetail={false} />
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white p-1">
          <WellnessReportsPanel roleLabel="Loan Officer" />
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

function MiniKpi({ label, value, accent = 'text-white' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value ?? '—'}</p>
    </div>
  )
}
