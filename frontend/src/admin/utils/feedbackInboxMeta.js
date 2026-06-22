import {
  Bot,
  HelpCircle,
  MessageSquareQuote,
  MessagesSquare,
  Sparkles,
  Star,
  ThumbsDown,
} from 'lucide-react'

export const QUICK_TABS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'read', label: 'Read' },
  { id: 'replied', label: 'Replied' },
  { id: 'high_rating', label: 'High rating' },
  { id: 'low_rating', label: 'Low rating' },
]

export const FEEDBACK_TYPES = {
  testimonial: {
    id: 'testimonial',
    label: 'Testimonials',
    shortLabel: 'Testimonial',
    description: 'High ratings & publish-ready praise',
    icon: Sparkles,
    accent: 'from-amber-500 to-orange-600',
    chip: 'bg-amber-50 text-amber-900 ring-amber-200',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
  },
  complaint: {
    id: 'complaint',
    label: 'Complaints',
    shortLabel: 'Complaint',
    description: 'Issues, escalations, low ratings',
    icon: ThumbsDown,
    accent: 'from-rose-600 to-red-700',
    chip: 'bg-rose-50 text-rose-800 ring-rose-200',
    border: 'border-l-rose-500',
    dot: 'bg-rose-500',
  },
  inquiry: {
    id: 'inquiry',
    label: 'Inquiries',
    shortLabel: 'Inquiry',
    description: 'Questions & general follow-ups',
    icon: HelpCircle,
    accent: 'from-sky-600 to-blue-700',
    chip: 'bg-sky-50 text-sky-900 ring-sky-200',
    border: 'border-l-sky-500',
    dot: 'bg-sky-500',
  },
  chatbot: {
    id: 'chatbot',
    label: 'Chatbot',
    shortLabel: 'Chatbot',
    description: 'Website assistant submissions',
    icon: Bot,
    accent: 'from-brand-primary to-red-800',
    chip: 'bg-red-50 text-red-900 ring-red-200',
    border: 'border-l-brand-primary',
    dot: 'bg-brand-primary',
  },
  general: {
    id: 'general',
    label: 'General',
    shortLabel: 'General',
    description: 'Other feedback & mixed items',
    icon: MessagesSquare,
    accent: 'from-gray-600 to-gray-800',
    chip: 'bg-gray-100 text-gray-800 ring-gray-200',
    border: 'border-l-gray-400',
    dot: 'bg-gray-400',
  },
}

export function formatTimestamp(ts) {
  if (!ts) return '—'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function avatarText(name, email) {
  const base = String(name || email || '?').trim()
  return (base[0] || '?').toUpperCase()
}

export function resolveFeedbackType(row) {
  const source = String(row?.source || '').toLowerCase()
  const category = String(row?.category || '').toLowerCase()
  const subject = String(row?.subject || '').toLowerCase()
  const rating = Number(row?.rating)
  const priority = String(row?.priority || '').toLowerCase()

  if (source.includes('chatbot') || source.includes('chat bot') || source === 'chat') {
    return 'chatbot'
  }
  if (
    category.includes('complaint') ||
    subject.includes('complaint') ||
    (Number.isFinite(rating) && rating > 0 && rating <= 2) ||
    priority.includes('urgent') ||
    priority.includes('legal')
  ) {
    return 'complaint'
  }
  if (
    category.includes('inquiry') ||
    category.includes('question') ||
    subject.includes('inquiry') ||
    subject.includes('question')
  ) {
    return 'inquiry'
  }
  if (
    (Number.isFinite(rating) && rating >= 4) ||
    String(row?.publication_status || '').toLowerCase() === 'approved' ||
    category.includes('testimonial')
  ) {
    return 'testimonial'
  }
  return 'general'
}

export function countByFeedbackType(items) {
  const counts = { all: items.length, testimonial: 0, complaint: 0, inquiry: 0, chatbot: 0, general: 0 }
  items.forEach((row) => {
    const type = resolveFeedbackType(row)
    counts[type] = (counts[type] || 0) + 1
  })
  return counts
}

export function priorityMeta(priority) {
  const p = String(priority || '').toLowerCase()
  if (p.includes('urgent')) return { label: priority, className: 'bg-brand-primary text-white' }
  if (p.includes('high')) return { label: priority, className: 'bg-red-100 text-red-900 ring-1 ring-red-200' }
  if (p.includes('medium')) return { label: priority, className: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' }
  if (p.includes('low')) return { label: priority, className: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200' }
  if (p.includes('legal')) return { label: priority, className: 'bg-purple-700 text-white' }
  if (p.includes('escalated')) return { label: priority, className: 'bg-fuchsia-700 text-white' }
  return { label: priority || 'Medium', className: 'bg-gray-100 text-gray-800 ring-1 ring-gray-200' }
}

export function statusMeta(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'new') return { label: status, className: 'bg-brand-primary/10 text-brand-primary ring-brand-primary/25' }
  if (s === 'read') return { label: status, className: 'bg-gray-100 text-gray-700 ring-gray-200' }
  if (s === 'replied') return { label: status, className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }
  if (s === 'in progress') return { label: status, className: 'bg-amber-50 text-amber-900 ring-amber-200' }
  if (s === 'escalated') return { label: status, className: 'bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-200' }
  if (s === 'resolved') return { label: status, className: 'bg-teal-50 text-teal-900 ring-teal-200' }
  return { label: status || 'New', className: 'bg-gray-100 text-gray-700 ring-gray-200' }
}

export function publicationMeta(pub, featured) {
  const p = String(pub || 'pending').toLowerCase()
  if (p === 'approved') {
    return featured
      ? { label: 'Featured', className: 'bg-amber-50 text-amber-900 ring-amber-300' }
      : { label: 'Approved', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }
  }
  if (p === 'rejected') return { label: 'Rejected', className: 'bg-rose-50 text-rose-800 ring-rose-300' }
  return { label: 'Pending', className: 'bg-slate-50 text-slate-600 ring-slate-200' }
}

export { MessageSquareQuote, Star }
