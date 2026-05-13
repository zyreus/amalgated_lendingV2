import { APPLICATION_NATURE } from './amalgatedApplicationFormState'
import CorporateLetterhead from '../CorporateLetterhead.jsx'

const LABEL = 'block text-xs font-medium text-slate-600 mb-1'
const INPUT = 'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-[#c41e3a] focus:outline-none focus:ring-1 focus:ring-[#c41e3a]'
const SECTION = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
const H3 = 'text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2'
const BRANCH_OPTIONS = ['Davao branch', 'Gensan', 'Mangagoy', 'Kidapawan', 'Manila']

function inputClass(hasError) {
  return hasError
    ? `${INPUT} border-red-500 ring-1 ring-red-500/20`
    : INPUT
}

function fieldError(errors, path) {
  const message = errors?.[path]
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null
}

function setPath(obj, path, value) {
  const next = { ...obj }
  const keys = path.split('.')
  let cur = next
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    cur[k] = { ...cur[k] }
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
  return next
}

function updateArray(arr, index, key, value) {
  const next = [...arr]
  next[index] = { ...next[index], [key]: value }
  return next
}

/**
 * Official Amalgated-style loan application layout (Business, Chattel, REM, Salary).
 * @param {object} props
 * @param {'business'|'chattel'|'real_estate'|'salary'|null} props.presetCategory - locks one loan type checkbox
 * @param {object} props.value
 * @param {function} props.onChange
 */
