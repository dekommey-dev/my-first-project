#!/usr/bin/env python3
"""Render a 1080x1920 Shorts edit of the Modaly AI demo video."""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = sys.argv[1]
OUT = sys.argv[2]
PREVIEW = len(sys.argv) > 3 and sys.argv[3] == "preview"

W, H = 1080, 1920
FPS = 30
SW, SH, SFPS = 2244, 1950, 54

FONT_DIR = "/root/.fonts/"
F_BLACK = FONT_DIR + "Pretendard-Black.otf"
F_XB = FONT_DIR + "Pretendard-ExtraBold.otf"
F_B = FONT_DIR + "Pretendard-Bold.otf"
F_SB = FONT_DIR + "Pretendard-SemiBold.otf"

CYAN = (47, 211, 255)
YELLOW = (255, 222, 60)
WHITE = (255, 255, 255)

# Panel (video window)
PX, PY, PW, PH = 40, 450, 1000, 900
RADIUS = 34

# --------------------------------------------------------------------------
# Edit decision list. keys: (src_t, cx, cy, w) crop keyframes in source px.
# --------------------------------------------------------------------------
SEGMENTS = [
    dict(name="hook", src=(33.9, 35.9), dur=2.0,
         keys=[(33.9, 1156, 1040, 1300), (35.9, 1156, 1040, 1700)],
         step="미리보기", cap=[("이 PPT, ", WHITE), ("AI가 혼자", YELLOW), (" 만들었어요", WHITE)]),
    dict(name="input", src=(0.2, 4.4), dur=2.0,
         keys=[(0.2, 1171, 760, 1250), (4.4, 1171, 760, 1100)],
         step="STEP 1 · 주제 입력",
         cap=[("주제 한 줄", YELLOW), (" 쓰고", WHITE), ("\n", None), ("장수·언어·톤만 고르면 끝", WHITE)]),
    dict(name="upload", src=(4.6, 8.6), dur=2.0,
         keys=[(4.6, 1122, 976, 1380), (8.6, 1122, 976, 1250)],
         step="STEP 1 · 자료 첨부",
         cap=[("참고 자료", YELLOW), ("도 첨부 OK", WHITE), ("\n", None), ("PDF · Word · 이미지", WHITE)]),
    dict(name="research", src=(8.8, 15.2), dur=2.5,
         keys=[(8.8, 1300, 790, 1000), (9.5, 1400, 790, 900), (10.0, 1160, 560, 1560), (15.2, 1160, 560, 1500)],
         step="STEP 2 · AI 리서치",
         cap=[("AI가 직접 ", WHITE), ("리서치", YELLOW), ("하고", WHITE), ("\n", None), ("개요까지 짜줍니다", WHITE)],
         clicks=[(9.05, 1625, 833)]),
    dict(name="essay", src=(15.0, 17.0), dur=1.5,
         keys=[(15.0, 900, 800, 1150), (17.0, 960, 820, 1250)],
         step="STEP 3 · 초안 작성",
         cap=[("탄탄한 ", WHITE), ("에세이 초안", YELLOW), ("\n", None), ("자동으로 완성", WHITE)]),
    dict(name="cite", src=(21.4, 25.3), dur=2.0,
         keys=[(21.4, 1167, 1185, 1700), (25.3, 1167, 1250, 1650)],
         step="STEP 3 · 출처 확인",
         cap=[("출처", YELLOW), ("까지 꼼꼼하게 달고", WHITE), ("\n", None), ("클릭 한 번이면", WHITE)],
         clicks=[(24.95, 1158, 1872)]),
    dict(name="build", src=(25.4, 31.2), dur=2.0,
         keys=[(25.4, 1167, 1200, 1680), (31.2, 1167, 1200, 1720)],
         step="STEP 4 · 슬라이드 생성",
         cap=[("레이아웃·도표 ", WHITE), ("디자인", YELLOW), ("도", WHITE), ("\n", None), ("알아서 척척", WHITE)]),
    dict(name="grid", src=(31.4, 33.6), dur=2.0,
         keys=[(31.4, 1167, 1000, 1750), (33.6, 1167, 1000, 1500)],
         step="STEP 4 · 완성",
         cap=[("슬라이드 ", WHITE), ("11장", YELLOW), (" 완성!", WHITE)]),
    dict(name="preview", src=(35.6, 37.9), dur=2.0,
         keys=[(35.6, 1156, 1040, 1700), (37.9, 1156, 1100, 1700)],
         step="STEP 4 · 완성",
         cap=[("바로 발표 가능한 ", WHITE), ("퀄리티", YELLOW)]),
    dict(name="download", src=(37.9, 38.6), dur=0.7, hold=2.0,
         keys=[(37.9, 1156, 1150, 1700), (38.6, 1156, 1150, 1700)],
         step="STEP 5 · 다운로드",
         cap=[("PPTX", YELLOW), ("로 바로 다운로드", WHITE)],
         clicks=[(37.98, 1158, 1641)]),
]

