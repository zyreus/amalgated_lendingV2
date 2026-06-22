import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import LoanProductWizardModal from '../components/LoanProductWizardModal.jsx'
import { SkeletonLine } from '../../components/AppSkeletons.jsx'
import {
  calculatorConfigToForm,
  emptyCalculatorConfig,
  emptyRulesConfig,
  formToCalculatorConfig,
  formToRulesConfig,
  rulesConfigToForm,
} from '../utils/loanProductConfigSchema.js'

const TIER_BADGE = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
  orange: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
}

function tierBadgeClass(tier) {
  return TIER_BADGE[tier] || 'bg-gray-100 text-gray-700 dark:bg-[#0F172A]/40 dark:text-gray-300'
}

const emptyForm = {
  code: '',
  slug: '',
  name: '',
  description: '',
  interest_rate: '',
  rate_type: 'monthly',
  collateral: '',
  collateral_type: '',
  requirements: '',
  max_term: '',
  max_amount: '',
  age_limit: '',
  safe_age: '',
  downpayment: '',
  status: 'active',
  tier: 'blue',
  icon_key: '',
  sample_monthly_pension: '',
  sample_computation_note: '',
  sort_order: '0',
}

function emptyConfigState() {
  return {
    calculatorConfig: emptyCalculatorConfig(),
    rulesConfig: emptyRulesConfig(),
    calcExtra: {},
    rulesExtra: {},
  }
}

