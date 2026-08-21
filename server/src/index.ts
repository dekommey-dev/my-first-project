import express from 'express'
import cors from 'cors'
import { env, isDemoMode } from './env.js'
import { HttpError } from './lib/http.js'
import { MODELS, EFFORT_LEVELS } from './llm/models.js'
import { provider } from './llm/index.js'
import chatRouter from './routes/chat.js'
import conversationsRouter from './routes/conversations.js'

const app = express()

app.set('trust proxy', true)
app.use(
  cors({
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    credentials: false,
  }),
)
app.use(express.json({ limit: '4mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: provider.name,
    demoMode: isDemoMode,
    defaultModel: env.defaultModel,
    uptimeSeconds: Math.round(process.uptime()),
  })
})

app.get('/api/models', (_req, res) => {
  res.json({
    models: MODELS,
    defaultModel: env.defaultModel,
    efforts: EFFORT_LEVELS,
    demoMode: isDemoMode,
  })
})

app.use('/api/conversations', conversationsRouter)
app.use('/api/chat', chatRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' })
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, code: error.code })
    return
  }
  if (error instanceof Error && error.name === 'ZodError') {
    res.status(400).json({ error: 'invalid request body', detail: error.message })
    return
  }
  console.error('[server] unhandled error:', error)
  res.status(500).json({ error: 'internal server error' })
})

const server = app.listen(env.port, () => {
  console.log(`\n  Aida API listening on http://localhost:${env.port}`)
  console.log(`  provider: ${provider.name}${isDemoMode ? ' (no API key set)' : ''}`)
  console.log(`  default model: ${env.defaultModel}`)
  console.log(`  data: ${env.dataDir}\n`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
