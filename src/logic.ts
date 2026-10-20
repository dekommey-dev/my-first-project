// 프론트엔드의 순수 로직(자동 추천 판단, 스트림 파싱). React와 분리해 node:test로 검증한다.

export const AUTO_EVERY = 3
export const ERROR_MARK = '\u0000ERROR:'

// 마지막 추천 이후 문장이 AUTO_EVERY개 이상 쌓였는지. 전사를 지워 줄어들면 기준을 0으로 되돌린다.
export function autoState(auto: boolean, loading: boolean, count: number, last: number) {
  const base = count < last ? 0 : last
  return { base, fire: auto && !loading && count - base >= AUTO_EVERY }
}

// 스트리밍 중인 JSON 배열 텍스트에서 이미 완성된 문자열 항목만 뽑는다.
export function partialSuggestions(text: string): string[] {
  const start = text.indexOf('[')
  if (start < 0) return []
  const out: string[] = []
  for (const m of text.slice(start + 1).matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    try {
      out.push(JSON.parse(`"${m[1]}"`))
    } catch {
      break
    }
  }
  return out
}

// 최종 텍스트를 추천 목록으로 확정한다. 해석 불가면 Error.
export function finalSuggestions(text: string): string[] {
  const list = partialSuggestions(text).map((s) => s.trim()).filter(Boolean)
  if (!list.length) throw new Error('추천 응답을 해석하지 못했습니다.')
  return list
}

// 스트림 끝에 붙은 서버 오류 표식을 분리한다.
export function splitStreamError(text: string): { text: string; error?: string } {
  const i = text.indexOf(ERROR_MARK)
  return i < 0 ? { text } : { text: text.slice(0, i), error: text.slice(i + ERROR_MARK.length) }
}

// fetch 응답 본문을 읽으며 누적 텍스트를 onText로 알린다. 서버 오류는 Error로 던진다.
export async function readTextStream(res: Response, onText: (full: string) => void): Promise<string> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '요청 실패')
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onText(splitStreamError(full).text)
  }
  const { text, error } = splitStreamError(full)
  if (error) throw new Error(error)
  return text
}

// AbortController로 취소된 요청인지(fetch·스트림 읽기 모두 AbortError를 던진다).
export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError'
}
