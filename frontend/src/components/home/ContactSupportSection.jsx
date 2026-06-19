import { COMPANY_PHONES, COMPANY_PHONE_WHATSAPP } from '../../config/companyContact.js'

const mainOfficeAddress =
  'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000'

export default function ContactSupportSection() {
  const mapQuery = encodeURIComponent(mainOfficeAddress)
  const messengerLink = 'https://m.me/'
  const whatsappLink = `https://wa.me/${COMPANY_PHONE_WHATSAPP}`

  return (
    <section id="contact-support" className="app-container landing-section">
      <div className="landing-card-grid items-stretch lg:grid-cols-2">
        <article className="landing-panel flex h-full min-h-[22rem] flex-col">
          <p className="section-title">Contact & Support</p>
          <h2 className="landing-section-heading">
            Need help? Our team is ready to assist.
          </h2>
          <dl className="landing-stack mt-8 flex-1 text-sm text-brand-text/80">
            <div>
              <dt className="font-semibold text-brand-text">Address</dt>
              <dd className="mt-1 leading-relaxed">{mainOfficeAddress}</dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-text">Mobile</dt>
              <dd className="mt-1 flex flex-col gap-1">
                {COMPANY_PHONES.map((phone) => (
                  <a key={phone.raw} href={phone.href} className="hover:text-brand-primary">
                    {phone.raw}
                  </a>
                ))}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-text">Email</dt>
              <dd className="mt-1">support@amalgatedlending.com</dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-text">Operating Hours</dt>
              <dd className="mt-1">Monday to Saturday, 8:30 AM - 5:30 PM</dd>
            </div>
          </dl>
          <div className="landing-btn-group mt-8">
            <a
              href={messengerLink}
              target="_blank"
              rel="noreferrer"
              className="landing-btn-secondary"
            >
              Messenger
            </a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="landing-btn-secondary"
            >
              WhatsApp
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
              className="landing-btn-primary"
            >
              Get Directions
            </a>
          </div>
        </article>

        <div className="flex min-h-[24rem] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1 shadow-[0_12px_40px_rgba(217,34,67,0.07),0_4px_20px_rgba(0,0,0,0.04)] lg:min-h-full">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3959.36126486874!2d125.6124840553452!3d7.084051134957256!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32f96da651e42635%3A0x5bd7a84c2784dcf!2sAmalgated%20Capital%2C%20Inc.!5e0!3m2!1sen!2sph!4v1771920193547!5m2!1sen!2sph"
            title="Amalgated Lending Inc. Davao Location"
            className="h-full min-h-[22rem] w-full flex-1 border-0 lg:min-h-[28rem]"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
