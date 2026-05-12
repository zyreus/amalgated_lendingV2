/**
 * Amalgated Lending Inc. — AI "training" for visitor chat (Groq system context + keyword fallbacks).
 * Edit this file or set LENDING_AI_FAQ_PATH to a UTF-8 text file (appended to the FAQ block).
 */

import fs from 'fs';
import path from 'path';

/** Primary public contact (mobile) — aligned with amalgatedlending.com Contact page */
export const LENDING_PHONE = '09190675095';
export const LENDING_EMAIL = 'support@amalgatedlending.com';
export const LENDING_OFFICE =
  'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000';

export const LENDING_AI_APPEND = `
Official role: You are the platform’s AI assistant for Amalgated Lending Inc. (ALI) — website visitors, borrowers (general how-to only), and admins (procedural guidance only).
You help with: personal and business loans, salary loans, chattel mortgage, real estate mortgage, travel assistance, SSS/GSIS pension-related loan pages, application steps, loan products overview, office contact, navigation, and responsible borrowing.
Always steer users to Loan Products and Apply for product-specific numbers and checklists. The lending business is part of the Amalgated Holdings group.
When "Verified knowledge excerpts" are included with the visitor message, treat them as authoritative website and catalogue text; do not contradict them. If excerpts conflict with a general answer, follow the excerpts.
Official public phone for Amalgated Lending Inc. is mobile ${LENDING_PHONE} only. Never cite (082) 297 8099, landlines, or any number except ${LENDING_PHONE} and ${LENDING_EMAIL} for contact — older numbers may appear in outdated excerpts; prefer this rule when giving a callback number.
Tone: professional, friendly, accurate, and concise (prefer short answers; add steps only when the user asks).
Security: Never reveal passwords, OTPs, tokens, borrower PII you do not see in the current thread, internal admin-only records, database/backend details, or unpublished formulas beyond approved site/CMS text. Never invent system vulnerabilities. For account-specific balances, approvals, or disputes, direct users to the borrower portal (if they are the borrower) or to official support — do not guess outcomes.
Admin users: You may describe generic workflows (e.g. reviewing applications, monitoring payments, running reports) but never expose confidential data, credentials, or internal identifiers.
Standard fallbacks: If you lack verified information: briefly apologize and suggest contacting support at ${LENDING_EMAIL} or ${LENDING_PHONE}. For sensitive account actions: "For security, please contact our official support team with your registered details." For unknown technical failures: suggest our technical or support team may assist better.
Rules: Do not invent APRs, monthly payments, approval odds, or legal advice. If numbers or eligibility are product-specific, say they depend on assessment and suggest Apply or a call to the office. Keep replies short unless the user asks for detail.`.trim();

