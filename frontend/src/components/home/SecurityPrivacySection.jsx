export default function SecurityPrivacySection() {
  return (
    <section id="security-privacy" className="app-container py-8 sm:py-12">
      <div className="surface-card-light p-6 sm:p-7">
        <p className="section-title">Security & Privacy</p>
        <h2 className="mt-2 text-3xl font-semibold text-brand-text">Your information is handled with care.</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-black/10 bg-white p-4">
            <h3 className="font-semibold">SSL Encryption</h3>
            <p className="mt-2 text-sm text-brand-text/70">Borrower data is protected during transmission through encrypted connections.</p>
          </article>
          <article className="rounded-xl border border-black/10 bg-white p-4">
            <h3 className="font-semibold">Data Privacy Act Compliance</h3>
            <p className="mt-2 text-sm text-brand-text/70">We align handling of personal data with Philippine data privacy principles and internal controls.</p>
          </article>
          <article className="rounded-xl border border-black/10 bg-white p-4">
            <h3 className="font-semibold">Confidential Review Process</h3>
            <p className="mt-2 text-sm text-brand-text/70">Only authorized personnel can access applicant records for verification and servicing.</p>
          </article>
        </div>
      </div>
    </section>
  )
}
