# 삼성전자 3Q26 실적 전망 & 코스피 전망 — 인포그래픽 경제 영상

5분 분량(4:55) 1920×1080 / 30fps 유튜브용 인포그래픽 영상과 그 제작 파이프라인입니다.
데이터 기준일은 **2026-10-07**(삼성전자 3분기 잠정실적 발표 전날)입니다.

## 결과물
| 파일 | 내용 |
|---|---|
| `output/samsung_3q26_kospi_outlook.mp4` | 최종 영상 (자막 번인, 내레이션 + BGM + 효과음, -14 LUFS) |
| `subtitles.ko.srt` | 자막 파일 (유튜브 CC 업로드용) |
| `output/youtube_meta.md` | 제목 후보 · 설명 · 챕터 타임스탬프 · 태그 |
| `script.py` | 대본 원본 (자막 문구 / 낭독 문구 / 출처) |

## 구성
1. 오프닝 — 분기 영업이익 100조, 그런데 주가는 고점 대비 -27%
2. CH1 숫자로 보는 3분기 — 분기 영업이익 추이, 하루 1.16조, 증권사 전망 분포
3. CH2 이 돈은 누가 벌었나 — DS 104.8조(98%), 3가지 엔진, DS vs MX 시소
4. CH3 4분기, 그리고 주가 — 4Q 가격 전망, 실적↑ 주가↓ 역설, 체크포인트
5. CH4 코스피는 어디로 — 2026 롤러코스터, 삼전닉스 비중 54%, 매크로, 10월 밴드, 이벤트 캘린더
6. CH5 시나리오 & 정리 — 강세/기본/약세, 요약, 구독 CTA, 면책 고지

## 파이프라인
```
script.py ──tts.py──▶ build/lines/*.wav, build/narration.wav, build/timeline.json, page/timeline.js, subtitles.ko.srt
                      (sherpa-onnx + Supertonic 3 한국어 남성 보이스, 라인당 최대 4테이크 → 한국어 ASR로 검수해 최적 테이크 선택)
timeline ──music.py──▶ build/mix.wav   (절차적으로 합성한 오리지널 BGM + 효과음 + 내레이션 덕킹)
page/index.html ──render.cjs──▶ 프레임 캡처(Playwright) → x264 세그먼트 (병렬)
build.sh ──▶ 세그먼트 결합 + 라우드니스 정규화 + 먹싱 → output/*.mp4
```
- 모든 애니메이션은 `renderAt(t)` 하나로 결정되는 결정적(deterministic) 렌더링이라 프레임 누락·싱크 어긋남이 없습니다.
- 장면 전환·차트 등장 타이밍은 각 내레이션 라인의 시작 시각에 맞춰 자동 정렬됩니다. 대본을 고치고 다시 빌드하면 싱크가 그대로 맞습니다.
- 폰트: Pretendard (SIL OFL, `page/fonts/`).

### 다시 빌드하기
```bash
pip install sherpa-onnx soundfile numpy
# 모델 (GitHub releases, k2-fsa/sherpa-onnx)
#   tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2
#   asr-models/sherpa-onnx-zipformer-korean-2024-06-24.tar.bz2
MODELS=/path/to/models WORKERS=6 ./build.sh
```
특정 시점 미리보기: `node snap.cjs <out_dir> 12.5 40 ...` (해당 초의 스틸 PNG 저장)

## 참고
- 실적 수치는 2026-10-07 시점 컨센서스·증권사 전망이며, 10월 8일 발표되는 잠정실적과 다를 수 있습니다. 발표 후 `script.py`·`page/index.html`의 수치를 갱신해 재빌드하세요.
- 코스피 차트는 주요 시점 종가만 연결한 그래프입니다(일별 데이터 아님).
- 시나리오는 채널 자체 관점이며 투자 권유가 아닙니다.
- 내레이션은 로컬 TTS입니다. 직접 녹음하려면 `subtitles.ko.srt`의 타이밍에 맞춰 녹음한 파일로 `build/narration.wav`를 교체한 뒤 `./build.sh --skip-tts`를 실행하세요(BGM 덕킹·믹스가 새 녹음 기준으로 다시 계산됩니다).
