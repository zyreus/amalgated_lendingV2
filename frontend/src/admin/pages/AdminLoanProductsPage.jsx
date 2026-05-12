import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { SkeletonLine } from '../../components/AppSkeletons.jsx'

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
  calculator_config_json: '{}',
  rules_json: '{}',
  sort_order: '0',
}

function parseConfig(json) {
  if (!json || !String(json).trim()) return {}
  try {
    return JSON.parse(json)
  } catch {
    return null
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
  }

  const openEdit = (row) => {
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
      calculator_config_json: JSON.stringify(row.calculator_config || {}, null, 2),
      rules_json: JSON.stringify(row.rules || {}, null, 2),
      sort_order: row.sort_order != null ? String(row.sort_order) : '0',
      _id: row.id,
    })
  }

  const save = async (e) => {
    e.preventDefault()
    const cfg = parseConfig(form.calculator_config_json)
    const rules = parseConfig(form.rules_json)
    if (cfg === null) {
      showToast('Calculator config must be valid JSON.', 'error')
      return
    }
    if (rules === null) {
      showToast('Rules must be valid JSON.', 'error')
      return
    }
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
    setSaving(true)
    try {
      if (modal === 'new') {
        await api('/admin/loan-products', { method: 'POST', body: JSON.stringify(payload) })
        showToast('Loan product created.', 'success')
      } else {
        await api(`/admin/loan-products/${form._id}`, { method: 'PUT', body: JSON.stringify(payload) })
        showToast('Loan product updated.', 'success')
      }
      setModal(null)
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
                <div key={r.id} className={`${admin.cardNoHover} space-y-2 p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                      <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{r.rate_type || '—'} · {r.interest_rate != null ? `${r.interest_rate}%` : '—'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-gray-700 dark:bg-[#0F172A]/40 dark:text-gray-200">
                      {r.status}
                    </span>
                  </div>
                  <p className={`text-xs ${admin.textMuted}`}>Max term: {r.max_term != null ? `${r.max_term} mo` : '—'}</p>
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
                <th className={`${admin.tableCell} text-left`}>Name</th>
                <th className={`${admin.tableCell} text-left`}>Rate</th>
                <th className={`${admin.tableCell} text-left`}>Rate type</th>
                <th className={`${admin.tableCell} text-left`}>Collateral</th>
                <th className={`${admin.tableCell} text-left`}>Max term</th>
                <th className={`${admin.tableCell} text-left`}>Status</th>
                <th className={`${admin.tableCell} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={admin.tbodyRow}>
                  <td className={`${admin.tableCell} font-medium ${admin.tableText}`}>{r.name}</td>
                  <td className={admin.tableCell}>{r.interest_rate != null ? `${r.interest_rate}%` : '—'}</td>
                  <td className={`${admin.tableCell} capitalize`}>{r.rate_type || '—'}</td>
                  <td className={`max-w-[10rem] truncate sm:max-w-[180px] ${admin.tableCell} ${admin.tableMuted}`} title={r.collateral}>
                    {r.collateral || '—'}
                  </td>
                  <td className={admin.tableCell}>{r.max_term != null ? `${r.max_term} mo` : '—'}</td>
                  <td className={`${admin.tableCell} capitalize`}>{r.status}</td>
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

      {modal ? (
        <div className={admin.modalOverlay}>
          <div className={`${admin.modalCard} max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {modal === 'new' ? 'Add loan product' : 'Edit loan product'}
            </h2>
            <form onSubmit={save} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Product code</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} />
                </div>
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Slug</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} required />
                </div>
                <div className="sm:col-span-2">
                  <label className={`text-xs ${admin.textMuted}`}>Sort order</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.sort_order} onChange={(e) => setForm((s) => ({ ...s, sort_order: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Loan name</label>
                <input className={`mt-1 w-full ${admin.input}`} value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} required />
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Description</label>
                <textarea className={`mt-1 w-full ${admin.input}`} rows={3} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Interest rate (%)</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.interest_rate} onChange={(e) => setForm((s) => ({ ...s, interest_rate: e.target.value }))} required />
                </div>
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Rate type</label>
                  <select className={`mt-1 w-full ${admin.input}`} value={form.rate_type} onChange={(e) => setForm((s) => ({ ...s, rate_type: e.target.value }))}>
                    <option value="monthly">monthly</option>
                    <option value="fixed">fixed</option>
                    <option value="annual">annual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Collateral</label>
                <input className={`mt-1 w-full ${admin.input}`} value={form.collateral} onChange={(e) => setForm((s) => ({ ...s, collateral: e.target.value }))} />
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Collateral type</label>
                <input className={`mt-1 w-full ${admin.input}`} value={form.collateral_type} onChange={(e) => setForm((s) => ({ ...s, collateral_type: e.target.value }))} />
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Requirements</label>
                <textarea className={`mt-1 w-full ${admin.input}`} rows={2} value={form.requirements} onChange={(e) => setForm((s) => ({ ...s, requirements: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Max term (months)</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.max_term} onChange={(e) => setForm((s) => ({ ...s, max_term: e.target.value }))} />
                </div>
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Max loan amount</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.max_amount} onChange={(e) => setForm((s) => ({ ...s, max_amount: e.target.value }))} />
                </div>
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Age limit</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.age_limit} onChange={(e) => setForm((s) => ({ ...s, age_limit: e.target.value }))} />
                </div>
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Safe age</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.safe_age} onChange={(e) => setForm((s) => ({ ...s, safe_age: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Downpayment (optional)</label>
                <input className={`mt-1 w-full ${admin.input}`} value={form.downpayment} onChange={(e) => setForm((s) => ({ ...s, downpayment: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Status</label>
                  <select className={`mt-1 w-full ${admin.input}`} value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Tier (UI)</label>
                  <select className={`mt-1 w-full ${admin.input}`} value={form.tier} onChange={(e) => setForm((s) => ({ ...s, tier: e.target.value }))}>
                    <option value="green">green</option>
                    <option value="blue">blue</option>
                    <option value="orange">orange</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Icon key</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.icon_key} onChange={(e) => setForm((s) => ({ ...s, icon_key: e.target.value }))} placeholder="home, vehicle, …" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={`text-xs ${admin.textMuted}`}>Sample monthly pension</label>
                  <input className={`mt-1 w-full ${admin.input}`} value={form.sample_monthly_pension} onChange={(e) => setForm((s) => ({ ...s, sample_monthly_pension: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Sample computation note</label>
                <textarea className={`mt-1 w-full ${admin.input}`} rows={2} value={form.sample_computation_note} onChange={(e) => setForm((s) => ({ ...s, sample_computation_note: e.target.value }))} />
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Calculator config (JSON)</label>
                <textarea
                  className={`mt-1 w-full font-mono text-xs ${admin.input}`}
                  rows={4}
                  value={form.calculator_config_json}
                  onChange={(e) => setForm((s) => ({ ...s, calculator_config_json: e.target.value }))}
                  placeholder='{"pension_multiplier":10,"max_principal":500000}'
                />
              </div>
              <div>
                <label className={`text-xs ${admin.textMuted}`}>Rules / formula controls (JSON)</label>
                <textarea
                  className={`mt-1 w-full font-mono text-xs ${admin.input}`}
                  rows={6}
                  value={form.rules_json}
                  onChange={(e) => setForm((s) => ({ ...s, rules_json: e.target.value }))}
                  placeholder='{"service_charge_rate":0.035,"doc_stamp_per_200":1.5}'
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className={admin.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`${admin.btnPrimary} disabled:opacity-50`}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
