import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContactForm } from './ContactForm'
import { ContactList } from './ContactList'
import { ChatPanel } from './ChatPanel'
import { useChats } from '../hooks/useChats'
import { useContacts, useCreateContact } from '../hooks/useContacts'
import type { Contact } from '../types'

const queryClient = new QueryClient()

function CrmChatScreen() {
  const [search, setSearch] = useState('')
  const [page] = useState(1)
  const [activeContact, setActiveContact] = useState<Contact | undefined>()
  const createContact = useCreateContact()
  const contactsQuery = useContacts(search, page)
  const chatsQuery = useChats(activeContact?.id)

  const contacts = useMemo(() => contactsQuery.data?.data ?? [], [contactsQuery.data])
  const chats = useMemo(() => chatsQuery.data?.data ?? [], [chatsQuery.data])
  const activeChat = chats[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="grid gap-4">
        <div className="rounded-xl border border-gray-200 p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search contacts"
          />
        </div>
        <ContactForm onSubmit={async (payload) => void createContact.mutateAsync(payload)} />
        <ContactList contacts={contacts} activeContactId={activeContact?.id} onSelect={setActiveContact} />
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-gray-200 p-4">
          <h2 className="text-lg font-semibold">Chats</h2>
          <p className="text-sm text-gray-500">
            Backend-first reference UI for the new Laravel CRM chat module.
          </p>
          {activeContact ? (
            <div className="mt-2 text-sm text-gray-600">
              Active contact: <strong>{activeContact.name}</strong>
            </div>
          ) : null}
        </div>
        <ChatPanel chat={activeChat} />
      </div>
    </div>
  )
}

export function CrmChatApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <CrmChatScreen />
    </QueryClientProvider>
  )
}
