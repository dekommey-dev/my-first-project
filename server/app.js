// HTTP 앱: LLM 호출(스트리밍)과 빌드된 프론트엔드(dist) 정적 서빙.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { ERROR_MARK, SUMMARY_PROMPT, buildSuggestPrompt, createSseParser, parseRequest } from './logic.js'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 1e6) reject(new Error('요청이 너무 큽니다.'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// 환경변수는 호출 시점에 읽는다(테스트에서 가짜 업스트림으로 바꿀 수 있도록).
async function openLlm(system, content, maxTokens) {
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: [{ role: 'user', content }],
    }),
  })
  if (!res.ok || !res.body) throw new Error(`LLM 오류 ${res.status}`)
  return res.body
}

const routes = {
  '/api/suggest': (r) => ({ system: buildSuggestPrompt(r), max: 600 }),
  '/api/summary': () => ({ system: SUMMARY_PROMPT, max: 1200 }),
}

async function handleStream(res, route, parsed) {
  let body
  try {
    body = await openLlm(route.system, parsed.transcript, route.max)
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ error: e.message }))
  }
  // 응답은 LLM 텍스트를 그대로 흘려보내는 text/plain 스트림이다.
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' })
  const feed = createSseParser((t) => res.write(t))
  const decoder = new TextDecoder()
  try {
    for await (const chunk of body) feed(decoder.decode(chunk, { stream: true }))
  } catch (e) {
    res.write(ERROR_MARK + e.message)
  }
  res.end()
}

function serveStatic(req, res, distDir) {
  const root = path.resolve(distDir)
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = path.join(root, urlPath)
  if (!file.startsWith(root)) file = path.join(root, 'index.html')
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end('빌드된 프론트엔드가 없습니다. `npm run build`를 먼저 실행하세요.')
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}

export function createApp({ distDir = 'dist' } = {}) {
  return http.createServer(async (req, res) => {
    const route = req.method === 'POST' ? routes[req.url] : undefined
    if (!route) {
      if (req.method === 'GET' && !req.url?.startsWith('/api/')) return serveStatic(req, res, distDir)
      res.writeHead(404, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ error: 'not found' }))
    }
    const fail = (status, error) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error }))
    }
    if (!process.env.ANTHROPIC_API_KEY) return fail(500, 'ANTHROPIC_API_KEY가 설정되지 않았습니다.')
    let parsed
    try {
      parsed = parseRequest(await readBody(req))
    } catch (e) {
      return fail(400, e.message)
    }
    await handleStream(res, route(parsed), parsed)
  })
}
