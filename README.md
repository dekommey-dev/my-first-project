# 회의 도우미

회의 음성을 브라우저 Web Speech API(Chrome/Edge)로 실시간 전사하고, LLM으로 답변을 추천하는 웹앱.

## 실행

```bash
npm install
export ANTHROPIC_API_KEY=...   # 선택: ANTHROPIC_MODEL
npm run server                 # 추천 API (:8787)
npm run dev                    # 프론트엔드 (Vite, /api 프록시)
```
