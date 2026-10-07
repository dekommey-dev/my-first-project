#!/usr/bin/env python3
"""Synthesize a 20s upbeat tech BGM + whoosh/click SFX for the Shorts edit."""
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 20.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4

CUTS = [2.0, 4.0, 6.0, 8.5, 10.0, 12.0, 14.0, 16.0, 18.0]
CLICKS = [6.098, 11.821, 18.08]
END = 18.85
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def add(buf, sig, t):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * f + phase) % 1.0) - 1


# chords per bar: F  G  Am  C (IV V vi I), voiced around C4
CHORDS = [
    [53, 57, 60, 64],  # Fmaj7
    [55, 59, 62, 67],  # G
    [57, 60, 64, 67],  # Am7
    [52, 55, 60, 64],  # C/E
]
ROOTS = [41, 43, 45, 48]

pad = np.zeros(N)
bass = np.zeros(N)
arp = np.zeros(N)
drums = np.zeros(N)
sfx = np.zeros(N)

n_bars = int(np.ceil(DUR / BAR))
for b in range(n_bars):
    t0 = b * BAR
    ch = CHORDS[b % 4] if t0 < END - 0.01 else [48, 55, 60, 64, 67]
    # ---- pad (detuned saws, soft attack)
    n = int(BAR * SR) + int(0.4 * SR)
    env = np.minimum(1, np.arange(n) / (0.25 * SR)) * np.exp(-np.arange(n) / (6 * SR))
    env[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))
    s = np.zeros(n)
    for m in ch:
        for det in (-0.08, 0.08):
            s += saw(midi(m + det), n, rng.random())
    add(pad, lp(s, 1500) * env * 0.05, t0)
    # ---- bass: 8th-note pulses on root
    if 2.0 <= t0 < END:
        for k in range(8):
            tt = t0 + k * BEAT / 2
            nn = int(BEAT / 2 * SR)
            tb = np.arange(nn) / SR
            f = midi(ROOTS[b % 4] - 12 + (12 if k % 2 else 0))
            sig = np.tanh(2.2 * np.sin(2 * np.pi * f * tb)) * np.exp(-tb * 7)
            sig *= np.minimum(1, tb / 0.004)
            add(bass, sig * 0.22, tt)
    # ---- pluck arpeggio, 16ths
    if 2.0 <= t0 < END:
        pattern = [0, 2, 1, 3, 2, 1, 3, 2]
        for k in range(16):
            tt = t0 + k * BEAT / 4
            m = ch[pattern[k % 8]] + 12
            nn = int(0.35 * SR)
            tb = np.arange(nn) / SR
            f = midi(m)
            sig = (np.sin(2 * np.pi * f * tb) + 0.3 * np.sin(2 * np.pi * 2 * f * tb)) * np.exp(-tb * 14)
            sig *= np.minimum(1, tb / 0.002)
            add(arp, sig * (0.07 if k % 4 == 0 else 0.05), tt)


def kick():
    nn = int(0.35 * SR)
    tb = np.arange(nn) / SR
    f = 45 + 110 * np.exp(-tb * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tb * 9)
    s += 0.25 * hp(rng.normal(0, 1, nn), 3000) * np.exp(-tb * 120)
    return np.tanh(1.6 * s) * 0.55


def hat(open_=False):
    nn = int((0.18 if open_ else 0.05) * SR)
    tb = np.arange(nn) / SR
    return hp(rng.normal(0, 1, nn), 8000, 4) * np.exp(-tb * (25 if open_ else 90)) * 0.10


def clap():
    nn = int(0.25 * SR)
    tb = np.arange(nn) / SR
    env = np.exp(-tb * 22)
    for d in (0.0, 0.011, 0.022):
        env += np.where(tb > d, np.exp(-(tb - d) * 160), 0) * 0.6
    return bp(rng.normal(0, 1, nn), 900, 5000) * env * 0.09


K = kick()
kick_times = []
t = 2.0
while t < END - 1e-6:
    add(drums, K, t)
    kick_times.append(t)
    add(drums, hat(open_=True), t + BEAT / 2)
    add(drums, hat(), t + BEAT / 4)
    add(drums, hat(), t + 3 * BEAT / 4)
    beat_in_bar = int(round((t % BAR) / BEAT))
    if t >= 4.0 and beat_in_bar in (1, 3):
        add(drums, clap(), t)
    t += BEAT
# opening impact & final hit
add(drums, K * 1.1, 0.0)
add(drums, K * 1.2, END)

# sidechain ducking from kicks
duck = np.ones(N)
for kt in kick_times + [END]:
    i = int(kt * SR)
    nn = int(0.3 * SR)
    curve = 1 - 0.55 * np.exp(-np.arange(nn) / (0.07 * SR))
    j = min(N, i + nn)
    duck[i:j] = np.minimum(duck[i:j], curve[: j - i])
pad *= duck
bass *= duck
arp *= 0.6 + 0.4 * duck

# ---- whooshes leading into each cut
for c in CUTS:
    nn = int(0.45 * SR)
    tb = np.arange(nn) / SR
    noise = rng.normal(0, 1, nn)
    # sweep bandpass by blocks
    out = np.zeros(nn)
    blocks = 18
    for k in range(blocks):
        a, bnd = k * nn // blocks, (k + 1) * nn // blocks
        fc = 400 * (12 ** (k / blocks))
        seg = bp(noise, fc * 0.6, min(fc * 1.6, 20000))[a:bnd]
        out[a:bnd] = seg
    env = np.sin(np.pi * np.clip(tb / 0.45, 0, 1)) ** 2
    add(sfx, out * env * 0.16, c - 0.36)

# ---- UI clicks
for c in CLICKS:
    nn = int(0.06 * SR)
    tb = np.arange(nn) / SR
    s = np.sin(2 * np.pi * 2400 * tb) * np.exp(-tb * 120) + 0.5 * hp(rng.normal(0, 1, nn), 4000) * np.exp(-tb * 300)
    add(sfx, s * 0.22, c)

# ---- end shimmer
nn = int((DUR - END) * SR)
tb = np.arange(nn) / SR
sh = np.zeros(nn)
for m in (72, 76, 79, 84):
    sh += np.sin(2 * np.pi * midi(m) * tb) * (0.5 + 0.5 * np.sin(2 * np.pi * 5 * tb))
add(sfx, sh * np.exp(-tb * 1.6) * 0.04, END)

mix = pad + bass + arp + drums + sfx
# gentle fade in/out
fade = np.ones(N)
fade[: int(0.02 * SR)] = np.linspace(0, 1, int(0.02 * SR))
fo = int(0.6 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= fade
mix = np.tanh(mix * 1.1) / 1.1

stereo = np.stack([mix, mix], axis=1)
# a touch of width: delay the arp/pad on the right channel
width = np.zeros(N)
d = int(0.012 * SR)
width[d:] = (pad + arp)[:-d] * fade[:-d]
stereo[:, 1] = stereo[:, 1] * 0.85 + width * 0.25
stereo[:, 0] = stereo[:, 0] * 0.85 + (pad + arp) * fade * 0.25
stereo /= np.max(np.abs(stereo)) / 0.9

with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
