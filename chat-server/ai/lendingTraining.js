/**
 * Amalgated Lending Inc. — AI context for visitor chat (Groq system message + keyword fallbacks).
 * Optional overlay: set LENDING_AI_FAQ_PATH to a UTF-8 file (appended after the FAQ reference block).
 */

import fs from 'fs';
import path from 'path';

/** Official public contact — aligned with amalgatedlending.com Contact page */
export const LENDING_PHONE = '09190675095';
export const LENDING_EMAIL = 'support@amalgatedlending.com';
/** Main office VisMin (corporate) — same copy as `ContactPage.jsx` / `BranchesPage.jsx` */
export const LENDING_OFFICE =
  'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000';
/** Main office Luzon — same copy as Contact + Branches pages */
export const LENDING_OFFICE_LUZON = '1220 Pedro Gil Street, Paco, Manila';

/** Branch rows as shown on public `/branches` (keep in sync with `BranchesPage.jsx`). */
export const LENDING_PUBLIC_BRANCHES_LINES = [
  'Kidapawan: A & S Landing Commercial Bldg., Brgy. Sudapin, Kidapawan City',
  'Mangagoy: M.Conpinco Building Espiritu St. Mangagoy, Bislig City Surigao Del Sur 8311',
  'Lagao (General Santos): Aradaza st. General Santos City',
].join('\n');

/**
 * System prompt (hierarchical). FAQ block below adds topic recipes without repeating every prohibition.
 * Structure: Role → Goals → Rules → Knowledge priority → Escalation → Style.
 */
export const LENDING_AI_APPEND = `
ROLE
You are the official AI assistant for Amalgated Lending Inc. (ALI), Davao City, Philippines — part of the Amalgated Holdings group. You serve website visitors and borrowers with general, non-binding information only.

GOALS
- Explain loan categories, navigation (Loan Products, Application flow, Apply/Borrower Portal, Contact, Branches), and high-level application steps.
- Encourage responsible borrowing and use of official channels.
- Match the user’s language (widget language when set; otherwise the user’s last message).

PUBLIC WEBSITE (canonical — match amalgatedlending.com SPA; paths are on-site routes)
- Main office VisMin (corporate): ${LENDING_OFFICE}
- Main office Luzon: ${LENDING_OFFICE_LUZON}
- Branch network (see /branches): ${LENDING_PUBLIC_BRANCHES_LINES.replace(/\n/g, '; ')}
- Service areas (site copy): Luzon, Visayas, Mindanao, and NCR.
- Contact (/contact): inquiry form for name, contact number, email, preferred loan type, estimated amount; “Get directions” for the Davao pin; after submit, users continue the full application in the Borrower Portal (/borrower/login).
- Key visitor routes: /loan-products, /application-flow, /loans/* product pages, /contact, /branches, /privacy-policy.
- This chat widget: quick actions include “How to apply?”, “Ask about rates”, “Loan products”, and “Talk to an agent” / “Human agent” for escalation; the UI states users may escalate to a human anytime. A footer notes AI answers can be inaccurate—if asked, acknowledge briefly and offer phone (${LENDING_PHONE}) or agent handoff for verified details.

CORE RULES (compliance — never break)
- Do not quote specific interest rates, APRs, monthly amortization amounts, fees, or approval percentages. Say they depend on product, amount, term, and credit assessment; direct to Apply or ${LENDING_PHONE}.
- Do not approve or decline loans, predict outcomes, or give personalized financial or legal advice.
- Do not promise processing or approval timelines as guarantees. If asked about timing, say timing varies; only underwriting can confirm after a complete file.
- Account-specific data (balance, schedule, approval status, disputes): direct the borrower to the Borrower portal or ${LENDING_PHONE} / ${LENDING_EMAIL}. Never guess.
- Official contact only: mobile ${LENDING_PHONE} and ${LENDING_EMAIL}. Never cite (082) 297 8099, other landlines, or numbers from old marketing. If "Verified knowledge excerpts" show an old number, follow this rule for callbacks.

KNOWLEDGE PRIORITY
1) When the user message includes "Verified knowledge excerpts", treat them as authoritative site/catalog text. If they conflict with general knowledge, follow the excerpts except where they violate CORE RULES (rates, guarantees, wrong phone) — then defer to Apply/phone.
2) Otherwise use the FAQ reference block in this system message for topic handling.

HUMAN ESCALATION
- If the user wants a human (e.g. "Talk to an agent", "Human agent", callback, loan officer): confirm briefly, tell them staff can continue in chat or by phone at ${LENDING_PHONE}, and do not treat it as a trivia question. The app may switch modes; stay professional.

SECURITY
- Never ask for or repeat passwords, OTPs, or full ID numbers. No internal IDs, admin secrets, or borrower PII you do not see in-thread. No invented vulnerabilities.

ADMIN USERS
- Only generic internal workflows; never expose confidential records or credentials.

STYLE
- Short, scannable, professional, warm. Prefer 2–4 sentences unless the user asks for detail.
`.trim();

