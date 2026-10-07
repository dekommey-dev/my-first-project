#!/usr/bin/env bash
# 전체 파이프라인: TTS → BGM/믹스 → 프레임 렌더 → 최종 MP4
# usage: MODELS=/path/to/sherpa-models WORKERS=6 ./build.sh [--skip-tts]
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}"
WORKERS="${WORKERS:-6}"
FPS=30

if [[ "${1:-}" != "--skip-tts" ]]; then
  python3 tts.py --models "${MODELS:?set MODELS to the folder holding the sherpa-onnx model dirs}" --takes 4
fi
python3 music.py

DUR=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['duration'])")
TOTAL=$(python3 -c "import math;print(math.ceil($DUR*$FPS))")
CHUNK=$(( (TOTAL + WORKERS - 1) / WORKERS ))
rm -f build/seg_*.mp4 build/segs.txt
for ((i=0; i<WORKERS; i++)); do
  a=$(( i * CHUNK )); b=$(( (i + 1) * CHUNK )); (( b > TOTAL )) && b=$TOTAL
  node render.cjs "$a" "$b" "build/seg_$i.mp4" "$FPS" &
  echo "file 'seg_$i.mp4'" >> build/segs.txt
done
wait

ffmpeg -y -loglevel error -f concat -safe 0 -i build/segs.txt -c copy build/video_only.mp4
# YouTube 권장 라우드니스(-14 LUFS)로 정규화 후 먹싱
ffmpeg -y -loglevel error -i build/video_only.mp4 -i build/mix.wav \
  -filter:a "loudnorm=I=-14:TP=-1.5:LRA=11" -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -shortest output/samsung_3q26_kospi_outlook.mp4
echo "done → output/samsung_3q26_kospi_outlook.mp4"
