import { useMemo, useState } from 'react'
import { crmChatClient } from '../api/client'
import { useMessages, useSendMessage } from '../hooks/useMessages'
import type { Chat } from '../types'

type ChatPanelProps = {
  chat?: Chat
}

export function ChatPanel({ chat }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [streamed, setStreamed] = useState('')
  const messagesQuery = useMessages(chat?.id)
  const sendMessage = useSendMessage(chat?.id)

  const messages = useMemo(() => messagesQuery.data?.data ?? [], [messagesQuery.data])

  if (!chat) {
    return <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">Select a chat to inspect messages.</div>
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold">{chat.subject || 'Untitled chat'}</h3>
        <p className="text-sm text-gray-500">
          {chat.channel} · {chat.status} · {chat.messages_count ?? 0} messages
        </p>
      </div>

      <div className="min-h-[320px] rounded-xl border border-gray-200 p-4">
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-400">{message.sender_type}</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{message.content}</div>
            </div>
          ))}
          {streamed ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-xs uppercase text-red-500">AI stream preview</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{streamed}</div>
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="grid gap-3 rounded-xl border border-gray-200 p-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!draft.trim()) return

          const content = draft.trim()
          setDraft('')
          setStreamed('')

          await sendMessage.mutateAsync({ content, request_ai_reply: true })

          const streamKey = crypto.randomUUID()
          await crmChatClient.streamAiReply(
            chat.id,
            { message: content, stream_request_key: streamKey },
            (chunk) => setStreamed((prev) => prev + chunk)
          )
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a reply and trigger the AI assistant…"
        />
        <button disabled={sendMessage.isPending} type="submit">
          {sendMessage.isPending ? 'Sending…' : 'Send and stream AI'}
        </button>
      </form>
    </div>
  )
}
