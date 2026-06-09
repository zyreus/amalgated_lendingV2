import { CORPORATE_PRINT_LEGAL_NAME, CORPORATE_PRINT_TAGLINE } from '../utils/corporatePrintHeaderHtml.js'

/**
 * On-screen / print letterhead matching Laravel `company-corporate-header` partial.
 */
export default function CorporateLetterhead({ logoSrc = '/amalgated-lending-logo.png', className = '' }) {
  return (
    <header className={`corp-letterhead w-full ${className || ''}`}>
      <div className="flex items-center">
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
      </div>
      <div className="mt-3 h-px w-full bg-black" aria-hidden />
    </header>
  )
}
