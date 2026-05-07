import type { Chat, Contact, Message, MessageListResponse, PaginatedResponse } from '../types'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: HttpMethod
  body?: unknown
  signal?: AbortSignal
}

const API_BASE = '/api/v1/admin'

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`)
  }

  return data as T
}

export const crmChatClient = {
  listContacts(search = '', page = 1) {
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    qs.set('page', String(page))
    return request<PaginatedResponse<Contact>>(`/contacts?${qs.toString()}`)
  },
  getContact(id: number) {
    return request<{ data: Contact }>(`/contacts/${id}`)
  },
  createContact(payload: Partial<Contact>) {
    return request<{ data: Contact }>('/contacts', { method: 'POST', body: payload })
  },
  updateContact(id: number, payload: Partial<Contact>) {
    return request<{ data: Contact }>(`/contacts/${id}`, { method: 'PUT', body: payload })
  },
  deleteContact(id: number) {
    return request<{ ok: boolean }>(`/contacts/${id}`, { method: 'DELETE' })
  },
  listChats(contactId?: number) {
    const qs = new URLSearchParams()
    if (contactId) qs.set('contact_id', String(contactId))
    return request<PaginatedResponse<Chat>>(`/chats?${qs.toString()}`)
  },
  createChat(payload: Partial<Chat>) {
    return request<{ data: Chat }>('/chats', { method: 'POST', body: payload })
  },
  listMessages(chatId: number, afterId?: number) {
    const qs = new URLSearchParams()
    if (afterId) qs.set('after_id', String(afterId))
    return request<MessageListResponse>(`/chats/${chatId}/messages?${qs.toString()}`)
  },
  sendMessage(chatId: number, payload: { content: string; request_ai_reply?: boolean }) {
    return request<{ ok: boolean; data: Message }>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: payload,
    })
  },
  async streamAiReply(
    chatId: number,
    payload: { message: string; stream_request_key: string },
    onChunk: (chunk: string) => void
  ) {
    const response = await fetch(`${API_BASE}/chats/${chatId}/messages/stream-ai`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      throw new Error(`Streaming failed (${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      onChunk(decoder.decode(value, { stream: true }))
    }
  },
}
