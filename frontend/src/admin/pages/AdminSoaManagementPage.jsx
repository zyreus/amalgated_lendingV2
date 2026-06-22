import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  AlertTriangle,
  CalendarClock,
  Download,
  Eye,
  FileText,
  Loader2,
  MailCheck,
  Percent,
  RefreshCcw,
  Search,
  WalletCards,
  X,
} from 'lucide-react'
import { api, getToken } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { EmptyTableRow, TableSkeletonRows, admin } from '../components/AdminUi.jsx'
import { laravelApiBases, laravelApiUrl } from '../../utils/lendingLaravelApi.js'

const cardClass = 'rounded-2xl border border-[#D8D8D8] bg-[#F8F8F8] shadow-sm transition-all duration-200 hover:shadow-md'
const inputClass = 'w-full rounded-xl border border-[#D8D8D8] bg-[#F8F8F8] px-4 py-2.5 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]'
const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C] disabled:cursor-not-allowed disabled:opacity-60'
const secondaryBtn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8D8D8] bg-[#F8F8F8] px-4 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]'
const tableCell = 'px-3 py-3 sm:px-4'

function peso(value) {
  const n = Number(value || 0)
  return `PHP ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function monthLabel(value) {
  if (!value) return 'All months'
  const d = new Date(`${value}-01T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function loanOptionLabel(loan) {
  if (!loan) return 'Select loan'
  const borrower = loan.borrower?.name ? `${loan.borrower.name} · ` : ''
  return `${borrower}${loan.loan_number || `Loan #${loan.id}`} · ${peso(loan.principal)} · ${String(loan.status || '-').replace(/_/g, ' ')}`
}

function fileNameFromDisposition(header, fallback) {
  const match = String(header || '').match(/filename="?([^"]+)"?/i)
  return match?.[1] || fallback
}

async function readBlobError(response) {
  try {
    const text = await response.data.text()
    const json = JSON.parse(text)
    return json.hint || json.message || text
  } catch {
    return `Request failed (HTTP ${response.status}).`
  }
}

async function requestBlob(path, accept) {
  const token = getToken()
  let lastError = null
  for (const base of laravelApiBases()) {
    try {
      const response = await axios.get(laravelApiUrl(path, base), {
        headers: { Accept: accept, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        responseType: 'blob',
        validateStatus: () => true,
        timeout: 120000,
      })
      if (response.status >= 200 && response.status < 300) {
        return {
          blob: new Blob([response.data], { type: accept }),
          filename: fileNameFromDisposition(response.headers?.['content-disposition'], 'soa-report.pdf'),
        }
      }
      lastError = new Error(await readBlobError(response))
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Download failed.')
}

async function downloadBlob(path, filename, accept) {
  const { blob, filename: serverFilename } = await requestBlob(path, accept)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || serverFilename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function StatCard({ label, value, icon: Icon, iconClass }) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{value ?? '-'}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const s = String(status || 'ready').toLowerCase()
  let cls = 'bg-yellow-100 text-yellow-700'
  if (s === 'paid') cls = 'bg-green-100 text-green-700'
  if (s === 'overdue') cls = 'bg-red-100 text-red-700'
  if (s === 'sent') cls = 'bg-slate-100 text-[#0F172A]'
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${cls}`}>{s.replace(/_/g, ' ')}</span>
}

function FilterChip({ label, onClear }) {
  return (
    <button type="button" onClick={onClear} className="inline-flex items-center gap-2 rounded-full border border-[#D8D8D8] bg-[#F8F8F8] px-3 py-1.5 text-xs font-semibold text-[#0F172A] transition hover:bg-white">
      {label}
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

export default function AdminSoaManagementPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ q: '', status: '', month: new Date().toISOString().slice(0, 7), page: 1 })
  const [searchText, setSearchText] = useState('')
  const [form, setForm] = useState({ loan_id: '', borrower_id: '', borrower_name: '', send_email: true })
  const [borrowerOptions, setBorrowerOptions] = useState([])
  const [selectedBorrower, setSelectedBorrower] = useState(null)
  const [loanOptions, setLoanOptions] = useState([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(null)

  const query = useMemo(() => {
    const q = new URLSearchParams()
    if (filters.q) q.set('q', filters.q)
    if (filters.status) q.set('status', filters.status)
    if (filters.month) q.set('month', `${filters.month}-01`)
    q.set('page', String(filters.page || 1))
    q.set('per_page', '20')
    return q.toString()
  }, [filters])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((v) => (v.q === searchText.trim() ? v : { ...v, q: searchText.trim(), page: 1 }))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchText])

  useEffect(() => {
    return () => {
      if (preview?.pdfUrl) URL.revokeObjectURL(preview.pdfUrl)
    }
  }, [preview?.pdfUrl])

  const load = async () => {
    setLoading(true)
    try {
      const [list, dash] = await Promise.all([api(`/soa?${query}`), api(`/soa/analytics?${query}`)])
      setRows(Array.isArray(list?.data?.data) ? list.data.data : [])
      setMeta(list?.data || null)
      setAnalytics(dash?.data || null)
    } catch (err) {
      showToast(err.message || 'Could not load SOA dashboard.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [query])

  useEffect(() => {
    const search = form.borrower_name.trim()
    if (search.length < 2 || selectedBorrower?.name === search) {
      setBorrowerOptions([])
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const [borrowers, loans] = await Promise.all([
          api(`/borrowers?search=${encodeURIComponent(search)}&per_page=8`),
          api(`/soa/eligible-loans?q=${encodeURIComponent(search)}&limit=100`),
        ])
        if (!cancelled) {
          setBorrowerOptions(Array.isArray(borrowers?.data?.data) ? borrowers.data.data : [])
          setLoanOptions(Array.isArray(loans?.data) ? loans.data : [])
        }
      } catch {
        if (!cancelled) {
          setBorrowerOptions([])
          setLoanOptions([])
        }
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.borrower_name, selectedBorrower?.name])

  const updateFilter = (patch) => setFilters((v) => ({ ...v, ...patch, page: 1 }))

  const loadEligibleLoans = async ({ borrowerId = '', q = '' } = {}) => {
    setLookupLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (borrowerId) params.set('borrower_id', String(borrowerId))
      if (q) params.set('q', q)
      const res = await api(`/soa/eligible-loans?${params.toString()}`)
      const loans = Array.isArray(res?.data) ? res.data : []
      setLoanOptions(loans)
      return loans
    } catch (err) {
      setLoanOptions([])
      showToast(err.message || 'Could not load eligible loans.', 'error')
      return []
    } finally {
      setLookupLoading(false)
    }
  }

  useEffect(() => {
    loadEligibleLoans()
  }, [])

  const selectBorrower = async (borrower) => {
    setForm((v) => ({ ...v, borrower_id: String(borrower.id), borrower_name: borrower.name || '', loan_id: '' }))
    setSearchText(borrower.name || borrower.email || '')
    setFilters((v) => ({ ...v, q: borrower.name || borrower.email || '', page: 1 }))
    setBorrowerOptions([])
    setSelectedBorrower(borrower)
    const loans = await loadEligibleLoans({ borrowerId: borrower.id })
    setForm((v) => ({ ...v, loan_id: loans.length === 1 ? String(loans[0].id) : '' }))
  }

  const selectLoan = (loanId) => {
    const loan = loanOptions.find((item) => String(item.id) === String(loanId))
    const borrower = loan?.borrower || null
    setForm((v) => ({
      ...v,
      loan_id: loanId,
      borrower_id: borrower?.id ? String(borrower.id) : v.borrower_id,
      borrower_name: borrower?.name || v.borrower_name,
    }))
    if (borrower) {
      setSelectedBorrower(borrower)
    }
  }

  const submitSingle = async () => {
    if (!form.borrower_id || !selectedBorrower) return showToast('Select a borrower from the search results before generating.', 'error')
    if (!form.loan_id) return showToast('Select a borrower loan before generating.', 'error')
    setBusy('single')
    try {
      await api('/soa/generate', {
        method: 'POST',
        body: JSON.stringify({
          borrower_id: Number(form.borrower_id),
          loan_id: Number(form.loan_id),
          statement_month: `${filters.month || new Date().toISOString().slice(0, 7)}-01`,
          send_email: form.send_email,
        }),
      })
      showToast('SOA generated and saved. Email delivery to borrower is in progress.', 'success')
      await load()
    } catch (err) {
      showToast(err.message || 'SOA generation failed.', 'error')
    } finally {
      setBusy('')
    }
  }

  const submitBatch = async () => {
    setBusy('batch')
    try {
      const body = { statement_month: `${filters.month || new Date().toISOString().slice(0, 7)}-01`, send_email: form.send_email }
      if (form.borrower_id) body.borrower_id = Number(form.borrower_id)
      if (!form.borrower_id && form.borrower_name.trim()) body.borrower_name = form.borrower_name.trim()
      const res = await api('/soa/batch-generate', { method: 'POST', body: JSON.stringify(body) })
      showToast(`Generated ${res?.data?.generated || 0} statement(s).`, 'success')
      await load()
    } catch (err) {
      showToast(err.message || 'Batch generation failed.', 'error')
    } finally {
      setBusy('')
    }
  }

  const resend = async (statement) => {
    setBusy(`resend-${statement.id}`)
    try {
      await api(`/soa/${statement.id}/resend-email`, { method: 'POST', body: '{}' })
      showToast('SOA email sent to borrower.', 'success')
      await load()
    } catch (err) {
      showToast(err.message || 'Could not queue email.', 'error')
    } finally {
      setBusy('')
    }
  }

  const openPreview = async (statement) => {
    setBusy(`preview-${statement.id}`)
    try {
      const [detail, pdf] = await Promise.all([api(`/soa/${statement.id}/preview`), requestBlob(`/soa/${statement.id}/preview-pdf`, 'application/pdf')])
      setPreview({ ...(detail?.data || statement), pdfUrl: URL.createObjectURL(pdf.blob) })
    } catch (err) {
      showToast(err.message || 'Could not load SOA PDF preview.', 'error')
    } finally {
      setBusy('')
    }
  }

  const closePreview = () => {
    if (preview?.pdfUrl) URL.revokeObjectURL(preview.pdfUrl)
    setPreview(null)
  }

  const exportReport = async (format) => {
    setBusy(`export-${format}`)
    try {
      const accept = format === 'pdf' ? 'application/pdf' : format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv'
      const ext = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xls' : 'csv'
      await downloadBlob(`/soa/export?format=${format}&${query}`, `soa-report.${ext}`, accept)
    } catch (err) {
      showToast(err.message || 'Export failed.', 'error')
    } finally {
      setBusy('')
    }
  }

  const clearFilters = () => {
    setSearchText('')
    setFilters({ q: '', status: '', month: new Date().toISOString().slice(0, 7), page: 1 })
  }

  const summary = analytics?.summary || {}
  const pdfGd = analytics?.environment?.pdf_gd === true
  const hasActiveFilters = Boolean(filters.q || filters.status || filters.month !== new Date().toISOString().slice(0, 7))
  const stats = [
    ['Generated SOA', summary.total_generated, FileText, 'bg-rose-100 text-rose-600'],
    ['Projected Monthly Due', peso(summary.total_due), CalendarClock, 'bg-blue-100 text-blue-600'],
    ['Outstanding Balance', peso(summary.outstanding_balance), WalletCards, 'bg-green-100 text-green-600'],
    ['Overdue Accounts', summary.overdue_accounts, AlertTriangle, 'bg-orange-100 text-orange-600'],
    ['Email Sent', summary.email_sent, MailCheck, 'bg-violet-100 text-violet-600'],
    ['Borrower Viewed', summary.viewed, Eye, 'bg-amber-100 text-amber-600'],
    ['Downloaded', summary.downloaded, Download, 'bg-cyan-100 text-cyan-600'],
    ['Penalties', peso(summary.penalties), Percent, 'bg-pink-100 text-pink-600'],
  ]

  return (
    <div className="w-full min-w-0 space-y-6 bg-[#F5EEDF] text-[#0F172A]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">SOA Management</h1>
          <p className="mt-1 text-sm text-[#64748B]">Generate, send, monitor, and analyze monthly borrower Statements of Account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['csv', 'excel', 'pdf'].map((format) => (
            <button key={format} type="button" onClick={() => exportReport(format)} disabled={busy === `export-${format}`} className={secondaryBtn}>
              {busy === `export-${format}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {!pdfGd && analytics?.environment?.pdf_hint ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">PDF letterhead images need PHP GD</p>
          <p className="mt-1 text-amber-900/90">{analytics.environment.pdf_hint}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon, iconClass]) => <StatCard key={label} label={label} value={value} icon={Icon} iconClass={iconClass} />)}
      </div>

      <div className={`${cardClass} space-y-4 p-5`}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">Generate SOA</h2>
            <p className="text-xs text-[#64748B]">Search a borrower, pick a loan, then generate for {monthLabel(filters.month)}.</p>
          </div>
          <input className={`${inputClass} w-full sm:max-w-[11rem]`} type="month" value={filters.month} onChange={(e) => updateFilter({ month: e.target.value })} aria-label="Statement month" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="relative md:col-span-2 xl:col-span-1">
            <label className={labelClass}>Borrower</label>
            <input
              className={inputClass}
              placeholder="Name or email"
              value={form.borrower_name}
              onChange={(e) => {
                const value = e.target.value
                setForm((v) => ({ ...v, borrower_name: value, borrower_id: '', loan_id: '' }))
                setSearchText(value)
                setSelectedBorrower(null)
                setLoanOptions([])
              }}
            />
            {borrowerOptions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-64 overflow-y-auto rounded-xl border border-[#D8D8D8] bg-[#F8F8F8] p-1 shadow-xl">
                {borrowerOptions.map((borrower) => (
                  <button key={borrower.id} type="button" onClick={() => selectBorrower(borrower)} className="block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white">
                    <span className="block font-semibold text-[#0F172A]">{borrower.name || `Borrower #${borrower.id}`}</span>
                    <span className="block text-xs text-[#64748B]">#{borrower.id} · {borrower.email || 'No email'} · {borrower.loans_count || 0} loan(s)</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Loan</label>
            <select className={inputClass} value={form.loan_id} onChange={(e) => selectLoan(e.target.value)} disabled={lookupLoading}>
              <option value="">{lookupLoading ? 'Loading loans...' : loanOptions.length ? 'Select loan' : 'No eligible active loans found'}</option>
              {loanOptions.map((loan) => <option key={loan.id} value={loan.id}>{loanOptionLabel(loan)}</option>)}
            </select>
          </div>

          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 text-sm text-[#0F172A]">
              <input type="checkbox" checked={form.send_email} onChange={(e) => setForm((v) => ({ ...v, send_email: e.target.checked }))} />
              Send email after generate
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={submitSingle} disabled={busy === 'single'} className={primaryBtn}>
                {busy === 'single' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {busy === 'single' ? 'Generating...' : 'Generate per loan'}
              </button>
              <button type="button" onClick={submitBatch} disabled={busy === 'batch'} className={secondaryBtn}>
                {busy === 'batch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {busy === 'batch' ? 'Generating...' : 'Batch generate'}
              </button>
            </div>
          </div>
        </div>

        {selectedBorrower ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#D8D8D8] bg-white/60 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#0F172A]"><Link to={`/admin/borrowers/${selectedBorrower.id}`} className="text-[#E11D48] hover:underline">{selectedBorrower.name || `Borrower #${selectedBorrower.id}`}</Link></p>
              <p className="text-xs text-[#64748B]">ID #{selectedBorrower.id} · {selectedBorrower.email || 'No email'} · {selectedBorrower.phone || 'No phone'}</p>
            </div>
            <p className="text-xs font-semibold text-[#E11D48]">{loanOptions.length} active loan{loanOptions.length === 1 ? '' : 's'} · <Link to={`/admin/borrowers/${selectedBorrower.id}`} className="underline">Open borrower profile</Link></p>
          </div>
        ) : null}
      </div>

      <div className={`${cardClass} space-y-4 p-5`}>
        <div className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto] lg:items-end">
          <div>
            <label className={labelClass}>Search records</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" aria-hidden />
              <input className={`${inputClass} pl-10`} placeholder="Borrower, email, or loan number" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Month</label>
            <input className={inputClass} type="month" value={filters.month} onChange={(e) => updateFilter({ month: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={filters.status} onChange={(e) => updateFilter({ status: e.target.value })}>
              <option value="">All statuses</option>
              {['ready', 'sent', 'viewed', 'overdue', 'paid'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="button" onClick={clearFilters} className={secondaryBtn}>Clear filters</button>
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap gap-2">
            {filters.q ? <FilterChip label={`Search: ${filters.q}`} onClear={() => { setSearchText(''); updateFilter({ q: '' }) }} /> : null}
            {filters.month ? <FilterChip label={`Month: ${monthLabel(filters.month)}`} onClear={() => updateFilter({ month: '' })} /> : null}
            {filters.status ? <FilterChip label={`Status: ${filters.status}`} onClear={() => updateFilter({ status: '' })} /> : null}
          </div>
        ) : null}
      </div>

      <div className="w-full min-w-0 overflow-x-auto rounded-2xl border border-[#D8D8D8] bg-[#F8F8F8] shadow-sm">
        <table className="min-w-[980px] w-full table-auto border-collapse text-left text-sm">
          <thead className="bg-[#F3F4F6] text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            <tr>
              {['Statement', 'Borrower', 'Due', 'Total', 'Balance', 'Delivery', 'Engagement', 'Actions'].map((h) => <th key={h} className={tableCell}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <TableSkeletonRows cols={8} rows={6} /> : null}
            {!loading && rows.length === 0 ? <EmptyTableRow colSpan={8} message="No SOA records found for the active filters." /> : null}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="border-b border-[#D8D8D8]/70 transition hover:bg-[#FAFAFA]">
                <td className={tableCell}><div className="font-semibold text-[#0F172A]">{row.statement_number}</div><div className="text-xs text-[#64748B]">{row.statement_month_label}</div></td>
                <td className={tableCell}>
                  {row.borrower?.id ? <Link to={`/admin/borrowers/${row.borrower.id}`} className="font-medium text-[#E11D48] hover:underline">{row.borrower.name}</Link> : <div className="font-medium text-[#0F172A]">{row.borrower?.name || '-'}</div>}
                  <div className="text-xs text-[#64748B]">{row.loan_number || `Loan #${row.loan_id}`}</div>
                </td>
                <td className={tableCell}>{shortDate(row.due_date)}</td>
                <td className={`${tableCell} font-semibold text-[#E11D48]`}>{peso(row.total_due)}</td>
                <td className={tableCell}>{peso(row.remaining_balance)}</td>
                <td className={tableCell}><div className="space-y-2"><StatusBadge status={row.status} /><p className="text-xs text-[#0F172A]">{row.email_sent ? `Sent ${shortDate(row.email_sent_at)}` : 'Not sent'}</p></div></td>
                <td className={`${tableCell} text-xs text-[#64748B]`}>Viewed: {row.viewed_at ? shortDate(row.viewed_at) : '-'}<br />Downloaded: {row.downloaded_at ? shortDate(row.downloaded_at) : '-'}</td>
                <td className={tableCell}>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openPreview(row)} disabled={busy === `preview-${row.id}`} className={secondaryBtn}>{busy === `preview-${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Preview</button>
                    <button type="button" onClick={() => downloadBlob(`/soa/${row.id}/download`, `SOA-${row.statement_month || row.id}.pdf`, 'application/pdf').catch((e) => showToast(e.message, 'error'))} className={secondaryBtn}><Download className="h-4 w-4" />PDF</button>
                    <button type="button" onClick={() => resend(row)} disabled={busy === `resend-${row.id}`} className={primaryBtn}>{busy === `resend-${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}Resend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta ? (
        <div className="flex flex-col gap-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing page {meta.current_page || 1} of {meta.last_page || 1}.</p>
          <div className="flex gap-2">
            <button type="button" disabled={(meta.current_page || 1) <= 1 || loading} onClick={() => setFilters((v) => ({ ...v, page: Math.max(1, (v.page || 1) - 1) }))} className={secondaryBtn}>Previous</button>
            <button type="button" disabled={(meta.current_page || 1) >= (meta.last_page || 1) || loading} onClick={() => setFilters((v) => ({ ...v, page: (v.page || 1) + 1 }))} className={secondaryBtn}>Next</button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className={admin.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="soa-preview-title">
          <div className={`${admin.modalCard} max-w-6xl`}>
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-[#1F2937]">
              <div>
                <p className={admin.modalEyebrow}>Statement preview</p>
                <h2 id="soa-preview-title" className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{preview.statement_number || `SOA #${preview.id}`}</h2>
                <p className={admin.textMuted}>{preview.statement_month_label || preview.statement_month} · {preview.borrower?.name || 'Borrower'}</p>
              </div>
              <button type="button" onClick={closePreview} className={admin.btnSecondary}>Close</button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Due date', shortDate(preview.due_date)],
                ['Monthly due', peso(preview.monthly_due)],
                ['Penalties', peso(preview.penalties)],
                ['Total due', peso(preview.total_due)],
              ].map(([label, value]) => (
                <div key={label} className={`${admin.insetPanel} p-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#1F2937] dark:bg-[#0F172A]/50">
              <iframe title="SOA PDF preview" src={preview.pdfUrl} className="h-[70vh] w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
