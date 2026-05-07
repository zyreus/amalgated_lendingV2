import { forwardRef, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { formatPeso } from '../utils'
import type { ComputeLoanResult } from '../types'

interface Props {
  borrower: {
    name: string
    email?: string
    phone?: string
    address?: string
  }
  application: {
    productName: string
    applicationNature: string
    loanTypeLabel?: string
    coMakerName?: string
    coMakerPhone?: string
  }
  computation: ComputeLoanResult
}

const PrintableBody = forwardRef<HTMLDivElement, Props>(function PrintableBody({ borrower, application, computation }, ref) {
  return (
    <div ref={ref} className="bg-white p-8 text-black">
      <style>{`@media print { @page { size: A4; margin: 14mm; } }`}</style>
      <div className="border-b border-black pb-4">
        <h1 className="text-2xl font-bold">Loan Application Form</h1>
        <p className="mt-1 text-sm">Amalgated Lending Corporation</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="font-semibold">Applicant</p>
          <p>{borrower.name}</p>
          <p>{borrower.email || '—'}</p>
          <p>{borrower.phone || '—'}</p>
          <p>{borrower.address || '—'}</p>
        </div>
        <div>
          <p className="font-semibold">Application Details</p>
          <p>{application.productName}</p>
          <p>{application.loanTypeLabel || 'General Lending'}</p>
          <p>{application.applicationNature}</p>
          <p>Co-maker: {application.coMakerName || '—'}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-300 p-4 text-sm">
        <p className="font-semibold">Computation Summary</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>Loan Amount: {formatPeso(computation.inputs.loan_amount)}</div>
          <div>Net Proceeds: {formatPeso(computation.breakdown.net_proceeds)}</div>
          <div>Monthly Amortization: {formatPeso(computation.breakdown.monthly_amortization)}</div>
          <div>Total Misc. Fees: {formatPeso(computation.breakdown.total_miscellaneous_fees)}</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 pt-10 text-sm">
        <div className="border-t border-black pt-2">Borrower Signature</div>
        <div className="border-t border-black pt-2">Authorized Lending Officer</div>
      </div>
    </div>
  )
})

export function PrintableLoanApplicationForm(props: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${props.borrower.name || 'loan-application'}-application`,
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Printable Loan Application</h3>
          <p className="mt-1 text-sm text-gray-600">A4-friendly document for borrower and admin loan records.</p>
        </div>
        <button type="button" onClick={() => handlePrint()} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
          Print Application
        </button>
      </div>

      <div className="sr-only">
        <PrintableBody ref={printRef} {...props} />
      </div>
    </div>
  )
}
