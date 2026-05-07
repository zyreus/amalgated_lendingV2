import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crmChatClient } from '../api/client'
import type { Chat } from '../types'

export function useChats(contactId?: number) {
  return useQuery({
    queryKey: ['crm-chats', contactId ?? 'all'],
    queryFn: () => crmChatClient.listChats(contactId),
  })
}

export function useCreateChat() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Partial<Chat>) => crmChatClient.createChat(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-chats'] })
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] })
    },
  })
}
