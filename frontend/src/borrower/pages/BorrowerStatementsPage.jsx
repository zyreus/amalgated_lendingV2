import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

const months = ['May 2026', 'Apr 2026', 'Mar 2026', 'Feb 2026', 'Jan 2026', 'Dec 2025']

export default function BorrowerStatementsPage() {
  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Documents"
        title="Statements & certificates"
        description="Download monthly statements for your records. Tax and compliance PDFs will appear here when generated."
      />

      <PortalCard title="Monthly statements" subtitle="Sample rows — replace with API list.">
        <div className="overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-background-alt/90 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-[#0F172A] dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {months.map((m) => (
                <tr key={m} className="bg-white/80 dark:bg-transparent">
                  <td className="px-4 py-3 font-medium text-brand-text dark:text-white">{m}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Loan statement</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-lg border border-brand-primary/30 px-3 py-1.5 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PortalCard>
    </div>
  )
}
