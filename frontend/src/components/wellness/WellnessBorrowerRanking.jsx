import { Link } from 'react-router-dom'
import { admin } from '../../admin/components/AdminUi.jsx'
import BorrowerTierBadge from './BorrowerTierBadge.jsx'
import TrendIndicator from './TrendIndicator.jsx'
import RiskBadge from './RiskBadge.jsx'
import { formatCategory } from './wellnessUtils.js'

export default function WellnessBorrowerRanking({ borrowers = [], title = 'Borrower ranking', limit = 15 }) {
  const rows = borrowers.slice(0, limit)

  return (
    <section className={admin.cardNoHover}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={`border-b border-gray-200 dark:border-gray-700 ${admin.textMuted}`}>
              <th className="py-2 pr-4 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">Borrower</th>
              <th className="py-2 pr-4 font-medium">Score</th>
              <th className="py-2 pr-4 font-medium">Tier</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Risk</th>
              <th className="py-2 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={b.borrower_id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 pr-4 tabular-nums text-gray-500">{i + 1}</td>
                <td className="py-2 pr-4">
                  <Link to={`/admin/borrowers/${b.borrower_id}`} className="font-medium text-brand-primary hover:underline">
                    {b.name || `Borrower #${b.borrower_id}`}
                  </Link>
                </td>
                <td className="py-2 pr-4 font-bold tabular-nums">{b.wellness_score}/100</td>
                <td className="py-2 pr-4"><BorrowerTierBadge score={b.wellness_score} /></td>
                <td className="py-2 pr-4">{formatCategory(b.score_category)}</td>
                <td className="py-2 pr-4"><RiskBadge level={b.default_risk_level} /></td>
                <td className="py-2"><TrendIndicator trend={b.improvement_trend} /></td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={`py-4 text-sm ${admin.textMuted}`}>No borrowers ranked yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
