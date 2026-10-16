// 회의 도우미 서버: 응답 추천·회의록 요약 API(LLM 스트리밍)와 빌드된 프론트엔드를 함께 서빙한다.
// ANTHROPIC_API_KEY 필수, ANTHROPIC_MODEL·PORT 선택. 먼저 `npm run build`로 dist를 만든다.
import { createApp } from './app.js'

const PORT = process.env.PORT || 8787
createApp().listen(PORT, () => console.log(`meeting server on :${PORT}`))