/**
 * Topic reference for the model (not a duplicate of every prohibition — see LENDING_AI_APPEND).
 */
const LENDING_CUSTOMER_FAQ_BASE = `
FAQ TOPICS (answer in the user’s language; stay within CORE RULES above):

• Apply & documents — Online Apply; typically valid ID, proof of income, proof of address; extras per product (e.g. collateral docs). Final list is confirmed in review.

• Products — Summarize from Loan Products and /loans/* pages (salary, chattel, real estate, travel, SSS/GSIS-style, business/personal as shown). No unpublished rate sheets.

• Rates & fees — Only general: depend on assessment; exact figures via application or ${LENDING_PHONE}.

• Eligibility — Income, credit history, obligations, documents; underwriting decides; no chat guarantees.

• Timing — Varies by completeness and case; no fixed promise; status via portal or phone.

• Collateral vs unsecured-style — Point to the relevant product page if unsure.

• Repayment / penalties / early payoff — Defined in the loan agreement; no invented percentages; officer at ${LENDING_PHONE}.

• Refinance / second loan — Specialist review; apply or call and mention existing loan.

• Business loans — Use of funds discussed in application; same rules on rates/eligibility.

• Complaints / errors — Calm tone; "Talk to an agent" and/or ${LENDING_PHONE}.

• Privacy — Data used to evaluate/service; avoid pasting full sensitive IDs in chat; use official forms.

• Borrower portal — Login for payments, notifications, status; password via Forgot password.

• OFW / abroad — Document and income verification; Apply or ${LENDING_PHONE}.

• Third-party costs — May exist depending on product; defer to officer/agreement.

• Off-topic — Politely redirect to ALI lending or official contact.

• Widget shortcuts — "How to apply" → steps + documents (no rate numbers). "Ask about rates" → depends on assessment + Apply/phone. "Loan products" → categories + site sections. "Talk to an agent" / "Human agent" → human handoff / phone as above.

• Locations — Always mention both main offices (Davao VisMin + Manila Luzon) when answering “where are you / office / branch”; then summarize branch cities or send users to /branches and /contact. Do not invent extra branches.

• Admin portal — Generic staff workflows only; no secrets or individual borrower data.
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

/** User wants a human — match before other intents to avoid partial answers. */
const ESCALATION_EN =
  /\b(talk to an agent|talk to a human|live agent|human agent|real person|speak to (?:a )?(?:human|person|agent)|connect me to (?:someone|an agent|support)|transfer me to|escalat|loan officer|callback please|call me back|have someone call|representative please|customer service rep|speak with staff)\b/i;
const ESCALATION_FIL =
  /\b(agent|humano|tao|staff|representat|kausap(?:in)?\s+(?:ang\s+)?(?:agent|tao|staff)|makipag-ugnay\s+sa\s+(?:agent|tao)|gusto\s+ko\s+(?:ng\s+)?(?:tao|agent|tawag)|pakiusap\s+(?:tawag|agent)|maghanap\s+ng\s+(?:agent|tao)|live\s+person|talk\s+to\s+an?\s+agent)\b/i;
const ESCALATION_ES =
  /\b(agente|humano|persona|representante|hablar con (?:un )?(?:agente|persona)|transferir|escalar)\b/i;

function normalizeLang(input) {
  const raw = String(input || '').toLowerCase().trim();
  if (!raw) return 'en';
  const base = raw.split(/[-_]/)[0];
  if (base === 'tl' || base === 'fil') return 'fil';
  if (['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'id', 'vi'].includes(base)) return base;
  return 'en';
}

function wantsEscalation(message, lang) {
  const m = String(message || '');
  if (ESCALATION_EN.test(m)) return true;
  if (normalizeLang(lang) === 'fil' && ESCALATION_FIL.test(m)) return true;
  if (normalizeLang(lang) === 'es' && ESCALATION_ES.test(m)) return true;
  return ESCALATION_FIL.test(m) || ESCALATION_ES.test(m);
}

function escalationReply(lang) {
  const l = normalizeLang(lang);
  if (l === 'fil') {
    return `Naiintindihan namin na gusto mong makausap ang aming team. Pakipindot ang **Talk to an agent** o **Human agent** sa chat kung available, o tumawag sa ${LENDING_PHONE} (mobile) o mag-email sa ${LENDING_EMAIL}. Hindi namin mabibigay ang account-specific na detalye dito sa chat para manatiling secure ang impormasyon mo.`;
  }
  if (l === 'es') {
    return `Podemos pasarle con nuestro equipo. Use **Talk to an agent** / **Human agent** en el chat si está disponible, o llame al ${LENDING_PHONE} (móvil) o escriba a ${LENDING_EMAIL}. Por seguridad, no compartimos datos específicos de su cuenta aquí.`;
  }
  return `I’ll connect you with our team. Please tap **Talk to an agent** or **Human agent** in this chat if you see it, or call ${LENDING_PHONE} (mobile) or email ${LENDING_EMAIL}. For your security, we can’t discuss account-specific details in this automated chat.`;
}

/** Office + branch summary — keep aligned with `ContactPage.jsx` and `BranchesPage.jsx`. */
function publicLocationFallbackReply(lang) {
  const l = normalizeLang(lang);
  const site = 'https://amalgatedlending.com';
  if (l === 'fil') {
    return `Ayon sa pampublikong website ng Amalgated Lending Inc.: **Main office VisMin (corporate):** ${LENDING_OFFICE} **Main office Luzon:** ${LENDING_OFFICE_LUZON}. May branch network sa Kidapawan, Mangagoy (Bislig), at General Santos (Lagao)—buong address sa ${site}/branches. Mobile: ${LENDING_PHONE}. Email: ${LENDING_EMAIL}. Inquiry: ${site}/contact.`;
  }
  if (l === 'es') {
    return `Según el sitio público de Amalgated Lending Inc.: **Oficina principal VisMin:** ${LENDING_OFFICE} **Oficina principal Luzón:** ${LENDING_OFFICE_LUZON}. Red en Kidapawan, Mangagoy (Bislig) y General Santos (Lagao)—direcciones en ${site}/branches. Móvil: ${LENDING_PHONE}. Email: ${LENDING_EMAIL}. Contacto: ${site}/contact.`;
  }
  return `Amalgated Lending Inc. lists two main offices on amalgatedlending.com: **VisMin (corporate):** ${LENDING_OFFICE} **Luzon:** ${LENDING_OFFICE_LUZON}. Published branches include Kidapawan, Mangagoy (Bislig), and General Santos (Lagao)—full addresses on ${site}/branches. Mobile: ${LENDING_PHONE}. Email: ${LENDING_EMAIL}. Contact & inquiry: ${site}/contact. Explore Loan Products and Apply there too.`;
}

/** Rule-based replies when Groq is unavailable or errors. */
export function getLendingFallbackReply(userMessage, lang) {
  const m = String(userMessage || '').toLowerCase();
  const l = normalizeLang(lang);

  if (wantsEscalation(userMessage, lang)) {
    return escalationReply(l);
  }

  if (l === 'fil') {
    if (/rate|interest|bunga|presyo|magkano|fee|amort|hulog\s+buwan|monthly|apr|percent|porsyento/i.test(m)) {
      return `Para manatiling tama at compliant, hindi namin maaaring magbigay ng eksaktong interest rate, buwanang hulog, o presyo ng loan dito sa chat — depende iyan sa produkto, halaga, term, at credit assessment. Mag-apply sa opisyal na Apply page o tumawag sa ${LENDING_PHONE} para sa personalized na quote.`;
    }
    if (/apply|aplikasyon|loan|utang|salary|negosyo|personal|business|hiram|mag-loan|mag loan|loan sana|pautang/i.test(m)) {
      return `Puwede kang mag-apply online sa website ng Amalgated Lending Inc. (Apply). Karaniwang kailangan ng valid ID, proof of income, at supporting documents — susuriin ng team ang file mo at makikipag-ugnay sila kung may update. Hindi natin ma-guarantee ang eksaktong petsa ng sagot; para sa follow-up, ${LENDING_PHONE} o ${LENDING_EMAIL}.`;
    }
    if (/document|papeles|requirements|id\b|pantapat|collateral|sangla|kotse|bahay|lupa|dokumento/i.test(m)) {
      return `Karaniwan: valid government ID, proof of income, proof of address, at karagdagang dokumento depende sa loan product (lalo na kung may collateral). Kumpletuhin ang Apply form online — sasabihin ng team kung may kulang pa. May tanong sa partikular na produkto? ${LENDING_PHONE}.`;
    }
    if (/eligible|qualified|approve|deny|reject|credit|score|aprobar/i.test(m)) {
      return `Ang eligibility at desisyon sa approval ay ginagawa ng underwriting batay sa income, credit history, obligasyon, at kumpletong dokumento — walang garantiya sa chat. Mag-apply o tumawag sa ${LENDING_PHONE} para masuri ang case mo nang tama.`;
    }
    if (/how long|gaano katagal|processing|kailan|timeline|status|kelan|matatapos/i.test(m)) {
      return `Ang tagal ng review ay depende sa kung kumpleto ang dokumento at sa klase ng loan — hindi natin ma-guarantee ang eksaktong araw dito. Para sa status ng iyong application, Borrower portal (kung registered) o tumawag sa ${LENDING_PHONE}.`;
    }
    if (/payment|bayad|hulog|penalty|late|early|pay off/i.test(m)) {
      return `Ang schedule ng bayad at penalties ay nakasaad sa loan agreement. Hindi namin ii-quote ang eksaktong porsyento dito — pakikipag-usap sa representative sa ${LENDING_PHONE}.`;
    }
    if (/refinance|existing|second loan|doble|may loan na/i.test(m)) {
      return `Kailangan suriin ng specialist ang kasalukuyang account mo. Mag-apply o tumawag sa ${LENDING_PHONE} at banggitin ang existing loan mo.`;
    }
    if (/complaint|reklamo|problem|issue|mali|error|hindi\s+masaya/i.test(m)) {
      return `Paumanhin sa abala. Pakigamit ang **Talk to an agent** o **Human agent** sa chat o tumawag sa ${LENDING_PHONE} para direktang matulungan ka ng staff.`;
    }
    if (/ofw|abroad|overseas|sa ibang bansa|nasasabak/i.test(m)) {
      return `Maraming OFW case ang nangangailangan ng tamang dokumento at proof of income. Mag-apply online o tumawag sa ${LENDING_PHONE} para matulungan kang pumili ng angkop na product.`;
    }
    if (/insurance|notary|third party/i.test(m)) {
      return `Maaaring may karagdagang bayarin depende sa produkto at proseso. Ang detalye ay mula sa loan officer o sa agreement — ${LENDING_PHONE}.`;
    }
    if (/branch|opisina|saan|location|davao|manila|luzon|address|bisita|taga\s+saan|kidapawan|bislig|gensan|lagao|ncr/i.test(m)) {
      return publicLocationFallbackReply(l);
    }
    if (/hello|hi |^hi$|kumusta|tulong|help|magandang|musta|kamusta/i.test(m)) {
      return `Kumusta! Dito ang Amalgated Lending Inc. — tutulong kami sa pangkalahatang tanong tungkol sa loans, Apply, at Loan Products. Ano ang gusto mong malaman? Puwede mo ring gamitin ang mga quick option sa chat.`;
    }
    if (/salamat|thank/i.test(m)) {
      return `Walang anuman! Kung may tanong ka pa tungkol sa loan o application, sabihin mo lang.`;
    }
    return `Salamat sa mensahe mo. Para sa loan, rates (sa assessment), o application, tumawag sa ${LENDING_PHONE} o ${LENDING_EMAIL}, o bisitahin ang Apply page sa website ng Amalgated Lending Inc.`;
  }

  if (l === 'es') {
    if (/tasa|interés|cuota|mensual|precio|fee|comisión|apr/i.test(m)) {
      return `Por cumplimiento normativo, no podemos indicar tasas exactas, cuotas mensuales ni comisiones en este chat: dependen del producto, monto, plazo y evaluación crediticia. Para una cotización personalizada, aplique en línea o llame al ${LENDING_PHONE}.`;
    }
    if (/apply|aplicación|loan|préstamo|salary|business|personal/i.test(m)) {
      return `Puede aplicar en línea en el sitio de Amalgated Lending Inc. (página Apply). Suele pedirse ID válido, comprobante de ingresos y documentos de respaldo. El equipo revisará su expediente; no garantizamos fechas exactas de respuesta — para seguimiento: ${LENDING_PHONE} o ${LENDING_EMAIL}.`;
    }
    if (/documento|requisito|papel|garantía|colateral|vehículo|propiedad/i.test(m)) {
      return `Normalmente: ID oficial, comprobante de ingresos, domicilio y documentos según el producto. Complete Apply en línea; el equipo indicará si falta algo. ${LENDING_PHONE}.`;
    }
    if (/sucursal|oficina|dirección|ubicación|dónde|davao|manila|luzon|kidapawan|bislig/i.test(m)) {
      return publicLocationFallbackReply(l);
    }
    if (/hola|buenos|ayuda|gracias por contactar/i.test(m)) {
      return `Hola, somos Amalgated Lending Inc. — préstamos personales, salariales, empresariales y más. ¿En qué podemos orientarle? Use también las opciones rápidas del chat.`;
    }
    return `Gracias por su mensaje. Para préstamos, cotizaciones (tras evaluación) o aplicaciones: ${LENDING_PHONE} o ${LENDING_EMAIL}, o la página Apply del sitio.`;
  }

  if (/rate|interest|apr|monthly payment|how much (?:will|would|do) i pay|amort|fee schedule|percentage rate/i.test(m)) {
    return `For regulatory accuracy we can’t quote specific interest rates, APRs, or exact monthly payments in this chat—they depend on the product, amount, term, and your credit assessment. Please use the Apply flow on our site or call ${LENDING_PHONE} for a personalized quote.`;
  }
  if (/apply|application|how do i apply|apply for|loan application/i.test(m)) {
    return `You can apply online through the Amalgated Lending Inc. website (Apply). You’ll typically need a valid ID, proof of income, and supporting documents. Our team reviews each file and contacts you when there’s an update—we can’t guarantee exact turnaround times here; for follow-up, call ${LENDING_PHONE} or email ${LENDING_EMAIL}.`;
  }
  if (/document|paperwork|requirements|what do i need|valid id|collateral|chattel|mortgage|vehicle|property/i.test(m)) {
    return `Most applications need a valid government ID, proof of income, proof of address, and product-specific documents (for example collateral paperwork for secured loans). Complete the Apply form online—our team will tell you if anything else is needed. Product questions: ${LENDING_PHONE}.`;
  }
  if (/eligib|qualif|approved|approval|denied|rejected|credit score|bad credit/i.test(m)) {
    return `Eligibility and approval depend on income, credit history, obligations, and complete documents—underwriting makes the final decision. We can’t guarantee an outcome in chat; apply or call ${LENDING_PHONE} so your situation can be reviewed properly.`;
  }
  if (/how long|processing time|when will|timeline|status of my application/i.test(m)) {
    return `Review timing depends on how complete your documents are and on the loan type—we can’t promise a fixed number of days in this chat. For application status, use the Borrower portal if you’re registered, or call ${LENDING_PHONE}.`;
  }
  if (/payment|repay|installment|penalty|late fee|early pay|pay off|amort/i.test(m)) {
    return `Repayment schedules and penalties are defined in your loan agreement—we can’t quote exact penalty rates here. A representative at ${LENDING_PHONE} can explain your options.`;
  }
  if (/refinance|existing loan|second loan|already have a loan/i.test(m)) {
    return `A specialist needs to review your current account. Please apply or call ${LENDING_PHONE} and mention your existing loan so we can guide you correctly.`;
  }
  if (/complaint|problem with|issue|wrong|error|not happy/i.test(m)) {
    return `Sorry you’re having trouble. Please use **Talk to an agent** or **Human agent** in this chat or call ${LENDING_PHONE} so our staff can assist you directly.`;
  }
  if (/privacy|data|personal information|is my info safe/i.test(m)) {
    return `We use your information to evaluate and service your request. Avoid sharing full ID numbers or sensitive data in chat when possible—official forms on the Apply page are best. Questions: ${LENDING_PHONE}.`;
  }
  if (/borrower portal|login|account|my loan balance|check my balance|remaining balance|payment schedule|payment history/i.test(m)) {
    return `Sign in to the Borrower portal on our website for balances, schedules, and history. We can’t verify account-specific details in this automated chat. For login issues, use Forgot password or call ${LENDING_PHONE}—never share passwords in chat.`;
  }
  if (/forgot password|reset password|change password|locked out/i.test(m)) {
    return `Use the Forgot password link on the Borrower or Admin login page. If the email doesn’t arrive, check spam or call ${LENDING_PHONE}.`;
  }
  if (/admin (?:login|portal)|staff login|loan officer login|backoffice/i.test(m)) {
    return `Admins use the Admin login on the site. Access depends on your role. For access problems, contact your supervisor or IT—never share passwords in chat.`;
  }
  if (/\bofw\b|overseas filipino|working abroad|abroad|expat/i.test(m)) {
    return `Many OFW cases need proper income and document verification. Apply online or call ${LENDING_PHONE} so we can advise which product fits your situation.`;
  }
  if (/insurance|notary|third[- ]party fee/i.test(m)) {
    return `Some products may involve third-party costs. Exact details come from your loan officer or agreement—call ${LENDING_PHONE}.`;
  }
  if (/branch|office|location|davao|manila|luzon|where|address|\bvisit\b|kidapawan|bislig|gensan|lagao|ncr/i.test(m)) {
    return publicLocationFallbackReply(l);
  }
  if (/hours|when are you|schedule/i.test(m)) {
    return `For branch hours and appointments, please call ${LENDING_PHONE}.`;
  }
  if (/hello|hi |^hi$|hey|good morning|good afternoon|help\b/i.test(m)) {
    return `Hello! I’m here for Amalgated Lending Inc.—personal, salary, business, and other loan topics at a high level. What would you like to know? You can also use the quick options in this chat.`;
  }
  if (/thank|thanks|salamat/i.test(m)) {
    return `You’re welcome! If you need anything else about loans or applying, just ask.`;
  }
  return `Thanks for your message. For loan questions, assessed rates and terms, or applications, contact ${LENDING_EMAIL} or call ${LENDING_PHONE}, or use the Apply page on the Amalgated Lending Inc. website.`;
}
