import { useState } from 'react'
import type { Contact } from '../types'

type ContactFormProps = {
  initialValue?: Partial<Contact>
  onSubmit: (payload: Partial<Contact>) => Promise<void> | void
}

export function ContactForm({ initialValue, onSubmit }: ContactFormProps) {
  const [form, setForm] = useState({
    name: initialValue?.name ?? '',
    email: initialValue?.email ?? '',
    phone: initialValue?.phone ?? '',
    company: initialValue?.company ?? '',
    source: initialValue?.source ?? 'manual',
    notes: initialValue?.notes ?? '',
  })

  return (
    <form
      className="grid gap-3 rounded-xl border border-gray-200 p-4"
      onSubmit={async (event) => {
        event.preventDefault()
        await onSubmit(form)
      }}
    >
      <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Name" />
      <input value={form.email ?? ''} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="Email" />
      <input value={form.phone ?? ''} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Phone" />
      <input value={form.company ?? ''} onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))} placeholder="Company" />
      <textarea value={form.notes ?? ''} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Notes" />
      <button type="submit">Save contact</button>
    </form>
  )
}
