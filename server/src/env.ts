import 'dotenv/config'
import path from 'node:path'

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? '',
  defaultModel: process.env.DEFAULT_MODEL?.trim() || 'claude-opus-5',
  corsOrigins: list(process.env.CORS_ORIGIN ?? '*'),
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR ?? './data'),
}

/**
 * With no API key the server still runs: every completion is served by the
 * scripted demo provider. That keeps `docker compose up` and the hosted
 * preview useful before anyone has signed up for an API key.
 */
export const isDemoMode = env.anthropicApiKey === ''
