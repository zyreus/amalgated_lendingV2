const mainOfficeAddress =
  'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000'

export default function ContactSupportSection() {
  const mapQuery = encodeURIComponent(mainOfficeAddress)
  const messengerLink = 'https://m.me/'
  const whatsappLink = 'https://wa.me/639190675095'

  return (
    <section id="contact-support" className="app-container py-8 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="surface-card-light p-6 sm:p-7">
          <p className="section-title">Contact & Support</p>
          <h2 className="mt-2 text-3xl font-semibold text-brand-text">Need help? Our team is ready to assist.</h2>
          <dl className="mt-5 space-y-3 text-sm text-brand-text/80">
            <div><dt className="font-semibold text-brand-text">Address</dt><dd>{mainOfficeAddress}</dd></div>
            <div><dt className="font-semibold text-brand-text">Mobile</dt><dd>09190675095</dd></div>
            <div><dt className="font-semibold text-brand-text">Email</dt><dd>support@amalgatedlending.com</dd></div>
            <div><dt className="font-semibold text-brand-text">Operating Hours</dt><dd>Monday to Saturday, 8:30 AM - 5:30 PM</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={messengerLink} target="_blank" rel="noreferrer" className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold">Messenger</a>
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold">WhatsApp</a>
            <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white">Get Directions</a>
          </div>
        </article>

        <div className="overflow-hidden rounded-2xl border border-black/10">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3959.36126486874!2d125.6124840553452!3d7.084051134957256!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32f96da651e42635%3A0x5bd7a84c2784dcf!2sAmalgated%20Capital%2C%20Inc.!5e0!3m2!1sen!2sph!4v1771920193547!5m2!1sen!2sph"
            title="Amalgated Lending Inc. Davao Location"
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: '360px' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
