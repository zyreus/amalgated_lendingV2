import { forwardRef, useMemo, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import CorporateLetterhead from '../../../components/CorporateLetterhead.jsx'
import { formatPercent, formatPeso } from '../utils'
import type { ComputeLoanResult } from '../types'

interface Props {
  borrower: {
    name: string
    email?: string
    phone?: string
    accountNumber?: string
  }
  computation: ComputeLoanResult
  totalPaid?: number
  printTitle?: string
  serverPrintUrl?: string | null
}

export const StateOfAccountPrintable = forwardRef<HTMLDivElement, Props>(function StateOfAccountPrintable(
  { borrower, computation, totalPaid = 0, printTitle = 'Statement of Account' },
  ref
) {
  const totalPayable = computation.summary.total_payable
  const remainingBalance = Math.max(0, totalPayable - totalPaid)

  return (
    <div ref={ref} className="bg-white p-8 text-black">
      <style>{`@media print { @page { size: A4; margin: 14mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <CorporateLetterhead className="mb-6" />
      <div className="border-b border-gray-300 pb-3">
        <h1 className="text-xl font-bold text-gray-900">{printTitle}</h1>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="font-semibold">Borrower Details</p>
          <p>{borrower.name}</p>
          <p>{borrower.email || '—'}</p>
          <p>{borrower.phone || '—'}</p>
        </div>
        <div>
          <p className="font-semibold">Loan Details</p>
          <p>{computation.product.name}</p>
          <p>Rate: {formatPercent(computation.product.monthly_rate_percent_effective, 4)} / month</p>
          <p>Term: {computation.inputs.term_months} months</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-gray-300 p-4 text-sm">
        <div>Loan Amount: {formatPeso(computation.inputs.loan_amount)}</div>
        <div>Total Payable: {formatPeso(totalPayable)}</div>
        <div>Total Paid: {formatPeso(totalPaid)}</div>
        <div>Remaining Balance: {formatPeso(remainingBalance)}</div>
      </div>

      <div className="mt-6">
        <h2 className="text-base font-semibold">Amortization Schedule</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-left">#</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Beginning</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Principal</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Interest</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Amortization</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Ending</th>
            </tr>
          </thead>
          <tbody>
            {computation.schedule.map((row) => (
              <tr key={row.installment_no}>
                <td className="border border-gray-300 px-2 py-2">{row.installment_no}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{formatPeso(row.beginning_balance)}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{formatPeso(row.principal)}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{formatPeso(row.interest)}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{formatPeso(row.amortization)}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{formatPeso(row.ending_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})

export function StateOfAccountForm(props: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const totalPaid = props.totalPaid || 0
  const remainingBalance = useMemo(
    () => Math.max(0, props.computation.summary.total_payable - totalPaid),
    [props.computation.summary.total_payable, totalPaid]
  )

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${props.borrower.name || 'borrower'}-SOA`,
  })

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">State of Account</h2>
          <p className="mt-1 text-sm text-gray-600">Printable borrower SOA with summary and straight-line schedule.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handlePrint()}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Print SOA
          </button>
          {props.serverPrintUrl ? (
            <a
              href={props.serverPrintUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800"
            >
              Open PDF
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Borrower</p>
          <p className="mt-2 font-semibold text-gray-900">{props.borrower.name}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Monthly Amortization</p>
          <p className="mt-2 font-semibold text-gray-900">{formatPeso(props.computation.breakdown.monthly_amortization)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Paid</p>
          <p className="mt-2 font-semibold text-gray-900">{formatPeso(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Remaining Balance</p>
          <p className="mt-2 font-semibold text-gray-900">{formatPeso(remainingBalance)}</p>
        </div>
      </div>

      <div className="sr-only">
        <StateOfAccountPrintable ref={printRef} {...props} />
      </div>
    </section>
  )
}
