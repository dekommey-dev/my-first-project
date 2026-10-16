import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSuggestPrompt, parseRequest, parseSuggestions, SUGGEST_PROMPT } from './logic.js'

test('parseRequest: 잘못된 JSON·빈 전사는 거부한다', () => {
  assert.throws(() => parseRequest('not json'), /JSON/)
  assert.throws(() => parseRequest('{}'), /비어/)
  assert.throws(() => parseRequest('{"transcript":"   "}'), /비어/)
  assert.throws(() => parseRequest('{"transcript":5}'), /비어/)
  assert.throws(() => parseRequest('null'), /비어/)
})

test('parseRequest: 전사는 뒤 4000자만, 역할·톤은 정리해서 반환한다', () => {
  const r = parseRequest(JSON.stringify({ transcript: 'a'.repeat(5000), role: '  PM ', tone: 5 }))
  assert.equal(r.transcript.length, 4000)
  assert.equal(r.role, 'PM')
  assert.equal(r.tone, '')
})

test('buildSuggestPrompt: 역할·톤이 있을 때만 덧붙인다', () => {
  assert.equal(buildSuggestPrompt({ role: '', tone: '' }), SUGGEST_PROMPT)
  const p = buildSuggestPrompt({ role: '팀장', tone: '정중하게' })
  assert.match(p, /팀장/)
  assert.match(p, /정중하게/)
})

test('parseSuggestions: 코드블록으로 감싼 JSON 배열도 읽는다', () => {
  assert.deepEqual(parseSuggestions('```json\n["가", " 나 ", "다"]\n```'), ['가', '나', '다'])
})

test('parseSuggestions: 배열이 없거나 비어 있으면 에러', () => {
  assert.throws(() => parseSuggestions('응답 없음'), /해석/)
  assert.throws(() => parseSuggestions('[]'), /해석/)
  assert.throws(() => parseSuggestions('[1, ""]'), /해석/)
  assert.throws(() => parseSuggestions('[broken'), /해석/)
  assert.throws(() => parseSuggestions(undefined), /해석/)
})

import { createSseParser } from './logic.js'

const ev = (text) => `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`

test('createSseParser: 줄 중간에서 끊긴 청크도 이어 붙여 처리한다', () => {
  const out = []
  const feed = createSseParser((t) => out.push(t))
  const raw = ev('안녕') + 'event: ping\ndata: {"type":"ping"}\n\n' + ev('하세요')
  feed(raw.slice(0, 20))
  feed(raw.slice(20, 70))
  feed(raw.slice(70))
  assert.deepEqual(out, ['안녕', '하세요'])
})

test('createSseParser: error 이벤트는 예외로 전달한다', () => {
  const feed = createSseParser(() => {})
  assert.throws(() => feed('data: {"type":"error","error":{"message":"과부하"}}\n'), /과부하/)
})