export default function AdminLoanProductsPage() {
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const allowed = can('loans.view')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [configState, setConfigState] = useState(emptyConfigState)
  const [saving, setSaving] = useState(false)
  /** { id, name } when delete confirmation modal is open */
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    if (!allowed) return
    setLoading(true)
    try {
      const res = await api('/admin/loan-products')
      setRows(res.data || [])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [allowed, showToast])

  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    setModal('new')
    setForm(emptyForm)
    setConfigState(emptyConfigState())
  }

  const openEdit = (row) => {
    const calcParsed = calculatorConfigToForm(row.calculator_config || {})
    const rulesParsed = rulesConfigToForm(row.rules || {})
    setModal('edit')
    setForm({
      slug: row.slug || '',
      code: row.code || '',
      name: row.name || '',
      description: row.description || '',
      interest_rate: row.interest_rate != null ? String(row.interest_rate) : '',
      rate_type: row.rate_type || 'monthly',
      collateral: row.collateral || '',
      collateral_type: row.collateral_type || '',
      requirements: row.requirements || '',
      max_term: row.max_term != null ? String(row.max_term) : '',
      max_amount: row.max_amount != null ? String(row.max_amount) : '',
      age_limit: row.age_limit != null ? String(row.age_limit) : '',
      safe_age: row.safe_age != null ? String(row.safe_age) : '',
      downpayment: row.downpayment || '',
      status: row.status || 'active',
      tier: row.tier || 'blue',
      icon_key: row.icon_key || '',
      sample_monthly_pension: row.sample_monthly_pension != null ? String(row.sample_monthly_pension) : '',
      sample_computation_note: row.sample_computation_note || '',
      sort_order: row.sort_order != null ? String(row.sort_order) : '0',
      _id: row.id,
    })
    setConfigState({
      calculatorConfig: calcParsed.form,
      rulesConfig: rulesParsed.form,
      calcExtra: calcParsed.extra,
      rulesExtra: rulesParsed.extra,
    })
  }

  const save = async (e) => {
    e.preventDefault()
    const cfg = formToCalculatorConfig(configState.calculatorConfig, configState.calcExtra)
    const rules = formToRulesConfig(configState.rulesConfig, configState.rulesExtra)
    const payload = {
      code: form.code.trim() || null,
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      interest_rate: Number(form.interest_rate),
      rate_type: form.rate_type,
      collateral: form.collateral.trim() || null,
      collateral_type: form.collateral_type.trim() || null,
      requirements: form.requirements.trim() || null,
      max_term: form.max_term === '' ? null : Number(form.max_term),
      max_amount: form.max_amount === '' ? null : Number(form.max_amount),
      age_limit: form.age_limit === '' ? null : Number(form.age_limit),
      safe_age: form.safe_age === '' ? null : Number(form.safe_age),
      downpayment: form.downpayment.trim() || null,
      status: form.status,
      tier: form.tier,
      icon_key: form.icon_key.trim() || null,
      sample_monthly_pension: form.sample_monthly_pension === '' ? null : Number(form.sample_monthly_pension),
      sample_computation_note: form.sample_computation_note.trim() || null,
      calculator_config: Object.keys(cfg).length ? cfg : null,
      rules: Object.keys(rules).length ? rules : null,
      sort_order: Number(form.sort_order) || 0,
    }
    if (!payload.slug || !payload.name) {
      showToast('Slug and name are required.', 'error')
      return
    }
    const rate = Number(payload.interest_rate)
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      showToast('Interest rate must be between 0 and 100.', 'error')
      return
    }
    setModal(null)
    setSaving(true)
    try {
      if (modal === 'new') {
        await api('/admin/loan-products', { method: 'POST', body: JSON.stringify(payload) })
        showToast('Loan product created.', 'success')
      } else {
        await api(`/admin/loan-products/${form._id}`, { method: 'PUT', body: JSON.stringify(payload) })
        showToast('Loan product updated.', 'success')
      }
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const performDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      await api(`/admin/loan-products/${deleteTarget.id}`, { method: 'DELETE' })
      showToast('Loan product deleted.', 'success')
      await load()
    } catch (e) {
      showToast(e.message || 'Could not delete loan product.', 'error')
      throw e
    }
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <p className={admin.textMuted}>You do not have permission to view loan products.</p>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={admin.pageTitle}>Loan products</h1>
          <p className={`mt-1 text-sm ${admin.textMuted}`}>
            Manage loan types, rates, and calculator settings for the public site and approvals.
          </p>
        </div>
        <button type="button" onClick={openNew} className={admin.btnPrimary}>
          Add product
        </button>
      </div>

      <div className={admin.tableWrap}>
        {loading ? (
          <div className="space-y-2 p-4">
            <SkeletonLine className="h-4 w-44" />
            <table className={`${admin.tableBase} ${admin.tableMin900}`}>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className={admin.tbodyRow}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className={admin.tableCell}>
                        <SkeletonLine className="h-3 w-full max-w-[8rem]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* Card view on small + tablets */}
            <div className="space-y-3 lg:hidden">
              {rows.map((r) => (
                <div key={r.id} className={`${admin.cardNoHover} space-y-3 p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.code ? (
                          <span className="rounded-md bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-primary">
                            {r.code}
                          </span>
                        ) : null}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tierBadgeClass(r.tier)}`}>
                          {r.tier || 'default'}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                      <p className={`mt-0.5 text-xs ${admin.textMuted}`}>
                        {r.interest_rate != null ? `${r.interest_rate}%` : '—'} · {r.rate_type || 'monthly'} · max {r.max_term != null ? `${r.max_term} mo` : '—'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                        r.status === 'active'
                          ? 'bg-red-50 text-brand-primary ring-1 ring-brand-primary/20'
                          : 'bg-gray-100 text-gray-600 dark:bg-[#0F172A]/40 dark:text-gray-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  {r.collateral ? <p className={`text-xs ${admin.textMuted}`}>Collateral: {r.collateral}</p> : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={() => openEdit(r)} className={admin.btnSecondary}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: r.id, name: r.name || r.slug || `Product #${r.id}` })}
                      className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-red-700 hover:shadow-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!rows.length ? (
                <div className={`${admin.cardNoHover} p-4 text-sm ${admin.textMuted}`}>
                  No loan products. Run migrations &amp; seed or add one.
                </div>
              ) : null}
            </div>

            {/* Table view on desktop */}
            <div className="hidden lg:block">
              <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin900}`}>
            <thead>
              <tr className={admin.thead}>
                <th className={`${admin.tableCell} text-left`}>Product</th>
                <th className={`${admin.tableCell} text-left`}>Rate</th>
                <th className={`${admin.tableCell} text-left`}>Collateral</th>
                <th className={`${admin.tableCell} text-left`}>Max term</th>
                <th className={`${admin.tableCell} text-left`}>Tier</th>
                <th className={`${admin.tableCell} text-left`}>Status</th>
                <th className={`${admin.tableCell} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={admin.tbodyRow}>
                  <td className={admin.tableCell}>
                    <div className="flex items-center gap-2">
                      {r.code ? (
                        <span className="hidden rounded-md bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-primary xl:inline">
                          {r.code}
                        </span>
                      ) : null}
                      <span className={`font-medium ${admin.tableText}`}>{r.name}</span>
                    </div>
                    <p className={`mt-0.5 text-[11px] ${admin.tableMuted}`}>{r.slug}</p>
                  </td>
                  <td className={admin.tableCell}>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {r.interest_rate != null ? `${r.interest_rate}%` : '—'}
                    </span>
                    <p className={`text-[11px] capitalize ${admin.tableMuted}`}>{r.rate_type || '—'}</p>
                  </td>
                  <td className={`max-w-[10rem] truncate sm:max-w-[180px] ${admin.tableCell} ${admin.tableMuted}`} title={r.collateral}>
                    {r.collateral || '—'}
                  </td>
                  <td className={admin.tableCell}>{r.max_term != null ? `${r.max_term} mo` : '—'}</td>
                  <td className={admin.tableCell}>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tierBadgeClass(r.tier)}`}>
                      {r.tier || '—'}
                    </span>
                  </td>
                  <td className={admin.tableCell}>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        r.status === 'active'
                          ? 'bg-red-50 text-brand-primary dark:bg-red-950/30'
                          : 'bg-gray-100 text-gray-600 dark:bg-[#0F172A]/40'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className={`${admin.tableCell} text-right`}>
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                        <button type="button" onClick={() => openEdit(r)} className={`${admin.btnSecondary} w-full sm:mr-2 sm:w-auto`}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: r.id, name: r.name || r.slug || `Product #${r.id}` })}
                          className="w-full rounded-lg border border-gray-200 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 dark:border-red-900 sm:w-auto"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className={`${admin.tableCell} py-8 text-center ${admin.textMuted}`}>
                      No loan products. Run migrations & seed or add one.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete loan product?"
        description={
          deleteTarget
            ? `This will permanently remove “${deleteTarget.name}”. Active loans or applications that reference this product may be affected. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={performDelete}
      />

      <LoanProductWizardModal
        open={modal != null}
        mode={modal === 'new' ? 'new' : 'edit'}
        form={form}
        setForm={setForm}
        configState={configState}
        setConfigState={setConfigState}
        saving={saving}
        onClose={() => setModal(null)}
        onSave={save}
      />
    </div>
  )
}
