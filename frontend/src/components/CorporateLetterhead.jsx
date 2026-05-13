import { CORPORATE_PRINT_LEGAL_NAME, CORPORATE_PRINT_TAGLINE } from '../utils/corporatePrintHeaderHtml.js'

const ADDRESS_LINES = [
  'ACI IT and Corporate Centre,',
  'Doña Carolina Uy Kim Peng Building, Cor.',
  'JP Laurel Avenue and Inigo Street,',
  'Bajada, Davao City 8000',
]

/**
 * On-screen / print letterhead matching Laravel `company-corporate-header` partial.
 */
export default function CorporateLetterhead({ logoSrc = '/amalgated-lending-logo.png', className = '' }) {
  return (
    <header className={`corp-letterhead w-full ${className || ''}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center rounded-full border-[3px] border-[#b91c1c] bg-white p-1"
            style={{ width: 56, height: 56 }}
          >
            <img src={logoSrc} alt="" className="h-11 w-11 object-contain" width={44} height={44} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold uppercase leading-tight tracking-wide text-black">
              {CORPORATE_PRINT_LEGAL_NAME}
            </p>
            <p className="mt-1 font-serif text-sm italic leading-snug text-black">
              &ldquo;{CORPORATE_PRINT_TAGLINE}&rdquo;
            </p>
          </div>
        </div>
        <address className="shrink-0 text-right text-[11px] not-italic leading-relaxed text-black sm:max-w-[48%] sm:pl-4">
          {ADDRESS_LINES.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </div>
      <div className="mt-3 h-px w-full bg-black" aria-hidden />
    </header>
  )
}
