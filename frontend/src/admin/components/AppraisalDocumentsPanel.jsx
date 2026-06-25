import { useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from './AdminUi.jsx'
import { resolvePublicFileUrl } from '../../utils/lendingLaravelApi.js'

const APPRAISAL_DOC_TYPE = 'ci_appraisal'

function isImageDoc(doc) {
  return /\.(jpe?g|png|webp)$/i.test(doc.original_name || '') || String(doc.mime_type || '').startsWith('image/')
}

export default function AppraisalDocumentsPanel({
  loanId,
  documents = [],
  permissions = {},
  canEdit = false,
  onChanged,
}) {
  const { showToast } = useToast()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const canUpload = canEdit && permissions.upload
  const canDelete = canEdit && permissions.delete

  const uploadFiles = async (files) => {
    if (!files?.length || !loanId) return
    setBusy(true)
    try {
      for (const file of files) {
        const body = new FormData()
        body.append('file', file)
        body.append('document_type', APPRAISAL_DOC_TYPE)
        await api(`/loans/${loanId}/documents`, { method: 'POST', body })
      }
      showToast(files.length > 1 ? `${files.length} appraisal files uploaded.` : 'Appraisal file uploaded.', 'success')
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Upload failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const deleteDoc = async (docId) => {
    if (!window.confirm('Delete this appraisal file permanently?')) return
    setBusy(true)
    try {
      await api(`/loans/${loanId}/documents/${docId}`, { method: 'DELETE' })
      showToast('Appraisal file deleted.', 'success')
      onChanged?.()
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-[#1F2937]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">CI appraisal documents</h3>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>
            Upload photos or PDFs from the credit investigator&apos;s property appraisal (site photos, appraisal report, sketch plan, etc.).
          </p>
        </div>
        {canUpload ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Uploading…' : 'Upload photo or document'}
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,image/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          uploadFiles(files)
          e.target.value = ''
        }}
      />

      {documents.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {documents.map((doc) => {
            const url = resolvePublicFileUrl(doc.file_url || doc.file_path)
            const image = isImageDoc(doc)
            return (
              <li key={doc.id} className="rounded-lg border border-gray-100 p-3 dark:border-[#1F2937]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {doc.original_name || 'Appraisal file'}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400">
                      Open
                    </a>
                    {canDelete ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteDoc(doc.id)}
                        className="text-xs font-semibold text-gray-600 hover:underline dark:text-gray-300"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                {image ? (
                  <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
                    <img src={url} alt="" className="max-h-44 w-full rounded border object-contain dark:border-[#1F2937]" />
                  </a>
                ) : (
                  <p className={`mt-2 text-xs ${admin.textMuted}`}>PDF document</p>
                )}
                {doc.uploaded_by_user?.name || doc.uploaded_by?.name ? (
                  <p className={`mt-2 text-xs ${admin.textMuted}`}>
                    Uploaded by {doc.uploaded_by_user?.name || doc.uploaded_by?.name}
                    {doc.uploaded_at ? ` · ${String(doc.uploaded_at).slice(0, 16).replace('T', ' ')}` : ''}
                  </p>
                ) : doc.uploaded_at ? (
                  <p className={`mt-2 text-xs ${admin.textMuted}`}>Uploaded {String(doc.uploaded_at).slice(0, 16).replace('T', ' ')}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={`mt-4 text-sm ${admin.textMuted}`}>No CI appraisal files uploaded yet.</p>
      )}
    </div>
  )
}
