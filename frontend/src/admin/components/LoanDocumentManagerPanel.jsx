import { useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from './AdminUi.jsx'
import { resolvePublicFileUrl } from '../../utils/lendingLaravelApi.js'

const DOC_VERIFY_OPTIONS = [
  { value: 'pending', label: 'Pending review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'requires_resubmission', label: 'Requires resubmission' },
]

function verificationPillClass(status) {
  switch (status) {
    case 'verified':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-100'
    case 'rejected':
      return 'bg-red-100 text-red-900 dark:bg-red-900/35 dark:text-red-100'
    case 'requires_resubmission':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-100'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }
}

export default function LoanDocumentManagerPanel({
  loanId,
  documents = [],
  permissions = {},
  coMakerLabel = null,
  onChanged,
  canReview = false,
}) {
  const { showToast } = useToast()
  const fileRef = useRef(null)
  const replaceRef = useRef(null)
  const [uploadMeta, setUploadMeta] = useState({ co_maker_id: null, document_type: 'supporting', document_category: null })
  const [replaceDocId, setReplaceDocId] = useState(null)
  const [busy, setBusy] = useState(false)

  const uploadFile = async (file, meta, replaceId = null) => {
    if (!file || !loanId) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('document_type', meta.document_type || 'supporting')
      if (meta.document_category) body.append('document_category', meta.document_category)
      if (meta.co_maker_id) body.append('co_maker_id', String(meta.co_maker_id))

      if (replaceId) {
        await api(`/loans/${loanId}/documents/${replaceId}/replace`, { method: 'POST', body })
        showToast('Document replaced.', 'success')
      } else {
        await api(`/loans/${loanId}/documents`, { method: 'POST', body })
        showToast('Document uploaded.', 'success')
      }
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Upload failed.', 'error')
    } finally {
      setBusy(false)
      setReplaceDocId(null)
    }
  }

  const deleteDoc = async (docId) => {
    if (!window.confirm('Delete this document permanently?')) return
    setBusy(true)
    try {
      await api(`/loans/${loanId}/documents/${docId}`, { method: 'DELETE' })
      showToast('Document deleted.', 'success')
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveReview = async (doc, status, notes) => {
    try {
      await api(`/loans/${loanId}/document-review`, {
        method: 'PATCH',
        body: JSON.stringify({
          loan_document_id: doc.id,
          status,
          notes: notes?.trim() || null,
        }),
      })
      showToast('Document verification saved.', 'success')
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Review save failed.', 'error')
    }
  }

  if (!documents.length && !permissions.upload) {
    return <p className={`text-sm ${admin.textMuted}`}>No structured documents on file.</p>
  }

  return (
    <div className="space-y-4">
      {coMakerLabel ? (
        <p className={`text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>{coMakerLabel}</p>
      ) : null}

      {permissions.upload ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setUploadMeta({ co_maker_id: null, document_type: 'borrower_upload', document_category: null })
              fileRef.current?.click()
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            Upload document
          </button>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          uploadFile(file, uploadMeta)
          e.target.value = ''
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (replaceDocId) uploadFile(file, uploadMeta, replaceDocId)
          e.target.value = ''
        }}
      />

      <ul className="space-y-4">
        {documents.map((doc) => {
          const url = resolvePublicFileUrl(doc.file_url || doc.file_path)
          const isImage = /\.(jpe?g|png)$/i.test(doc.original_name || '') || String(doc.mime_type || '').startsWith('image/')
          return (
            <li key={doc.id} className="rounded-lg border border-gray-100 p-4 dark:border-[#1F2937]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {(doc.document_category || doc.document_type || 'Document').replace(/_/g, ' ')}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${verificationPillClass(doc.verification_status)}`}>
                      {String(doc.verification_status || 'pending').replace(/_/g, ' ')}
                    </span>
                  </div>
                  {isImage ? (
                    <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                      <img src={url} alt="" className="max-h-40 rounded border object-contain dark:border-[#1F2937]" />
                    </a>
                  ) : (
                    <a href={url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-red-600 hover:underline dark:text-red-400">
                      {doc.original_name || 'Open file'}
                    </a>
                  )}
                  {doc.uploaded_at ? (
                    <p className={`mt-1 text-xs ${admin.textMuted}`}>Uploaded: {String(doc.uploaded_at)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gray-700 hover:underline dark:text-gray-300">
                    Download
                  </a>
                  {permissions.replace ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setReplaceDocId(doc.id)
                        setUploadMeta({
                          co_maker_id: doc.co_maker_id,
                          document_type: doc.document_type,
                          document_category: doc.document_category,
                        })
                        replaceRef.current?.click()
                      }}
                      className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300"
                    >
                      Replace
                    </button>
                  ) : null}
                  {permissions.delete ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteDoc(doc.id)}
                      className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
              {canReview ? (
                <DocReviewRow doc={doc} onSave={saveReview} />
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DocReviewRow({ doc, onSave }) {
  const [status, setStatus] = useState(doc.verification_status || 'pending')
  const [notes, setNotes] = useState(doc.review_notes || '')

  return (
    <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 dark:border-[#1F2937] sm:grid-cols-2">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={`text-xs ${admin.input}`}>
        {DOC_VERIFY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Review notes"
        className={`text-xs ${admin.input}`}
      />
      <button
        type="button"
        onClick={() => onSave(doc, status, notes)}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 sm:col-span-2 sm:w-fit"
      >
        Save verification
      </button>
    </div>
  )
}
