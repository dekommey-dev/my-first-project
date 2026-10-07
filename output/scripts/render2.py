#!/usr/bin/env python3
"""Premium-review style 1080x1920 Shorts edit of the Modaly AI demo (v2)."""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
PREVIEW = len(sys.argv) > 3 and sys.argv[3] == "preview"
ONLY = None
if len(sys.argv) > 4:  # render a sub-range of output frames for checks: "a-b"
    a_, b_ = sys.argv[4].split("-")
    ONLY = (int(a_), int(b_))

W, H, FPS = 1080, 1920, 30
SW, SH, SFPS = 2244, 1950, 54
FD = "/root/.fonts/Pretendard-"
F_BLACK, F_XB, F_B, F_SB, F_M = (FD + s + ".otf" for s in ("Black", "ExtraBold", "Bold", "SemiBold", "Medium"))

INK = (14, 15, 19)
ACCENT = (56, 214, 255)
WHITE = (255, 255, 255)
MUTED = (138, 147, 166)

# ---- layout grid (64px safe margins, 8px rhythm)
MX = 48
PROG_Y = 144
CHAP_Y = 196
WX, WY, WW = 48, 336, 984
BAR_H = 56
CW, CH = WW, 936                     # browser content area
WIN_H = BAR_H + CH
WIN_R = 30
CAP_Y = 1452                          # caption block center

# ---------------------------------------------------------------------------
# Edit decision list
# ---------------------------------------------------------------------------
CHAPTERS = {
    0: ("REVIEW", "AI로 PPT 만들기"),
    1: ("PROMPT", "주제 입력"),
    2: ("RESEARCH", "자료 조사"),
    3: ("DRAFT", "초안 작성"),
    4: ("DESIGN", "슬라이드 디자인"),
    5: ("EXPORT", "다운로드"),
    6: ("SUMMARY", "한눈에 보기"),
}

SEGMENTS = [
    dict(name="hook", ch=0, src=(33.9, 35.9), dur=2.0,
         keys=[(33.9, 1156, 1043, 1620), (35.9, 1156, 1043, 1760)],
         cap=[["주제", "한", "줄", "넣었더니"], ["PPT", "*11장*이", "나왔습니다"]], cap_size=74),
    dict(name="input", ch=1, src=(0.2, 4.4), dur=2.0,
         keys=[(0.2, 1171, 770, 1250), (4.4, 1171, 770, 1120)],
         spot=[(0.5, 4.4, (636, 592, 1706, 960))],
         cap=[["*주제*", "*한*", "*줄*", "쓰고"], ["분량·언어·톤만", "고르면", "끝"]]),
    dict(name="upload", ch=1, src=(4.6, 8.4), dur=1.5,
         keys=[(4.6, 1122, 976, 1400), (8.4, 1122, 976, 1280)],
         cap=[["*참고", "자료*도"], ["함께", "넣을", "수", "있어요"]]),
    dict(name="research", ch=2, src=(8.8, 15.0), dur=2.0,
         keys=[(8.8, 1320, 790, 1000), (9.45, 1420, 790, 880), (10.0, 1160, 600, 1560), (15.0, 1160, 600, 1500)],
         clicks=[(9.05, 1625, 833)],
         cap=[["AI가", "*리서치*부터"], ["개요까지", "알아서"]]),
    dict(name="essay", ch=3, src=(15.0, 17.0), dur=1.5,
         keys=[(15.0, 900, 820, 1150), (17.0, 960, 840, 1250)],
         cap=[["*출처*", "달린", "초안이"], ["먼저", "나오고"]]),
    dict(name="cite", ch=3, src=(21.4, 25.3), dur=2.0,
         keys=[(21.4, 1167, 1200, 1700), (25.3, 1167, 1260, 1650)],
         spot=[(22.2, 24.2, (372, 1288, 1996, 1716)), (24.35, 25.3, (984, 1846, 1332, 1944))],
         clicks=[(24.95, 1158, 1896)],
         cap=[["검토", "후"], ["*버튼*", "*하나*면"]]),
    dict(name="build", ch=4, src=(25.4, 31.2), dur=2.0,
         keys=[(25.4, 1167, 1200, 1680), (31.2, 1167, 1200, 1720)],
         cap=[["레이아웃·도표까지"], ["*자동*으로", "디자인"]]),
    dict(name="grid", ch=4, src=(31.4, 33.6), dur=1.5,
         keys=[(31.4, 1167, 1000, 1750), (33.6, 1167, 1000, 1520)],
         cap=[["총", "*{n}장*", "완성"]], counter=(0.15, 0.9, 11)),
    dict(name="preview", ch=4, src=(35.6, 37.9), dur=1.5,
         keys=[(35.6, 1156, 1060, 1700), (37.9, 1156, 1100, 1700)],
         cap=[["바로", "발표해도", "되는"], ["*완성도*"]]),
    dict(name="download", ch=5, src=(37.9, 38.6), dur=1.0,
         keys=[(37.9, 1156, 1300, 1500), (38.6, 1156, 1300, 1450)],
         spot=[(37.9, 38.6, (1004, 1590, 1311, 1690))],
         clicks=[(37.98, 1158, 1641)],
         cap=[["*PPTX*로", "바로", "다운로드"]]),
    dict(name="summary", ch=6, src=(38.55, 38.55), dur=3.0, summary=True,
         keys=[(38.55, 1156, 1300, 1450)],
         cap=[["주제만", "정하세요"], ["나머지는", "*AI*가"]]),
]

