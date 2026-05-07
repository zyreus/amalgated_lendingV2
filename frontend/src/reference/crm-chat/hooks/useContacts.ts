import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crmChatClient } from '../api/client'
import type { Contact } from '../types'

export function useContacts(search: string, page: number) {
  return useQuery({
    queryKey: ['crm-contacts', search, page],
    queryFn: () => crmChatClient.listContacts(search, page),
  })
}

export function useCreateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Partial<Contact>) => crmChatClient.createContact(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Contact> }) =>
      crmChatClient.updateContact(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] })
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => crmChatClient.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['crm-chats'] })
    },
  })
}
