import { Link } from 'react-router-dom'
import { admin, TableSkeletonRows } from '../AdminUi.jsx'
import { applicationStatusBadgeClass, applicationStatusLabel, normalizeApplicationStatus } from './applicationStatus.js'

export function formatLoanRateMonthly(loan) {
  const payloadRate = Number(loan?.selected_interest_rate ?? loan?.application_payload?.selected_interest_rate)
  if (Number.isFinite(payloadRate) && payloadRate > 0) {
    const suffix = loan?.selected_rate_type === 'monthly' || loan?.application_payload?.selected_rate_type === 'monthly' ? '%/mo' : '%'
    return `${payloadRate.toFixed(4)}${suffix}`
  }
  const annual = Number(loan?.annual_interest_rate)
  if (!Number.isFinite(annual) || annual <= 0) return '-'
  return `${(annual / 12).toFixed(4)}%/mo (~${annual.toFixed(2)}%/yr)`
}

function money(value) {
  const n = Number(value || 0)
  return `PHP ${Number.isFinite(n) ? n.toLocaleString() : '0'}`
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${applicationStatusBadgeClass(status)}`}>
      {applicationStatusLabel(status)}
    </span>
  )
}

function EmptyState({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
              <path d="M9 8h6M9 12h6M9 16h3" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">No applications found for this status.</p>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>Try another status tab or broaden your search.</p>
        </div>
      </td>
    </tr>
  )
}

function RowActions({ loan, canApprove, onPreApprove, onReturnToPending, onApprove }) {
  const status = normalizeApplicationStatus(loan.status)

  return (
    <div className="flex justify-end gap-2">
      {canApprove && status === 'pending' && (
        <button
          type="button"
          onClick={() => onPreApprove(loan)}
          className={`${admin.btnPrimary} px-3 py-1.5 text-xs`}
        >
          Pre-Approve
        </button>
      )}
      {canApprove && status === 'pre-approved' && (
        <>
          <button
            type="button"
            onClick={() => onApprove(loan)}
            className={`${admin.btnPrimary} px-3 py-1.5 text-xs`}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReturnToPending(loan)}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-100"
          >
            Return
          </button>
        </>
      )}
      <Link
        to={`/admin/loans/${loan.id}`}
        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]"
      >
        Details
      </Link>
    </div>
  )
}

export default function ApplicationsTable({ rows, loading, canApprove, onPreApprove, onReturnToPending, onApprove }) {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${admin.cardNoHover} p-4`}>
              <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-2 h-3 w-52 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-3 h-6 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-[#1F2937]" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className={`${admin.cardNoHover} p-6 text-center`}>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No applications found for this status.</p>
            <p className={`mt-1 text-xs ${admin.textMuted}`}>Try another status tab or broaden your search.</p>
          </div>
        ) : (
          rows.map((loan) => (
            <div key={loan.id} className={`${admin.cardNoHover} space-y-3 p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/admin/loans/${loan.id}`} className="font-semibold text-red-600 transition hover:underline dark:text-red-400">
                    {loan.loan_number || `Loan #${loan.id}`}
                  </Link>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{loan.borrower?.name || '-'}</p>
                  <p className={`text-xs ${admin.textMuted}`}>{loan.borrower?.email || '-'}</p>
                </div>
                <StatusBadge status={loan.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className={`text-xs ${admin.textMuted}`}>Principal</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{money(loan.principal)}</p>
                </div>
                <div>
                  <p className={`text-xs ${admin.textMuted}`}>Term / Rate</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {loan.term_months} mo - {formatLoanRateMonthly(loan)}
                  </p>
                </div>
              </div>
              <RowActions loan={loan} canApprove={canApprove} onPreApprove={onPreApprove} onReturnToPending={onReturnToPending} onApprove={onApprove} />
            </div>
          ))
        )}
      </div>

      <div className={`hidden lg:block ${admin.tableWrap} max-h-[70vh]`}>
        <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin900}`}>
          <thead className="sticky top-0 z-10 bg-white dark:bg-[#111827]">
            <tr className={admin.thead}>
              <th className={admin.tableCell}>Loan ID</th>
              <th className={admin.tableCell}>Borrower</th>
              <th className={admin.tableCell}>Email</th>
              <th className={admin.tableCell}>Principal</th>
              <th className={admin.tableCell}>Status</th>
              <th className={admin.tableCell}>Term</th>
              <th className={admin.tableCell}>Rate</th>
              <th className={`${admin.tableCell} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows cols={8} rows={7} />
            ) : rows.length === 0 ? (
              <EmptyState colSpan={8} />
            ) : (
              rows.map((loan) => (
                <tr key={loan.id} className={admin.tbodyRow}>
                  <td className={admin.tableCell}>
                    <Link
                      to={`/admin/loans/${loan.id}`}
                      className="font-medium text-red-600 transition hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
                    >
                      {loan.loan_number || `#${loan.id}`}
                    </Link>
                  </td>
                  <td className={admin.tableCell}>{loan.borrower?.name || '-'}</td>
                  <td className={`${admin.tableCell} ${admin.tableMuted}`}>{loan.borrower?.email || '-'}</td>
                  <td className={admin.tableCell}>{money(loan.principal)}</td>
                  <td className={admin.tableCell}>
                    <StatusBadge status={loan.status} />
                  </td>
                  <td className={admin.tableCell}>{loan.term_months} mo</td>
                  <td className={`${admin.tableCell} tabular-nums ${admin.tableMuted}`}>{formatLoanRateMonthly(loan)}</td>
                  <td className={`${admin.tableCell} text-right`}>
                    <RowActions loan={loan} canApprove={canApprove} onPreApprove={onPreApprove} onReturnToPending={onReturnToPending} onApprove={onApprove} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
