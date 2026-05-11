import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { admin } from './AdminUi.jsx'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'

function displayUrl(previewUrl) {
  if (!previewUrl) return ''
  return getLaravelStorageFileUrl(String(previewUrl))
}

function statusBadgeClass(status) {
  const v = String(status || '').toLowerCase()
  if (v === 'pending') return 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200'
  if (v === 'approved' || v === 'verified') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
  if (v === 'rejected') return 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200'
  return 'bg-gray-100 text-gray-700 dark:bg-[#1F2937] dark:text-gray-300'
}

function formatStatus(status) {
  const v = String(status || '').toLowerCase()
  if (v === 'verified') return 'Approved'
  if (!v) return '—'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

function formatWhen(iso) {
  if (iso == null || iso === '') return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return String(iso)
  }
}

/**
 * Admin CRM: unified borrower uploads (document loans, portal ID, loan KYC, payments).
 */
export default function BorrowerUploadedFilesPanel({ borrowerId, canVerifyDocs, showToast }) {
  const [loading, setLoading] = useState(true)
  const [manifest, setManifest] = useState(null)
  const [preview, setPreview] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [drafts, setDrafts] = useState({})

  const load = useCallback(async () => {
    if (!borrowerId) return
    setLoading(true)
    try {
      const res = await api(`/borrowers/${borrowerId}/uploaded-files`)
      setManifest(res.data || null)
    } catch (e) {
      showToast?.(e.message || 'Could not load uploaded files.', 'error')
      setManifest(null)
    } finally {
      setLoading(false)
    }
  }, [borrowerId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const updateDraft = (docId, field, value) => {
    setDrafts((d) => ({
      ...d,
      [docId]: { ...d[docId], [field]: value },
    }))
  }

  const saveUploadReview = async (uploadedDocumentId) => {
    if (!uploadedDocumentId || !canVerifyDocs) return
    const dr = drafts[uploadedDocumentId] || {}
    const status = dr.status || 'pending'
    const remarks = dr.remarks != null ? dr.remarks : ''
    setSavingId(uploadedDocumentId)
    try {
      await api(`/uploaded-documents/${uploadedDocumentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: status === 'approved' ? 'approved' : status,
          remarks: remarks === '' ? null : remarks,
        }),
      })
      showToast?.('Document verification saved.', 'success')
      await load()
    } catch (e) {
      showToast?.(e.message || 'Save failed.', 'error')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className={admin.cardNoHover}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower uploaded files</h2>
        <p className={`mt-2 text-sm ${admin.textMuted}`}>Loading file manifest…</p>
      </div>
    )
  }

  const summary = manifest?.summary
  const sections = Array.isArray(manifest?.sections) ? manifest.sections : []

  return (
    <div className={admin.cardNoHover}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Borrower uploaded files</h2>
          <p className={`mt-1 text-xs ${admin.textMuted}`}>
            Thumbnails open in a lightbox; PDFs open in a new tab. Requirement uploads can be verified here when you have
            loan approval permissions.
          </p>
        </div>
        {summary ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 font-medium text-gray-800 dark:border-[#374151] dark:bg-[#1F2937] dark:text-gray-200">
              Total: {summary.total_files ?? 0}
            </span>
            {(summary.pending_review ?? 0) > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                Pending review: {summary.pending_review}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {sections.length === 0 ? (
        <p className={`mt-4 text-sm ${admin.textMuted}`}>No uploaded files found for this borrower yet.</p>
      ) : (
        <div className="mt-6 space-y-8">
          {sections.map((section) => (
            <div key={section.section_key || section.title}>
              <div className="border-b border-gray-200 pb-2 dark:border-[#374151]">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{section.title}</h3>
                {section.subtitle ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{section.subtitle}</p> : null}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(section.items || []).map((item) => {
                  const url = displayUrl(item.preview_url)
                  const isImg = item.mime_kind === 'image' && url
                  const isPdf = item.mime_kind === 'pdf'
                  const docId = item.uploaded_document_id
                  const dr = docId ? drafts[docId] || {} : {}
                  const effectiveStatus = dr.status ?? item.review_status ?? 'pending'

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#374151] dark:bg-[#111827]"
                    >
                      <button
                        type="button"
                        className="relative block aspect-[4/3] w-full bg-gray-50 text-left dark:bg-[#0f172a]"
                        onClick={() => {
                          if (isImg && url) setPreview({ url, title: item.category, mime: 'image' })
                          else if (isPdf && url) window.open(url, '_blank', 'noopener,noreferrer')
                          else if (url) window.open(url, '_blank', 'noopener,noreferrer')
                        }}
                      >
                        {isImg && url ? (
                          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-4">
                            <span className="text-2xl text-gray-400" aria-hidden>
                              {isPdf ? 'PDF' : '📎'}
                            </span>
                            <span className={`text-center text-xs ${admin.textMuted}`}>
                              {isPdf ? 'Open PDF' : 'Open file'}
                            </span>
                          </div>
                        )}
                      </button>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <p className="text-xs font-semibold leading-snug text-gray-900 dark:text-gray-100">{item.category}</p>
                        <p className={`truncate text-[11px] ${admin.textMuted}`} title={item.original_name || ''}>
                          {item.original_name || '—'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(item.review_status)}`}>
                            {formatStatus(item.review_status)}
                          </span>
                          <span className={`text-[10px] ${admin.textMuted}`}>{formatWhen(item.uploaded_at)}</span>
                        </div>
                        {item.remarks ? (
                          <p className={`text-[11px] leading-snug ${admin.textMuted}`}>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Notes: </span>
                            {item.remarks}
                          </p>
                        ) : null}
                        {Array.isArray(item.reupload_history) && item.reupload_history.length > 1 ? (
                          <p className={`text-[10px] ${admin.textMuted}`}>
                            Re-upload history: {item.reupload_history.length} version(s)
                          </p>
                        ) : null}
                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                            >
                              Download / open
                            </a>
                          ) : null}
                        </div>
                        {docId && canVerifyDocs ? (
                          <div className="mt-2 space-y-2 border-t border-gray-100 pt-2 dark:border-[#1F2937]">
                            <label className={`block text-[10px] font-medium uppercase tracking-wide ${admin.textMuted}`}>
                              Verification
                            </label>
                            <select
                              className={`w-full ${admin.input} text-xs`}
                              value={effectiveStatus === 'verified' ? 'approved' : effectiveStatus}
                              onChange={(e) => updateDraft(docId, 'status', e.target.value)}
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                            <textarea
                              className={`w-full ${admin.input} min-h-[52px] text-xs`}
                              placeholder="Admin notes (optional)"
                              value={dr.remarks !== undefined ? dr.remarks : item.remarks || ''}
                              onChange={(e) => updateDraft(docId, 'remarks', e.target.value)}
                            />
                            <button
                              type="button"
                              disabled={savingId === docId}
                              onClick={() => saveUploadReview(docId)}
                              className={`${admin.btnPrimary} w-full py-1.5 text-xs disabled:opacity-50`}
                            >
                              {savingId === docId ? 'Saving…' : 'Save verification'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview?.mime === 'image' ? (
        <div
          className={admin.modalOverlay}
          role="presentation"
          tabIndex={-1}
          onClick={() => setPreview(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreview(null)}
        >
          <div
            className={`${admin.modalCard} max-w-4xl p-3`}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preview.title}</p>
              <button type="button" className={admin.btnSecondary} onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <img src={preview.url} alt="" className="max-h-[70vh] w-full rounded-lg object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
