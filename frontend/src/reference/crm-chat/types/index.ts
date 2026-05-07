export type PaginatedResponse<T> = {
  data: T[]
  links?: Record<string, string | null>
  meta?: {
    current_page?: number
    from?: number | null
    last_page?: number
    path?: string
    per_page?: number
    to?: number | null
    total?: number
  }
}

export type Contact = {
  id: number
  public_id: string
  owner_user_id: number
  name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  source: string | null
  status: string
  notes: string | null
  metadata: Record<string, unknown>
  ai_summary: string | null
  ai_summary_generated_at: string | null
  last_contacted_at: string | null
  chats_count?: number
  latest_chat_at?: string | null
  created_at: string
  updated_at: string
}

export type Chat = {
  id: number
  public_id: string
  contact_id: number
  owner_user_id: number
  subject: string | null
  channel: string
  status: string
  customer_unread_count: number
  agent_unread_count: number
  messages_count?: number
  last_message_at: string | null
  context_window_size: number
  ai_summary: string | null
  ai_summary_generated_at: string | null
  metadata: Record<string, unknown>
  contact?: Contact
  latest_message?: Message
  created_at: string
  updated_at: string
}

export type Message = {
  id: number
  public_id: string
  chat_id: number
  sender_type: 'customer' | 'agent' | 'ai' | 'system'
  sender_user_id: number | null
  role: string
  content: string
  is_ai_generated: boolean
  provider: string | null
  model: string | null
  parent_message_id: number | null
  stream_request_key: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type MessageListResponse = {
  ok: boolean
  data: Message[]
  meta: {
    limit: number
    has_more: boolean
  }
}
