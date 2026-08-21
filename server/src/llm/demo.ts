import type { CompletionRequest, Provider, StreamChunk } from './types.js'

/**
 * Stand-in provider used when no ANTHROPIC_API_KEY is configured.
 *
 * It never calls a network service. The point is that the whole product —
 * streaming, stop button, persistence, retry, markdown rendering — can be
 * exercised end to end before anyone has an API key, and that the hosted
 * preview does something rather than showing an error wall.
 */

const INTRO = [
  '**데모 모드로 실행 중입니다.** 이 응답은 서버에 내장된 대본이고, 실제 모델 호출이 아닙니다.',
  '',
  '진짜 Claude 응답을 받으려면 서버에 API 키를 넣고 다시 시작하세요:',
  '',
  '```bash',
  'echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env',
  'npm run dev',
  '```',
  '',
  '키가 설정되면 이 대본은 사라지고 모든 대화가 Anthropic Messages API로 전달됩니다.',
].join('\n')

const CODE_SAMPLE = [
  '데모 모드라 실제 코드를 작성해 드릴 수는 없지만, 렌더링이 어떻게 보이는지는 확인하실 수 있습니다:',
  '',
  '```ts',
  'export async function* stream(reader: ReadableStreamDefaultReader<Uint8Array>) {',
  '  const decoder = new TextDecoder()',
  '  for (;;) {',
  '    const { value, done } = await reader.read()',
  '    if (done) return',
  '    yield decoder.decode(value, { stream: true })',
  '  }',
  '}',
  '```',
  '',
  '| 기능 | 데모 모드 | API 키 있음 |',
  '| --- | --- | --- |',
  '| 스트리밍 | 예 | 예 |',
  '| 대화 저장 | 예 | 예 |',
  '| 실제 모델 응답 | 아니요 | 예 |',
  '| 웹 검색 | 아니요 | 예 |',
].join('\n')

function scriptFor(request: CompletionRequest): string {
  const last = request.messages.at(-1)?.content.toLowerCase() ?? ''
  if (/코드|code|함수|function|버그|bug|타입|type/.test(last)) return CODE_SAMPLE
  if (request.messages.filter((turn) => turn.role === 'user').length > 1) {
    return [
      `방금 하신 말씀은 "${request.messages.at(-1)?.content.slice(0, 120) ?? ''}" 였습니다.`,
      '',
      '데모 모드에서는 대화 맥락을 그대로 저장하고 다시 보여주는 것까지만 합니다. ' +
        '`ANTHROPIC_API_KEY`를 설정하면 같은 히스토리가 그대로 모델에 전달됩니다.',
    ].join('\n')
  }
  return INTRO
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const demoProvider: Provider = {
  name: 'demo',

  async *complete(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    if (request.showThinking) {
      for (const part of ['요청을 확인하는 중', '… 데모 대본을 고르는 중', '… 준비 완료.']) {
        if (request.signal.aborted) return
        yield { type: 'thinking', text: part }
        await sleep(140)
      }
    }

    // Emitted in small chunks so the client's incremental rendering, its
    // autoscroll, and the stop button all get a realistic workout.
    const script = scriptFor(request)
    for (const token of script.match(/\s*\S+/g) ?? []) {
      if (request.signal.aborted) return
      yield { type: 'text', text: token }
      await sleep(12)
    }

    yield { type: 'usage', inputTokens: 0, outputTokens: 0 }
  },

  async title(firstUserMessage) {
    const words = firstUserMessage.trim().split(/\s+/).slice(0, 5).join(' ')
    return words.slice(0, 60) || 'New chat'
  },
}
