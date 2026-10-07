#!/usr/bin/env python3
"""대본(script.py) → 라인별 TTS 음성 + 타임라인(timeline.json / page/timeline.js) + SRT.

로컬 TTS: sherpa-onnx + Supertonic 3 (int8), 한국어 남성 보이스.
각 라인을 N회 합성해 한국어 ASR(zipformer)로 되읽은 뒤, 원문과 가장 일치하는 테이크를 채택한다.

usage: python3 tts.py --models <dir with sherpa model folders> [--takes 3]
"""
import argparse, json, os, re, sys, difflib
import numpy as np
import soundfile as sf
import sherpa_onnx

from script import SCENES, SOURCES

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
VOICE_SID = 8          # Supertonic 남성 보이스 (ASR 일치율 최상위)
SPEED = 1.1
STEPS = 12
GAP_LINE = 0.30        # 라인 사이 쉼
GAP_SCENE = 0.55       # 장면 전환 추가 쉼
LEAD_IN = 0.6          # 영상 시작 후 첫 대사까지


def load(models):
    st = os.path.join(models, "sherpa-onnx-supertonic-3-tts-int8-2026-05-11")
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
                duration_predictor=f"{st}/duration_predictor.int8.onnx",
                text_encoder=f"{st}/text_encoder.int8.onnx",
                vector_estimator=f"{st}/vector_estimator.int8.onnx",
                vocoder=f"{st}/vocoder.int8.onnx",
                tts_json=f"{st}/tts.json",
                unicode_indexer=f"{st}/unicode_indexer.bin",
                voice_style=f"{st}/voice.bin"),
            num_threads=4)))
    asr_dir = os.path.join(models, "sherpa-onnx-zipformer-korean-2024-06-24")
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{asr_dir}/encoder-epoch-99-avg-1.int8.onnx",
        decoder=f"{asr_dir}/decoder-epoch-99-avg-1.int8.onnx",
        joiner=f"{asr_dir}/joiner-epoch-99-avg-1.int8.onnx",
        tokens=f"{asr_dir}/tokens.txt", num_threads=4)
    return tts, rec


def resample(x, sr, to):
    n = int(len(x) * to / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def trim(x, thr=0.008, pad=0.04):
    env = np.convolve(np.abs(x), np.ones(441) / 441, mode="same")
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * SR)); b = min(len(x), idx[-1] + int(pad * SR))
    y = x[a:b].copy()
    f = int(0.01 * SR)
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y


norm = lambda s: re.sub(r"[^가-힣a-zA-Z0-9]", "", s)


def synth(tts, rec, text, takes):
    best = None
    for k in range(takes):
        g = sherpa_onnx.GenerationConfig()
        g.sid = VOICE_SID; g.num_steps = STEPS; g.speed = SPEED; g.extra["lang"] = "ko"
        a = tts.generate(text, g)
        x = np.array(a.samples, dtype=np.float32)
        if a.sample_rate != SR:
            x = resample(x, a.sample_rate, SR)
        x = trim(x)
        s = rec.create_stream(); s.accept_waveform(16000, resample(x, SR, 16000)); rec.decode_stream(s)
        score = difflib.SequenceMatcher(None, norm(text), norm(s.result.text)).ratio()
        if best is None or score > best[0]:
            best = (score, x, s.result.text)
        if score > 0.93:
            break
    return best


def strip_md(s):
    return s.replace("**", "")


def fmt_srt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--takes", type=int, default=3)
    args = ap.parse_args()
    tts, rec = load(args.models)
    os.makedirs(os.path.join(HERE, "build", "lines"), exist_ok=True)

    cursor = LEAD_IN
    out_scenes, chunks, report = [], [], []
    n = 0
    for si, sc in enumerate(SCENES):
        if si > 0:
            cursor += GAP_SCENE
        start = cursor - (GAP_SCENE / 2 if si > 0 else LEAD_IN)
        lines = []
        if sc.get("hold"):
            cursor += sc["hold"]
        for ln in sc["lines"]:
            score, x, heard = synth(tts, rec, ln["tts"], args.takes)
            path = os.path.join(HERE, "build", "lines", f"{n:03d}.wav")
            sf.write(path, x, SR, subtype="PCM_16")
            d = len(x) / SR
            lines.append({"start": round(cursor, 3), "end": round(cursor + d, 3), "sub": ln["sub"]})
            chunks.append((cursor, path))
            report.append(f"{n:03d} {score:.2f} {d:5.2f}s | {ln['tts']} | {heard}")
            print(report[-1], flush=True)
            cursor += d + GAP_LINE
            n += 1
        out_scenes.append({"id": sc["id"], "chapter": sc["chapter"], "source": SOURCES.get(sc["id"], ""),
                           "start": round(start, 3), "lines": lines})
    total = cursor + 0.3
    for i, s in enumerate(out_scenes):
        s["end"] = out_scenes[i + 1]["start"] if i + 1 < len(out_scenes) else round(total, 3)

    # 내레이션 트랙
    narr = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for t0, p in chunks:
        x, _ = sf.read(p, dtype="float32"); a = int(t0 * SR); narr[a:a + len(x)] += x
    peak = np.max(np.abs(narr)) or 1
    narr *= 0.89 / peak
    sf.write(os.path.join(HERE, "build", "narration.wav"), narr, SR, subtype="PCM_16")

    tl = {"fps": 30, "duration": round(total, 3), "scenes": out_scenes}
    json.dump(tl, open(os.path.join(HERE, "build", "timeline.json"), "w"), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, "page", "timeline.js"), "w").write(
        "window.TL = " + json.dumps(tl, ensure_ascii=False) + ";\n")

    srt, k = [], 1
    for s in out_scenes:
        for ln in s["lines"]:
            srt.append(f"{k}\n{fmt_srt(ln['start'])} --> {fmt_srt(ln['end'] + 0.15)}\n{strip_md(ln['sub'])}\n")
            k += 1
    open(os.path.join(HERE, "subtitles.ko.srt"), "w").write("\n".join(srt))
    open(os.path.join(HERE, "build", "tts_report.txt"), "w").write("\n".join(report))
    print(f"TOTAL {total:.1f}s, lines {n}")


if __name__ == "__main__":
    main()
