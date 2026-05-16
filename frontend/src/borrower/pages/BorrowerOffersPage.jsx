import { Link } from 'react-router-dom'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

const offers = [
  {
    id: 1,
    title: 'Personal line — pre-qualified',
    apr: '12.4% APR',
    amount: '₱250,000 max',
    tag: 'AI match 94%',
    highlight: true,
  },
  {
    id: 2,
    title: 'Debt consolidation bundle',
    apr: '11.9% APR',
    amount: '₱400,000 max',
    tag: 'Save on interest',
    highlight: false,
  },
  {
    id: 3,
    title: 'Credit builder installment',
    apr: '8.5% APR',
    amount: '₱50,000 max',
    tag: 'Reporting friendly',
    highlight: false,
  },
]

export default function BorrowerOffersPage() {
  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Offers"
        title="Loan offers matched to you"
        description="Rates shown are illustrative. Final pricing depends on verification, underwriting, and regulatory checks."
        actions={
          <Link to="/borrower/apply-loan" className="rounded-xl border border-brand-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-brand-primary shadow-sm transition hover:bg-brand-primary/5 dark:bg-[#111827]">
            Start application
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {offers.map((o) => (
          <PortalCard
            key={o.id}
            className={o.highlight ? 'ring-2 ring-brand-primary/40' : ''}
            title={o.title}
            subtitle={o.tag}
            footer={
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Est. rate</p>
                  <p className="text-lg font-bold text-brand-text dark:text-white">{o.apr}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{o.amount}</p>
                </div>
                <Link
                  to="/borrower/apply-loan"
                  className="rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-primary transition hover:brightness-105"
                >
                  Select
                </Link>
              </div>
            }
            padding={false}
          >
            <p className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
              Includes flexible repayment, digital signing, and real-time status in your dashboard.
            </p>
          </PortalCard>
        ))}
      </div>
    </div>
  )
}
