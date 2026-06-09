import { Link } from 'react-router-dom'

const MODULES = [
  { to: '/admin/borrowers', label: 'Borrowers', desc: 'KYC, segmentation, lifecycle' },
  { to: '/admin/loans', label: 'Loan approvals', desc: 'Risk queues & decisions' },
  { to: '/admin/payments', label: 'Payments & OR/AR', desc: 'Receipts, matching, delinquency' },
  { to: '/admin/reports', label: 'Analytics', desc: 'Revenue, funnel, portfolio health' },
  { to: '/admin/chat-crm', label: 'CRM & AI chat', desc: 'Bot controls + inbox' },
  { to: '/admin/loan-products', label: 'Products', desc: 'Rates, fees, eligibility' },
]

export default function AdminCrmModuleStrip() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-red-50/40 p-6 shadow-sm dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0f172a] dark:shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">CRM modules</p>
        </div>
      </div>
      <ul className="mt-5 grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <li key={m.to}>
            <Link
              to={m.to}
              className="flex h-full min-h-[5.5rem] flex-col rounded-xl border border-gray-200 bg-white/90 p-4 transition hover:border-red-300 hover:shadow-md dark:border-[#374151] dark:bg-[#0f172a]/80 dark:hover:border-red-500/40"
            >
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.label}</span>
              <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{m.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
