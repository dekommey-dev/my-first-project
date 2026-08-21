import { Router } from 'express'
import { z } from 'zod'
import { store, type Message } from '../db.js'
import { env } from '../env.js'
import { openEventStream } from '../lib/http.js'
import { provider } from '../llm/index.js'
import { EFFORT_LEVELS, findModel, resolveModel } from '../llm/models.js'
import type { StreamChunk } from '../llm/types.js'

const router = Router()

const chatBody = z.object({
  conversationId: z.string().optional(),
  message: z.string().max(200_000).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().max(20_000).optional(),
  effort: z.enum(EFFORT_LEVELS).default('high'),
  showThinking: z.boolean().default(false),
  webSearch: z.boolean().default(false),
  /**
   * Re-answer from an earlier point: this message and everything after it is
   * dropped before the model is called again.
   */
  retryFromMessageId: z.string().optional(),
})

router.post('/', async (req, res) => {
  let body: z.infer<typeof chatBody>
  try {
    body = chatBody.parse(req.body ?? {})
  } catch (error) {
    res.status(400).json({ error: 'invalid request body', detail: String(error) })
    return
  }

  if (body.model && !findModel(body.model)) {
    res.status(400).json({ error: `unknown model "${body.model}"` })
    return
  }

  // Errors that happen before the stream opens are plain JSON; once headers are
  // out, everything has to travel as an SSE `error` event instead.
  let conversation = body.conversationId ? store.getConversation(body.conversationId) : null
  if (body.conversationId && !conversation) {
    res.status(404).json({ error: 'conversation not found' })
    return
  }

  const model = resolveModel(body.model ?? conversation?.model, env.defaultModel)
  const systemPrompt = body.systemPrompt ?? conversation?.systemPrompt ?? ''

  if (!conversation) {
    conversation = store.createConversation({ model: model.id, systemPrompt })
  } else if (conversation.model !== model.id || conversation.systemPrompt !== systemPrompt) {
    conversation = store.updateConversation(conversation.id, {
      model: model.id,
      systemPrompt,
    })!
  }

  if (body.retryFromMessageId) {
    store.deleteMessagesFrom(conversation.id, body.retryFromMessageId)
  }

  let userMessage: Message | null = null
  if (body.message?.trim()) {
    userMessage = store.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: body.message,
    })
  }

  const history = store.listMessages(conversation.id)
  if (history.length === 0) {
    res.status(400).json({ error: 'nothing to send: provide a message or a retry point' })
    return
  }
  if (history.at(-1)?.role !== 'user') {
    res.status(400).json({ error: 'the last message must come from the user' })
    return
  }

  const isFirstExchange = history.filter((message) => message.role === 'user').length === 1

  const stream = openEventStream(res)
  const controller = new AbortController()
  // Must be `res`, not `req`: Node emits 'close' on the request object once its
  // body has been consumed, which would abort every stream immediately.
  res.on('close', () => controller.abort())

  stream.send('meta', {
    conversationId: conversation.id,
    model: model.id,
    provider: provider.name,
    userMessage,
  })

  let answer = ''
  let usage = { inputTokens: 0, outputTokens: 0 }
  let refused = false

  try {
    const chunks = provider.complete({
      model: model.id,
      system: systemPrompt,
      messages: history.map((message) => ({ role: message.role, content: message.content })),
      effort: body.effort,
      showThinking: body.showThinking,
      webSearch: body.webSearch,
      signal: controller.signal,
    })

    for await (const chunk of chunks as AsyncIterable<StreamChunk>) {
      if (!stream.open) break

      switch (chunk.type) {
        case 'text':
          answer += chunk.text
          stream.send('delta', { text: chunk.text })
          break
        case 'thinking':
          stream.send('thinking', { text: chunk.text })
          break
        case 'tool':
          stream.send('tool', { label: chunk.label })
          break
        case 'refusal':
          refused = true
          answer += (answer ? '\n\n' : '') + chunk.message
          stream.send('refusal', { message: chunk.message })
          break
        case 'usage':
          usage = { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens }
          break
      }
    }
  } catch (error) {
    const aborted = controller.signal.aborted
    if (!aborted) {
      console.error('[chat] completion failed:', error)
      stream.send('error', { message: describe(error) })
    }
    // A partial answer is still worth keeping — it is what the user saw.
    if (answer.trim()) persist()
    stream.close()
    return
  }

  const assistantMessage = answer.trim() ? persist() : null

  if (isFirstExchange && userMessage) {
    try {
      const title = await provider.title(userMessage.content, model.id)
      if (title) {
        store.updateConversation(conversation.id, { title })
        stream.send('title', { title })
      }
    } catch (error) {
      console.warn('[chat] title generation failed:', describe(error))
    }
  }

  stream.send('done', { message: assistantMessage, usage, refused })
  stream.close()

  function persist(): Message {
    return store.addMessage({
      conversationId: conversation!.id,
      role: 'assistant',
      content: answer,
      model: model.id,
    })
  }
})

function describe(error: unknown): string {
  if (error instanceof Error) {
    const status = (error as { status?: number }).status
    return status ? `${error.message} (HTTP ${status})` : error.message
  }
  return String(error)
}

export default router
