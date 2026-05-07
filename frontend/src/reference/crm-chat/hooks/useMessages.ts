import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crmChatClient } from '../api/client'

export function useMessages(chatId?: number) {
  return useQuery({
    queryKey: ['crm-messages', chatId],
    enabled: Boolean(chatId),
    queryFn: () => crmChatClient.listMessages(chatId as number),
  })
}

export function useSendMessage(chatId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { content: string; request_ai_reply?: boolean }) =>
      crmChatClient.sendMessage(chatId as number, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['crm-chats'] })
    },
  })
}
