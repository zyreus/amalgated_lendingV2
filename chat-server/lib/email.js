/**
 * Email notification service — Google Workspace SMTP (primary).
 * Configure SMTP_HOST=smtp.gmail.com, SMTP_USER, SMTP_PASS (App Password), MAIL_FROM.
 */

import nodemailer from 'nodemailer'

let transporter = null

const DELAY_MS = 150
const SMTP_RETRY_ATTEMPTS = Number(process.env.MAIL_RETRY_ATTEMPTS) || 3
const SMTP_RETRY_DELAY_MS = Number(process.env.MAIL_RETRY_DELAY_MS) || 750

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com').trim()
  const user = (process.env.SMTP_USER || process.env.MAIL_USERNAME || '').trim()
  const pass = process.env.SMTP_PASS || process.env.MAIL_PASSWORD || ''
  if (!host || !user || !pass) return null
  return {
    host,
    port: Number(process.env.SMTP_PORT || process.env.MAIL_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true' || String(process.env.MAIL_ENCRYPTION || 'tls').toLowerCase() === 'ssl',
    auth: { user, pass },
  }
}

function getTransporter() {
  if (transporter !== null) return transporter
  const cfg = getSmtpConfig()
  if (!cfg) return null
  transporter = nodemailer.createTransport(cfg)
  return transporter
}

export function isEmailConfigured() {
  return !!getTransporter()
}

export function getBaseUrl(port = process.env.PORT || 8000) {
  const base = (process.env.SITE_URL || '').replace(/\/$/, '')
  return base || `http://localhost:${port}`
}

export function buildUnsubscribeUrl(token, port) {
  return `${getBaseUrl(port)}/api/unsubscribe/${token}`
}

export function buildReadMoreUrl(type, port) {
  const base = getBaseUrl(port)
  if (type === 'careers') return `${base}/careers`
  if (type === 'news') return `${base}/news`
  return `${base}/news`
}

function getEmailLogoUrl(port) {
  const custom = (process.env.EMAIL_LOGO_URL || '').trim()
  if (custom) return custom
  return `${getBaseUrl(port)}/Amalgated_holdings.png`
}

function defaultFrom() {
  return (
    process.env.MAIL_FROM
    || process.env.MAIL_FROM_ADDRESS
    || (process.env.SMTP_USER ? `"Amalgated Lending" <${process.env.SMTP_USER}>` : 'support@amalgatedlending.com')
  )
}

