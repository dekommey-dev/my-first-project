import type { Conversation, Effort, Message, ServerInfo } from '../types'

/**
 * Base URL of the API. Empty means "same origin", which is what the Vite dev
 * proxy and the production nginx container both provide. A build for a
 * separately-hosted API sets VITE_API_BASE_URL.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new ApiError(response.status, detail?.error ?? `Request failed (${response.status})`)
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export const api = {
  info: () => request<ServerInfo>('/api/models'),

  listConversations: () =>
    request<{ conversations: Conversation[] }>('/api/conversations').then((r) => r.conversations),

  getConversation: (id: string) =>
    request<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}`),

  renameConversation: (id: string, title: string) =>
    request<{ conversation: Conversation }>(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }).then((r) => r.conversation),

  deleteConversation: (id: string) =>
    request<void>(`/api/conversations/${id}`, { method: 'DELETE' }),
}

export interface ChatRequest {
  conversationId?: string
  message?: string
  model: string
  systemPrompt: string
  effort: Effort
  showThinking: boolean
  webSearch: boolean
  retryFromMessageId?: string
}

export interface ChatHandlers {
  onMeta(payload: { conversationId: string; model: string; userMessage: Message | null }): void
  onDelta(text: string): void
  onThinking(text: string): void
  onTool(label: string): void
  onRefusal(message: string): void
  onTitle(title: string): void
  onDone(payload: { message: Message | null }): void
  onError(message: string): void
}

/**
 * Posts a turn and consumes the SSE response.
 *
 * EventSource cannot POST, so the stream is read off `fetch` and framed by
 * hand. Frames are separated by a blank line; a frame that straddles two
 * network chunks stays in `buffer` until the rest of it arrives.
 */
export async function streamChat(
  body: ChatRequest,
  handlers: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (signal.aborted) return
    handlers.onError(
      error instanceof TypeError
        ? 'Could not reach the API server. Is it running?'
        : String(error),
    )
    return
  }

  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => null)
    handlers.onError(detail?.error ?? `Request failed (${response.status})`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        dispatch(buffer.slice(0, boundary), handlers)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }
    }
  } catch (error) {
    if (!signal.aborted) handlers.onError(String(error))
  } finally {
    reader.cancel().catch(() => {})
  }
}

function dispatch(frame: string, handlers: ChatHandlers): void {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of frame.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim()
    else if (line.startsWith('data: ')) dataLines.push(line.slice(6))
  }
  if (dataLines.length === 0) return

  let payload: any
  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    return
  }

  switch (event) {
    case 'meta':
      handlers.onMeta(payload)
      break
    case 'delta':
      handlers.onDelta(payload.text)
      break
    case 'thinking':
      handlers.onThinking(payload.text)
      break
    case 'tool':
      handlers.onTool(payload.label)
      break
    case 'refusal':
      handlers.onRefusal(payload.message)
      break
    case 'title':
      handlers.onTitle(payload.title)
      break
    case 'done':
      handlers.onDone(payload)
      break
    case 'error':
      handlers.onError(payload.message)
      break
  }
}
