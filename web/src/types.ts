export type Role = 'user' | 'assistant'

export interface Conversation {
  id: string
  title: string
  model: string
  systemPrompt: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: Role
  content: string
  model: string | null
  createdAt: number
}

export interface ModelSpec {
  id: string
  name: string
  description: string
  contextWindow: number
  maxOutputTokens: number
  supportsEffort: boolean
  supportsAdaptiveThinking: boolean
  supportsWebSearch: boolean
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface ServerInfo {
  models: ModelSpec[]
  defaultModel: string
  efforts: Effort[]
  demoMode: boolean
}

export interface Settings {
  model: string
  systemPrompt: string
  effort: Effort
  showThinking: boolean
  webSearch: boolean
}