function normalizeFrom(addr) {
  if (!addr || typeof addr !== 'string') return defaultFrom()
  const s = addr.trim()
  const match = s.match(/<?([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/)
  const email = match ? match[1] : s
  const nameMatch = s.match(/^["']?([^"'<]+)["']?\s*</)
  const name = nameMatch ? nameMatch[1].trim() : 'Amalgated Lending'
  return `${name} <${email}>`
}

function escapeHtml(s) {
  if (s == null || typeof s !== 'string') return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function sendViaSmtp(options) {
  const trans = getTransporter()
  if (!trans) return null
  const from = normalizeFrom(options.from || defaultFrom())
  let lastError = null
  for (let attempt = 1; attempt <= SMTP_RETRY_ATTEMPTS; attempt++) {
    try {
      return await trans.sendMail({ ...options, from })
    } catch (err) {
      lastError = err
      if (attempt < SMTP_RETRY_ATTEMPTS) {
        await sleep(SMTP_RETRY_DELAY_MS * attempt)
      }
    }
  }
  throw lastError
}

async function sendOne(options) {
  const fromAddr = options.from || defaultFrom()
  const from = normalizeFrom(fromAddr)
  const result = await sendViaSmtp({ ...options, from })
  if (result === null) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (Google App Password) in .env.')
  }
  return result
}

export async function sendCustomEmail({ to, subject, html, text }) {
  const from = defaultFrom()
  return sendOne({ from, to, subject, html, text })
}

export async function sendApplicationConfirmationEmail({ to, applicantName, jobTitle }) {
  const from = defaultFrom()
  const logoUrl = getEmailLogoUrl()
  const safeName = escapeHtml(applicantName || 'Applicant')
  const safeTitle = escapeHtml(jobTitle || 'your application')
  const subject = `Application received – Amalgated Holdings`
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Application Received</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <div style="margin-bottom: 24px;">
    <img src="${logoUrl}" alt="Amalgated Holdings" style="height: 48px; width: auto; display: block;" />
  </div>
  <h2 style="margin: 0 0 16px; font-size: 1.25rem; color: #2F6FA3;">Application received</h2>
  <p style="margin: 0 0 12px; line-height: 1.5;">Dear ${safeName},</p>
  <p style="margin: 0 0 12px; line-height: 1.5;">Thank you for applying for <strong>${safeTitle}</strong> at Amalgated Holdings. We have received your application and resume.</p>
  <p style="margin: 0 0 24px; line-height: 1.5;">Our team will review your submission and get in touch if your profile matches our current needs.</p>
  <p style="margin: 0; font-size: 12px; color: #6b7280;">Amalgated Holdings</p>
</body>
</html>`
  const text = `Dear ${applicantName || 'Applicant'},\n\nThank you for applying for ${jobTitle || 'your application'} at Amalgated Holdings.\n\nAmalgated Holdings`
  return sendOne({ from, to, subject, html, text })
}

export async function sendTestEmail(to) {
  const from = defaultFrom()
  const logoUrl = getEmailLogoUrl()
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test Email</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #1f2937;">
  <div style="margin-bottom: 20px;">
    <img src="${logoUrl}" alt="Amalgated Lending" style="height: 48px; width: auto; display: block;" />
  </div>
  <h2 style="margin: 0 0 12px; color: #2F6FA3;">Google Workspace SMTP — Test Email</h2>
  <p style="margin: 0 0 8px; line-height: 1.6;">
    Your email configuration is working. Subscribers and chat notifications will be delivered through Google Workspace SMTP.
  </p>
  <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">Sent at ${new Date().toISOString()}</p>
</body>
</html>`
  const result = await sendOne({
    from,
    to,
    subject: 'Amalgated Lending — SMTP configuration test',
    html,
    text: 'Your Google Workspace SMTP configuration is working correctly.',
  })
  if (result === null) throw new Error('SMTP is not configured.')
  return result
}

const emailQueue = []
let queueProcessing = false

async function processQueue() {
  if (queueProcessing || emailQueue.length === 0) return
  queueProcessing = true
  while (emailQueue.length > 0) {
    const job = emailQueue.shift()
    try {
      await sendNotificationEmailsSync(job.opts, job.subscribers)
    } catch (e) {
      console.error('[email] Queue job failed:', e?.message || e)
    }
  }
  queueProcessing = false
}

export function queueNotificationEmails(opts, subscribers) {
  if (!subscribers?.length) return
  emailQueue.push({ opts, subscribers })
  setImmediate(processQueue)
}

export async function sendNotificationEmails(opts, subscribers) {
  queueNotificationEmails(opts, subscribers)
}

async function sendNotificationEmailsSync(opts, subscribers) {
  if (!isEmailConfigured() || !subscribers?.length) return

  const { type, title, description, port } = opts
  const readMoreUrl = buildReadMoreUrl(type, port)
  const typeLabel = type === 'careers' ? 'New career posting' : 'New news article'
  const buttonLabel = type === 'careers' ? 'Apply Now' : 'Read News'
  const safeTitle = escapeHtml(title || 'Update')
  const safeDesc = escapeHtml(description || '')
  const logoUrl = getEmailLogoUrl(port)

  for (const sub of subscribers) {
    try {
      const unsubscribeUrl = buildUnsubscribeUrl(sub.unsubscribe_token || sub.id, port)
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${typeLabel}</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <div style="margin-bottom: 24px;">
    <img src="${logoUrl}" alt="Amalgated Holdings" style="height: 48px; width: auto; display: block;" />
  </div>
  <h2 style="margin: 0 0 16px; font-size: 1.25rem;">${typeLabel}</h2>
  <p style="margin: 0 0 12px; line-height: 1.5;">${safeTitle}</p>
  ${safeDesc ? `<p style="margin: 0 0 20px; line-height: 1.5; color: #4b5563;">${safeDesc}</p>` : ''}
  <p style="margin: 0 0 24px;">
    <a href="${readMoreUrl}" style="display: inline-block; padding: 10px 20px; background: #2F6FA3; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">${buttonLabel}</a>
  </p>
  <p style="margin: 0; font-size: 12px; color: #6b7280;">
    You received this because you subscribed to ${type === 'careers' ? 'careers' : 'news'} updates.
    <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a>
  </p>
</body>
</html>`
      await sendOne({
        from: defaultFrom(),
        to: sub.email,
        subject: `${typeLabel}: ${(title || 'Update').slice(0, 60)}`,
        html,
        text: `${typeLabel}\n\n${title || 'Update'}\n\n${description || ''}\n\n${buttonLabel}: ${readMoreUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
      })
      await sleep(DELAY_MS)
    } catch (err) {
      const msg = err?.message || String(err)
      if (msg.includes('BadCredentials') || msg.includes('Invalid login') || msg.includes('535')) {
        console.error('[email] Google SMTP auth failed. Use an App Password for MAIL_PASSWORD / SMTP_PASS.')
      } else {
        console.error('[email] Failed to send to', sub.email, msg)
      }
    }
  }
}
