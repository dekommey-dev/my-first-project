#!/usr/bin/env python3
"""오리지널 BGM + 효과음 합성 → 내레이션과 믹스 (저작권 걱정 없는 절차적 사운드).

build/timeline.json, build/narration.wav 를 읽어 build/mix.wav 를 만든다.
"""
import json, os
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
rng = np.random.default_rng(7)

tl = json.load(open(os.path.join(HERE, "build", "timeline.json")))
narr, _ = sf.read(os.path.join(HERE, "build", "narration.wav"), dtype="float32")
DUR = tl["duration"]
N = int(DUR * SR) + SR
narr = np.pad(narr, (0, max(0, N - len(narr))))[:N]
t_all = np.arange(N) / SR

BPM = 100
BEAT = 60 / BPM
BAR = BEAT * 4
title = next(s for s in tl["scenes"] if s["id"] == "title")
T_DROP = title["start"] + 0.25          # 타이틀 임팩트 → 그루브 시작
end_scene = next(s for s in tl["scenes"] if s["id"] == "end")
T_OUT = end_scene["start"]

midi = lambda m: 440.0 * 2 ** ((m - 69) / 12)
# Am – F – C – G  (각 2마디)
CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
ROOTS = [45, 41, 48, 43]


def env_adsr(n, a, r):
    e = np.ones(n, dtype=np.float32)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y


def lowpass_fast(x, fc, passes=2):
    # 블록 단위 IIR 대신 FFT 기반 저역 통과 (긴 신호용)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** (2 * passes))
    return np.fft.irfft(X, len(x)).astype(np.float32)


TBL_N = 4096
_ph = np.arange(TBL_N) / TBL_N * 2 * np.pi
TABLE = sum(np.sin(h * _ph) / h ** 1.6 for h in range(1, 7)).astype(np.float32)

pad = np.zeros(N, dtype=np.float32)
bass = np.zeros(N, dtype=np.float32)
arp = np.zeros(N, dtype=np.float32)
drums = np.zeros(N, dtype=np.float32)

seg = 2 * BAR
nseg = int(np.ceil(DUR / seg)) + 1
for k in range(nseg):
    t0 = k * seg
    ci = k % 4
    a0 = int(t0 * SR); n = int((seg + 1.2) * SR)
    if a0 >= N: break
    n = min(n, N - a0)
    tt = np.arange(n) / SR
    e = env_adsr(n, 1.2, 1.4)
    for m in CHORDS[ci]:
        f = midi(m)
        v = np.zeros(n, dtype=np.float32)
        for det in (-0.12, 0.0, 0.11):           # 디튠 3보이스 (웨이브테이블)
            ff = f * 2 ** (det / 12)
            idx = ((ff * tt + rng.uniform(0, 1)) * TBL_N).astype(np.int64) % TBL_N
            v += TABLE[idx]
        pad[a0:a0 + n] += v * e * 0.045
    # 서브 베이스
    fb = midi(ROOTS[ci] - 12)
    eb = env_adsr(n, 0.08, 0.8)
    bass[a0:a0 + n] += (np.sin(2 * np.pi * fb * tt) + 0.25 * np.sin(4 * np.pi * fb * tt)).astype(np.float32) * eb * 0.16
    # 아르페지오 (8분음표)
    pattern = [0, 1, 2, 3, 2, 1, 2, 3]
    tones = [c + 12 for c in CHORDS[ci]]
    for j in range(int(seg / (BEAT / 2))):
        ts = t0 + j * BEAT / 2
        s0 = int(ts * SR); ln = int(0.5 * SR)
        if s0 + ln >= N: break
        f = midi(tones[pattern[j % 8]])
        tn = np.arange(ln) / SR
        note = (np.sin(2 * np.pi * f * tn) + 0.3 * np.sin(4 * np.pi * f * tn)) * np.exp(-tn * 7.5)
        acc = 1.0 if j % 2 == 0 else 0.7
        arp[s0:s0 + ln] += note.astype(np.float32) * 0.05 * acc

# 드럼 (그루브 구간에서만)
nb = int(DUR / BEAT) + 1
for b in range(nb):
    tb = b * BEAT
    if tb < T_DROP or tb > T_OUT + 1: continue
    s0 = int(tb * SR)
    if b % 2 == 0:  # 킥 (1, 3박)
        ln = int(0.45 * SR); tn = np.arange(ln) / SR
        f = 48 + 70 * np.exp(-tn * 30)
        k = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tn * 9)
        drums[s0:s0 + ln] += k.astype(np.float32) * 0.30
    if b % 4 == 2:  # 소프트 클랩 (3박)
        ln = int(0.25 * SR); tn = np.arange(ln) / SR
        nz = rng.standard_normal(ln).astype(np.float32)
        nz = np.diff(np.concatenate([[0], nz]))
        drums[s0:s0 + ln] += nz * np.exp(-tn * 22).astype(np.float32) * 0.045
    for h in range(2):  # 하이햇 (8분)
        sh = int((tb + h * BEAT / 2) * SR); ln = int(0.06 * SR)
        if sh + ln >= N: continue
        nz = rng.standard_normal(ln).astype(np.float32)
        nz = np.diff(np.concatenate([[0], np.diff(np.concatenate([[0], nz]))]))
        drums[sh:sh + ln] += nz * np.exp(-np.arange(ln) / SR * 70).astype(np.float32) * (0.020 if h else 0.012)

