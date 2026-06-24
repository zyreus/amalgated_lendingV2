import { FileText, Palette } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'
import SettingsCategoryGate from '../components/SettingsCategoryGate.jsx'
import SettingsField from '../components/SettingsField.jsx'
import SettingsPageShell from '../components/SettingsPageShell.jsx'
import { SectionCard, SettingsLinkCard } from '../components/SettingsPrimitives.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useSettingsCategory } from '../context/SettingsCategoryContext.jsx'

const KEYS = ['branding']

export default function DocumentSettingsHubPage() {
  return (
    <SettingsCategoryGate categoryId="documents">
      <DocumentSettingsContent />
    </SettingsCategoryGate>
  )
}

function DocumentSettingsContent() {
  const { readOnly } = useSettingsCategory()
  const { sections, patch } = useSettings()

  return (
    <SettingsPageShell breadcrumb={[{ label: 'Document Settings' }]} saveKeys={KEYS}>
      <div className="grid gap-3 md:grid-cols-2">
        <SettingsLinkCard label="Printable PDF Forms" description="Manage promissory notes, disclosure statements, and loan forms." to="/admin/printable-forms" />
        <SettingsLinkCard label="SOA Management" description="Generate and customize statements of account." to="/admin/soa" />
        <SettingsLinkCard label="Loan Products" description="Per-product document and fee configuration." to="/admin/loan-products" />
      </div>

      <SectionCard title="PDF Branding" icon={Palette} subtitle="Colors used on generated PDF documents.">
        <div className="grid min-w-0 gap-5 md:grid-cols-3">
          <SettingsField label="Primary color" htmlFor="brand-primary">
            <input
              id="brand-primary"
              type="color"
              className="h-10 w-full cursor-pointer rounded-xl border border-gray-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F2937]"
              value={sections.branding.primary_color || '#ff0000'}
              onChange={(e) => patch('branding', { primary_color: e.target.value })}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Background color" htmlFor="brand-bg">
            <input
              id="brand-bg"
              type="color"
              className="h-10 w-full cursor-pointer rounded-xl border border-gray-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F2937]"
              value={sections.branding.background_color || '#000000'}
              onChange={(e) => patch('branding', { background_color: e.target.value })}
              disabled={readOnly}
            />
          </SettingsField>
          <SettingsField label="Surface color" htmlFor="brand-surface">
            <input
              id="brand-surface"
              type="color"
              className="h-10 w-full cursor-pointer rounded-xl border border-gray-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F2937]"
              value={sections.branding.surface_color || '#0a0a0a'}
              onChange={(e) => patch('branding', { surface_color: e.target.value })}
              disabled={readOnly}
            />
          </SettingsField>
        </div>
        <p className={`text-xs ${admin.textMuted}`}>
          Logo for PDFs uses Company Information settings. Upload your logo under General → Company Information.
        </p>
      </SectionCard>

      <SectionCard title="Document templates" icon={FileText} subtitle="Template content is managed on dedicated pages.">
        <p className={`text-sm ${admin.textMuted}`}>
          Promissory note and disclosure statement templates are configured per loan product and in Printable PDF Forms.
        </p>
      </SectionCard>
    </SettingsPageShell>
  )
}
