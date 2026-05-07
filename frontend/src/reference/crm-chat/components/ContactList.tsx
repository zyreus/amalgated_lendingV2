import type { Contact } from '../types'

type ContactListProps = {
  contacts: Contact[]
  activeContactId?: number
  onSelect: (contact: Contact) => void
}

export function ContactList({ contacts, activeContactId, onSelect }: ContactListProps) {
  return (
    <div className="rounded-xl border border-gray-200">
      {contacts.map((contact) => (
        <button
          key={contact.id}
          type="button"
          onClick={() => onSelect(contact)}
          className={`block w-full border-b border-gray-200 px-4 py-3 text-left last:border-b-0 ${
            activeContactId === contact.id ? 'bg-red-50' : 'bg-white'
          }`}
        >
          <div className="font-semibold">{contact.name}</div>
          <div className="text-sm text-gray-500">{contact.email || 'No email'}</div>
          <div className="text-xs text-gray-400">
            {contact.company || 'Independent'} · {contact.chats_count ?? 0} chat(s)
          </div>
        </button>
      ))}
    </div>
  )
}