const LENDING_CUSTOMER_FAQ_BASE = `
Typical customer topics (answer in the user's language; stay within these guardrails):

1) Applying & documents — Online Apply flow on the website; usually valid government ID, proof of income, proof of address, and extra papers depending on product (e.g. collateral docs for mortgage/chattel). Final checklist is confirmed during review.

2) Loan products — Visitors can read summaries on Loan Products and dedicated pages (e.g. salary loan, chattel mortgage, real estate mortgage, travel assistance, SSS/GSIS pension loan). Summarize categories in plain language; do not quote unpublished rate sheets.

3) Rates, fees, monthly amortization — Explain that interest, term, and fees depend on product, amount, tenor, and credit assessment. For exact figures they should submit an application or call the office.

4) Eligibility & approval — Credit history, income stability, existing obligations, and completeness of documents affect decisions. No guarantees in chat; underwriting decides.

5) Processing time — Ballpark only: after a complete application, review often takes a few business days; complex cases can take longer. Offer phone follow-up if they are in a hurry.

6) Collateral (vehicle/property) vs unsecured-style products — Chattel/real-estate loans are secured by assets described on the site; salary/personal-style products are marketed with different requirements. If unsure, point to the relevant product page.

7) Repayment, penalties, early payoff — Explain that terms are in the loan agreement; staff can explain options. Do not invent penalty percentages.

8) Existing loans / refinance / second loan — Say a specialist must review their current account; suggest calling or applying and mentioning their existing loan.

9) Business loans — Use of funds (working capital, equipment, expansion) is discussed during application; same rules on rates and eligibility.

10) Complaints, errors, or hardship — Acknowledge calmly; suggest they speak to a representative on the phone or use "Talk to an agent" in chat so staff can see their case.

11) Privacy & data — Assure that information is used to evaluate and service their request; sensitive data should not be pasted in full (e.g. full ID numbers) in chat—use official forms where possible.

12) Borrower portal — Registered borrowers may use the borrower area of the site for payments and account status; new applicants start from Apply.

13) OFW / overseas Filipino workers — Many cases need document and income verification; suggest Apply or phone so staff can advise on supported arrangements.

14) Insurance, notary, or third-party fees — Say only what is generally true (some products may involve third-party costs); defer specifics to the loan officer or agreement.

15) Language — Match the widget language when set; otherwise follow the user's language.

16) Off-topic — Politely redirect to lending, holdings contact, or applying.

17) Public website — Mission and credibility: Amalgated Lending Inc. offers regulated lending products in Davao & Mindanao; guide visitors to Loan Products, Features/Branches pages, and Contact. Do not invent awards or regulatory claims not in excerpts.

18) Loan products to reference (by site pages) — Salary loan; SSS/GSIS pension-style loan pages; chattel mortgage; real estate mortgage; travel assistance; business/personal loan categories as shown on the site. "Emergency" or generic personal needs map to the closest product page and assessment — no guaranteed amounts or rates in chat.

19) Typical requirements (high level) — Valid government ID; proof of income; proof of billing/address; employment or business proof where applicable; bank details during underwriting; collateral documents for secured products. Final list is confirmed during review.

20) Application journey (when asked for steps) — (1) Create account / start Apply as prompted on the site. (2) Upload or attach required documents. (3) Eligibility and verification by the team. (4) Loan assessment / underwriting. (5) Approval or decline notice. (6) Release of funds per agreement. (7) Repayment per schedule — use borrower portal or staff for payment posting questions.

21) Borrower portal (general) — Log in via Borrower login; register if new; complete or continue loan wizard; upload documents there; track status, schedule, and notifications on the dashboard; use profile/security pages for updates and password reset; for proof-of-payment uploads follow on-screen instructions. Do not read or confirm another person’s data.

22) Admin portal (general) — Staff sign in on Admin; use dashboard for portfolio summaries; review and approve/reject applications; manage borrowers, payments, reports, and notifications per role permissions; document verification workflows. Never output secrets, role bypass instructions, or individual borrower records from chat.

23) FAQs — How long approval takes: a few business days after a complete file, longer if incomplete. Payment methods: per loan agreement and staff instructions (GCash/bank/cash may appear in borrower flows — defer to portal/officer if unsure). Missed payments: consequences are in the agreement; suggest speaking to an officer. Password reset: use the site’s Forgot password flow. Loan balance: borrower dashboard / statement, not chat speculation.

24) Performance — Aim for quick replies; rely on verified excerpts when present; avoid long essays unless requested.

25) Widget quick actions — Visitors may tap "How to apply?", "Ask about rates", or "Loan products" (or localized equivalents). Treat those as requests for: (a) stepwise Apply + documents + review flow, (b) rate/amortization explanation without invented numbers, (c) product categories with links to the right site sections — always grounded in verified excerpts when present. "Talk to an agent" is handled by the app as a human handoff, not a trivia question.
`.trim();

function loadOptionalFaqOverlay() {
  const raw = (process.env.LENDING_AI_FAQ_PATH || '').trim();
  if (!raw) return '';
  const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  try {
    if (!fs.existsSync(resolved)) {
      console.warn('[ai] LENDING_AI_FAQ_PATH not found:', resolved);
      return '';
    }
    const text = fs.readFileSync(resolved, 'utf8').trim();
    if (!text) return '';
    return `\n\nAdditional business notes (from LENDING_AI_FAQ_PATH):\n${text}`;
  } catch (e) {
    console.warn('[ai] Could not read LENDING_AI_FAQ_PATH:', e?.message || e);
    return '';
  }
}

