import { useCallback, useEffect, useMemo, useState } from 'react'
import { borrowerApi } from '../api/client.js'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'

const LS_PREFIX = 'al-printable-draft:'

export default function BorrowerPrintableFormsPage() {
  const [branchCode, setBranchCode] = useState('')
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [draftJsonById, setDraftJsonById] = useState({})
  const [generatingId, setGeneratingId] = useState(null)

  const loadForms = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const q = new URLSearchParams()
      if (branchCode.trim()) q.set('branch_code', branchCode.trim())
      const path = `/borrower/printable-forms${q.toString() ? `?${q}` : ''}`
      const res = await borrowerApi(path)
      setForms(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setErr(e.message || 'Failed to load forms.')
      setForms([])
    } finally {
      setLoading(false)
    }
  }, [branchCode])

  useEffect(() => {
    loadForms()
  }, [loadForms])

  const loadDraftIntoState = useCallback((list) => {
    const next = {}
    for (const f of list) {
      try {
        const raw = localStorage.getItem(`${LS_PREFIX}${f.id}`)
        next[f.id] = raw != null ? raw : '{}'
      } catch {
        next[f.id] = '{}'
      }
    }
    setDraftJsonById((prev) => ({ ...next, ...prev }))
  }, [])

  useEffect(() => {
    if (forms.length) loadDraftIntoState(forms)
  }, [forms, loadDraftIntoState])

  const setDraftFor = (id, text) => {
    setDraftJsonById((p) => ({ ...p, [id]: text }))
    try {
      localStorage.setItem(`${LS_PREFIX}${id}`, text)
    } catch {
      /* ignore */
    }
  }

  const parsedFields = (id) => {
    const raw = draftJsonById[id] ?? '{}'
    try {
      const o = JSON.parse(raw)
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : {}
    } catch {
      return { _parse_error: true }
    }
  }

  const generate = async (form, opts = {}) => {
    const blank = !!opts.blank
    const fields = blank ? {} : parsedFields(form.id)
    if (!blank && fields._parse_error) {
      setErr('Fix JSON draft before generating PDF.')
      return
    }
    setGeneratingId(form.id)
    setErr('')
    try {
      const wm = blank ? false : !!(form.watermark_enabled || fields.watermark)
      const res = await borrowerApi(`/borrower/printable-forms/${form.id}/generate`, {
        method: 'POST',
        body: JSON.stringify({
          fields,
          watermark: wm,
          branch_code: branchCode.trim(),
        }),
      })
      let url =
        typeof res.download_url === 'string' && res.download_url.startsWith('/api/')
          ? res.download_url
          : ''
      url = url || getLaravelStorageFileUrl(res.path)
      const path = res.path
      if (url && path && res.form_id != null) {
        try {
          await borrowerApi('/borrower/printable-forms/download-log', {
            method: 'POST',
            body: JSON.stringify({ printable_form_id: res.form_id, storage_path: path }),
          })
        } catch {
          /* non-fatal */
        }
      }
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e.message || 'Generation failed.')
    } finally {
      setGeneratingId(null)
    }
  }

  const cardBase =
    'rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg'

  const sorted = useMemo(() => [...forms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [forms])

  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 space-y-6 px-4 py-6 lg:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Printable forms</h1>
        <p className={`mt-1 text-sm text-gray-600 dark:text-gray-400`}>
          Download PDFs generated on the server. Save a draft as JSON merge fields — optional; blank PDF opens all lines for handwritten completion.
        </p>
      </div>

      <div className={cardBase}>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Branch code (optional)
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100"
            placeholder="For branch-specific forms only"
            value={branchCode}
            onChange={(e) => setBranchCode(e.target.value)}
          />
          <button
            type="button"
            onClick={() => loadForms()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
          >
            Refresh list
          </button>
        </div>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading forms…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No printable forms available.</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((f) => {
            const open = expandedId === f.id
            return (
              <div key={f.id} className={cardBase}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{f.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Key: <code>{f.form_key}</code>
                      {' · '}
                      {f.category}
                      {f.pdf_version ? ` · v${f.pdf_version}` : ''}
                    </p>
                    {f.description ? (
                      <p className={`mt-2 text-sm text-gray-600 dark:text-gray-400`}>{f.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : f.id)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100"
                    >
                      {open ? 'Hide draft' : 'Edit draft'}
                    </button>
                    <button
                      type="button"
                      disabled={generatingId === f.id}
                      onClick={() => generate(f, { blank: true })}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 disabled:opacity-50 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100"
                    >
                      Blank PDF
                    </button>
                    <button
                      type="button"
                      disabled={generatingId === f.id}
                      onClick={() => generate(f)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-red-700 disabled:opacity-50"
                    >
                      {generatingId === f.id ? 'Generating…' : 'Generate from draft'}
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Draft merge fields (JSON object)
                    </label>
                    <textarea
                      value={draftJsonById[f.id] ?? '{}'}
                      onChange={(e) => setDraftFor(f.id, e.target.value)}
                      spellCheck={false}
                      rows={12}
                      className={`font-mono mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-900 dark:border-[#1F2937] dark:bg-[#020617] dark:text-gray-100`}
                      placeholder={`{\n  \"present_address\": \"\",\n  \"loan_amount\": \"\",\n  \"loan_term_months\": \"\"\n}`}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
