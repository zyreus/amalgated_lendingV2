/** Official public contact numbers — keep in sync with chat-server/ai/lendingTraining.js */
export const COMPANY_PHONES = [
  { display: '0956 568 6044', href: 'tel:+639565686044', raw: '09565686044' },
  { display: '0919 067 5781', href: 'tel:+639190675781', raw: '09190675781' },
]

export const COMPANY_PHONE_WHATSAPP = '639190675781'

export function companyPhonesInline(separator = ' · ') {
  return COMPANY_PHONES.map((phone) => phone.display).join(separator)
}
