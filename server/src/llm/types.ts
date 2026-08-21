import type { Effort } from './models.js'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface CompletionRequest {
  model: string
  system: string
  messages: ChatTurn[]
  effort: Effort
  /** Stream a summary of the model's reasoning alongside the answer. */
  showThinking: boolean
  /** Let the model search the web via Anthropic's server-side tool. */
  webSearch: boolean
  signal: AbortSignal
}

export type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'refusal'; message: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }

export interface Provider {
  readonly name: 'anthropic' | 'demo'
  complete(request: CompletionRequest): AsyncGenerator<StreamChunk>
  /** Short conversation title derived from the opening exchange. */
  title(firstUserMessage: string, model: string): Promise<string>
}
