import test from 'node:test'
import assert from 'node:assert/strict'
import { autoState, finalSuggestions, partialSuggestions, readTextStream, splitStreamError, ERROR_MARK } from './logic.ts'

test('autoState: 3문장 이상 쌓이고 켜져 있고 로딩 중이 아닐 때만 발동', () => {
  assert.equal(autoState(true, false, 3, 0).fire, true)
  assert.equal(autoState(true, false, 2, 0).fire, false)
  assert.equal(autoState(false, false, 9, 0).fire, false)
  assert.equal(autoState(true, true, 9, 0).fire, false)
  assert.equal(autoState(true, false, 5, 3).fire, false)
  assert.equal(autoState(true, false, 6, 3).fire, true)
})

test('autoState: 전사를 지워 개수가 줄면 기준을 0으로 되돌린다', () => {
  assert.deepEqual(autoState(true, false, 1, 5), { base: 0, fire: false })
})

test('partialSuggestions: 완성된 항목만 점진적으로 반환', () => {
  assert.deepEqual(partialSuggestions(''), [])
  assert.deepEqual(partialSuggestions('["가'), [])
  assert.deepEqual(partialSuggestions('["가", "나'), ['가'])
  assert.deepEqual(partialSuggestions('["가 \\"인용\\"", "나"]'), ['가 "인용"', '나'])
})

test('finalSuggestions: 비어 있으면 에러', () => {
  assert.deepEqual(finalSuggestions('```json\n["a","b"]\n```'), ['a', 'b'])
  assert.throws(() => finalSuggestions('죄송합니다'), /해석/)
})

test('splitStreamError: 오류 표식 분리', () => {
  assert.deepEqual(splitStreamError('abc'), { text: 'abc' })
  assert.deepEqual(splitStreamError(`ab${ERROR_MARK}끊김`), { text: 'ab', error: '끊김' })
})

test('readTextStream: 누적 텍스트를 알리고 오류 표식은 예외로', async () => {
  const mk = (parts: string[], status = 200) =>
    new Response(new ReadableStream({ start(c) { parts.forEach((p) => c.enqueue(new TextEncoder().encode(p))); c.close() } }), { status })
  const seen: string[] = []
  assert.equal(await readTextStream(mk(['["a",', ' "b"]']), (t) => seen.push(t)), '["a", "b"]')
  assert.deepEqual(seen, ['["a",', '["a", "b"]'])
  await assert.rejects(readTextStream(mk(['x', `${ERROR_MARK}과부하`]), () => {}), /과부하/)
  const bad = new Response(JSON.stringify({ error: '키 없음' }), { status: 500 })
  await assert.rejects(readTextStream(bad, () => {}), /키 없음/)
})
