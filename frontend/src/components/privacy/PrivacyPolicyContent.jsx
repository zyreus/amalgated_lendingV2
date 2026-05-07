export const PRIVACY_POLICY_VERSION = '2026-04-28'

export default function PrivacyPolicyContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-black/80">
      <section>
        <h2 className="text-lg font-semibold text-black">1) Introduction</h2>
        <p className="mt-2">
          Amalgated Lending Inc. is committed to protecting your personal information in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">2) Information We Collect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Personal details (full name, birthdate, civil status, valid IDs)</li>
          <li>Contact details (mobile number, email, address)</li>
          <li>Financial and employment information (income, employer, business profile, pension data)</li>
          <li>Loan and repayment information (application details, schedules, payment records)</li>
          <li>Technical and usage data (device/browser data, cookies, security logs)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">3) How We Collect Information</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Directly from application forms and uploaded documents</li>
          <li>From support interactions (calls, chat, email)</li>
          <li>From verification and credit assessment activities with your consent</li>
          <li>From website and portal usage through cookies/security monitoring</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">4) Purpose of Collection</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Evaluate, process, and manage your loan application</li>
          <li>Identity verification, fraud prevention, and risk assessment</li>
          <li>Loan disbursement, billing, collections, and account servicing</li>
          <li>Regulatory reporting and legal compliance</li>
          <li>Service improvements and customer support</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">5) Data Use and Sharing</h2>
        <p className="mt-2">
          We use your data only for legitimate lending operations and compliance obligations. We may share information with authorized personnel, payment channels, verification providers, legal/regulatory authorities, and service providers under confidentiality and data protection obligations.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">6) Storage, Security, and Retention</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>SSL-encrypted transmission and controlled system access</li>
          <li>Secure servers, logging, and role-based permissions</li>
          <li>Retention based on legal, regulatory, and operational requirements</li>
          <li>Secure deletion or anonymization when no longer required</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">7) Your Rights</h2>
        <p className="mt-2">
          Subject to law, you may request access, correction, deletion, objection, or restriction of your personal data, and may raise privacy concerns through our support channels.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">8) Cookies and Tracking</h2>
        <p className="mt-2">
          We may use cookies and similar tools for session management, security, and service improvements. You may manage cookie preferences through your browser settings.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">9) Third-Party Service Providers</h2>
        <p className="mt-2">
          We may engage trusted vendors for hosting, communications, payments, analytics, and fraud controls. These providers are required to implement appropriate privacy and security safeguards.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-black">10) Contact for Privacy Concerns</h2>
        <p className="mt-2">
          For privacy concerns, requests, or complaints, contact: support@amalgatedlending.com
        </p>
      </section>
    </div>
  )
}
