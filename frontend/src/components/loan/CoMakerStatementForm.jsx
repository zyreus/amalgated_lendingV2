const LABEL = 'block text-xs font-medium text-slate-600 mb-1'
const INPUT = 'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-[#c41e3a] focus:outline-none focus:ring-1 focus:ring-[#c41e3a]'
const SECTION = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
const H3 = 'text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2'

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
 * Co-maker statement (Amalgated format).
 * Optional: prefill applicant name and loan amount for display (parent can also merge into `value` on submit).
 */
export default function CoMakerStatementForm({ value, onChange, prefillApplicantName = '', prefillLoanAmount = '', fieldErrors = {} }) {
  const v = value

  const patch = (path, val) => onChange(setPath(v, path, val))

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Co-maker statement</h2>
      </div>

      <div className={SECTION}>
        <p className="text-xs leading-relaxed text-slate-700">
          I agree to be the co-maker of the applicant named below for the requested loan amount. I understand that I may be jointly and solidarily liable
          according to the terms approved by Amalgated Lending Inc.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Applicant name</label>
            <input
              className={INPUT}
              value={v.applicant_name_ref}
              onChange={(e) => patch('applicant_name_ref', e.target.value)}
              placeholder={prefillApplicantName || undefined}
            />
          </div>
          <div>
            <label className={LABEL}>Requested loan (Php)</label>
            <input
              className={INPUT}
              value={v.requested_loan_php}
              onChange={(e) => patch('requested_loan_php', e.target.value)}
              placeholder={prefillLoanAmount ? String(prefillLoanAmount) : undefined}
            />
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Co-maker — personal information</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['name', 'Full name *'],
            ['email', 'Email *'],
            ['age', 'Age'],
            ['status', 'Civil status'],
            ['tin', 'TIN'],
            ['business_address', 'Business address'],
            ['business_tel', 'Tel. (business) *'],
            ['sss_gsis', 'SSS / GSIS'],
            ['residence_address', 'Residence address'],
            ['residence_tel', 'Tel. (residence) *'],
            ['philhealth', 'PhilHealth'],
          ].map(([key, lab]) => (
            <div key={key}>
              <label className={LABEL}>{lab}</label>
              <input
                data-field-path={key === 'business_tel' || key === 'residence_tel' ? 'coMakerStatement.phone' : `coMakerStatement.${key}`}
                className={inputClass(
                  fieldErrors[`coMakerStatement.${key}`] ||
                  ((key === 'business_tel' || key === 'residence_tel') && fieldErrors['coMakerStatement.phone'])
                )}
                type={key === 'email' ? 'email' : 'text'}
                autoComplete={key === 'email' ? 'email' : undefined}
                value={v[key]}
                onChange={(e) => patch(key, e.target.value)}
              />
              {key === 'name' ? fieldError(fieldErrors, 'coMakerStatement.name') : null}
              {key === 'email' ? fieldError(fieldErrors, 'coMakerStatement.email') : null}
              {key === 'residence_tel' ? fieldError(fieldErrors, 'coMakerStatement.phone') : null}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>CTC No.</label>
            <input className={INPUT} value={v.ctc_number} onChange={(e) => patch('ctc_number', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>CTC date</label>
            <input className={INPUT} type="date" value={v.ctc_date} onChange={(e) => patch('ctc_date', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>CTC place</label>
            <input className={INPUT} value={v.ctc_place} onChange={(e) => patch('ctc_place', e.target.value)} />
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Co-maker&apos;s spouse</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['spouse.name', 'Name'],
            ['spouse.age', 'Age'],
            ['spouse.sss_gsis', 'SSS / GSIS'],
            ['spouse.ctc_number', 'CTC No.'],
            ['spouse.tin', 'TIN'],
            ['spouse.philhealth', 'PhilHealth'],
          ].map(([path, lab]) => {
            const leaf = path.split('.')[1]
            return (
              <div key={path}>
                <label className={LABEL}>{lab}</label>
                <input className={INPUT} value={v.spouse[leaf]} onChange={(e) => patch(path, e.target.value)} />
              </div>
            )
          })}
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

      <div className={SECTION}>
        <h3 className={H3}>Dependents & residence</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={LABEL}>No. of dependents</label>
            <input className={INPUT} value={v.dependents} onChange={(e) => patch('dependents', e.target.value)} />
          </div>
          <div className="flex flex-wrap items-end gap-4 pb-2">
            <span className="text-xs text-slate-600">Own residence?</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="cm_home" checked={v.home_ownership === 'yes'} onChange={() => patch('home_ownership', 'yes')} className="text-[#c41e3a]" />
              Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="cm_home" checked={v.home_ownership === 'no'} onChange={() => patch('home_ownership', 'no')} className="text-[#c41e3a]" />
              No
            </label>
          </div>
          <div>
            <label className={LABEL}>Stay — years</label>
            <input className={INPUT} value={v.stay_years} onChange={(e) => patch('stay_years', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Months</label>
            <input className={INPUT} value={v.stay_months} onChange={(e) => patch('stay_months', e.target.value)} />
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
          ].map(([path, lab]) => {
            const leaf = path.split('.')[1]
            return (
              <div key={path} className="mb-2">
                <label className={LABEL}>{lab}</label>
                <input className={INPUT} value={v.employed[leaf]} onChange={(e) => patch(path, e.target.value)} />
              </div>
            )
          })}
        </div>
        <div className={SECTION}>
          <h3 className={H3}>If self-employed</h3>
          {[
            ['self_employed.firm_name', 'Firm / trade name'],
            ['self_employed.nature_of_business', 'Nature of business'],
            ['self_employed.address', 'Address'],
            ['self_employed.ownership', 'Sole owner / partner'],
            ['self_employed.capital_invested', 'Capital invested'],
          ].map(([path, lab]) => {
            const leaf = path.split('.')[1]
            return (
              <div key={path} className="mb-2">
                <label className={LABEL}>{lab}</label>
                <input className={INPUT} value={v.self_employed[leaf]} onChange={(e) => patch(path, e.target.value)} />
              </div>
            )
          })}
        </div>
      </div>

      <div className={SECTION}>
        <h3 className={H3}>Other collateral (other financing institutions)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1 text-left">Bank</th>
                <th className="py-1 text-left">Properties</th>
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
        <h3 className={H3}>Bank references</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-1 text-left">Bank</th>
              <th className="py-1 text-left">Deposit type</th>
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
                <th className="py-1 text-right">Original</th>
                <th className="py-1 text-right">Balance</th>
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
                      <option value="principal">Principal</option>
                      <option value="guarantor">Guarantor</option>
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
        <h3 className={H3}>Signatures</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Date</label>
            <input className={INPUT} type="date" value={v.certification_date} onChange={(e) => patch('certification_date', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Co-maker signature (type name if digital)</label>
            <input className={INPUT} value={v.signature_applicant} onChange={(e) => patch('signature_applicant', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Co-maker&apos;s spouse</label>
            <input className={INPUT} value={v.signature_spouse} onChange={(e) => patch('signature_spouse', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  )
}
