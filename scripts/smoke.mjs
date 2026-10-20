// 실행 중인 서버(npm start)에 실제 요청을 보내 추천·회의록 스트리밍을 점검한다.
// 사용법: SMOKE_URL=http://localhost:8787 node scripts/smoke.mjs
const base = process.env.SMOKE_URL || 'http://localhost:8787'
const transcript = [
  '다음 분기 출시 일정을 2주 미룰지 논의하고 있습니다.',
  '디자인 검수가 아직 끝나지 않았고 QA 인력이 부족합니다.',
  '김 팀장님은 범위를 줄여서 원래 일정에 맞추자고 하셨습니다.',
].join('\n')

async function call(path, body) {
  const t0 = Date.now()
  const res = await fetch(base + path, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${await res.text()}`)
  let text = ''
  let first = 0
  for await (const chunk of res.body) {
    if (!first) first = Date.now() - t0
    text += Buffer.from(chunk).toString('utf8')
  }
  if (text.includes('\u0000ERROR:')) throw new Error(`${path} 스트림 오류: ${text.split('\u0000ERROR:')[1]}`)
  console.log(`\n[${path}] 첫 조각 ${first}ms / 전체 ${Date.now() - t0}ms\n${text}`)
  return text
}

const sug = await call('/api/suggest', { transcript, role: '프론트엔드 팀장', tone: '정중하고 간결하게' })
const list = JSON.parse(sug.match(/\[[\s\S]*\]/)?.[0] ?? 'null')
if (!Array.isArray(list) || list.length < 1) throw new Error('추천 응답이 JSON 배열이 아닙니다.')
const sum = await call('/api/summary', { transcript })
if (!sum.includes('## 요약')) throw new Error('회의록에 "## 요약" 섹션이 없습니다.')
console.log('\n점검 통과')
