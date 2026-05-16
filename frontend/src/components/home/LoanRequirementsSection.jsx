const requirements = [
  {
    type: 'Personal Loan',
    docs: ['1 valid government ID', 'Proof of income or cashflow', 'Proof of billing', 'Completed application form'],
    notes: 'Best for emergency, medical, and household needs.',
  },
  {
    type: 'Business Loan',
    docs: ['Valid ID', 'Business permit/registration (if applicable)', 'Store or business cashflow record', 'Proof of address'],
    notes: 'Designed for sari-sari stores, freelancers, and micro-entrepreneurs.',
  },
  {
    type: 'Salary Loan (ACI)',
    docs: ['Valid IDs (borrower and co-maker)', 'Recent payslip', 'Employment details', 'Proof of billing'],
    notes: 'Payroll-linked loan support with co-maker requirements.',
  },
  {
    type: 'SSS/GSIS Pension Loan',
    docs: ['Pension details', 'Valid ID', 'ATM/account details', 'Proof of billing'],
    notes: 'Age and pension-based validation applies.',
  },
]

export default function LoanRequirementsSection() {
  return (
    <section id="loan-requirements" className="app-container landing-section">
      <div className="landing-panel">
        <div className="landing-section-header">
          <p className="section-title">Loan Requirements</p>
          <h2 className="landing-section-heading">
            Clear documentary requirements by loan type.
          </h2>
          <p className="landing-section-lead">
            We keep requirements transparent so you can prepare confidently.
          </p>
        </div>
        <div className="landing-content-after-header landing-card-grid lg:grid-cols-2">
          {requirements.map((group) => (
            <article key={group.type} className="landing-inner-card">
              <h3 className="text-lg font-semibold text-brand-text">{group.type}</h3>
              <ul className="mt-4 flex-1 space-y-2 text-sm leading-relaxed text-brand-text/80">
                {group.docs.map((doc) => (
                  <li key={doc}>• {doc}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-brand-text/65">{group.notes}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
