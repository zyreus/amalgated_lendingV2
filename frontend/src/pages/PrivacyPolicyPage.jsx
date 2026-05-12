import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import SeoMeta from '../components/SeoMeta.jsx'
import PrivacyPolicyContent, { PRIVACY_POLICY_VERSION } from '../components/privacy/PrivacyPolicyContent.jsx'

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SeoMeta
        title="Privacy Policy | Amalgated Lending Inc."
        description="How Amalgated Lending Inc. collects, uses, secures, and protects personal information under the Data Privacy Act of 2012."
        canonical="https://amalgatedlending.com/privacy-policy"
      />
      <SubPageHeader />
      <main className="app-container flex-1 py-12 sm:py-16">
        <article className="mx-auto max-w-4xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="section-title">Legal & Compliance</p>
          <h1 className="mt-2 text-3xl font-semibold text-black">Privacy Policy</h1>
          <p className="mt-2 text-sm text-black/60">Effective version: {PRIVACY_POLICY_VERSION}</p>
          <div className="mt-6">
            <PrivacyPolicyContent />
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
