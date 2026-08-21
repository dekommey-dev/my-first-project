import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env.js'
import { resolveModel } from './models.js'
import type { CompletionRequest, Provider, StreamChunk } from './types.js'

/**
 * Built on first use. The SDK constructor rejects a missing key, and this
 * module is imported even in demo mode, so construction has to wait until a
 * request actually needs it.
 */
let cachedClient: Anthropic | null = null
function getClient(): Anthropic {
  cachedClient ??= new Anthropic({ apiKey: env.anthropicApiKey })
  return cachedClient
}

/**
 * Server-side refusal fallback: when a safety classifier declines a request the
 * API reroutes it instead of handing back an unusable turn. It rides on a beta
 * flag, so `beta` is dropped for the rest of the process the first time the API
 * says it does not know it — that keeps the app working on keys without access.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
let fallbackSupported = true

function isUnknownBetaError(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError) || error.status !== 400) return false
  return /beta|fallback/i.test(error.message)
}

function buildParams(request: CompletionRequest) {
  const spec = resolveModel(request.model, env.defaultModel)

  const params: Record<string, unknown> = {
    model: spec.id,
    max_tokens: spec.maxOutputTokens,
    messages: request.messages.map((turn) => ({ role: turn.role, content: turn.content })),
  }

  if (request.system.trim()) params.system = request.system.trim()

  // `effort` replaced `temperature` on this model generation — temperature is
  // rejected outright, so it is never sent.
  if (spec.supportsEffort) params.output_config = { effort: request.effort }

  // Opus 5 thinks adaptively whether or not `thinking` is present; the flag
  // controls only whether a readable summary is streamed back to the browser.
  if (spec.supportsAdaptiveThinking) {
    params.thinking = request.showThinking
      ? { type: 'adaptive', display: 'summarized' }
      : { type: 'adaptive' }
  }

  if (request.webSearch && spec.supportsWebSearch) {
    params.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }]
  }

  return params
}

async function* streamOnce(
  params: Record<string, unknown>,
  signal: AbortSignal,
): AsyncGenerator<StreamChunk, Anthropic.Message | null> {
  const useBeta = fallbackSupported
  const options = { signal }

  const client = getClient()
  const stream = useBeta
    ? client.beta.messages.stream(
        { ...params, betas: [FALLBACK_BETA], fallbacks: 'default' } as never,
        options,
      )
    : client.messages.stream(params as never, options)

  for await (const event of stream as AsyncIterable<Anthropic.MessageStreamEvent>) {
    if (event.type === 'content_block_start') {
      const block = event.content_block
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        yield { type: 'tool', label: 'Searching the web' }
      }
      continue
    }
    if (event.type !== 'content_block_delta') continue

    const delta = event.delta
    if (delta.type === 'text_delta') {
      yield { type: 'text', text: delta.text }
    } else if (delta.type === 'thinking_delta') {
      yield { type: 'thinking', text: delta.thinking }
    }
  }

  return (await stream.finalMessage()) as Anthropic.Message
}

async function* completeWithBetaRetry(request: CompletionRequest): AsyncGenerator<StreamChunk> {
  const params = buildParams(request)
  const history = [...(params.messages as Anthropic.MessageParam[])]
  let inputTokens = 0
  let outputTokens = 0

  // `pause_turn` means a server-side tool run was interrupted mid-turn; the
  // assistant content so far is echoed back and the turn continues.
  for (let turn = 0; turn < 6; turn += 1) {
    let final: Anthropic.Message | null = null

    try {
      final = yield* streamOnce({ ...params, messages: history }, request.signal)
    } catch (error) {
      if (isUnknownBetaError(error) && fallbackSupported) {
        console.warn(`[llm] beta "${FALLBACK_BETA}" unavailable on this key; continuing without it`)
        fallbackSupported = false
        final = yield* streamOnce({ ...params, messages: history }, request.signal)
      } else {
        throw error
      }
    }

    if (!final) return

    inputTokens += final.usage?.input_tokens ?? 0
    outputTokens += final.usage?.output_tokens ?? 0

    if (final.stop_reason === 'refusal') {
      // `stop_details` is populated only for refusals and is newer than the
      // installed SDK's `Message` type, so it is read off a narrowed cast.
      const details = (final as { stop_details?: { explanation?: string } | null }).stop_details
      yield {
        type: 'refusal',
        message: details?.explanation ?? 'This request was declined by a safety classifier.',
      }
      break
    }

    if (final.stop_reason === 'pause_turn') {
      history.push({ role: 'assistant', content: final.content })
      continue
    }

    break
  }

  yield { type: 'usage', inputTokens, outputTokens }
}

export const anthropicProvider: Provider = {
  name: 'anthropic',

  complete: completeWithBetaRetry,

  async title(firstUserMessage, model) {
    const spec = resolveModel(model, env.defaultModel)
    const response = await getClient().messages.create({
      // Titling is a trivial classification job; the cheapest model is plenty.
      model: spec.supportsEffort ? 'claude-haiku-4-5' : spec.id,
      max_tokens: 64,
      system:
        'Write a short title for a chat that opens with the message below. ' +
        'Four words at most, in the language the message is written in. ' +
        'No quotes, no trailing punctuation, no preamble — reply with the title only.',
      messages: [{ role: 'user', content: firstUserMessage.slice(0, 2000) }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    return text.replace(/^["'\s]+|["'.\s]+$/g, '').slice(0, 80)
  },
}

export { Anthropic }