t = 0.0
for s in SEGMENTS:
    s["t0"], t = t, t + s["dur"]
    s["t1"] = t
TOTAL = t
assert abs(TOTAL - 20.0) < 1e-6, TOTAL
CH_RANGE = {}
for s in SEGMENTS:
    a, b = CH_RANGE.get(s["ch"], (s["t0"], s["t1"]))
    CH_RANGE[s["ch"]] = (min(a, s["t0"]), max(b, s["t1"]))


# ---------------------------------------------------------------------------
# easing / helpers
# ---------------------------------------------------------------------------
def clamp01(x):
    return min(max(x, 0.0), 1.0)


def smooth(x):
    x = clamp01(x)
    return x * x * x * (x * (6 * x - 15) + 10)   # smootherstep


def out_cubic(x):
    return 1 - (1 - clamp01(x)) ** 3


def out_expo(x):
    x = clamp01(x)
    return 1 if x >= 1 else 1 - 2 ** (-10 * x)


def out_back(x, s=1.4):
    x = clamp01(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def lerp(a, b, u):
    return a + (b - a) * u


def font(path, size):
    return ImageFont.truetype(path, size)


def ss_draw(w, h, fn, s=4):
    """Supersampled vector drawing for crisp anti-aliased shapes."""
    im = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), s)
    return im.resize((w, h), Image.LANCZOS)


def with_alpha(im, a):
    if a >= 0.999:
        return im
    im = im.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
    return im


def paste(base, im, x, y, a=1.0, scale=1.0, anchor="mm"):
    if a <= 0.004:
        return
    if abs(scale - 1) > 1e-3:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.BICUBIC)
    im = with_alpha(im, a)
    ox = {"l": 0, "m": im.width / 2, "r": im.width}[anchor[0]]
    oy = {"t": 0, "m": im.height / 2, "b": im.height}[anchor[1]]
    base.alpha_composite(im, (round(x - ox), round(y - oy)))


