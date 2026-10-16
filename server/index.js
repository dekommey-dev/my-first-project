// 응답 추천·회의록 요약 서버: 회의 전사 내용을 LLM(Anthropic Messages API)으로 처리한다.
// ANTHROPIC_API_KEY 환경변수가 필요하고, ANTHROPIC_MODEL로 모델을 바꿀 수 있다.
import http from 'node:http'
import { SUMMARY_PROMPT, buildSuggestPrompt, parseRequest, parseSuggestions } from './logic.js'

const PORT = process.env.PORT || 8787
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'

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

async function callLlm(system, content, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  })
  if (!res.ok) throw new Error(`LLM 오류 ${res.status}`)
  const json = await res.json()
  return json.content?.[0]?.text ?? ''
}

const routes = {
  '/api/suggest': async (req) =>
    ({ suggestions: parseSuggestions(await callLlm(buildSuggestPrompt(req), req.transcript, 600)) }),
  '/api/summary': async (req) => ({ summary: (await callLlm(SUMMARY_PROMPT, req.transcript, 1200)).trim() }),
}

http
  .createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    const handler = req.method === 'POST' ? routes[req.url] : undefined
    if (!handler) return send(404, { error: 'not found' })
    if (!process.env.ANTHROPIC_API_KEY) return send(500, { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' })
    let parsed
    try {
      parsed = parseRequest(await readBody(req))
    } catch (e) {
      return send(400, { error: e.message })
    }
    try {
      send(200, await handler(parsed))
    } catch (e) {
      send(502, { error: e.message })
    }
  })
  .listen(PORT, () => console.log(`meeting server on :${PORT}`))
