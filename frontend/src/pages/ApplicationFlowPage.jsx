import { Link } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import SeoMeta from '../components/SeoMeta.jsx'

const steps = [
  { t: 'Check Eligibility', d: 'Use our calculator and choose the best product for your needs.' },
  { t: 'Submit Requirements', d: 'Upload IDs and supporting documents securely through our portal.' },
  { t: 'Verification & Approval', d: 'Our lending team reviews your application and contacts you promptly.' },
  { t: 'Disbursement', d: 'Approved funds are released through your selected disbursement method.' },
]

export default function ApplicationFlowPage() {
  return (
    <div className="min-h-screen bg-brand-background-alt">
      <SeoMeta
        title="Loan Application Process | Amalgated Lending"
        description="Understand the complete application flow for personal and business loans in Davao and Mindanao."
        canonical="https://amalgatedlending.com/application-flow"
      />
      <SubPageHeader />
      <main className="app-container py-12">
        <h1 className="text-3xl font-semibold text-brand-text">Simple & Transparent Loan Application Flow</h1>
        <p className="mt-2 max-w-3xl text-brand-text/70">We designed our process to reduce anxiety and keep you informed at every step.</p>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.t} className="surface-card-light p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Step {i + 1}</p>
              <h2 className="mt-2 text-xl font-semibold">{s.t}</h2>
              <p className="mt-2 text-sm text-brand-text/75">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/apply" className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white">Apply Now</Link>
          <Link to="/contact" className="rounded-full border border-black/15 px-6 py-3 text-sm font-semibold">Talk to a Loan Officer</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