def text_img(txt, path, size, fill, tracking=0.0, shadow=None):
    f = font(path, size)
    asc, desc = f.getmetrics()
    widths = [f.getlength(c) for c in txt]
    tw = sum(widths) + tracking * size * (len(txt) - 1)
    pad = 24 if shadow else 4
    im = Image.new("RGBA", (int(tw) + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if tracking == 0:
        d.text((pad, pad), txt, font=f, fill=fill)
    else:
        x = pad
        for c, cw in zip(txt, widths):
            d.text((x, pad), c, font=f, fill=fill)
            x += cw + tracking * size
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        sh.putalpha(im.getchannel("A").point(lambda v: int(v * shadow)))
        sh = sh.filter(ImageFilter.GaussianBlur(10))
        base = Image.new("RGBA", im.size, (0, 0, 0, 0))
        base.alpha_composite(sh, (0, 6))
        base.alpha_composite(im)
        im = base
    return im


# ---------------------------------------------------------------------------
# static layers
# ---------------------------------------------------------------------------
def make_background():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.zeros((H, W, 3), np.float32) + np.array(INK, np.float32)
    # soft key light from the top + faint brand bloom behind the window
    d1 = np.sqrt(((xx - W * 0.5) / 900) ** 2 + ((yy - 120) / 900) ** 2)
    img += np.exp(-d1 ** 2 * 1.4)[..., None] * np.array([26, 29, 38], np.float32)
    d2 = np.sqrt(((xx - W * 0.5) / 700) ** 2 + ((yy - 830) / 560) ** 2)
    img += np.exp(-d2 ** 2 * 1.6)[..., None] * np.array([6, 30, 44], np.float32)
    # vignette
    dv = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
    img *= (1 - 0.45 * np.clip(dv - 0.55, 0, 1))[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


BG = make_background()

rng = np.random.default_rng(3)
GRAIN = []
for _ in range(6):
    g = rng.normal(0, 1, (H // 2, W // 2))
    a = (np.abs(g) * 3).clip(0, 7).astype(np.uint8)
    col = np.where(g > 0, 255, 0).astype(np.uint8)
    im = Image.fromarray(np.dstack([col, col, col, a]), "RGBA").resize((W, H), Image.BILINEAR)
    GRAIN.append(im)


def window_chrome():
    s = 4

    def draw(d, s):
        d.rounded_rectangle((0, 0, WW * s - 1, WIN_H * s - 1), WIN_R * s, fill=(236, 238, 243, 255))
        d.rectangle((0, BAR_H * s, WW * s, BAR_H * s + s), fill=(214, 218, 226, 255))
        for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
            cx, cy, r = (30 + i * 26) * s, BAR_H / 2 * s, 7 * s
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=c + (255,))
        # url pill
        pw = 420
        x0, y0 = (WW - pw) / 2 * s, 13 * s
        d.rounded_rectangle((x0, y0, x0 + pw * s, y0 + 30 * s), 15 * s, fill=(255, 255, 255, 255))
        # lock glyph
        lx, ly = x0 + 132 * s, y0 + 9 * s
        d.rounded_rectangle((lx, ly + 5 * s, lx + 11 * s, ly + 14 * s), 2 * s, fill=(150, 156, 170, 255))
        d.arc((lx + 1.5 * s, ly, lx + 9.5 * s, ly + 10 * s), 180, 360, fill=(150, 156, 170, 255), width=int(1.8 * s))
    im = ss_draw(WW, WIN_H, draw, s)
    t = text_img("modaly.ai", F_SB, 19, (88, 94, 110, 255))
    im.alpha_composite(t, (int((WW - 420) / 2 + 152 - 4), int(13 + 15 - t.height / 2)))
    return im


CHROME = window_chrome()
CONTENT_MASK = ss_draw(CW, CH, lambda d, s: (d.rounded_rectangle((0, -WIN_R * s, CW * s - 1, CH * s - 1),
                                                                   WIN_R * s, fill=(255, 255, 255, 255))))
CONTENT_MASK = CONTENT_MASK.getchannel("A")
WIN_BORDER = ss_draw(WW + 2, WIN_H + 2, lambda d, s: d.rounded_rectangle(
    (0, 0, (WW + 2) * s - 1, (WIN_H + 2) * s - 1), (WIN_R + 1) * s, outline=(255, 255, 255, 46), width=2 * s))


def make_shadow():
    pad = 160
    im = Image.new("RGBA", (WW + pad * 2, WIN_H + pad * 2), (0, 0, 0, 0))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for blur, dy, a in ((70, 60, 150), (24, 18, 110), (6, 4, 90)):
        lay = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(lay).rounded_rectangle((pad, pad + dy, pad + WW, pad + WIN_H + dy), WIN_R, fill=(0, 0, 0, a))
        out.alpha_composite(lay.filter(ImageFilter.GaussianBlur(blur)))
    return out, pad


SHADOW, SHADOW_PAD = make_shadow()

# chapter header pieces
NUM_IMG = {k: text_img("%02d" % k if 1 <= k <= 5 else "", F_BLACK, 66, ACCENT + (255,), tracking=-0.02)
           for k in CHAPTERS}
ENG_IMG = {k: text_img(v[0], F_SB, 22, MUTED + (255,), tracking=0.28) for k, v in CHAPTERS.items()}
KOR_IMG = {k: text_img(v[1], F_B, 42, WHITE + (255,)) for k, v in CHAPTERS.items()}


def badge_icon(kind):
    def draw(d, s):
        r = 31 * s
        d.ellipse((2 * s, 2 * s, 2 * s + 2 * r, 2 * s + 2 * r), outline=ACCENT + (255,), width=3 * s)
        c = 2 * s + r
        if kind == "play":
            d.polygon([(c - 9 * s, c - 13 * s), (c - 9 * s, c + 13 * s), (c + 14 * s, c)], fill=ACCENT + (255,))
        else:
            d.line([(c - 13 * s, c + 1 * s), (c - 4 * s, c + 10 * s), (c + 14 * s, c - 10 * s)],
                   fill=ACCENT + (255,), width=5 * s, joint="curve")
    return ss_draw(68, 68, draw)


NUM_IMG[0] = badge_icon("play")
NUM_IMG[6] = badge_icon("check")
DOT_SEP = ss_draw(10, 10, lambda d, s: d.ellipse((0, 0, 10 * s - 1, 10 * s - 1), fill=(90, 96, 112, 255)))


# ---------------------------------------------------------------------------
# captions: word-by-word reveal with accent marker
# ---------------------------------------------------------------------------
NO_MARK = True


class Caption:
    def __init__(self, lines, size=60, counter_val=None):
        self.size = size
        f = font(F_XB, size)
        self.lh = int(size * 1.32)
        self.words = []   # (img, x, y, accent, width)
        space = f.getlength(" ")
        layout = []
        inside = False
        for line in lines:
            row = []
            for w in line:
                acc = "*" in w
                # accent between asterisks; may span several words ("*참고", "자료*")
                segs, buf = [], ""
                for c in w:
                    if c == "*":
                        if buf:
                            segs.append((buf, inside))
                        buf, inside = "", not inside
                    else:
                        buf += c
                if buf:
                    segs.append((buf, inside))
                if counter_val is not None:
                    segs = [(sx.replace("{n}", str(counter_val)), ia) for sx, ia in segs]
                ww = sum(f.getlength(sx) for sx, _ in segs)
                row.append((segs, ww, acc))
            layout.append(row)
        total_h = self.lh * len(layout)
        for li, row in enumerate(layout):
            row_w = sum(r[1] for r in row) + space * (len(row) - 1)
            x = -row_w / 2
            y = -total_h / 2 + li * self.lh
            for segs, ww, acc in row:
                im = Image.new("RGBA", (int(ww) + 40, self.lh + 40), (0, 0, 0, 0))
                sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
                d, ds = ImageDraw.Draw(im), ImageDraw.Draw(sh)
                xx = 20
                acc_spans = []
                for sx, ia in segs:
                    col = ACCENT if ia else WHITE
                    d.text((xx, 20 + (self.lh - size) * 0.35), sx, font=f, fill=col + (255,))
                    ds.text((xx, 20 + (self.lh - size) * 0.35), sx, font=f, fill=(0, 0, 0, 170))
                    sw = f.getlength(sx)
                    if ia:
                        acc_spans.append((xx, xx + sw))
                    xx += sw
                sh = sh.filter(ImageFilter.GaussianBlur(9))
                comp = Image.new("RGBA", im.size, (0, 0, 0, 0))
                comp.alpha_composite(sh, (0, 5))
                comp.alpha_composite(im)
                self.words.append(dict(img=comp, x=x - 20, y=y - 20, spans=acc_spans))
                x += ww + space

    def draw(self, canvas, cx, cy, lt, alpha=1.0, stagger=0.055):
        for i, w in enumerate(self.words):
            u = (lt - i * stagger) / 0.32
            if u <= 0:
                continue
            e = out_expo(u)
            a = clamp01(u * 2.2) * alpha
            yoff = 26 * (1 - e)
            # accent underline marker (drawn under word, wipes in)
            for (x0, x1) in ([] if NO_MARK else w["spans"]):
                mu = out_cubic((lt - i * stagger - 0.12) / 0.35)
                if mu > 0:
                    mx0 = cx + w["x"] + x0
                    mx1 = mx0 + (x1 - x0) * mu
                    my = cy + w["y"] + 20 + self.lh * 0.80 + yoff
                    lay = Image.new("RGBA", (int(x1 - x0) + 12, 16), (0, 0, 0, 0))
                    ImageDraw.Draw(lay).rounded_rectangle((0, 0, int(mx1 - mx0) + 6, 11), 5,
                                                          fill=ACCENT + (int(110 * a),))
                    canvas.alpha_composite(lay, (int(mx0 - 3), int(my)))
            paste(canvas, w["img"], cx + w["x"], cy + w["y"] + yoff, a=a, anchor="lt")


CAPTIONS = []
for s in SEGMENTS:
    if "counter" in s:
        CAPTIONS.append({n: Caption(s["cap"], s.get("cap_size", 60), counter_val=n)
                         for n in range(1, s["counter"][2] + 1)})
    else:
        CAPTIONS.append(Caption(s["cap"], s.get("cap_size", 60)))


# ---------------------------------------------------------------------------
# summary card
# ---------------------------------------------------------------------------
SUM_W, SUM_H = 840, 640
SUM_ROWS = [("입력", "주제 한 줄 + 참고 파일"), ("과정", "리서치 → 초안 → 디자인"), ("결과", "슬라이드 11장 · PPTX")]


def summary_base():
    def draw(d, s):
        d.rounded_rectangle((0, 0, SUM_W * s - 1, SUM_H * s - 1), 36 * s, fill=(250, 250, 252, 255))
    im = ss_draw(SUM_W, SUM_H, draw)
    paste(im, text_img("SUMMARY", F_SB, 22, (16, 150, 196, 255), tracking=0.28), 56, 60, anchor="lt")
    paste(im, text_img("Modaly AI 한눈에 보기", F_BLACK, 52, INK + (255,)), 52, 100, anchor="lt")
    ImageDraw.Draw(im).rectangle((56, 196, SUM_W - 56, 197), fill=(222, 225, 232, 255))
    return im


SUM_BASE = summary_base()


def summary_row(label, value):
    im = Image.new("RGBA", (SUM_W - 112, 110), (0, 0, 0, 0))
    paste(im, text_img(label, F_SB, 30, (128, 134, 150, 255)), 0, 55, anchor="lm")
    paste(im, text_img(value, F_B, 38, INK + (255,)), 130, 55, anchor="lm")

    def chk(d, s):
        r = 21 * s
        d.ellipse((0, 0, 2 * r, 2 * r), fill=ACCENT + (255,))
        d.line([(12 * s, 22 * s), (19 * s, 29 * s), (31 * s, 15 * s)], fill=(255, 255, 255, 255), width=4 * s,
               joint="curve")
    paste(im, ss_draw(42, 42, chk), im.width - 2, 55, anchor="rm")
    return im


SUM_ROW_IMG = [summary_row(*r) for r in SUM_ROWS]


# ---------------------------------------------------------------------------
# geometry helpers
# ---------------------------------------------------------------------------
def crop_at(keys, st):
    if st <= keys[0][0]:
        return keys[0][1:]
    for a, b in zip(keys, keys[1:]):
        if a[0] <= st <= b[0]:
            u = smooth((st - a[0]) / (b[0] - a[0]))
            return tuple(lerp(a[i], b[i], u) for i in (1, 2, 3))
    return keys[-1][1:]


def crop_rect(seg, st):
    cx, cy, w = crop_at(seg["keys"], st)
    h = w * CH / CW
    x0 = min(max(cx - w / 2, 0), SW - w)
    y0 = min(max(cy - h / 2, 0), SH - h)
    return x0, y0, w, h


def to_content(rect, x, y):
    x0, y0, w, h = rect
    return (x - x0) * CW / w, (y - y0) * CH / h


def spotlight(content, seg, st, rect):
    """Dim everything outside the active focus rect; soft rounded edge + accent stroke."""
    spots = seg.get("spot", [])
    act = [(a, b, r) for a, b, r in spots if a - 0.3 <= st <= b + 0.3]
    if not act:
        return content
    a, b, r = act[0]
    k = min(clamp01((st - a) / 0.3), clamp01((b + 0.3 - st) / 0.3))
    # morph from previous spot if they are adjacent
    idx = spots.index(act[0])
    if idx > 0 and a - spots[idx - 1][1] < 0.4:
        pa, pb, pr = spots[idx - 1]
        u = smooth((st - pb) / max(a - pb, 0.15))
        r = tuple(lerp(pr[i], r[i], u) for i in range(4))
        k = clamp01((b + 0.3 - st) / 0.3)
    k = smooth(k)
    if k <= 0:
        return content
    x0, y0 = to_content(rect, r[0], r[1])
    x1, y1 = to_content(rect, r[2], r[3])
    mask = Image.new("L", (CW, CH), int(150 * k))
    hole = ss_draw(CW, CH, lambda d, s: d.rounded_rectangle((x0 * s, y0 * s, x1 * s, y1 * s), 18 * s,
                                                             fill=(0, 0, 0, 255)), s=2).getchannel("A")
    mask = Image.composite(Image.new("L", (CW, CH), 0), mask, hole)
    dim = Image.new("RGBA", (CW, CH), (10, 12, 18, 0))
    dim.putalpha(mask)
    content.alpha_composite(dim)
    stroke = ss_draw(CW, CH, lambda d, s: d.rounded_rectangle((x0 * s, y0 * s, x1 * s, y1 * s), 18 * s,
                                                               outline=ACCENT + (int(230 * k),), width=3 * s), s=2)
    content.alpha_composite(stroke)
    return content


def ripple(content, seg, st, rect):
    for ct, x, y in seg.get("clicks", []):
        u = (st - ct) / 0.6
        if 0 <= u <= 1:
            px, py = to_content(rect, x, y)
            lay = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
            d = ImageDraw.Draw(lay)
            for k, delay in ((0, 0), (1, 0.18)):
                v = clamp01((u - delay) / (1 - delay))
                if v <= 0:
                    continue
                r = 14 + 70 * out_cubic(v)
                d.ellipse((px - r, py - r, px + r, py + r), outline=ACCENT + (int(255 * (1 - v)),), width=4)
            r0 = 22 * (1 - out_cubic(u))
            d.ellipse((px - r0, py - r0, px + r0, py + r0), fill=ACCENT + (int(120 * (1 - u)),))
            content.alpha_composite(lay)
    return content


# ---------------------------------------------------------------------------
# source reader
# ---------------------------------------------------------------------------
class Reader:
    def __init__(self, a, b):
        self.a = a
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{max(a - 0.0, 0):.3f}", "-i", SRC,
                                   "-t", f"{b - a + 0.3:.3f}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.idx, self.frame = -1, None

    def get(self, st):
        target = int(round((st - self.a) * SFPS))
        while self.idx < target:
            buf = self.p.stdout.read(SW * SH * 3)
            if len(buf) < SW * SH * 3:
                break
            self.frame = np.frombuffer(buf, np.uint8).reshape(SH, SW, 3)
            self.idx += 1
        return self.frame

    def close(self):
        self.p.stdout.close()
        self.p.kill()
        self.p.wait()


def content_frame(frame, rect):
    x0, y0, w, h = rect
    return Image.fromarray(frame).resize((CW, CH), Image.LANCZOS, box=(x0, y0, x0 + w, y0 + h)).convert("RGBA")


# ---------------------------------------------------------------------------
# frame composition
# ---------------------------------------------------------------------------
def chapter_header(canvas, t):
    seg_ch = [s for s in SEGMENTS if s["t0"] <= t < s["t1"]] or [SEGMENTS[-1]]
    ch = seg_ch[0]["ch"]
    c0 = CH_RANGE[ch][0]
    lt = t - c0
    prev = ch - 1 if ch > 0 else None
    # outgoing header slides up & fades for the first 0.25s of a new chapter
    if prev is not None and lt < 0.25:
        u = out_cubic(lt / 0.25)
        draw_header(canvas, prev, -24 * u, 1 - u)
    u = out_expo((lt - 0.08) / 0.5) if ch > 0 else out_expo(lt / 0.6)
    draw_header(canvas, ch, 28 * (1 - u), clamp01(u * 1.5))


def draw_header(canvas, ch, dy, a):
    num = NUM_IMG[ch]
    paste(canvas, num, MX - (4 if 1 <= ch <= 5 else 0), CHAP_Y + 50 + dy, a=a, anchor="lm")
    x = MX + num.width + 10
    paste(canvas, ENG_IMG[ch], x, CHAP_Y + 30 + dy, a=a, anchor="lm")
    paste(canvas, KOR_IMG[ch], x - 4, CHAP_Y + 72 + dy, a=a, anchor="lm")


def progress_bar(canvas, t):
    d = ImageDraw.Draw(canvas)
    n, gap = 5, 10
    segw = (W - 2 * MX - gap * (n - 1)) / n
    for i in range(n):
        x0 = MX + i * (segw + gap)
        d.rounded_rectangle((x0, PROG_Y, x0 + segw, PROG_Y + 6), 3, fill=(255, 255, 255, 40))
        a, b = CH_RANGE[i + 1]
        u = clamp01((t - a) / (b - a))
        if u > 0:
            d.rounded_rectangle((x0, PROG_Y, x0 + max(6, segw * u), PROG_Y + 6), 3, fill=ACCENT + (255,))


def compose_window(canvas, content, scale=1.0, dy=0.0, blur=0.0, dim=0.0):
    content = content.copy()
    if blur > 0.3:
        content = content.filter(ImageFilter.GaussianBlur(blur))
    if dim > 0:
        content.alpha_composite(Image.new("RGBA", content.size, (8, 10, 16, int(255 * dim))))
    win = CHROME.copy()
    content.putalpha(CONTENT_MASK)
    win.alpha_composite(content, (0, BAR_H))
    cx, cy = WX + WW / 2, WY + WIN_H / 2 + dy
    sh = SHADOW
    if abs(scale - 1) > 1e-3:
        win = win.resize((round(WW * scale), round(WIN_H * scale)), Image.LANCZOS)
        sh = SHADOW.resize((round(SHADOW.width * scale), round(SHADOW.height * scale)), Image.BILINEAR)
        border = WIN_BORDER.resize((win.width + 2, win.height + 2), Image.BILINEAR)
    else:
        border = WIN_BORDER
    paste(canvas, sh, cx, cy, anchor="mm")
    paste(canvas, win, cx, cy, anchor="mm")
    paste(canvas, border, cx, cy, anchor="mm")


enc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
     "-i", "-", "-c:v", "libx264", "-preset", "veryfast" if PREVIEW else "slow", "-crf", "15",
     "-tune", "film", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
     "-colorspace", "bt709", "-movflags", "+faststart", OUT],
    stdin=subprocess.PIPE)

n_total = int(round(TOTAL * FPS))
prev_last = None   # last content frame of previous segment (for dissolve)
fi = 0
for si, seg in enumerate(SEGMENTS):
    a, b = seg["src"]
    speed = (b - a) / seg["dur"] if b > a else 0
    f0, f1 = int(round(seg["t0"] * FPS)), int(round(seg["t1"] * FPS))
    need = ONLY is None or not (f1 <= ONLY[0] or f0 >= ONLY[1])
    reader = Reader(a, max(b, a + 0.1)) if need else None
    last = None
    for fi in range(f0, f1):
        t = fi / FPS
        lt = t - seg["t0"]
        st = a + lt * speed
        if not need:
            continue
        rect = crop_rect(seg, st)
        content = content_frame(reader.get(st), rect)
        content = spotlight(content, seg, st, rect)
        content = ripple(content, seg, st, rect)
        last = content
        if ONLY and not (ONLY[0] <= fi < ONLY[1]):
            continue

        canvas = BG.copy()

        # dissolve + push-in from the previous shot
        if prev_last is not None and lt < 0.22 and not seg.get("summary"):
            u = smooth(lt / 0.22)
            sc = 1.06 - 0.06 * out_cubic(lt / 0.4)
            inc = content
            if sc > 1.001:
                inc = content.resize((round(CW * sc), round(CH * sc)), Image.BILINEAR).crop(
                    (round((CW * sc - CW) / 2), round((CH * sc - CH) / 2),
                     round((CW * sc - CW) / 2) + CW, round((CH * sc - CH) / 2) + CH))
            content = Image.blend(prev_last, inc, u)
        elif not seg.get("summary") and lt < 0.4 and si > 0:
            sc = 1.06 - 0.06 * out_cubic(lt / 0.4)
            content = content.resize((round(CW * sc), round(CH * sc)), Image.BILINEAR).crop(
                (round((CW * sc - CW) / 2), round((CH * sc - CH) / 2),
                 round((CW * sc - CW) / 2) + CW, round((CH * sc - CH) / 2) + CH))

        # window intro (first 0.6s) and summary recess
        if si == 0:
            iu = out_expo(t / 0.7)
            compose_window(canvas, content, scale=0.92 + 0.08 * iu, dy=60 * (1 - iu))
        elif seg.get("summary"):
            su = smooth(lt / 0.55)
            compose_window(canvas, content, scale=1 - 0.06 * su, dy=-10 * su, blur=14 * su, dim=0.55 * su)
        else:
            compose_window(canvas, content)

        progress_bar(canvas, t)
        chapter_header(canvas, t)

        # summary card
        if seg.get("summary"):
            cu = out_expo((lt - 0.15) / 0.6)
            card = SUM_BASE.copy()
            for ri, rim in enumerate(SUM_ROW_IMG):
                ru = out_expo((lt - 0.45 - ri * 0.18) / 0.45)
                if ru > 0:
                    paste(card, rim, 56, 222 + ri * 128 + 20 * (1 - ru), a=clamp01(ru * 1.6), anchor="lt")
                    if ri < 2:
                        ImageDraw.Draw(card).rectangle((56, 222 + ri * 128 + 119, SUM_W - 56, 222 + ri * 128 + 120),
                                                       fill=(236, 238, 243, int(255 * clamp01(ru))))
            sshadow = Image.new("RGBA", (SUM_W + 200, SUM_H + 200), (0, 0, 0, 0))
            ImageDraw.Draw(sshadow).rounded_rectangle((100, 130, 100 + SUM_W, 130 + SUM_H), 36, fill=(0, 0, 0, 170))
            sshadow = sshadow.filter(ImageFilter.GaussianBlur(40))
            ccy = WY + WIN_H / 2 + 70 * (1 - cu)
            paste(canvas, sshadow, W / 2, ccy, a=clamp01(cu * 1.4))
            paste(canvas, card, W / 2, ccy, a=clamp01(cu * 1.4), scale=0.94 + 0.06 * cu)

        # caption
        cap = CAPTIONS[si]
        if isinstance(cap, dict):
            c0, c1, nmax = seg["counter"]
            n = max(1, min(nmax, int(1 + (nmax - 1) * out_cubic((lt - c0) / (c1 - c0)))))
            cap = cap[n]
        ca = 1.0
        if si < len(SEGMENTS) - 1:
            ca = clamp01((seg["t1"] - t) / 0.1)
        cap_lt = lt if si > 0 else lt - 0.25
        cap.draw(canvas, W / 2, CAP_Y, cap_lt, alpha=ca)

        # film grain
        canvas.alpha_composite(GRAIN[fi % len(GRAIN)])
        # final fade to black (last 0.25s)
        if t > TOTAL - 0.25:
            canvas.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * smooth((t - TOTAL + 0.25) / 0.25)))))

        enc.stdin.write(canvas.convert("RGB").tobytes())
        if fi % 60 == 0:
            print(f"{fi}/{n_total}", flush=True)
    if reader:
        reader.close()
    if last is not None:
        prev_last = last

enc.stdin.close()
enc.wait()
print("cuts:", [round(s["t0"], 2) for s in SEGMENTS[1:]])
print("clicks:", [round(s["t0"] + (c[0] - s["src"][0]) / ((s["src"][1] - s["src"][0]) / s["dur"]), 3)
                  for s in SEGMENTS for c in s.get("clicks", [])])
