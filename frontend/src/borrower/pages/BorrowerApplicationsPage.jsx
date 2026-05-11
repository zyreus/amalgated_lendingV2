import { useEffect, useState } from 'react'
import { borrowerApi } from '../api/client.js'
import { admin as ui } from '../../admin/components/AdminUi.jsx'
import { formatDate } from '../utils/formatters.js'
import { AdminPageSkeleton } from '../../components/AppSkeletons.jsx'
import { Link } from 'react-router-dom'
import { getBorrowerDocumentLoanApplications } from '../../utils/documentLoanApi.js'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

function mergeLendingPayload(data) {
  return data && typeof data === 'object'
    ? {
        general: data.general || [],
        general_drafts: data.general_drafts || [],
        travel: data.travel || [],
      }
    : { general: [], general_drafts: [], travel: [] }
}

export default function BorrowerApplicationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apps, setApps] = useState({ general: [], general_drafts: [], travel: [] })
  const [documentApps, setDocumentApps] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [res, docRes] = await Promise.all([
          borrowerApi('/borrower/lending-applications'),
          getBorrowerDocumentLoanApplications().catch(() => ({ data: [] })),
        ])
        if (!mounted) return
        setApps(mergeLendingPayload(res?.data))
        setDocumentApps(Array.isArray(docRes?.data) ? docRes.data : [])
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load borrower applications.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const performDeleteDraft = async () => {
    const id = confirmDeleteId
    if (id == null) return
    setDeletingId(id)
    setError('')
    try {
      await borrowerApi(`/borrower/loan-applications/${id}`, { method: 'DELETE' })
      const res = await borrowerApi('/borrower/lending-applications')
      setApps(mergeLendingPayload(res?.data))
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err.message || 'Could not delete draft.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <AdminPageSkeleton />

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC2626]">Borrower Portal</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">My applications and documents</h2>
        <p className={`mt-1 text-sm ${ui.textMuted}`}>
          View your applications and uploaded requirements.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
      ) : null}

      {documentApps.length === 0 &&
      apps.general.length === 0 &&
      apps.general_drafts.length === 0 &&
      apps.travel.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm ${ui.textMuted} dark:border-gray-600 dark:bg-[#0F172A]/30`}
        >
          No applications found yet.
        </div>
      ) : null}

      {documentApps.length > 0 ? (
        <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm dark:border-red-900/40 dark:from-red-950/30 dark:to-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Document loan applications</h3>
          <ul className="mt-4 space-y-3">
            {documentApps.map((app) => (
              <li key={`d-${app.id}`} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{app.product?.name || 'Loan application'}</p>
                    <p className={`mt-1 text-xs ${ui.tableMuted}`}>
                      Documents: {app.progress?.uploaded ?? 0} / {app.progress?.total ?? 0} · Signed form:{' '}
                      {app.progress?.signed_form ? 'yes' : 'no'}
                      {app.submitted_at ? ` · Submitted ${formatDate(app.submitted_at)}` : ''}
                    </p>
                  </div>
                  {app.product?.slug ? (
                    <Link
                      to={`/apply/documents/${encodeURIComponent(app.product.slug)}`}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Open application
                    </Link>
                  ) : null}
                </div>
                {app.signed_form_url ? (
                  <a href={getLaravelStorageFileUrl(app.signed_form_url)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-red-600 hover:underline dark:text-red-400">
                    View uploaded signed form
                  </a>
                ) : null}
                {app.embedded_documents?.valid_id_url || app.embedded_documents?.proof_income_url ? (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {app.embedded_documents?.valid_id_url ? (
                      <a href={getLaravelStorageFileUrl(app.embedded_documents.valid_id_url)} target="_blank" rel="noreferrer" className="font-semibold text-red-700 hover:underline dark:text-red-300">
                        Valid ID
                      </a>
                    ) : null}
                    {app.embedded_documents?.proof_income_url ? (
                      <a href={getLaravelStorageFileUrl(app.embedded_documents.proof_income_url)} target="_blank" rel="noreferrer" className="font-semibold text-red-700 hover:underline dark:text-red-300">
                        Proof of income
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {apps.general.length > 0 || apps.general_drafts.length > 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">General loan applications</h3>
          <p className={`mt-1 text-xs ${ui.textMuted}`}>Submitted applications appear here after you finish the wizard and confirm final submit.</p>
          {apps.general.length === 0 ? (
            <p className={`mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-3 text-sm ${ui.textMuted} dark:border-[#374151] dark:bg-[#0F172A]/40`}>
              No submitted loan applications yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {apps.general.map((row) => (
                <li key={`g-${row.id}`} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        #{row.id} · {row.loan_type_label || row.loan_type}
                      </p>
                      <p className={`text-xs capitalize ${ui.tableMuted}`}>
                        {row.status} {row.submitted_at ? `· Submitted ${formatDate(row.submitted_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <DocumentLinks docs={row.uploaded_documents} />
                </li>
              ))}
            </ul>
          )}

          {apps.general_drafts.length > 0 ? (
            <div className="mt-6 border-t border-gray-100 pt-5 dark:border-[#1F2937]">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Saved drafts</h4>
              <p className={`mt-0.5 text-xs ${ui.textMuted}`}>Resume your in-progress form. Drafts stay private until you submit.</p>
              <ul className="mt-3 space-y-2">
                {apps.general_drafts.map((d) => (
                  <li
                    key={`gd-${d.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-[#374151] dark:bg-[#0F172A]/30"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        #{d.id} · {d.loan_type_label || d.loan_type}
                      </p>
                      <p className={`text-[11px] ${ui.tableMuted}`}>
                        Step {d.draft_step ?? '—'}
                        {d.draft_updated_at ? ` · Updated ${formatDate(d.draft_updated_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.resume_path ? (
                        <Link
                          to={d.resume_path}
                          className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-gray-200 transition hover:bg-red-50 dark:bg-[#111827] dark:text-red-300 dark:ring-[#4B5563] dark:hover:bg-red-950/30"
                        >
                          Resume / edit
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        disabled={deletingId === d.id}
                        onClick={() => setConfirmDeleteId(d.id)}
                        className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:text-gray-300 dark:ring-[#4B5563] dark:hover:bg-red-950/40 dark:hover:text-red-200"
                      >
                        {deletingId === d.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {apps.travel.length > 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Travel assistance applications</h3>
          <ul className="mt-4 space-y-3">
            {apps.travel.map((row) => (
              <li key={`t-${row.id}`} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Travel #{row.id}</p>
                    <p className={`text-xs capitalize ${ui.tableMuted}`}>{row.status}</p>
                  </div>
                </div>
                <DocumentLinks docs={row.uploaded_documents} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteId != null}
        title="Confirm deletion"
        message="Delete this saved draft? Any uploaded documents and signatures will be removed. This cannot be undone."
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={performDeleteDraft}
        busy={deletingId != null && deletingId === confirmDeleteId}
      />
    </div>
  )
}

function DocumentLinks({ docs }) {
  if (!Array.isArray(docs) || docs.length === 0) {
    return <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No uploaded documents yet.</p>
  }
  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Uploaded documents</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {docs.map((doc, idx) => (
          <a
            key={`${doc.key}-${idx}`}
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10"
          >
            {doc.label}
          </a>
        ))}
      </div>
    </div>
  )
}
