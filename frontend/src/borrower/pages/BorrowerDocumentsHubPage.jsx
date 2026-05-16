import { Link } from 'react-router-dom'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'

const categories = [
  { label: 'Government ID', status: 'Required', tone: 'amber' },
  { label: 'Proof of income', status: 'Optional', tone: 'gray' },
  { label: 'Bank statements', status: '3 months', tone: 'gray' },
  { label: 'Signed agreements', status: 'Available', tone: 'emerald' },
]

export default function BorrowerDocumentsHubPage() {
  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Document center"
        title="Secure vault for your files"
        description="Upload from any device. Files are encrypted in transit and at rest. Staff only access what you submit for active applications."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <PortalCard title="Quick upload" subtitle="Drag & drop (UI preview)" className="lg:col-span-2">
          <div className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-primary/25 bg-brand-primary/[0.03] px-4 py-10 text-center transition hover:border-brand-primary/50 hover:bg-brand-primary/[0.06]">
            <p className="text-sm font-semibold text-brand-text dark:text-white">Drop files here or tap to browse</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">PDF, JPG, PNG up to 15 MB each</p>
            <button
              type="button"
              className="mt-6 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover"
            >
              Choose files
            </button>
          </div>
        </PortalCard>

        <PortalCard title="Checklist" subtitle="What underwriters expect">
          <ul className="space-y-3">
            {categories.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2 rounded-xl bg-brand-background-alt/80 px-3 py-2 dark:bg-[#0F172A]/60">
                <span className="text-sm font-medium text-brand-text dark:text-gray-100">{c.label}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    c.tone === 'amber'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
                      : c.tone === 'emerald'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Linked to your wizard: <Link className="font-semibold text-brand-primary hover:underline" to="/borrower/apply-loan">Continue application</Link>
          </p>
        </PortalCard>
      </div>
    </div>
  )
}