total = sum(s["dur"] + s.get("hold", 0) for s in SEGMENTS)
# trim the end hold so the cut lands exactly on 20.0s
SEGMENTS[-1]["hold"] -= total - 20.0
t0 = 0.0
for s in SEGMENTS:
    s["t0"] = t0
    t0 += s["dur"] + s.get("hold", 0)
    s["t1"] = t0
TOTAL = t0
END_CARD_T = SEGMENTS[-1]["t0"] + SEGMENTS[-1]["dur"] + 0.15


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ease_out_back(x, s=1.7):
    x = min(max(x, 0.0), 1.0) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def ease_out_cubic(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def crop_at(keys, st):
    if st <= keys[0][0]:
        k = keys[0]
        return k[1:]
    for a, b in zip(keys, keys[1:]):
        if a[0] <= st <= b[0]:
            u = smooth((st - a[0]) / (b[0] - a[0]))
            return tuple(a[i] + (b[i] - a[i]) * u for i in (1, 2, 3))
    return keys[-1][1:]


def crop_rect(seg, st):
    cx, cy, w = crop_at(seg["keys"], st)
    h = w * PH / PW
    x0 = min(max(cx - w / 2, 0), SW - w)
    y0 = min(max(cy - h / 2, 0), SH - h)
    return x0, y0, w, h


def font(path, size):
    return ImageFont.truetype(path, size)


def rich_text_image(parts, size, path=F_XB, stroke=10, line_gap=18, shadow=True):
    """Render [(text, color)] with '\n' entries as line breaks, centered."""
    f = font(path, size)
    lines, cur = [], []
    for txt, col in parts:
        if txt == "\n":
            lines.append(cur)
            cur = []
        else:
            cur.append((txt, col))
    lines.append(cur)
    asc, desc = f.getmetrics()
    lh = asc + desc
    widths = [sum(f.getlength(t) for t, _ in ln) for ln in lines]
    pad = stroke + 30
    iw = int(max(widths)) + pad * 2
    ih = lh * len(lines) + line_gap * (len(lines) - 1) + pad * 2
    img = Image.new("RGBA", (iw, ih), (0, 0, 0, 0))
    # shadow layer
    if shadow:
        sh = Image.new("RGBA", (iw, ih), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        y = pad
        for ln, lw in zip(lines, widths):
            x = (iw - lw) / 2
            for t, _ in ln:
                sd.text((x, y + 8), t, font=f, fill=(0, 0, 0, 200), stroke_width=stroke, stroke_fill=(0, 0, 0, 200))
                x += f.getlength(t)
            y += lh + line_gap
        sh = sh.filter(ImageFilter.GaussianBlur(10))
        img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    y = pad
    for ln, lw in zip(lines, widths):
        x = (iw - lw) / 2
        for t, col in ln:
            d.text((x, y), t, font=f, fill=col + (255,), stroke_width=stroke, stroke_fill=(10, 12, 24, 255))
            x += f.getlength(t)
        y += lh + line_gap
    return img


def rounded_mask(w, h, r, scale=4):
    m = Image.new("L", (w * scale, h * scale), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * scale - 1, h * scale - 1), r * scale, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def pill(text, size, fg, bg, path=F_B, padx=26, pady=14, border=None):
    f = font(path, size)
    tw = f.getlength(text)
    asc, desc = f.getmetrics()
    w, h = int(tw + padx * 2), int(asc + desc + pady * 2)
    s = 4
    img = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w * s - 1, h * s - 1), h * s // 2, fill=bg,
                        outline=border, width=(3 * s if border else 0))
    img = img.resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(img).text((padx, pady), text, font=f, fill=fg)
    return img


