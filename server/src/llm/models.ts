/**
 * Catalog of models the UI can offer.
 *
 * The capability flags matter: the current Claude models reject request
 * parameters that older ones accepted. `temperature` is gone from the Opus 5 /
 * Sonnet 5 generation (a 400, not a warning), thinking is configured with
 * `{type: 'adaptive'}` rather than a token budget, and `output_config.effort`
 * is the knob that replaced temperature for trading cost against quality.
 * Sending the wrong shape fails the whole request, so every field below is
 * consulted before a request is built.
 */
export interface ModelSpec {
  id: string
  name: string
  description: string
  contextWindow: number
  maxOutputTokens: number
  /** Accepts `output_config: { effort }`. */
  supportsEffort: boolean
  /** Accepts `thinking: { type: 'adaptive' }`. */
  supportsAdaptiveThinking: boolean
  /** Accepts the `web_search_20260209` server tool. */
  supportsWebSearch: boolean
}

export const MODELS: ModelSpec[] = [
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    description: 'Most capable everyday model. Best reasoning and coding.',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    supportsEffort: true,
    supportsAdaptiveThinking: true,
    supportsWebSearch: true,
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    description: 'Balanced speed and quality. A good default for chat.',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    supportsEffort: true,
    supportsAdaptiveThinking: true,
    supportsWebSearch: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Fastest and cheapest. Good for short, simple turns.',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    supportsWebSearch: false,
  },
]

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORT_LEVELS)[number]

export function findModel(id: string): ModelSpec | undefined {
  return MODELS.find((model) => model.id === id)
}

/** Falls back to the first catalog entry so an unknown id never 500s a chat. */
export function resolveModel(id: string | undefined, fallbackId: string): ModelSpec {
  return findModel(id ?? '') ?? findModel(fallbackId) ?? MODELS[0]!
}
