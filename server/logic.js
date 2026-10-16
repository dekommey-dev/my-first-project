// 서버의 순수 로직(요청 검증, 프롬프트 생성, LLM 응답 파싱). 테스트하기 쉽도록 index.js와 분리했다.

const MAX_TRANSCRIPT = 4000
const MAX_FIELD = 200

export const SUGGEST_PROMPT = `당신은 회의 참가자를 돕는 어시스턴트입니다. 아래 회의 전사 내용을 보고,
참가자가 바로 말할 수 있는 응답을 3개 추천하세요. 각각 톤이 다르게(신중/적극/질문형) 한두 문장으로 작성합니다.
JSON 문자열 배열만 출력하세요. 예: ["...", "...", "..."]`

export const SUMMARY_PROMPT = `당신은 회의록 작성 도우미입니다. 아래 회의 전사 내용을 한국어 마크다운으로 정리하세요.
"## 요약"(3문장 이내), "## 주요 논의", "## 결정 사항", "## 할 일" 섹션을 사용하고, 내용이 없는 섹션은 "- 없음"으로 적습니다.`

// 요청 본문을 검증하고 정리한다. 실패하면 Error를 던진다(메시지는 사용자에게 보여 준다).
export function parseRequest(raw) {
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    throw new Error('요청 본문이 올바른 JSON이 아닙니다.')
  }
  if (!body || typeof body.transcript !== 'string' || !body.transcript.trim()) {
    throw new Error('전사 내용이 비어 있습니다.')
  }
  const field = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_FIELD) : '')
  return {
    transcript: body.transcript.slice(-MAX_TRANSCRIPT),
    role: field(body.role),
    tone: field(body.tone),
  }
}

// 역할·톤 설정을 시스템 프롬프트에 덧붙인다.
export function buildSuggestPrompt({ role, tone }) {
  let prompt = SUGGEST_PROMPT
  if (role) prompt += `\n참가자의 역할: ${role}`
  if (tone) prompt += `\n선호하는 말투/톤: ${tone} (세 응답 모두 이 방향을 우선 반영)`
  return prompt
}

// LLM 출력에서 문자열 배열을 뽑는다. 파싱할 수 없으면 빈 배열이 아닌 Error를 던진다.
export function parseSuggestions(text) {
  const match = String(text ?? '').match(/\[[\s\S]*\]/)
  if (!match) throw new Error('추천 응답을 해석하지 못했습니다.')
  let arr
  try {
    arr = JSON.parse(match[0])
  } catch {
    throw new Error('추천 응답을 해석하지 못했습니다.')
  }
  const list = Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : []
  if (!list.length) throw new Error('추천 응답을 해석하지 못했습니다.')
  return list
}

// Anthropic SSE 스트림 조각을 받아 text_delta의 텍스트를 onText로 넘기는 파서.
// 네트워크 청크가 줄 중간에서 끊겨도 완성된 줄만 처리한다.
export function createSseParser(onText) {
  let buf = ''
  return (chunk) => {
    buf += chunk
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const ev = JSON.parse(line.slice(5))
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') onText(ev.delta.text)
        if (ev.type === 'error') throw new Error(ev.error?.message ?? 'LLM 스트림 오류')
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }
}

// 스트림 중간에 발생한 오류를 본문으로 전달하기 위한 표식(헤더는 이미 200으로 나갔다).
export const ERROR_MARK = '\u0000ERROR:'
