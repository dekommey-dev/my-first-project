// 가짜 Anthropic 업스트림을 띄워 /api 스트리밍 흐름을 통합 테스트한다.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from './app.js'

const ev = (text) => `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`
const listen = (server) => new Promise((r) => server.listen(0, () => r(server.address().port)))

test('app: 스트리밍·검증·정적 서빙', async (t) => {
  let seen
  const upstream = http.createServer(async (req, res) => {
    let b = ''
    for await (const c of req) b += c
    seen = JSON.parse(b)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(ev('["첫째", '))
    setTimeout(() => {
      res.write(ev('"둘째"]'))
      res.end()
    }, 20)
  })
  const upPort = await listen(upstream)
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'))
  fs.writeFileSync(path.join(dist, 'index.html'), '<h1>ok</h1>')
  const app = createApp({ distDir: dist })
  const port = await listen(app)
  process.env.ANTHROPIC_API_KEY = 'test'
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${upPort}`
  t.after(() => {
    upstream.close()
    app.close()
    fs.rmSync(dist, { recursive: true })
  })
  const url = (p) => `http://localhost:${port}${p}`
  const post = (p, body) => fetch(url(p), { method: 'POST', body: JSON.stringify(body) })

  const ok = await post('/api/suggest', { transcript: '회의', role: '팀장', tone: '정중하게' })
  assert.equal(ok.status, 200)
  assert.equal(await ok.text(), '["첫째", "둘째"]')
  assert.equal(seen.stream, true)
  assert.match(seen.system, /팀장/)

  assert.equal((await post('/api/summary', { transcript: '' })).status, 400)
  assert.equal((await post('/api/nope', { transcript: 'x' })).status, 404)

  assert.equal(await (await fetch(url('/'))).text(), '<h1>ok</h1>')
  assert.equal(await (await fetch(url('/some/route'))).text(), '<h1>ok</h1>') // SPA 폴백
  assert.equal(await (await fetch(url('/..%2f..%2fetc/passwd'))).text(), '<h1>ok</h1>') // 경로 탈출 차단
  assert.equal((await fetch(url('/api/suggest'))).status, 404)
})