def paste_center(base, im, cx, cy, scale=1.0, alpha=1.0):
    if alpha <= 0.001 or scale <= 0.01:
        return
    if abs(scale - 1.0) > 1e-3:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    if alpha < 0.999:
        a = im.getchannel("A").point(lambda v: int(v * alpha))
        im = im.copy()
        im.putalpha(a)
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


# --------------------------------------------------------------------------
# static layers
# --------------------------------------------------------------------------
def make_background():
    bw, bh = W + 160, H + 160
    yy, xx = np.mgrid[0:bh, 0:bw].astype(np.float32)
    top = np.array([8, 12, 28], np.float32)
    bot = np.array([14, 22, 52], np.float32)
    g = (yy / bh)[..., None]
    img = top * (1 - g) + bot * g

    def glow(cx, cy, r, col, k):
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        a = np.exp(-d * d) * k
        return a[..., None] * np.array(col, np.float32)

    img += glow(bw * 0.15, bh * 0.22, 520, (30, 140, 255), 0.55)
    img += glow(bw * 0.9, bh * 0.55, 600, (40, 210, 255), 0.35)
    img += glow(bw * 0.4, bh * 0.95, 560, (110, 70, 255), 0.35)
    # faint grid
    grid = ((xx % 60 < 1.2) | (yy % 60 < 1.2)).astype(np.float32)[..., None] * 7
    img += grid
    noise = np.random.default_rng(1).normal(0, 2.0, img.shape[:2])[..., None]
    img = np.clip(img + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(img, "RGB").convert("RGBA")


BG = make_background()
PANEL_MASK = rounded_mask(PW, PH, RADIUS)

shadow = Image.new("RGBA", (PW + 200, PH + 200), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((100, 120, 100 + PW, 120 + PH), RADIUS, fill=(0, 0, 0, 190))
PANEL_SHADOW = shadow.filter(ImageFilter.GaussianBlur(36))

# glowing border ring around the panel
ring = Image.new("RGBA", ((PW + 12) * 4, (PH + 12) * 4), (0, 0, 0, 0))
ImageDraw.Draw(ring).rounded_rectangle((0, 0, (PW + 12) * 4 - 1, (PH + 12) * 4 - 1), (RADIUS + 6) * 4,
                                       outline=(120, 200, 255, 120), width=4 * 3)
PANEL_RING = ring.resize((PW + 12, PH + 12), Image.LANCZOS)

# header: brand chip + title
BRAND = pill("Modaly AI", 34, (230, 245, 255, 255), (47, 211, 255, 40), path=F_B, border=(47, 211, 255, 150))
TITLE = rich_text_image([("주제 한 줄", WHITE), ("이면", WHITE), ("\n", None), ("PPT", CYAN), ("가 뚝딱 완성", WHITE)],
                        92, path=F_BLACK, stroke=0, line_gap=6, shadow=True)

CAPS = [rich_text_image(s["cap"], 66, path=F_XB, stroke=9, line_gap=10) for s in SEGMENTS]
STEP_PILLS = {}
for s in SEGMENTS:
    if s["step"] not in STEP_PILLS:
        STEP_PILLS[s["step"]] = pill(s["step"], 34, (8, 16, 32, 255), (47, 211, 255, 255), path=F_XB, padx=24, pady=10)

END_TITLE = rich_text_image([("주제만 던지세요", WHITE), ("\n", None), ("PPT는 ", WHITE), ("Modaly AI", CYAN), ("가", WHITE)],
                            84, path=F_BLACK, stroke=0, line_gap=10)
END_SUB = pill("주제 입력 → 리서치 → 초안 → 슬라이드 → PPTX", 32, (225, 235, 255, 255), (255, 255, 255, 28),
               path=F_SB, padx=30, pady=14, border=(255, 255, 255, 60))

# progress dots (one per segment beyond hook)
PROG_Y = 1505


# --------------------------------------------------------------------------
# source frame reader per segment
# --------------------------------------------------------------------------
def read_segment_frames(seg):
    a, b = seg["src"]
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-i", SRC, "-t", f"{b - a + 0.2:.3f}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE)
    fsize = SW * SH * 3
    idx = -1
    frame = None

    def get(src_t):
        nonlocal idx, frame
        target = int(round((src_t - a) * SFPS))
        while idx < target:
            buf = proc.stdout.read(fsize)
            if len(buf) < fsize:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(SH, SW, 3)
            idx += 1
        return frame

    return proc, get


def render_panel(frame, rect):
    x0, y0, w, h = rect
    im = Image.fromarray(frame)
    return im.resize((PW, PH), Image.LANCZOS, box=(x0, y0, x0 + w, y0 + h))


# --------------------------------------------------------------------------
# main loop
# --------------------------------------------------------------------------
enc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
     "-i", "-", "-c:v", "libx264", "-preset", "veryfast" if PREVIEW else "slow", "-crf", "16",
     "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT],
    stdin=subprocess.PIPE)

