/** Matches Laravel `config/company.php` — print / download letterhead. */

export const CORPORATE_PRINT_LEGAL_NAME = 'AMALGAMATED LENDING INC.'

export const CORPORATE_PRINT_SLOGAN = 'Lending Hope, Building Futures.'

export const CORPORATE_PRINT_ADDRESS_LINES = [
  'ACI IT and Corporate Centre,',
  'Doña Carolina Uykimpan Building, Cor.',
  'JP Laurel Avenue and Iñigo Street,',
  'Bajada, Davao City 8000',
]

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

/**
 * Self-contained letterhead table for HTML invoice / receipt downloads.
 * @param {string} brandLogoUrl Absolute or same-origin URL to PNG logo
 * @param {number} [logoPx]
 */
export function corporatePrintHeaderBlock(brandLogoUrl, logoPx = 46) {
  const px = Math.max(24, Number(logoPx) || 46)
  const addr = CORPORATE_PRINT_ADDRESS_LINES.map(
    (line) => `<p style="margin:0">${escAttr(line)}</p>`,
  ).join('')
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;color:#374151">
<tbody>
<tr><td colspan="3" style="border-top:1px solid #d1d5db;line-height:0;font-size:0">&nbsp;</td></tr>
<tr>
<td style="width:88px;vertical-align:middle;padding:8px 12px 8px 0">
<div style="display:inline-block;border:1.5px solid #deb8bc;border-radius:999px;padding:6px;background:#fff;text-align:center">
<img src="${escAttr(brandLogoUrl)}" alt="" width="${px}" height="${px}" style="display:block;object-fit:contain" />
</div>
</td>
<td style="vertical-align:middle;padding:0 12px 0 0;min-width:0">
<p style="margin:0;font-size:15px;font-weight:bold;color:#374151;text-transform:uppercase;letter-spacing:0.03em;line-height:1.2">${escAttr(CORPORATE_PRINT_LEGAL_NAME)}</p>
<p style="margin:5px 0 0;font-size:10.5px;color:#6b7280;font-style:italic;font-family:Georgia,'Times New Roman',serif;line-height:1.35">${escAttr(CORPORATE_PRINT_SLOGAN)}</p>
</td>
<td style="vertical-align:middle;text-align:right;font-size:9.5px;line-height:1.45;color:#374151">${addr}</td>
</tr>
<tr><td colspan="3" style="border-top:1px solid #d1d5db;line-height:0;font-size:0">&nbsp;</td></tr>
</tbody>
</table>`
}
