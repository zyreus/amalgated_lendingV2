export default function SecurityPrivacySection() {
  return (
    <section id="security-privacy" className="app-container landing-section">
      <div className="landing-panel">
        <div className="landing-section-header mx-auto max-w-3xl text-center sm:mx-0 sm:max-w-none sm:text-left">
          <p className="section-title">Security & Privacy</p>
          <h2 className="landing-section-heading">
            Your information is handled with care.
          </h2>
        </div>
        <div className="landing-content-after-header landing-card-grid md:grid-cols-3">
          <article className="landing-inner-card">
            <h3 className="font-semibold text-brand-text">SSL Encryption</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-text/70">
              Borrower data is protected during transmission through encrypted connections.
            </p>
          </article>
          <article className="landing-inner-card">
            <h3 className="font-semibold text-brand-text">Data Privacy Act Compliance</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-text/70">
              We align handling of personal data with Philippine data privacy principles and internal controls.
            </p>
          </article>
          <article className="landing-inner-card">
            <h3 className="font-semibold text-brand-text">Confidential Review Process</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-text/70">
              Only authorized personnel can access applicant records for verification and servicing.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
