import {
  CORPORATE_PRINT_ADDRESS_LINES,
  CORPORATE_PRINT_LEGAL_NAME,
  CORPORATE_PRINT_SLOGAN,
} from '../utils/corporatePrintHeaderHtml.js'

/**
 * On-screen / print letterhead aligned with Laravel `partials.company-corporate-header`.
 */
export default function CorporateLetterhead({
  logoSrc = '/amalgated-lending-logo.png',
  logoClassName = 'h-11 w-11 object-contain',
  ringClassName = 'flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-rose-200 bg-white p-1.5',
  className = '',
}) {
  return (
    <div className={`text-gray-800 ${className}`}>
      <div className="border-t border-gray-300" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={ringClassName}>
            <img src={logoSrc} alt="" className={logoClassName} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold uppercase tracking-[0.03em] text-gray-700">{CORPORATE_PRINT_LEGAL_NAME}</p>
            <p className="mt-1 font-serif text-[10.5px] italic leading-snug text-gray-500">{CORPORATE_PRINT_SLOGAN}</p>
          </div>
        </div>
        <div className="text-right text-[9.5px] leading-snug text-gray-700">
          {CORPORATE_PRINT_ADDRESS_LINES.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-300" aria-hidden />
    </div>
  )
}
