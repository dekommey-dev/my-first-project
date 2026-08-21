import { Router } from 'express'
import { z } from 'zod'
import { store } from '../db.js'
import { env } from '../env.js'
import { badRequest, notFound } from '../lib/http.js'
import { findModel } from '../llm/models.js'

const router = Router()

const createBody = z.object({
  title: z.string().max(200).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().max(20_000).optional(),
})

const patchBody = z
  .object({
    title: z.string().max(200).optional(),
    model: z.string().optional(),
    systemPrompt: z.string().max(20_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'no fields to update' })

function requireKnownModel(model: string | undefined): string | undefined {
  if (model === undefined) return undefined
  if (!findModel(model)) throw badRequest(`unknown model "${model}"`)
  return model
}

router.get('/', (_req, res) => {
  res.json({ conversations: store.listConversations() })
})

router.post('/', (req, res) => {
  const body = createBody.parse(req.body ?? {})
  const conversation = store.createConversation({
    title: body.title,
    model: requireKnownModel(body.model) ?? env.defaultModel,
    systemPrompt: body.systemPrompt,
  })
  res.status(201).json({ conversation, messages: [] })
})

router.get('/:id', (req, res) => {
  const conversation = store.getConversation(req.params.id)
  if (!conversation) throw notFound('conversation')
  res.json({ conversation, messages: store.listMessages(conversation.id) })
})

router.patch('/:id', (req, res) => {
  const body = patchBody.parse(req.body ?? {})
  requireKnownModel(body.model)
  const conversation = store.updateConversation(req.params.id, body)
  if (!conversation) throw notFound('conversation')
  res.json({ conversation })
})

router.delete('/:id', (req, res) => {
  if (!store.deleteConversation(req.params.id)) throw notFound('conversation')
  res.status(204).end()
})

/** Drops a message and everything after it — the "retry from here" primitive. */
router.delete('/:id/messages/:messageId', (req, res) => {
  if (!store.getConversation(req.params.id)) throw notFound('conversation')
  const removed = store.deleteMessagesFrom(req.params.id, req.params.messageId)
  if (removed === 0) throw notFound('message')
  res.json({ removed, messages: store.listMessages(req.params.id) })
})

export default router
