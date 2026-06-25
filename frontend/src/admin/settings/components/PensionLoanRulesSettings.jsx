import { useCallback, useEffect, useState } from 'react'
import { BadgePercent } from 'lucide-react'
import { api } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { admin } from '../../components/AdminUi.jsx'
import SettingsField from '../components/SettingsField.jsx'
import { SettingsAccordion, settingsInputClass } from '../components/SettingsPrimitives.jsx'

const EMPTY = {
  interest_rate: '',
  max_term: '',
  pension_multiplier: '',
  max_principal: '',
  pension_retention_threshold: '',
  pension_retention_threshold_nw_sss: '',
  pension_retention_threshold_nw_gsis: '',
  pension_retention_threshold_rl_sss: '',
  pension_retention_threshold_rl_gsis: '',
}

export default function PensionLoanRulesSettings({ readOnly = false }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState(null)
  const [productBase, setProductBase] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('/loan-products')
      const rows = Array.isArray(res?.data) ? res.data : []
      const product = rows.find((p) => p.slug === 'sss-pension-loan')
      if (!product) {
        setProductId(null)
        setProductBase(null)
        setForm(EMPTY)
        return
      }
      const cfg = product.calculator_config || {}
      const rules = product.rules || {}
      setProductId(product.id)
      setProductBase(product)
      setForm({
        interest_rate: product.interest_rate ?? '',
        max_term: product.max_term ?? '',
        pension_multiplier: cfg.pension_multiplier ?? '',
        max_principal: cfg.max_principal ?? '',
        pension_retention_threshold: rules.pension_retention_threshold ?? '',
        pension_retention_threshold_nw_sss: rules.pension_retention_threshold_nw_sss ?? '',
        pension_retention_threshold_nw_gsis: rules.pension_retention_threshold_nw_gsis ?? '',
        pension_retention_threshold_rl_sss: rules.pension_retention_threshold_rl_sss ?? '',
        pension_retention_threshold_rl_gsis: rules.pension_retention_threshold_rl_gsis ?? '',
      })
    } catch (e) {
      showToast(e.message || 'Failed to load pension loan rules.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    if (!productId || !productBase || readOnly) return
    setSaving(true)
    try {
      const calculator_config = {
        ...(productBase.calculator_config || {}),
        pension_multiplier: Number(form.pension_multiplier) || 18.75,
        max_principal: Number(form.max_principal) || 1000000,
        fee_profile: 'pension',
        computation_style: 'straight_line',
      }
      const rules = {
        ...(productBase.rules || {}),
        pension_retention_threshold: Number(form.pension_retention_threshold) || 300,
        pension_retention_threshold_nw_sss: form.pension_retention_threshold_nw_sss !== ''
          ? Number(form.pension_retention_threshold_nw_sss)
          : undefined,
        pension_retention_threshold_nw_gsis: form.pension_retention_threshold_nw_gsis !== ''
          ? Number(form.pension_retention_threshold_nw_gsis)
          : undefined,
        pension_retention_threshold_rl_sss: form.pension_retention_threshold_rl_sss !== ''
          ? Number(form.pension_retention_threshold_rl_sss)
          : undefined,
        pension_retention_threshold_rl_gsis: form.pension_retention_threshold_rl_gsis !== ''
          ? Number(form.pension_retention_threshold_rl_gsis)
          : undefined,
      }
      Object.keys(rules).forEach((key) => {
        if (rules[key] === undefined) delete rules[key]
      })
      await api(`/loan-products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productBase,
          interest_rate: Number(form.interest_rate) || productBase.interest_rate,
          max_term: Number(form.max_term) || productBase.max_term,
          calculator_config,
          rules,
        }),
      })
      showToast('Pension loan rules saved.', 'success')
      await load()
    } catch (e) {
      showToast(e.message || 'Failed to save pension loan rules.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsAccordion
      title="SSS / GSIS Pension Loan Rules"
      subtitle="Minimum remaining pension, interest rate, term cap, and pension multiplier used for auto-computed loanable amounts."
      icon={BadgePercent}
    >
      {loading ? (
        <p className={`text-sm ${admin.textMuted}`}>Loading pension product rules…</p>
      ) : !productId ? (
        <p className={`text-sm ${admin.textMuted}`}>SSS Pension Loan product not found. Seed loan products first.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid min-w-0 gap-5 md:grid-cols-2">
            <SettingsField label="Monthly interest rate (%)" htmlFor="pen-rate">
              <input
                id="pen-rate"
                className={`w-full ${settingsInputClass}`}
                value={form.interest_rate}
                onChange={(e) => onChange('interest_rate', e.target.value)}
                inputMode="decimal"
                disabled={readOnly}
              />
            </SettingsField>
            <SettingsField label="Maximum loan term (months)" htmlFor="pen-term">
              <input
                id="pen-term"
                className={`w-full ${settingsInputClass}`}
                value={form.max_term}
                onChange={(e) => onChange('max_term', e.target.value)}
                inputMode="numeric"
                disabled={readOnly}
              />
            </SettingsField>
            <SettingsField label="Default minimum remaining pension (₱)" htmlFor="pen-min-excess" helper="Fallback when SSS/GSIS-specific rules are not set. Typical range: ₱100 (SSS) to ₱300 (GSIS).">
              <input
                id="pen-min-excess"
                className={`w-full ${settingsInputClass}`}
                value={form.pension_retention_threshold}
                onChange={(e) => onChange('pension_retention_threshold', e.target.value)}
                inputMode="decimal"
                disabled={readOnly}
              />
            </SettingsField>
            <SettingsField label="Pension loan multiplier" htmlFor="pen-mult" helper="Secondary cap: monthly pension × multiplier.">
              <input
                id="pen-mult"
                className={`w-full ${settingsInputClass}`}
                value={form.pension_multiplier}
                onChange={(e) => onChange('pension_multiplier', e.target.value)}
                inputMode="decimal"
                disabled={readOnly}
              />
            </SettingsField>
            <SettingsField label="Maximum principal cap (₱)" htmlFor="pen-max" className="md:col-span-2">
              <input
                id="pen-max"
                className={`w-full ${settingsInputClass}`}
                value={form.max_principal}
                onChange={(e) => onChange('max_principal', e.target.value)}
                inputMode="decimal"
                disabled={readOnly}
              />
            </SettingsField>
          </div>
          <div>
            <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>Pension product rules (optional overrides)</p>
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <SettingsField label="SSS new loan — min remaining (₱)" htmlFor="pen-nw-sss">
                <input
                  id="pen-nw-sss"
                  className={`w-full ${settingsInputClass}`}
                  value={form.pension_retention_threshold_nw_sss}
                  onChange={(e) => onChange('pension_retention_threshold_nw_sss', e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                  placeholder="Uses default if empty"
                />
              </SettingsField>
              <SettingsField label="GSIS new loan — min remaining (₱)" htmlFor="pen-nw-gsis">
                <input
                  id="pen-nw-gsis"
                  className={`w-full ${settingsInputClass}`}
                  value={form.pension_retention_threshold_nw_gsis}
                  onChange={(e) => onChange('pension_retention_threshold_nw_gsis', e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                  placeholder="Uses default if empty"
                />
              </SettingsField>
              <SettingsField label="SSS reloan — min remaining (₱)" htmlFor="pen-rl-sss">
                <input
                  id="pen-rl-sss"
                  className={`w-full ${settingsInputClass}`}
                  value={form.pension_retention_threshold_rl_sss}
                  onChange={(e) => onChange('pension_retention_threshold_rl_sss', e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                  placeholder="Uses default if empty"
                />
              </SettingsField>
              <SettingsField label="GSIS reloan — min remaining (₱)" htmlFor="pen-rl-gsis">
                <input
                  id="pen-rl-gsis"
                  className={`w-full ${settingsInputClass}`}
                  value={form.pension_retention_threshold_rl_gsis}
                  onChange={(e) => onChange('pension_retention_threshold_rl_gsis', e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                  placeholder="Uses default if empty"
                />
              </SettingsField>
            </div>
          </div>
          {!readOnly ? (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save pension loan rules'}
            </button>
          ) : null}
        </div>
      )}
    </SettingsAccordion>
  )
}