export default function AmalgatedLoanApplicationForm({
  presetCategory = null,
  value,
  onChange,
  loanTermOptions = null,
  loanTermFixed = null,
  fieldErrors = {},
}) {
  const v = value

  const patch = (path, val) => onChange(setPath(v, path, val))

  const toggleCategory = (key, checked) => {
    if (presetCategory) {
      const map = {
        business: 'businessLoan',
        chattel: 'chattelMortgage',
        real_estate: 'realEstateMortgage',
        salary: 'salaryLoan',
      }
      const locked = map[presetCategory]
      if (key === locked && !checked) return
      if (map[presetCategory] !== key) return
    }
    patch(`loan_categories.${key}`, checked)
  }

  const presetLocksOther =
    presetCategory &&
    {
      business: 'businessLoan',
      chattel: 'chattelMortgage',
      real_estate: 'realEstateMortgage',
      salary: 'salaryLoan',
    }[presetCategory]

  return (
    <div className="space-y-4 print:space-y-3">
      <CorporateLetterhead className="print:break-inside-avoid" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Official loan application (Amalgated format)</h2>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Branch & application type</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Branch *</label>
            <select
              data-field-path="branch_name"
              className={inputClass(fieldErrors.branch_name)}
              value={v.branch_name || ''}
              onChange={(e) => patch('branch_name', e.target.value)}
            >
              <option value="">Select branch…</option>
              {BRANCH_OPTIONS.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
            {fieldError(fieldErrors, 'branch_name')}
          </div>
          <div>
            <label className={LABEL}>Application nature *</label>
            <div
              data-field-path="application_nature"
              className={`flex flex-wrap gap-3 rounded-lg pt-1 ${fieldErrors.application_nature ? 'border border-red-500 px-3 py-2' : ''}`}
            >
              {[
                { id: APPLICATION_NATURE.NEW, label: 'New loan' },
                { id: APPLICATION_NATURE.RELOAN, label: 'Re-loan / renewal' },
                { id: APPLICATION_NATURE.RESTRUCTURED, label: 'Restructured' },
              ].map((opt) => (
                <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="app_nature"
                    checked={v.application_nature === opt.id}
                    onChange={() => patch('application_nature', opt.id)}
                    className="text-[#c41e3a] focus:ring-[#c41e3a]"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {fieldError(fieldErrors, 'application_nature')}
          </div>
        </div>

        <div className="mt-4">
          <label className={LABEL}>Loan category (check all that apply)</label>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {[
              { key: 'businessLoan', label: 'Business loans' },
              { key: 'chattelMortgage', label: 'Chattel mortgage' },
              { key: 'realEstateMortgage', label: 'Real estate mortgage' },
              { key: 'salaryLoan', label: 'Salary loan' },
            ].map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!v.loan_categories[key]}
                  disabled={presetLocksOther && presetLocksOther !== key}
                  onChange={(e) => toggleCategory(key, e.target.checked)}
                  className="rounded border-slate-300 text-[#c41e3a] focus:ring-[#c41e3a] disabled:opacity-50"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">Others (specify):</span>
            <input
              className={`${INPUT} max-w-md flex-1`}
              value={v.loan_categories.otherSpecify}
              onChange={(e) => patch('loan_categories.otherSpecify', e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Requested loan amount (Php) *</label>
            <input
              data-field-path="loan_principal_php"
              className={inputClass(fieldErrors.loan_principal_php)}
              type="number"
              min={1000}
              step="1000"
              value={v.loan_principal_php ?? ''}
              onChange={(e) => patch('loan_principal_php', e.target.value)}
            />
            {fieldError(fieldErrors, 'loan_principal_php')}
          </div>
          <div>
            <label className={LABEL}>Term (months) *</label>
            {loanTermFixed != null && loanTermFixed !== '' ? (
              <input data-field-path="loan_term_months" className={inputClass(fieldErrors.loan_term_months)} readOnly value={loanTermFixed} />
            ) : loanTermOptions?.length ? (
              <select
                data-field-path="loan_term_months"
                className={inputClass(fieldErrors.loan_term_months)}
                value={v.loan_term_months ?? ''}
                onChange={(e) => patch('loan_term_months', e.target.value)}
              >
                <option value="">Select…</option>
                {loanTermOptions.map((m) => (
                  <option key={m} value={String(m)}>
                    {m} months
                  </option>
                ))}
              </select>
            ) : (
              <input
                data-field-path="loan_term_months"
                className={inputClass(fieldErrors.loan_term_months)}
                type="number"
                min={1}
                value={v.loan_term_months ?? ''}
                onChange={(e) => patch('loan_term_months', e.target.value)}
              />
            )}
            {fieldError(fieldErrors, 'loan_term_months')}
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Applicant</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['applicant.name', 'Full name *'],
            ['applicant.email', 'Email (borrower portal) *'],
            ['applicant.mobile_phone', 'Mobile phone *'],
            ['applicant.age', 'Age'],
            ['applicant.civil_status', 'Civil status'],
            ['applicant.tin', 'TIN'],
            ['applicant.sss_gsis', 'SSS / GSIS No.'],
            ['applicant.philhealth', 'PhilHealth'],
          ].map(([path, lab]) => (
            <div key={path}>
              <label className={LABEL}>{lab}</label>
              <input
                data-field-path={path}
                className={inputClass(fieldErrors[path])}
                type={path.includes('email') ? 'email' : 'text'}
                autoComplete={path.includes('email') ? 'email' : path.includes('mobile') ? 'tel' : undefined}
                value={v.applicant[path.split('.')[1]]}
                onChange={(e) => patch(path, e.target.value)}
              />
              {fieldError(fieldErrors, path)}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>City</label>
            <input className={INPUT} value={v.applicant.city} onChange={(e) => patch('applicant.city', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Province</label>
            <input className={INPUT} value={v.applicant.province} onChange={(e) => patch('applicant.province', e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Business address</label>
            <textarea className={INPUT} rows={2} value={v.applicant.business_address} onChange={(e) => patch('applicant.business_address', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Tel. (business)</label>
            <input className={INPUT} value={v.applicant.business_tel} onChange={(e) => patch('applicant.business_tel', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Residence address *</label>
            <textarea
              data-field-path="applicant.residence_address"
              className={inputClass(fieldErrors['applicant.residence_address'])}
              rows={2}
              value={v.applicant.residence_address}
              onChange={(e) => patch('applicant.residence_address', e.target.value)}
            />
            {fieldError(fieldErrors, 'applicant.residence_address')}
          </div>
          <div>
            <label className={LABEL}>Tel. (residence)</label>
            <input className={INPUT} value={v.applicant.residence_tel} onChange={(e) => patch('applicant.residence_tel', e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>CTC No.</label>
            <input className={INPUT} value={v.applicant.ctc_number} onChange={(e) => patch('applicant.ctc_number', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>CTC date</label>
            <input className={INPUT} type="date" value={v.applicant.ctc_date} onChange={(e) => patch('applicant.ctc_date', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>CTC place</label>
            <input className={INPUT} value={v.applicant.ctc_place} onChange={(e) => patch('applicant.ctc_place', e.target.value)} />
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Spouse</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['spouse.name', 'Name'],
            ['spouse.age', 'Age'],
            ['spouse.sss', 'SSS No.'],
            ['spouse.ctc_number', 'CTC No.'],
            ['spouse.tin', 'TIN'],
            ['spouse.philhealth', 'PhilHealth'],
          ].map(([path, lab]) => (
            <div key={path}>
              <label className={LABEL}>{lab}</label>
              <input className={INPUT} value={v.spouse[path.split('.')[1]]} onChange={(e) => patch(path, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Spouse CTC date</label>
            <input className={INPUT} type="date" value={v.spouse.ctc_date} onChange={(e) => patch('spouse.ctc_date', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Spouse CTC place</label>
            <input className={INPUT} value={v.spouse.ctc_place} onChange={(e) => patch('spouse.ctc_place', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={SECTION}>
          <h3 className={H3}>Employed</h3>
          {[
            ['employed.employer_name', 'Employer name'],
            ['employed.address', 'Address'],
            ['employed.annual_salary', 'Annual salary'],
            ['employed.position', 'Position'],
            ['employed.length_of_service', 'Length of service'],
          ].map(([path, lab]) => (
            <div key={path} className="mb-2">
              <label className={LABEL}>{lab}</label>
              <input className={INPUT} value={v.employed[path.split('.')[1]]} onChange={(e) => patch(path, e.target.value)} />
            </div>
          ))}
        </div>
        <div className={SECTION}>
          <h3 className={H3}>If self-employed</h3>
          {[
            ['self_employed.firm_name', 'Firm / trade name'],
            ['self_employed.nature_of_business', 'Nature of business'],
            ['self_employed.address', 'Address'],
            ['self_employed.ownership', 'Sole owner / partner'],
            ['self_employed.capital_invested', 'Capital invested'],
          ].map(([path, lab]) => (
            <div key={path} className="mb-2">
              <label className={LABEL}>{lab}</label>
              <input className={INPUT} value={v.self_employed[path.split('.')[1]]} onChange={(e) => patch(path, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={SECTION}>
          <h3 className={H3}>Monthly salary / income (specify source)</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1 text-left">Description</th>
                <th className="w-28 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {v.monthly_income_rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1 pr-1">
                    <input className={INPUT} value={row.description} onChange={(e) => patch('monthly_income_rows', updateArray(v.monthly_income_rows, i, 'description', e.target.value))} />
                  </td>
                  <td className="py-1">
                    <input className={INPUT} value={row.amount} onChange={(e) => patch('monthly_income_rows', updateArray(v.monthly_income_rows, i, 'amount', e.target.value))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={SECTION}>
          <h3 className={H3}>Expenses (specify)</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1 text-left">Description</th>
                <th className="w-28 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {v.expense_rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1 pr-1">
                    <input className={INPUT} value={row.description} onChange={(e) => patch('expense_rows', updateArray(v.expense_rows, i, 'description', e.target.value))} />
                  </td>
                  <td className="py-1">
                    <input className={INPUT} value={row.amount} onChange={(e) => patch('expense_rows', updateArray(v.expense_rows, i, 'amount', e.target.value))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Residential information</h3>
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-sm text-slate-700">Do you own your residence?</span>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="home_own" checked={v.home_ownership === 'yes'} onChange={() => patch('home_ownership', 'yes')} className="text-[#c41e3a]" />
            Yes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="home_own" checked={v.home_ownership === 'no'} onChange={() => patch('home_ownership', 'no')} className="text-[#c41e3a]" />
            No
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Length of stay — years</label>
            <input className={INPUT} value={v.stay_years} onChange={(e) => patch('stay_years', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Months</label>
            <input className={INPUT} value={v.stay_months} onChange={(e) => patch('stay_months', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>No. of dependents</label>
            <input className={INPUT} value={v.dependents} onChange={(e) => patch('dependents', e.target.value)} />
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Other collateral (with other financing institutions)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1 text-left">Name of bank</th>
                <th className="py-1 text-left">Description of properties</th>
                <th className="py-1 text-left">Encumbrance / date</th>
                <th className="w-24 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {v.collateral_other.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {['bank', 'description', 'dateAvailed', 'amount'].map((k) => (
                    <td key={k} className="py-1 pr-1">
                      <input
                        className={INPUT}
                        value={row[k]}
                        onChange={(e) => patch('collateral_other', updateArray(v.collateral_other, i, k, e.target.value))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Credit information / bank references</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-1 text-left">Name of bank</th>
              <th className="py-1 text-left">Type of deposit</th>
              <th className="py-1 text-left">Accommodation</th>
            </tr>
          </thead>
          <tbody>
            {v.bank_references.map((row, i) => (
              <tr key={i} className="border-b border-slate-100">
                {['bank', 'depositType', 'accommodation'].map((k) => (
                  <td key={k} className="py-1 pr-1">
                    <input className={INPUT} value={row[k]} onChange={(e) => patch('bank_references', updateArray(v.bank_references, i, k, e.target.value))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Outstanding obligations</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1 text-left">Creditor</th>
                <th className="w-32 py-1">Role</th>
                <th className="py-1 text-right">Original amt.</th>
                <th className="py-1 text-right">Present balance</th>
                <th className="py-1">Maturity</th>
              </tr>
            </thead>
            <tbody>
              {v.outstanding_obligations.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1 pr-1">
                    <input className={INPUT} value={row.creditor} onChange={(e) => patch('outstanding_obligations', updateArray(v.outstanding_obligations, i, 'creditor', e.target.value))} />
                  </td>
                  <td className="py-1">
                    <select
                      className={INPUT}
                      value={row.role}
                      onChange={(e) => patch('outstanding_obligations', updateArray(v.outstanding_obligations, i, 'role', e.target.value))}
                    >
                      <option value="principal">As principal</option>
                      <option value="guarantor">As guarantor</option>
                    </select>
                  </td>
                  <td className="py-1">
                    <input className={INPUT} value={row.originalAmount} onChange={(e) => patch('outstanding_obligations', updateArray(v.outstanding_obligations, i, 'originalAmount', e.target.value))} />
                  </td>
                  <td className="py-1">
                    <input className={INPUT} value={row.presentBalance} onChange={(e) => patch('outstanding_obligations', updateArray(v.outstanding_obligations, i, 'presentBalance', e.target.value))} />
                  </td>
                  <td className="py-1">
                    <input className={INPUT} type="date" value={row.maturity} onChange={(e) => patch('outstanding_obligations', updateArray(v.outstanding_obligations, i, 'maturity', e.target.value))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${SECTION} print:break-inside-avoid`}>
        <h3 className={H3}>Certification</h3>
        <p className="text-xs leading-relaxed text-slate-600">
          I / we certify that the information furnished on this application is correct. It is agreed that Amalgated Lending Inc. may inquire into the correctness of the information submitted
          herein, and that these documents shall remain the property of Amalgated Lending Inc. whether or not the loan is granted.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Date</label>
            <input className={INPUT} type="date" value={v.certification_date} onChange={(e) => patch('certification_date', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Signature of applicant (type name if digital)</label>
            <input className={INPUT} value={v.applicant_signature_ack} onChange={(e) => patch('applicant_signature_ack', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Signature of spouse</label>
            <input className={INPUT} value={v.spouse_signature_ack} onChange={(e) => patch('spouse_signature_ack', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  )
}
