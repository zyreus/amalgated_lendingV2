/**
 * Shared letterhead for borrower invoices, print bundles, and calculators.
 * Keep in sync with `config/company.php` + `resources/views/partials/company-corporate-header.blade.php`.
 */
const LEGAL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COMPANY_PRINT_LEGAL_NAME) ||
  'AMALGATED LENDING INC.'
const TAGLINE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COMPANY_PRINT_TAGLINE) ||
  'Lending Hope, Building Futures.'

const ADDRESS_LINES = [
  'ACI IT and Corporate Centre,',
  'Doña Carolina Uy Kim Peng Building, Cor.',
  'JP Laurel Avenue and Inigo Street,',
  'Bajada, Davao City 8000',
]

export const CORPORATE_PRINT_LEGAL_NAME = LEGAL
export const CORPORATE_PRINT_TAGLINE = TAGLINE

/**
 * @param {string} logoUrl Absolute or same-origin URL to PNG logo
 * @param {number} [logoPx]
 */
export function corporatePrintHeaderBlock(logoUrl, logoPx = 52) {
  const px = Math.max(32, Number(logoPx) || 52)
  const ring = Math.max(2, Math.round(px * 0.07))
  const inner = Math.max(22, px - ring * 2 - 6)
  const addr = ADDRESS_LINES.join('<br>')
  return `
<div class="corp-hdr-wrap" style="width:100%;margin:0 0 12px;">
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0;padding:0;">
    <tr>
      <td style="width:58%;vertical-align:middle;padding:0;border:0;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:0;padding:0;">
          <tr>
            <td style="width:${px + 16}px;padding:0 12px 0 0;vertical-align:middle;border:0;">
              <div style="width:${px}px;height:${px}px;border:${ring}px solid #b91c1c;border-radius:999px;text-align:center;background:#fff;box-sizing:border-box;padding:3px;">
                <img src="${logoUrl}" alt="" width="${inner}" height="${inner}" style="width:${inner}px;height:${inner}px;display:block;margin:2px auto 0;object-fit:contain;" />
              </div>
            </td>
            <td style="vertical-align:middle;padding:0;border:0;">
              <p style="margin:0;font-family:ui-sans-serif,system-ui,Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;color:#000;letter-spacing:0.04em;text-transform:uppercase;line-height:1.15;">${LEGAL}</p>
              <p style="margin:5px 0 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;font-style:italic;color:#000;line-height:1.25;">&ldquo;${TAGLINE}&rdquo;</p>
            </td>
          </tr>
        </table>
      </td>
      <td style="width:42%;vertical-align:top;text-align:right;padding:0;border:0;">
        <div style="font-family:ui-sans-serif,system-ui,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;color:#000;margin:0;">${addr}</div>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:#000;margin:10px 0 12px;"></div>
</div>`
}
