import { env, isDemoMode } from '../env.js'
import { anthropicProvider } from './anthropic.js'
import { demoProvider } from './demo.js'
import type { Provider } from './types.js'

function selectProvider(): Provider {
  if (!isDemoMode) return anthropicProvider

  console.warn(
    '[llm] ANTHROPIC_API_KEY is not set - serving scripted demo responses.\n' +
      '      Set it in .env (see .env.example) and restart to talk to a real model.',
  )
  return demoProvider
}

export const provider: Provider = selectProvider()

export { env, isDemoMode }
export * from './models.js'
export * from './types.js'
