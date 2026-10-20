# 회의 도우미

[![CI](https://github.com/dekommey-dev/my-first-project/actions/workflows/ci.yml/badge.svg)](https://github.com/dekommey-dev/my-first-project/actions/workflows/ci.yml)

회의 음성을 브라우저 Web Speech API(Chrome/Edge)로 실시간 전사하고, LLM으로 답변을 추천하는 웹앱.

## 실행

```bash
npm install
export ANTHROPIC_API_KEY=...   # 선택: ANTHROPIC_MODEL
npm run server                 # 추천 API (:8787)
npm run dev                    # 프론트엔드 (Vite, /api 프록시)
```

## 테스트

```bash
npm test   # 서버의 요청 검증·프롬프트·응답 파싱 (node:test)
```

## 기능

- 한국어/영어 실시간 전사 (새로고침해도 localStorage에 유지), txt 내보내기
- 내 역할·선호 톤을 반영한 응답 추천 (수동 / 문장 3개마다 자동)
- 전사 기반 회의록 요약(`/api/summary`) 및 마크다운 내려받기

## 배포 (서버가 프론트엔드까지 서빙)

```bash
export ANTHROPIC_API_KEY=...
npm start          # build 후 :8787 (PORT로 변경)에서 API + dist 서빙
```

추천·요약 응답은 LLM 출력을 text/plain 스트림으로 그대로 전달하며, 화면에 점진적으로 표시됩니다.
테스트는 가짜 Anthropic 서버(`ANTHROPIC_BASE_URL`)로 스트리밍 흐름을 검증합니다.

## 실제 키 점검

```bash
export ANTHROPIC_API_KEY=...
npm start                # 터미널 1
npm run smoke            # 터미널 2: 추천·회의록 스트리밍을 실제 호출해 확인
```

## CI

`.github/workflows/ci.yml`이 푸시와 PR마다 Node 22에서 `npm ci` → `npm test` → `npm run build`를 실행합니다.
