const faqs = [
  ['What are the interest rates?', 'Rates vary by loan product. You can use our calculator to preview rates and repayment estimates before applying.'],
  ['Do you require collateral?', 'Some products may require collateral while others do not. Requirements depend on loan type and assessment results.'],
  ['What is the minimum and maximum loan amount?', 'Loan limits depend on selected product, term, and profile assessment. Product constraints are shown in the calculator.'],
  ['How long does approval take?', 'Qualified applications are typically processed within 24-48 hours, subject to document completeness and verification.'],
  ['Can I apply if I have a bad credit score?', 'Yes, you may still apply. Final decision depends on multiple factors including income stability and document verification.'],
  ['Is my information safe and confidential?', 'Yes. We use secure transmission channels and limit data access to authorized staff only.'],
  ['What are the penalties for late payment?', 'Late penalties depend on your product terms and schedule. Exact details are disclosed in your loan agreement and SOA.'],
  ['Can I pay early without penalty?', 'Early repayment options may be available depending on product terms. Please confirm with our support team before settlement.'],
]

export default function FaqSection() {
  return (
    <section id="faqs" className="app-container py-8 sm:py-12">
      <div className="surface-card-light p-6 sm:p-7">
        <p className="section-title">FAQs</p>
        <h2 className="mt-2 text-3xl font-semibold text-brand-text">Frequently Asked Questions</h2>
        <div className="mt-5 space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-black/10 bg-white p-4 open:shadow-sm">
              <summary className="cursor-pointer list-none pr-6 text-sm font-semibold text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
                {q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-brand-text/75">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
