// 응답 추천 서버: 회의 전사 내용을 받아 LLM(Anthropic Messages API)으로 답변 후보를 생성한다.
// ANTHROPIC_API_KEY 환경변수가 필요하고, ANTHROPIC_MODEL로 모델을 바꿀 수 있다.
import http from 'node:http'

const PORT = process.env.PORT || 8787
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'

const PROMPT = `당신은 회의 참가자를 돕는 어시스턴트입니다. 아래 회의 전사 내용을 보고,
참가자가 바로 말할 수 있는 응답을 3개 추천하세요. 각각 톤이 다르게(신중/적극/질문형) 한두 문장으로 작성합니다.
JSON 문자열 배열만 출력하세요. 예: ["...", "...", "..."]`

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 1e6) reject(new Error('too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function suggest(transcript) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: PROMPT,
      messages: [{ role: 'user', content: transcript }],
    }),
  })
  if (!res.ok) throw new Error(`LLM 오류 ${res.status}`)
  const json = await res.json()
  const text = json.content?.[0]?.text ?? '[]'
  const match = text.match(/\[[\s\S]*\]/)
  return JSON.parse(match ? match[0] : '[]')
}

http
  .createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST' || req.url !== '/api/suggest') return send(404, { error: 'not found' })
    if (!process.env.ANTHROPIC_API_KEY) return send(500, { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' })
    try {
      const { transcript } = JSON.parse(await readBody(req))
      if (typeof transcript !== 'string' || !transcript.trim()) return send(400, { error: '전사 내용이 비어 있습니다.' })
      send(200, { suggestions: await suggest(transcript.slice(-4000)) })
    } catch (e) {
      send(502, { error: e.message })
    }
  })
  .listen(PORT, () => console.log(`suggest server on :${PORT}`))
