import { useState } from 'react'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

export default function BorrowerAutopayPage() {
  const [enabled, setEnabled] = useState(false)
  const [day, setDay] = useState('5')

  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Payments"
        title="Autopay"
        description="Never miss a due date. We debit your linked account on the schedule you choose. You can pause anytime before the cut-off."
      />

      <PortalCard title="Schedule" subtitle="Demo controls — connect PSP in production.">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-text dark:text-white">Autopay status</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{enabled ? 'Active — we will debit automatically.' : 'Off — manual payments only.'}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-11 w-[4.5rem] shrink-0 rounded-full transition-colors ${enabled ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span
              className={`absolute top-1 h-9 w-9 rounded-full bg-white shadow-md transition-transform ${enabled ? 'left-[calc(100%-2.5rem)]' : 'left-1'}`}
            />
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="autopay-day" className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Debit day of month
            </label>
            <select
              id="autopay-day"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-600 dark:bg-[#0F172A] dark:text-white"
            >
              {['1', '5', '10', '15', '20', '25'].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Funding source</p>
            <p className="mt-3 rounded-xl border border-dashed border-gray-200 bg-brand-background-alt/80 px-4 py-3 text-sm text-gray-600 dark:border-gray-600 dark:bg-[#0F172A]/60 dark:text-gray-300">
              Link a bank in <span className="font-semibold text-brand-primary">Banking</span> to enable live debits.
            </p>
          </div>
        </div>
      </PortalCard>
    </div>
  )
}