n_frames = int(round(TOTAL * FPS))
frame_i = 0
last_panel = None
for si, seg in enumerate(SEGMENTS):
    proc, get = read_segment_frames(seg)
    a, b = seg["src"]
    speed = (b - a) / seg["dur"]
    seg_frames = int(round(seg["t1"] * FPS)) - int(round(seg["t0"] * FPS))
    for k in range(seg_frames):
        t = frame_i / FPS
        lt = t - seg["t0"]
        st = min(a + lt * speed, b)
        if lt <= seg["dur"] or last_panel is None:
            fr = get(st)
            panel = render_panel(fr, crop_rect(seg, st))
            last_panel = panel
        else:
            panel = last_panel

        # ---- background (slow drift)
        dx = 80 + 50 * math.sin(t * 0.35)
        dy = 80 + 50 * math.cos(t * 0.28)
        canvas = BG.crop((int(dx), int(dy), int(dx) + W, int(dy) + H)).copy()

        # ---- click ripple drawn into panel
        p = panel.convert("RGBA")
        for (ct, cx, cy) in seg.get("clicks", []):
            u = (st - ct) / 0.55
            if 0 <= u <= 1:
                x0, y0, w, h = crop_rect(seg, st)
                px_ = (cx - x0) * PW / w
                py_ = (cy - y0) * PH / h
                ov = Image.new("RGBA", p.size, (0, 0, 0, 0))
                d = ImageDraw.Draw(ov)
                r = 20 + 90 * ease_out_cubic(u)
                al = int(230 * (1 - u))
                d.ellipse((px_ - r, py_ - r, px_ + r, py_ + r), outline=(47, 180, 255, al), width=8)
                r2 = 16 + 40 * ease_out_cubic(u)
                d.ellipse((px_ - r2, py_ - r2, px_ + r2, py_ + r2), fill=(47, 180, 255, int(90 * (1 - u))))
                p.alpha_composite(ov)

        # cut "punch": slight zoom-in settle at segment start
        punch = 1.0 + 0.035 * (1 - ease_out_cubic(lt / 0.35)) if si > 0 else 1.0
        # end card: shrink & dim panel
        endu = smooth((t - END_CARD_T) / 0.5)
        pscale = punch * (1 - 0.12 * endu)
        pw, ph = int(PW * pscale), int(PH * pscale)
        pcy = PY + PH / 2 + 60 * endu

        if endu > 0:
            p = p.filter(ImageFilter.GaussianBlur(8 * endu))
            dim = Image.new("RGBA", p.size, (6, 10, 24, int(185 * endu)))
            p.alpha_composite(dim)
        p.putalpha(PANEL_MASK)
        sh = PANEL_SHADOW
        if abs(pscale - 1) > 1e-3:
            p = p.resize((pw, ph), Image.LANCZOS)
            sh = sh.resize((int(sh.width * pscale), int(sh.height * pscale)), Image.BILINEAR)
            ring_im = PANEL_RING.resize((pw + 12, ph + 12), Image.BILINEAR)
        else:
            ring_im = PANEL_RING
        canvas.alpha_composite(sh, (int(W / 2 - sh.width / 2), int(pcy - sh.height / 2 + 10)))
        canvas.alpha_composite(ring_im, (int(W / 2 - ring_im.width / 2), int(pcy - ring_im.height / 2)))
        canvas.alpha_composite(p, (int(W / 2 - pw / 2), int(pcy - ph / 2)))

        # ---- header (intro animation)
        hu = ease_out_cubic(t / 0.5)
        head_a = 1 - endu
        paste_center(canvas, BRAND, W / 2, 140 - 20 * (1 - hu), alpha=hu * head_a)
        paste_center(canvas, TITLE, W / 2, 300 + 30 * (1 - hu), scale=0.9 + 0.1 * ease_out_back(t / 0.5),
                     alpha=hu * head_a)

        # ---- step pill on panel top edge
        if endu < 1:
            pil_im = STEP_PILLS[seg["step"]]
            pu = ease_out_back(lt / 0.3)
            prev_step = SEGMENTS[si - 1]["step"] if si > 0 else None
            if prev_step == seg["step"]:
                pu = 1.0
            paste_center(canvas, pil_im, PX + 40 + pil_im.width / 2, PY + 6, scale=0.6 + 0.4 * pu,
                         alpha=min(1, lt / 0.12 if prev_step != seg["step"] else 1) * (1 - endu))

        # ---- caption pop
        cap = CAPS[si]
        cu = ease_out_back(lt / 0.28, s=2.2)
        ca = min(1.0, lt / 0.12)
        # fade out right before the next caption (except the last)
        if si < len(SEGMENTS) - 1:
            ca *= min(1.0, (seg["t1"] - t) / 0.08)
        ca *= (1 - endu)
        paste_center(canvas, cap, W / 2, 1490 + 24 * (1 - ease_out_cubic(lt / 0.28)),
                     scale=0.82 + 0.18 * cu, alpha=ca)

        # ---- progress bar (top)
        prog = t / TOTAL
        d = ImageDraw.Draw(canvas)
        d.rectangle((0, 0, W, 8), fill=(255, 255, 255, 40))
        d.rectangle((0, 0, int(W * prog), 8), fill=CYAN + (255,))

        # ---- end card
        if endu > 0:
            eu = ease_out_back((t - END_CARD_T - 0.1) / 0.45)
            ea = smooth((t - END_CARD_T - 0.1) / 0.25)
            paste_center(canvas, END_TITLE, W / 2, 900, scale=0.85 + 0.15 * eu, alpha=ea)
            su = smooth((t - END_CARD_T - 0.35) / 0.3)
            paste_center(canvas, END_SUB, W / 2, 1080 + 20 * (1 - su), alpha=su)

        enc.stdin.write(canvas.convert("RGB").tobytes())
        frame_i += 1
        if frame_i % 60 == 0:
            print(f"{frame_i}/{n_frames}", flush=True)
    proc.stdout.close()
    proc.kill()

enc.stdin.close()
enc.wait()
print("segments:", [(s["name"], round(s["t0"], 2), round(s["t1"], 2)) for s in SEGMENTS])
print("cut times:", [round(s["t0"], 3) for s in SEGMENTS[1:]])
print("click times:", [round(s["t0"] + (c[0] - s["src"][0]) * s["dur"] / (s["src"][1] - s["src"][0]), 3)
                       for s in SEGMENTS for c in s.get("clicks", [])])
print("end card:", END_CARD_T)