/** Injected into the Groq system message for lending chats. */
export const LENDING_CUSTOMER_FAQ = (LENDING_CUSTOMER_FAQ_BASE + loadOptionalFaqOverlay()).trim();

function normalizeLang(input) {
  const raw = String(input || '').toLowerCase().trim();
  if (!raw) return 'en';
  const base = raw.split(/[-_]/)[0];
  if (base === 'tl' || base === 'fil') return 'fil';
  if (['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'id', 'vi'].includes(base)) return base;
  return 'en';
}

/** Rule-based replies when GROQ_API_KEY is missing or Groq API errors (chat still works). */
export function getLendingFallbackReply(userMessage, lang) {
  const m = String(userMessage || '').toLowerCase();
  const l = normalizeLang(lang);

  if (l === 'fil') {
    if (/apply|aplikasyon|loan|utang|salary|negosyo|personal|business|hiram/i.test(m)) {
      return `Maaari kang mag-apply online sa Amalgated Lending Inc. website (Apply page). Kailangan ng valid ID, proof of income, at supporting documents. Susuriin ng team at makikipag-ugnay sa iyo — karaniwan sa loob ng 1–2 araw ng trabaho. Tulong: tumawag sa ${LENDING_PHONE}.`;
    }
    if (/document|papeles|requirements|id\b|pantapat|collateral|sangla|kotse|bahay|lupa/i.test(m)) {
      return `Karaniwang humihingi ng valid government ID, proof of income, proof of address, at karagdagang dokumento depende sa loan product (lalo na kung may collateral). Kumpletuhin ang Apply form online; titingnan ng team kung ano pa ang kailangan. Tawagan ang ${LENDING_PHONE} kung may partikular kang produkto.`;
    }
    if (/eligible|qualified|approve|deny|reject|credit|score/i.test(m)) {
      return `Ang eligibility at approval ay batay sa income, credit history, kasalukuyang obligasyon, at kumpletong dokumento — desisyon ng underwriting. Walang garantiya sa chat; mag-apply o tumawag sa ${LENDING_PHONE} para masuri ang case mo.`;
    }
    if (/how long|gaano katagal|processing|kailan|timeline/i.test(m)) {
      return `Kapag kumpleto ang application, karaniwang ilang araw ng trabaho ang unang review; maaaring mas matagal kung kailangan pa ng karagdagang dokumento. Para sa status, tumawag sa ${LENDING_PHONE}.`;
    }
    if (/payment|bayad|hulog|penalty|late|early|pay off/i.test(m)) {
      return `Ang terms ng bayad at penalties ay nakasaad sa loan agreement. Hindi namin maaaring i-quote ang eksaktong porsyento dito — pakipagusapan sa representative sa ${LENDING_PHONE}.`;
    }
    if (/refinance|existing|second loan|doble|may loan na/i.test(m)) {
      return `Kailangan suriin ng specialist ang kasalukuyang account mo. Mag-apply o tumawag sa ${LENDING_PHONE} at banggitin ang existing loan para matulungan ka nang tama.`;
    }
    if (/complaint|reklamo|problem|issue|mali|error/i.test(m)) {
      return `Paumanhin sa abala. Pakiusap gamitin ang "Talk to an agent" sa chat o tumawag sa ${LENDING_PHONE} para direktang matugunan ng staff ang isyu mo.`;
    }
    if (/ofw|abroad|overseas|sa ibang bansa/i.test(m)) {
      return `Maraming OFW at overseas cases ang nangangailangan ng tamang dokumento at proof of income. Mag-apply online o tumawag sa ${LENDING_PHONE} para masuri kung aling product ang angkop sa sitwasyon mo.`;
    }
    if (/insurance|notary|third party/i.test(m)) {
      return `Maaaring may karagdagang bayarin depende sa produkto at proseso (hal. third-party o dokumento). Ang eksaktong detalye ay mula sa loan officer o sa agreement — tumawag sa ${LENDING_PHONE}.`;
    }
    if (/rate|interest|bunga|presyo|magkano|fee/i.test(m)) {
      return `Depende ang rates at terms sa loan product, halaga, at profile mo. Para sa tumpak na quote, mag-apply online o tumawag sa ${LENDING_PHONE}.`;
    }
    if (/branch|opisina|saan|location|davao|address|bisita/i.test(m)) {
      return `Opisina: ${LENDING_OFFICE}. Mobile: ${LENDING_PHONE}. Email: ${LENDING_EMAIL}.`;
    }
    if (/hello|hi |^hi$|kumusta|tulong|help|magandang/i.test(m)) {
      return `Kumusta! Tutulungan ka namin sa Amalgated Lending Inc. — personal, salary, business loans, at iba pa. Ano ang gusto mong malaman? Puwede mo ring gamitin ang mga quick option sa chat.`;
    }
    if (/salamat|thank/i.test(m)) {
      return `Walang anuman! Kung may iba ka pang tanong tungkol sa loan o application, sabihin lang.`;
    }
    return `Salamat sa mensahe mo. Para sa loan details, rates, o application, tumawag sa ${LENDING_PHONE} o gamitin ang Apply page sa website.`;
  }

  if (l === 'es') {
    if (/apply|aplicación|loan|préstamo|salary|business|personal/i.test(m)) {
      return `Puede aplicar en línea en el sitio de Amalgated Lending Inc. (página Apply). Suele necesitarse ID válido, comprobante de ingresos y documentos. Teléfono: ${LENDING_PHONE}.`;
    }
    if (/documento|requisito|papel|garantía|colateral|vehículo|propiedad/i.test(m)) {
      return `Normalmente se pide ID oficial, comprobante de ingresos, comprobante de domicilio y documentos según el producto (p. ej. garantía inmobiliaria o vehículo). Complete el formulario Apply en línea; el equipo indicará si falta algo. ${LENDING_PHONE}.`;
    }
    if (/tasa|interés|cuota|mensual|precio|fee|comisión/i.test(m)) {
      return `Las tasas y plazos dependen del producto, monto y perfil. Para una cotización exacta, aplique en línea o llame al ${LENDING_PHONE}.`;
    }
    if (/sucursal|oficina|dirección|ubicación|dónde|davao/i.test(m)) {
      return `Oficina principal: ${LENDING_OFFICE}. Móvil: ${LENDING_PHONE}. Email: ${LENDING_EMAIL}.`;
    }
    if (/hola|buenos|ayuda|gracias por contactar/i.test(m)) {
      return `Hola, le ayudamos con préstamos Amalgated Lending Inc. (personal, salarial, empresarial y más). ¿Qué necesita saber? También puede usar las opciones rápidas del chat.`;
    }
    return `Gracias por tu mensaje. Para préstamos Amalgated Lending Inc., llama al ${LENDING_PHONE} o usa la página Apply en el sitio.`;
  }

  if (/apply|application|how do i apply|apply for|loan application/i.test(m)) {
    return `You can apply online through the Amalgated Lending Inc. website’s Apply page. You’ll typically need a valid ID, proof of income, and supporting documents. Our team reviews applications and usually contacts you within 1–2 business days. Need help? Call ${LENDING_PHONE}.`;
  }
  if (/document|paperwork|requirements|what do i need|valid id|collateral|chattel|mortgage|vehicle|property/i.test(m)) {
    return `Most applications need a valid government ID, proof of income, proof of address, and product-specific documents (for example collateral paperwork for chattel or real-estate loans). Complete the Apply form online—our team will tell you if anything else is needed. For a specific product, call ${LENDING_PHONE}.`;
  }
  if (/eligib|qualif|approved|approval|denied|rejected|credit score|bad credit/i.test(m)) {
    return `Eligibility and approval depend on income, credit history, existing obligations, and complete documents—underwriting makes the final decision. We can’t guarantee an outcome in chat; apply or call ${LENDING_PHONE} so your situation can be reviewed properly.`;
  }
  if (/how long|processing time|when will|timeline|status of my application/i.test(m)) {
    return `Once your application is complete, initial review is often within a few business days; complex or incomplete files can take longer. For a status update, call ${LENDING_PHONE}.`;
  }
  if (/payment|repay|installment|penalty|late fee|early pay|pay off|amort/i.test(m)) {
    return `Repayment schedules and any penalties are defined in your loan agreement—we can’t quote exact penalty rates here. A representative at ${LENDING_PHONE} can walk you through your options.`;
  }
  if (/refinance|existing loan|second loan|already have a loan/i.test(m)) {
    return `A specialist needs to review your current account. Please apply or call ${LENDING_PHONE} and mention your existing loan so we can guide you correctly.`;
  }
  if (/complaint|problem with|issue|wrong|error|not happy/i.test(m)) {
    return `Sorry you’re running into trouble. Please use “Talk to an agent” in this chat or call ${LENDING_PHONE} so our staff can look into your case directly.`;
  }
  if (/privacy|data|personal information|is my info safe/i.test(m)) {
    return `We use your information to evaluate and service your request. Avoid sharing full ID numbers or sensitive data in chat when possible—official forms on the Apply page are best. For privacy questions, our team at ${LENDING_PHONE} can help.`;
  }
  if (/borrower portal|login|account|my loan balance|check my balance|remaining balance|payment schedule|payment history/i.test(m)) {
    return `Sign in to the Borrower portal on the website. Your dashboard shows loan status, balance, payment schedule, and history; notifications appear in the portal. For login issues or if something looks wrong, call ${LENDING_PHONE} — do not share passwords in chat.`;
  }
  if (/forgot password|reset password|change password|locked out/i.test(m)) {
    return `Use the Forgot password link on the Borrower or Admin login page and follow the email instructions. If you don’t receive the email, check spam or call ${LENDING_PHONE} for account help.`;
  }
  if (/admin (?:login|portal)|staff login|loan officer login|backoffice/i.test(m)) {
    return `Admins use the Admin login on the site. Access to applications, approvals, and reports depends on your role. For access problems, contact your internal supervisor or IT — never share passwords in chat.`;
  }
  if (/\bofw\b|overseas filipino|working abroad|abroad|expat/i.test(m)) {
    return `Many OFW and overseas cases need proper income and document verification. Apply online or call ${LENDING_PHONE} so we can advise which product fits your situation.`;
  }
  if (/insurance|notary|third[- ]party fee/i.test(m)) {
    return `Some products or processes may involve third-party costs (e.g. insurance or documentation). Exact details come from your loan officer or agreement—call ${LENDING_PHONE} for guidance.`;
  }
  if (/rate|interest|how much|apr|monthly payment|fee/i.test(m)) {
    return `Interest rates and terms depend on the loan product, amount, term, and your profile. For accurate figures, apply online or call ${LENDING_PHONE} — our staff can provide a personalized quote.`;
  }
  if (/branch|office|location|davao|where|address|visit|open/i.test(m)) {
    return `Main office: ${LENDING_OFFICE}. Mobile: ${LENDING_PHONE}. Email: ${LENDING_EMAIL}. You can also explore Loan Products and Apply on our site.`;
  }
  if (/hours|when are you|schedule/i.test(m)) {
    return `For branch hours and appointments, please call ${LENDING_PHONE}.`;
  }
  if (/hello|hi |^hi$|hey|good morning|good afternoon|help\b/i.test(m)) {
    return `Hello! I can help with Amalgated Lending Inc. — personal, salary, business loans, and more. What would you like to know? You can also use the quick options in this chat.`;
  }
  if (/thank|thanks|salamat/i.test(m)) {
    return `You’re welcome! If you need anything else about loans or your application, just ask.`;
  }
  return `I’m sorry, I couldn’t find that information here. For loan details, rates, or applications, contact ${LENDING_EMAIL} or call ${LENDING_PHONE}, or use the Apply page on the Amalgated Lending Inc. website. Our menu above has shortcuts for common questions.`;
}