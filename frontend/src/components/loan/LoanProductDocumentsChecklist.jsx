import { getLoanProductDocumentList } from './loanProductDocuments.js'

/**
 * @param {object} props
 * @param {string} [props.productKey] — key in {@link LOAN_PRODUCT_DOCUMENT_CHECKLISTS}
 * @param {string[]} [props.items] — override list (optional)
 * @param {string} [props.title]
 */
export default function LoanProductDocumentsChecklist({ productKey, items, title = 'Documents to prepare & upload' }) {
  const list = items?.length ? items : productKey ? getLoanProductDocumentList(productKey) : []
  if (!list.length) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-800/60 dark:bg-amber-950/25">
      <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">{title}</h3>
      <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-200/85">
        Prepare these documents before signing in. Upload and verification are completed in the Borrower Portal.
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-amber-950/95 dark:text-amber-100/95">
        {list.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
