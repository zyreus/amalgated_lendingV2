import { borrowerApi, getBorrowerToken } from '../borrower/api/client.js'
import {
  laravelRequest,
  publicLaravelPost,
  formatLaravelUnreachableError,
} from './lendingLaravelApi.js'

/**
 * Public: structured requirements + product summary for document-only applications.
 */
export async function fetchDocumentRequirementsBySlug(slug) {
  const { res, lastError } = await laravelRequest(
    `/loan-products/slug/${encodeURIComponent(slug)}/requirements`,
  )
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = raw.message || raw.error || `HTTP ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : 'Failed to load requirements.')
  }
  return {
    product: raw.product || null,
    requirements: Array.isArray(raw.data) ? raw.data : [],
  }
}

/**
 * New borrower account + document application + JWT.
 */
export async function createDocumentLoanApplication(payload) {
  return publicLaravelPost('/loan-applications', payload)
}

export async function getDocumentLoanApplication(id) {
  return borrowerApi(`/loan-applications/${id}`)
}

export async function getDocumentLoanDraft(loanProductId) {
  return borrowerApi(`/loan-applications/draft?loan_product_id=${encodeURIComponent(String(loanProductId))}`)
}

export async function createBorrowerDocumentDraft(loanProductId) {
  return borrowerApi('/loan-applications/borrower-draft', {
    method: 'POST',
    body: JSON.stringify({ loan_product_id: loanProductId }),
  })
}

export async function getBorrowerDocumentLoanApplications() {
  return borrowerApi('/borrower/document-loan-applications')
}

/**
 * HTML for print (use fetch; borrowerApi expects JSON).
 */
export async function fetchApplicationPrintHtml(applicationId) {
  const token = getBorrowerToken()
  const { res, lastError } = await laravelRequest(`/application/${applicationId}/print`, {
    headers: {
      Accept: 'text/html',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res) throw new Error(formatLaravelUnreachableError(lastError))
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.message || err.error || `HTTP ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : 'Could not load printable form.')
  }
  return res.text()
}

/**
 * Opens a printable HTML tab before an application exists (no API).
 * Matches server print behavior: N/A for unknown fields.
 */
export function openClientLoanApplicationPrintPreview(product) {
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  const productName = esc(product?.name || 'Loan product')
  const generatedAt = new Date().toLocaleString()
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Loan Application — ${productName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111827; line-height: 1.5; margin: 0; padding: 24px; }
    .wrap { max-width: 720px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    .muted { color: #6b7280; font-size: 0.8rem; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 0.9rem; vertical-align: top; }
    th { background: #f9fafb; width: 38%; }
    .foot { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #d1d5db; font-size: 0.8rem; color: #6b7280; }
    .tag { display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
    @media print { body { padding: 0; } .wrap { border: none; max-width: none; } }
  </style>
</head>
<body>
<div class="wrap">
  <p class="tag">Preview</p>
  <h1>Loan Application Form</h1>
  <p class="muted">Generated ${esc(generatedAt)} · You can print before finishing uploads or signing. Missing borrower details show as N/A. Start your application to receive a reference number.</p>
  <table>
    <tbody>
      <tr><th>Loan product</th><td>${productName}</td></tr>
      <tr><th>Applicant name</th><td>N/A</td></tr>
      <tr><th>Email</th><td>N/A</td></tr>
      <tr><th>Phone</th><td>N/A</td></tr>
      <tr><th>Username</th><td>N/A</td></tr>
      <tr><th>Application reference</th><td>Pending — shown after you create or open your application</td></tr>
      <tr><th>Application date</th><td>N/A</td></tr>
      <tr><th>Residential address</th><td>N/A</td></tr>
      <tr><th>Employer / other</th><td>N/A</td></tr>
    </tbody>
  </table>
  <p class="foot">Sign below after printing, then scan or photograph and upload the signed form in your document application.</p>
  <p style="margin-top: 32px; min-height: 48px; border-bottom: 1px solid #111827; width: 60%;">Applicant signature</p>
  <p class="muted" style="margin-top: 4px;">Date: _______________</p>
</div>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (w) w.focus()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function uploadDocumentForRequirement({ documentLoanApplicationId, requirementId, file }) {
  const fd = new FormData()
  fd.append('document_loan_application_id', String(documentLoanApplicationId))
  fd.append('requirement_id', String(requirementId))
  fd.append('file', file)
  return borrowerApi('/upload-document', { method: 'POST', body: fd })
}

/** Same rules as upload; dedicated route per API spec. */
export async function reuploadDocumentForRequirement({ documentLoanApplicationId, requirementId, file }) {
  const fd = new FormData()
  fd.append('document_loan_application_id', String(documentLoanApplicationId))
  fd.append('requirement_id', String(requirementId))
  fd.append('file', file)
  return borrowerApi('/reupload-document', { method: 'POST', body: fd })
}

export async function uploadSignedApplicationForm({ documentLoanApplicationId, file }) {
  const fd = new FormData()
  fd.append('document_loan_application_id', String(documentLoanApplicationId))
  fd.append('file', file)
  return borrowerApi('/upload-signed-form', { method: 'POST', body: fd })
}

export async function submitDocumentLoanApplication(documentLoanApplicationId) {
  return borrowerApi(`/loan-applications/${documentLoanApplicationId}/submit`, { method: 'POST', body: '{}' })
}

/** Multi-step wizard (personal, loan, employment, preview) — advance=true updates highest_passed_step for stepper checks. */
export async function patchDocumentLoanWizard(documentLoanApplicationId, { step, data, advance }) {
  return borrowerApi(`/loan-applications/${documentLoanApplicationId}/wizard`, {
    method: 'PATCH',
    body: JSON.stringify({
      step,
      data,
      advance: advance !== false,
    }),
  })
}

/** Embedded uploads stored under storage/app/public/documents/{applicationId}/ (valid_id, proof_income, additional). */
export async function uploadEmbeddedDocument({ documentLoanApplicationId, slot, file, replaceIndex }) {
  const fd = new FormData()
  fd.append('slot', slot)
  fd.append('file', file)
  if (replaceIndex != null) fd.append('replace_index', String(replaceIndex))
  return borrowerApi(`/loan-applications/${documentLoanApplicationId}/embedded-documents`, {
    method: 'POST',
    body: fd,
  })
}