pad = lowpass_fast(pad, 2400)
arp = lowpass_fast(arp, 5000)

# 섹션별 레벨: 훅 구간은 패드+베이스만 서서히, 드롭 후 전체
lvl_arp = np.clip((t_all - (T_DROP - 0.1)) / 0.4, 0, 1).astype(np.float32)
lvl_hook = np.clip(t_all / 3.0, 0, 1).astype(np.float32)
bgm = pad * lvl_hook + bass * lvl_hook + arp * (0.35 + 0.65 * lvl_arp) + drums

# 아웃트로 페이드
fade = np.clip((DUR - t_all) / 5.0, 0, 1).astype(np.float32)
bgm *= fade

# ── 효과음 ──
sfx = np.zeros(N, dtype=np.float32)


def put(x, at, gain):
    s0 = int(at * SR)
    if s0 < 0: x = x[-s0:]; s0 = 0
    e = min(N, s0 + len(x)); sfx[s0:e] += x[:e - s0] * gain


def whoosh(d=0.55):
    ln = int(d * SR); tn = np.arange(ln) / SR
    nz = rng.standard_normal(ln).astype(np.float32)
    env = np.sin(np.pi * np.clip(tn / d, 0, 1)) ** 2
    lo = lowpass(nz, 900); hi = nz - lowpass(nz, 3500)
    mixp = np.linspace(0, 1, ln)
    return ((lo * (1 - mixp) + hi * mixp * 0.6 + lo * 0.3) * env).astype(np.float32)


def impact():
    ln = int(2.2 * SR); tn = np.arange(ln) / SR
    f = 38 + 60 * np.exp(-tn * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tn * 2.2)
    nz = lowpass(rng.standard_normal(ln).astype(np.float32), 1800) * np.exp(-tn * 9)
    return (boom * 0.9 + nz * 0.5).astype(np.float32)


def riser(d=1.6):
    ln = int(d * SR); tn = np.arange(ln) / SR
    nz = rng.standard_normal(ln).astype(np.float32)
    nz = nz - lowpass(nz, 600)
    return (nz * (tn / d) ** 2.2).astype(np.float32)


def tick():
    ln = int(0.08 * SR); tn = np.arange(ln) / SR
    return (np.sin(2 * np.pi * 1800 * tn) * np.exp(-tn * 80)).astype(np.float32)


def pop():
    ln = int(0.18 * SR); tn = np.arange(ln) / SR
    f = 600 + 900 * np.exp(-tn * 40)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tn * 25)).astype(np.float32)


put(riser(1.6), T_DROP - 1.6, 0.18)
put(impact(), T_DROP - 0.05, 0.55)
for s in tl["scenes"][2:]:
    put(whoosh(), s["start"] - 0.3, 0.16)
hook = tl["scenes"][0]
put(pop(), hook["lines"][0]["start"], 0.22)               # 100조 카운트
for s in tl["scenes"]:
    if s["id"] == "outro":
        put(tick(), s["lines"][4]["start"] + 1.7, 0.35)     # 구독 클릭
        put(tick(), s["lines"][4]["start"] + 2.4, 0.30)     # 좋아요 클릭
    if s["id"] == "checklist":
        for k in (1, 2, 3):
            put(tick(), s["lines"][k]["start"] + 0.85, 0.22)

# ── 덕킹: 내레이션이 나올 때 BGM -9dB ──
env = np.abs(narr)
win = int(0.12 * SR)
env = np.convolve(env, np.ones(win) / win, mode="same")
speech = (env > 0.01).astype(np.float32)
sm = int(0.35 * SR)
speech = np.convolve(speech, np.ones(sm) / sm, mode="same")
duck = 1.0 - 0.64 * np.clip(speech * 1.5, 0, 1)

bgm_peak = np.max(np.abs(bgm)) or 1
bgm = bgm / bgm_peak * 0.42 * duck

mix = narr * 1.0 + bgm + sfx
mix = np.tanh(mix * 1.05) / np.tanh(1.05)    # 소프트 리미트
st = np.stack([mix, mix], axis=1).astype(np.float32)
sf.write(os.path.join(HERE, "build", "mix.wav"), st, SR, subtype="PCM_16")
sf.write(os.path.join(HERE, "build", "bgm_only.wav"), np.stack([bgm + sfx] * 2, axis=1).astype(np.float32), SR, subtype="PCM_16")
print("mix written", DUR)
