import { useState } from 'react'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

export default function BorrowerBankingPage() {
  const [bank, setBank] = useState('BPI')
  const [acct, setAcct] = useState('****3210')

  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Account"
        title="Banking details"
        description="Used for disbursement and autopay. Account numbers are masked after save. Changing bank may require reverification."
      />

      <PortalCard title="Linked account" subtitle="Demo form — no data is sent.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Bank</label>
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
            >
              {['BPI', 'BDO', 'Metrobank', 'UnionBank', 'GCash'].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Account number</label>
            <input
              value={acct}
              onChange={(e) => setAcct(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tracking-widest dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Account name</label>
            <input
              readOnly
              defaultValue="Matches registered borrower"
              className="mt-1 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-[#1e293b] dark:text-gray-300"
            />
          </div>
        </div>
        <button
          type="button"
          className="mt-6 rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-brand-primary hover:bg-brand-primary-hover"
        >
          Save (demo)
        </button>
      </PortalCard>
    </div>
  )
}
