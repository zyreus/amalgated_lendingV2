import { APPLICATION_NATURE } from './amalgatedApplicationFormState.js'

const BRAND_LOGO_PATH = '/amalgated-lending-logo.png'

const NATURE_LABEL = {
  [APPLICATION_NATURE.NEW]: 'New loan',
  [APPLICATION_NATURE.RELOAN]: 'Re-loan / renewal',
  [APPLICATION_NATURE.RESTRUCTURED]: 'Restructured',
}

function hasTruthyObjectValues(obj) {
  if (!obj || typeof obj !== 'object') return false
  return Object.values(obj).some((val) => {
    if (val === false || val === 0) return false
    return val !== '' && val != null && val !== undefined
  })
}

function hasRowsWithContent(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false
  return rows.some((row) => {
    if (!row || typeof row !== 'object') return false
    return Object.values(row).some((cell) => String(cell ?? '').trim() !== '')
  })
}

function Cell({ children }) {
  return <td className="border border-slate-300 px-2 py-1 align-top text-xs text-black">{children}</td>
}

function Th({ children, className = '' }) {
  return (
    <th className={`border border-slate-300 bg-slate-100 px-2 py-1 text-left text-xs font-semibold text-black ${className}`}>{children}</th>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h2 className="mb-2 border-b border-slate-400 pb-1 text-sm font-bold text-black">{title}</h2>
      {children}
    </section>
  )
}

function valueOrBlank(value) {
  const text = String(value ?? '').trim()
  return text === '' ? <span className="text-transparent">.</span> : text
}

function labelize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function InfoRow({ label, value }) {
  return (
    <tr>
      <Th className="w-[30%]">{label}</Th>
      <Cell>{valueOrBlank(value)}</Cell>
    </tr>
  )
}

function TwoColInfoTable({ rows }) {
  return (
    <table className="w-full border-collapse text-xs">
      <tbody>
        {rows.map(([label, value]) => (
          <InfoRow key={label} label={label} value={value} />
        ))}
      </tbody>
    </table>
  )
}

function PrintHeader({ title = 'Loan Application' }) {
  return (
    <header className="mb-5 border-b-2 border-black pb-3 text-center">
      <div className="mb-2 flex items-center justify-center gap-3">
        <img src={BRAND_LOGO_PATH} alt="Amalgated Lending Inc." className="h-12 w-12 object-contain" />
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wide">Amalgated Lending Inc.</h1>
          <p className="text-xs">Trusted Lending Solutions</p>
        </div>
      </div>
      <p className="text-base font-bold uppercase">{title}</p>
    </header>
  )
}

function PrintFooter() {
  return (
    <footer className="mt-6 border-t border-slate-400 pt-2 text-center text-[10px] text-black">
      <span>Amalgated Lending Inc. Loan Application</span>
      <span className="mx-2">|</span>
      <span className="print-page-number"></span>
    </footer>
  )
}

