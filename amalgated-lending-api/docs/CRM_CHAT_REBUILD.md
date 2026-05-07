# CRM Chat Rebuild Notes

## New Laravel CRM Domain

This rebuild introduces a new Laravel-first CRM/chat domain:

- `contacts`
- `chats`
- `messages`
- `ai_usages`

The first pass is intentionally isolated from the current mixed implementation:

- Laravel legacy CRM: `Lead`, `LeadMessage`
- Node CRM/chat server: `chat-server/server.js`

That lets the new API ship without breaking the current production paths.

## Important Indexes

Add and keep the following indexes:

- `contacts(owner_user_id, status, updated_at)`
- `contacts(owner_user_id, email)`
- `contacts(owner_user_id, last_contacted_at)`
- `chats(contact_id, last_message_at)`
- `chats(owner_user_id, status, last_message_at)`
- `chats(owner_user_id, updated_at)`
- `messages(chat_id, created_at)`
- `messages(chat_id, id)` for seek-pagination
- `messages(sender_type, sender_user_id)`
- `messages(stream_request_key)`
- `ai_usages(chat_id, created_at)`
- `ai_usages(message_id)`
- `ai_usages(provider, model)`

## Performance Tips

### Contacts

- Always paginate contact lists.
- Use `withCount('chats')` in list views instead of loading chats.
- Use a subquery for `latest_chat_at` instead of joining the full chat table when you only need sort metadata.

### Chats

- Never return every chat in one request.
- Load only:
  - `contact`
  - `latestMessage`
  - `messages_count`
- Cache dashboard-style aggregates per owner in Redis and invalidate on contact/chat/message writes.

### Messages

- Prefer seek pagination (`before_id` / `after_id`) over page offsets.
- Load only the newest context window for AI jobs.
- Do not render full message history in contact or chat list endpoints.

### Database

- Keep bigint PKs for joins and secondary indexes.
- Use UUID public IDs for external references only.
- Make sure `last_message_id` and `last_message_at` are updated transactionally whenever a new message is stored.

## AI Integration Notes

### Never call AI synchronously in controllers

The new flow is:

1. store the user/agent message
2. update chat unread counters and `last_message_*`
3. dispatch a queued AI job
4. persist AI usage and the final assistant message asynchronously

### Context window management

Use:

- contact summary
- chat summary
- only the latest `N` messages

Do not send the entire thread to the provider.

### Usage tracking

Persist:

- provider
- model
- prompt tokens
- completion tokens
- total tokens
- latency
- request key
- status

## Streaming AI in Chat

Recommended production flow:

1. `POST /messages` stores the customer or agent message
2. `POST /messages/stream-ai` starts an SSE or streamed response
3. server streams provider deltas to the client
4. on completion, persist the assistant message and usage row
5. if the stream fails, persist a failed usage row and allow retry by request key

The current implementation includes a Laravel streamed endpoint scaffold. In production, replace the placeholder chunking with provider-native streaming.

## Migration Path From Existing CRM

### Phase 1

- Ship the new Laravel CRM endpoints beside the current Node and legacy Laravel CRM endpoints.
- Keep admin UI reads on the existing implementation while validating the new schema and API responses.

### Phase 2

- Map `Lead` to `Contact`
- Map legacy/Node `conversation` to `Chat`
- Map `LeadMessage` and Node message rows to `Message`
- Backfill `last_message_id`, `last_message_at`, and unread counters
- Generate initial contact summaries in the background

### Phase 3

- Switch admin CRM reads from Node endpoints to Laravel `/api/v1/admin/contacts`, `/chats`, `/messages`
- Keep Node chat server only for websocket-specific traffic until parity is complete

### Phase 4

- Remove duplicated CRM reads and writes in Node
- Keep only dedicated realtime/socket concerns in Node if still needed
- Consolidate all CRM persistence in Laravel

## Frontend Scaffold Notes

Reference frontend files live under:

- `frontend/src/reference/crm-chat`

They are intentionally not wired into the existing JS routes yet. This keeps the current UI stable while the Laravel API is validated.
