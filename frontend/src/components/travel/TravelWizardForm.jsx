import { TRAVEL_TERMS_TEXT, createEmptyDependent } from './travelWizardState.js'

const L = 'block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1.5'
const I =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#c41e3a] focus:ring-1 focus:ring-[#c41e3a]'
const CARD = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm'
const H2 = 'text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4'

function err(errors, key) {
  const m = errors?.[key]
  return m ? <p className="mt-1 text-xs text-red-600">{m}</p> : null
}

export default function TravelWizardForm({
  wizard,
  setWizard,
  errors = {},
  termsAccepted,
  setTermsAccepted,
  signatureDate,
  setSignatureDate,
  files,
  setFiles,
}) {
  const patch = (section, key, val) => {
    setWizard((w) => ({
      ...w,
      [section]: { ...w[section], [key]: val },
    }))
  }

  const addRow = (section) => {
    setWizard((w) => ({
      ...w,
      [section]: [...(w[section] || []), createEmptyDependent()],
    }))
  }

  const patchRow = (section, index, key, val) => {
    setWizard((w) => {
      const rows = [...(w[section] || [])]
      rows[index] = { ...rows[index], [key]: val }
      return { ...w, [section]: rows }
    })
  }

  const removeRow = (section, index) => {
    setWizard((w) => ({
      ...w,
      [section]: (w[section] || []).filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="space-y-6">
      <section className={CARD}>
        <h2 className={H2}>A. Loan details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={L}>Amount of loan (PHP) *</label>
            <input
              type="number"
              min="1000"
              step="1000"
              className={I}
              value={wizard.loan.amount_of_loan}
              onChange={(e) => patch('loan', 'amount_of_loan', e.target.value)}
            />
            {err(errors, 'loan.amount_of_loan')}
          </div>
          <div className="sm:col-span-2">
            <label className={L}>Purpose of loan *</label>
            <textarea
              rows={3}
              className={I}
              value={wizard.loan.purpose_of_loan}
              onChange={(e) => patch('loan', 'purpose_of_loan', e.target.value)}
              placeholder="Describe purpose (min. 10 characters)"
            />
            {err(errors, 'loan.purpose_of_loan')}
          </div>
          <div>
            <label className={L}>Desired term (months) *</label>
            <input type="text" readOnly className={`${I} bg-slate-50`} value="1 (monthly renewal)" />
            <input type="hidden" value={wizard.loan.desired_term} readOnly />
          </div>
          <div>
            <label className={L}>Country / destination *</label>
            <input className={I} value={wizard.loan.country_destination} onChange={(e) => patch('loan', 'country_destination', e.target.value)} />
            {err(errors, 'loan.country_destination')}
          </div>
          <div>
            <label className={L}>Travel date *</label>
            <input type="date" className={I} value={wizard.loan.travel_date} onChange={(e) => patch('loan', 'travel_date', e.target.value)} />
            {err(errors, 'loan.travel_date')}
          </div>
          <div>
            <label className={L}>Referred by</label>
            <input className={I} value={wizard.loan.referred_by} onChange={(e) => patch('loan', 'referred_by', e.target.value)} />
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>B. Personal data</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={L}>Email (borrower portal) *</label>
            <input type="email" className={I} autoComplete="email" value={wizard.personal.email} onChange={(e) => patch('personal', 'email', e.target.value)} />
            {err(errors, 'personal.email')}
          </div>
          <div>
            <label className={L}>Last name *</label>
            <input className={I} value={wizard.personal.last_name} onChange={(e) => patch('personal', 'last_name', e.target.value)} />
            {err(errors, 'personal.last_name')}
          </div>
          <div>
            <label className={L}>First name *</label>
            <input className={I} value={wizard.personal.first_name} onChange={(e) => patch('personal', 'first_name', e.target.value)} />
            {err(errors, 'personal.first_name')}
          </div>
          <div>
            <label className={L}>Middle name</label>
            <input className={I} value={wizard.personal.middle_name} onChange={(e) => patch('personal', 'middle_name', e.target.value)} />
          </div>
          <div>
            <label className={L}>Birthday *</label>
            <input type="date" className={I} value={wizard.personal.birthday} onChange={(e) => patch('personal', 'birthday', e.target.value)} />
            {err(errors, 'personal.birthday')}
          </div>
          <div>
            <label className={L}>Place of birth *</label>
            <input className={I} value={wizard.personal.place_of_birth} onChange={(e) => patch('personal', 'place_of_birth', e.target.value)} />
          </div>
          <div>
            <label className={L}>Civil status *</label>
            <select className={I} value={wizard.personal.civil_status} onChange={(e) => patch('personal', 'civil_status', e.target.value)}>
              <option value="">Select</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="separated">Separated</option>
              <option value="others">Others</option>
            </select>
          </div>
          <div>
            <label className={L}>Gender *</label>
            <select className={I} value={wizard.personal.gender} onChange={(e) => patch('personal', 'gender', e.target.value)}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className={L}>Citizenship *</label>
            <input className={I} value={wizard.personal.citizenship} onChange={(e) => patch('personal', 'citizenship', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={L}>Mother&apos;s maiden name *</label>
            <input className={I} value={wizard.personal.mother_maiden_name} onChange={(e) => patch('personal', 'mother_maiden_name', e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={L}>Home address *</label>
            <textarea rows={2} className={I} value={wizard.personal.home_address} onChange={(e) => patch('personal', 'home_address', e.target.value)} />
            {err(errors, 'personal.home_address')}
          </div>
          <div>
            <label className={L}>Barangay *</label>
            <input className={I} value={wizard.personal.barangay} onChange={(e) => patch('personal', 'barangay', e.target.value)} />
          </div>
          <div>
            <label className={L}>City *</label>
            <input className={I} value={wizard.personal.city} onChange={(e) => patch('personal', 'city', e.target.value)} />
            {err(errors, 'personal.city')}
          </div>
          <div>
            <label className={L}>Province *</label>
            <input className={I} value={wizard.personal.province} onChange={(e) => patch('personal', 'province', e.target.value)} />
            {err(errors, 'personal.province')}
          </div>
          <div>
            <label className={L}>ZIP code *</label>
            <input className={I} value={wizard.personal.zip_code} onChange={(e) => patch('personal', 'zip_code', e.target.value)} />
          </div>
          <div>
            <label className={L}>Move-in date *</label>
            <input type="date" className={I} value={wizard.personal.move_in_date} onChange={(e) => patch('personal', 'move_in_date', e.target.value)} />
          </div>
          <div>
            <label className={L}>Residence type *</label>
            <select className={I} value={wizard.personal.residence_type} onChange={(e) => patch('personal', 'residence_type', e.target.value)}>
              <option value="">Select</option>
              <option value="owned">Owned</option>
              <option value="mortgaged">Mortgaged</option>
              <option value="rented">Rented</option>
              <option value="with_relatives">With relatives</option>
            </select>
          </div>
          <div>
            <label className={L}>Telephone no.</label>
            <input className={I} value={wizard.personal.telephone_no} onChange={(e) => patch('personal', 'telephone_no', e.target.value)} />
          </div>
          <div>
            <label className={L}>Mobile no. *</label>
            <input className={I} autoComplete="tel" value={wizard.personal.mobile_no} onChange={(e) => patch('personal', 'mobile_no', e.target.value)} />
            {err(errors, 'personal.mobile_no')}
          </div>
          <div className="sm:col-span-2">
            <label className={L}>Provincial address</label>
            <textarea rows={2} className={I} value={wizard.personal.provincial_address} onChange={(e) => patch('personal', 'provincial_address', e.target.value)} />
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>C. Employment information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={L}>Employment type *</label>
            <select className={I} value={wizard.employment.employment_type} onChange={(e) => patch('employment', 'employment_type', e.target.value)}>
              <option value="">Select</option>
              <option value="employed">Employed</option>
              <option value="self-employed">Self-employed</option>
              <option value="others">Others</option>
            </select>
          </div>
          <div>
            <label className={L}>TIN *</label>
            <input className={I} value={wizard.employment.tin} onChange={(e) => patch('employment', 'tin', e.target.value)} />
            {err(errors, 'employment.tin')}
          </div>
          <div>
            <label className={L}>SSS / GSIS *</label>
            <input
              className={I}
              value={wizard.employment.sss_gsis}
              onChange={(e) => patch('employment', 'sss_gsis', e.target.value)}
            />
            {err(errors, 'employment.sss_gsis')}
          </div>
          <div className="sm:col-span-2">
            <label className={L}>Employer name *</label>
            <input className={I} value={wizard.employment.employer_name} onChange={(e) => patch('employment', 'employer_name', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={L}>Employer address *</label>
            <textarea rows={2} className={I} value={wizard.employment.employer_address} onChange={(e) => patch('employment', 'employer_address', e.target.value)} />
          </div>
          <div>
            <label className={L}>Employer tel. *</label>
            <input className={I} value={wizard.employment.employer_tel} onChange={(e) => patch('employment', 'employer_tel', e.target.value)} />
          </div>
          <div>
            <label className={L}>Start date *</label>
            <input type="date" className={I} value={wizard.employment.start_date} onChange={(e) => patch('employment', 'start_date', e.target.value)} />
          </div>
          <div>
            <label className={L}>Position *</label>
            <input className={I} value={wizard.employment.position} onChange={(e) => patch('employment', 'position', e.target.value)} />
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>D. Spouse information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['spouse_name', 'Spouse name'],
            ['spouse_employment_type', 'Spouse employment type'],
            ['spouse_sss', 'Spouse SSS'],
            ['spouse_employer_name', 'Spouse employer'],
            ['spouse_employer_address', 'Spouse employer address'],
            ['spouse_tel', 'Spouse telephone'],
            ['spouse_position', 'Spouse position'],
          ].map(([k, lab]) => (
            <div key={k} className={k.includes('address') ? 'sm:col-span-2' : ''}>
              <label className={L}>{lab}</label>
              {k.includes('address') ? (
                <textarea rows={2} className={I} value={wizard.spouse[k]} onChange={(e) => patch('spouse', k, e.target.value)} />
              ) : (
                <input className={I} value={wizard.spouse[k]} onChange={(e) => patch('spouse', k, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>E. Dependents</h2>
        {(wizard.dependents || []).map((row, i) => (
          <div key={i} className="mb-4 grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-3">
            <div>
              <label className={L}>Name</label>
              <input className={I} value={row.name} onChange={(e) => patchRow('dependents', i, 'name', e.target.value)} />
            </div>
            <div>
              <label className={L}>Birthdate</label>
              <input type="date" className={I} value={row.birthdate} onChange={(e) => patchRow('dependents', i, 'birthdate', e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className={L}>School / work</label>
              <input className={I} value={row.school_or_work} onChange={(e) => patchRow('dependents', i, 'school_or_work', e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <button type="button" onClick={() => removeRow('dependents', i)} className="text-xs font-semibold text-red-600 hover:underline">
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addRow('dependents')} className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          + Add dependent
        </button>
      </section>

      <section className={CARD}>
        <h2 className={H2}>F. Contact persons (not living with applicant)</h2>
        {(wizard.contact_persons || []).map((row, i) => (
          <div key={i} className="mb-4 grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-3">
            <div>
              <label className={L}>Name</label>
              <input className={I} value={row.name} onChange={(e) => patchRow('contact_persons', i, 'name', e.target.value)} />
            </div>
            <div>
              <label className={L}>Birthdate</label>
              <input type="date" className={I} value={row.birthdate} onChange={(e) => patchRow('contact_persons', i, 'birthdate', e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className={L}>School / work</label>
              <input className={I} value={row.school_or_work} onChange={(e) => patchRow('contact_persons', i, 'school_or_work', e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <button type="button" onClick={() => removeRow('contact_persons', i)} className="text-xs font-semibold text-red-600 hover:underline">
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addRow('contact_persons')} className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          + Add contact person
        </button>
      </section>

      <section className={CARD}>
        <h2 className={H2}>G. Sketch of residence</h2>
        <label className={L}>Upload image</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          onChange={(e) => setFiles((f) => ({ ...f, residence_sketch: e.target.files?.[0] || null }))}
        />
        {files?.residence_sketch ? <p className="mt-1 text-xs text-slate-500">{files.residence_sketch.name}</p> : null}
        {err(errors, 'files.residence_sketch')}
      </section>

      <section className={CARD}>
        <h2 className={H2}>Loan requirements (uploads)</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={L}>Passport photos (3 images)</label>
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                type="file"
                accept="image/jpeg,image/png"
                className="mt-2 block w-full text-sm"
                onChange={(e) => {
                  const list = [...(files.passport_photos || [null, null, null])]
                  list[i] = e.target.files?.[0] || null
                  setFiles((f) => ({ ...f, passport_photos: list }))
                }}
              />
            ))}
          </div>
          <div>
            <label className={L}>Passport copy</label>
            <input type="file" accept="image/jpeg,image/png,application/pdf" className="mt-1 block w-full text-sm" onChange={(e) => setFiles((f) => ({ ...f, passport_copy: e.target.files?.[0] || null }))} />
          </div>
          <div>
            <label className={L}>Valid IDs (2 uploads)</label>
            <input type="file" className="mt-1 block w-full text-sm" onChange={(e) => setFiles((f) => ({ ...f, valid_id_1: e.target.files?.[0] || null }))} />
            <input type="file" className="mt-2 block w-full text-sm" onChange={(e) => setFiles((f) => ({ ...f, valid_id_2: e.target.files?.[0] || null }))} />
          </div>
          <div>
            <label className={L}>Community tax certificate</label>
            <input type="file" accept="image/jpeg,image/png,application/pdf" className="mt-1 block w-full text-sm" onChange={(e) => setFiles((f) => ({ ...f, community_tax_certificate: e.target.files?.[0] || null }))} />
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>H. Signature date</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={L}>Date *</label>
            <input type="date" className={I} value={signatureDate} onChange={(e) => setSignatureDate(e.target.value)} />
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>Terms and conditions</h2>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
          {TRAVEL_TERMS_TEXT}
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#c41e3a] focus:ring-[#c41e3a]"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          <span className="text-sm text-slate-800">I agree to the Terms and Conditions *</span>
        </label>
        {err(errors, 'terms')}
      </section>
    </div>
  )
}