function ApplicationPrintView({ ext, applicantSignatureData }) {
  const v = ext || {}
  const px = v.product_extra || {}
  const lc = v.loan_categories || {}
  const cats = [
    lc.businessLoan && 'Business loans',
    lc.chattelMortgage && 'Chattel mortgage',
    lc.realEstateMortgage && 'Real estate mortgage',
    lc.salaryLoan && 'Salary loan',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="font-sans text-black">
      <PrintHeader />

      <Section title="Branch & application type">
        <TwoColInfoTable
          rows={[
            ['Branch', v.branch_name],
            ['Application nature', NATURE_LABEL[v.application_nature] || v.application_nature],
            ['Loan category', `${cats}${lc.otherSpecify ? `${cats ? ' — ' : ''}Others: ${lc.otherSpecify}` : ''}`],
            ['Requested loan amount (Php)', v.loan_principal_php],
            ['Term (months)', v.loan_term_months],
          ]}
        />
      </Section>

      <Section title="Borrower details">
        <TwoColInfoTable
          rows={[
            ['Name', v.applicant?.name],
            ['Email', v.applicant?.email],
            ['Mobile number', v.applicant?.mobile_phone],
            ['Age', v.applicant?.age],
            ['Civil status', v.applicant?.civil_status],
            ['TIN', v.applicant?.tin],
            ['City', v.applicant?.city],
            ['Province', v.applicant?.province],
            ['Residence address', v.applicant?.residence_address],
            ['Residence contact no.', v.applicant?.residence_tel],
            ['Business address', v.applicant?.business_address],
            ['Business contact no.', v.applicant?.business_tel],
            ['SSS / GSIS No.', v.applicant?.sss_gsis],
            ['PhilHealth', v.applicant?.philhealth],
            ['CTC No.', v.applicant?.ctc_number],
            ['CTC date', v.applicant?.ctc_date],
            ['CTC place', v.applicant?.ctc_place],
          ]}
        />
      </Section>

      {hasTruthyObjectValues(px) ? (
        <Section title="Loan product details">
          <TwoColInfoTable
            rows={Object.entries(px).map(([key, val]) => [labelize(key), val])}
          />
        </Section>
      ) : null}

      {hasTruthyObjectValues(v.spouse) ? (
        <Section title="Spouse">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {Object.entries(v.spouse || {}).map(([k, val]) => (
                <tr key={k}>
                  <Th className="capitalize">{k.replace(/_/g, ' ')}</Th>
                  <Cell>{val}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {hasTruthyObjectValues(v.employed) ? (
        <Section title="Employed">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {Object.entries(v.employed || {}).map(([k, val]) => (
                <tr key={k}>
                  <Th className="capitalize">{k.replace(/_/g, ' ')}</Th>
                  <Cell>{val}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {hasTruthyObjectValues(v.self_employed) ? (
        <Section title="Self-employed">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {Object.entries(v.self_employed || {}).map(([k, val]) => (
                <tr key={k}>
                  <Th className="capitalize">{k.replace(/_/g, ' ')}</Th>
                  <Cell>{val}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {hasRowsWithContent(v.monthly_income_rows) ? (
        <Section title="Monthly income">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {(v.monthly_income_rows || []).map((row, i) => (
                <tr key={i}>
                  <Cell>{row.description}</Cell>
                  <Cell>{row.amount}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {hasRowsWithContent(v.expense_rows) ? (
        <Section title="Expenses">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {(v.expense_rows || []).map((row, i) => (
                <tr key={i}>
                  <Cell>{row.description}</Cell>
                  <Cell>{row.amount}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {[v.home_ownership, v.stay_years, v.stay_months, v.dependents].some((x) => String(x ?? '').trim() !== '') ? (
        <Section title="Residential information">
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <Th>Own residence</Th>
                <Cell>{v.home_ownership}</Cell>
              </tr>
              <tr>
                <Th>Length of stay</Th>
                <Cell>
                  {v.stay_years} yr(s) {v.stay_months} mo(s)
                </Cell>
              </tr>
              <tr>
                <Th>Dependents</Th>
                <Cell>{v.dependents}</Cell>
              </tr>
            </tbody>
          </table>
        </Section>
      ) : null}

      {hasRowsWithContent(v.collateral_other) ? (
        <Section title="Other collateral">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>Bank</Th>
                <Th>Description</Th>
                <Th>Date / encumbrance</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {(v.collateral_other || []).map((row, i) => (
                <tr key={i}>
                  <Cell>{row.bank}</Cell>
                  <Cell>{row.description}</Cell>
                  <Cell>{row.dateAvailed}</Cell>
                  <Cell>{row.amount}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {hasRowsWithContent(v.bank_references) ? (
        <Section title="Bank references">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>Bank</Th>
                <Th>Deposit type</Th>
                <Th>Accommodation</Th>
              </tr>
            </thead>
            <tbody>
              {(v.bank_references || []).map((row, i) => (
                <tr key={i}>
                  <Cell>{row.bank}</Cell>
                  <Cell>{row.depositType}</Cell>
                  <Cell>{row.accommodation}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {hasRowsWithContent(v.outstanding_obligations) ? (
        <Section title="Outstanding obligations">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>Creditor</Th>
                <Th>Role</Th>
                <Th>Original</Th>
                <Th>Balance</Th>
                <Th>Maturity</Th>
              </tr>
            </thead>
            <tbody>
              {(v.outstanding_obligations || []).map((row, i) => (
                <tr key={i}>
                  <Cell>{row.creditor}</Cell>
                  <Cell>{row.role}</Cell>
                  <Cell>{row.originalAmount}</Cell>
                  <Cell>{row.presentBalance}</Cell>
                  <Cell>{row.maturity}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      <Section title="Certification">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <InfoRow label="Date" value={v.certification_date} />
            <tr>
              <Th>Applicant signature</Th>
              <Cell>
                {applicantSignatureData ? (
                  <img src={applicantSignatureData} alt="Applicant signature" className="h-14 w-auto object-contain" />
                ) : (
                  valueOrBlank(v.applicant_signature_ack)
                )}
              </Cell>
            </tr>
            <InfoRow label="Spouse signature" value={v.spouse_signature_ack} />
          </tbody>
        </table>
      </Section>

      <PrintFooter />
    </div>
  )
}

function CoMakerPrintView({ cm }) {
  const v = cm || {}
  return (
    <div className="mt-8 border-t-2 border-black pt-6 font-sans text-black">
      <PrintHeader title="Co-maker Statement" />

      <Section title="Agreement">
        <p className="text-xs leading-relaxed">
          Co-maker for applicant: <strong>{valueOrBlank(v.applicant_name_ref)}</strong> — requested loan: Php <strong>{valueOrBlank(v.requested_loan_php)}</strong>
        </p>
      </Section>

      <Section title="Co-maker — personal">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {['name', 'email', 'age', 'status', 'tin', 'business_address', 'business_tel', 'sss_gsis', 'residence_address', 'residence_tel', 'philhealth', 'ctc_number', 'ctc_date', 'ctc_place'].map(
              (k) => (
                <tr key={k}>
                  <Th className="capitalize">{k.replace(/_/g, ' ')}</Th>
                  <Cell>{valueOrBlank(v[k])}</Cell>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Co-maker — spouse">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {Object.entries(v.spouse || {}).map(([k, val]) => (
              <tr key={k}>
                <Th className="capitalize">{k.replace(/_/g, ' ')}</Th>
                <Cell>{valueOrBlank(val)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Dependents & residence">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <Th>Dependents</Th>
              <Cell>{valueOrBlank(v.dependents)}</Cell>
            </tr>
            <tr>
              <Th>Own residence</Th>
              <Cell>{valueOrBlank(v.home_ownership)}</Cell>
            </tr>
            <tr>
              <Th>Length of stay</Th>
              <Cell>
                {valueOrBlank(v.stay_years)} yr(s) {valueOrBlank(v.stay_months)} mo(s)
              </Cell>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Co-maker — employed">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {Object.entries(v.employed || {}).map(([k, val]) => (
              <tr key={k}>
                <Th className="capitalize">{k.replace(/_/g, ' ')}</Th>
                <Cell>{valueOrBlank(val)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Co-maker — self-employed">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {Object.entries(v.self_employed || {}).map(([k, val]) => (
              <tr key={k}>
                <Th className="capitalize">{k.replace(/_/g, ' ')}</Th>
                <Cell>{valueOrBlank(val)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Co-maker — collateral">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>Bank</Th>
              <Th>Properties</Th>
              <Th>Encumbrance / date</Th>
              <Th>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {(v.collateral_other || []).map((row, i) => (
              <tr key={i}>
                <Cell>{row.bank}</Cell>
                <Cell>{valueOrBlank(row.description)}</Cell>
                <Cell>{valueOrBlank(row.dateAvailed)}</Cell>
                <Cell>{valueOrBlank(row.amount)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Co-maker — bank references">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>Bank</Th>
              <Th>Deposit</Th>
              <Th>Accommodation</Th>
            </tr>
          </thead>
          <tbody>
            {(v.bank_references || []).map((row, i) => (
              <tr key={i}>
                <Cell>{row.bank}</Cell>
                <Cell>{valueOrBlank(row.depositType)}</Cell>
                <Cell>{valueOrBlank(row.accommodation)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Co-maker — obligations">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>Creditor</Th>
              <Th>Role</Th>
              <Th>Original</Th>
              <Th>Balance</Th>
              <Th>Maturity</Th>
            </tr>
          </thead>
          <tbody>
            {(v.outstanding_obligations || []).map((row, i) => (
              <tr key={i}>
                <Cell>{row.creditor}</Cell>
                <Cell>{valueOrBlank(row.role)}</Cell>
                <Cell>{valueOrBlank(row.originalAmount)}</Cell>
                <Cell>{valueOrBlank(row.presentBalance)}</Cell>
                <Cell>{valueOrBlank(row.maturity)}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Co-maker — signatures">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <Th>Date</Th>
              <Cell>{valueOrBlank(v.certification_date)}</Cell>
            </tr>
            <tr>
              <Th>Co-maker signature</Th>
              <Cell>{valueOrBlank(v.signature_applicant)}</Cell>
            </tr>
            <tr>
              <Th>Spouse signature</Th>
              <Cell>{valueOrBlank(v.signature_spouse)}</Cell>
            </tr>
          </tbody>
        </table>
      </Section>

      <PrintFooter />
    </div>
  )
}

/**
 * Print control + hidden print layout.
 */
export default function AmalgatedApplicationPrintBundle({
  extendedApplication,
  coMakerStatement,
  includeCoMaker,
  canPrint = true,
  applicantSignatureData = '',
}) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <div className="no-print mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Print application form</p>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
              {canPrint ? 'Open a clean print-ready copy of this application.' : 'Print is available after completing the required fields.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!canPrint}
            className="shrink-0 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Print application form
          </button>
        </div>
      </div>

      <div id="loan-application-print-root" className="print-only-amalg">
        <ApplicationPrintView ext={extendedApplication} applicantSignatureData={applicantSignatureData} />
        {includeCoMaker ? <CoMakerPrintView cm={coMakerStatement} /> : null}
      </div>
    </>
  )
}
