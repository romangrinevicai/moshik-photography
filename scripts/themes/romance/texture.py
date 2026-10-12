#!/usr/bin/env python3
"""
Romance theme — seamless paper/linen texture.

Builds a tileable 512×512 texture procedurally (numpy + Pillow) and writes it
to public/themes/romance/paper.webp as RGBA: warm-brown fibres/mottling with low
alpha where the paper is darker, cream where it is lighter, transparent
elsewhere — so the same tile can sit over any background colour (porcelain,
rose-beige panels, cocoa or sage sections).

Everything is periodic by construction (FFT-filtered noise; fibres drawn with
wrap-around), so the tile repeats without seams. Deterministic (fixed seed).

    python3 scripts/themes/romance/texture.py
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 512
OUT = Path(__file__).resolve().parents[3] / 'public' / 'themes' / 'romance' / 'paper.webp'
rng = np.random.default_rng(20261012)

ky = np.fft.fftfreq(N)[:, None]
kx = np.fft.fftfreq(N)[None, :]
kr = np.hypot(kx, ky)


def spectral(filt: np.ndarray) -> np.ndarray:
    """White noise shaped in the frequency domain: periodic, so it tiles."""
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((N, N))) * filt))
    return (out - out.mean()) / (out.std() + 1e-9)


# 1. soft cloudy mottling (low frequencies only)
mottle = spectral(np.where(kr > 0, 1 / np.maximum(kr, 1 / N) ** 1.25, 0) * np.exp(-((kr / 0.035) ** 2)))

# 2. linen weave: fine horizontal and vertical threads with irregular slubs
weave_h = spectral(np.exp(-((kx / 0.004) ** 2)) * np.exp(-(((np.abs(ky) - 0.16) / 0.07) ** 2)))
weave_v = spectral(np.exp(-((ky / 0.004) ** 2)) * np.exp(-(((np.abs(kx) - 0.16) / 0.07) ** 2)))
slub = spectral(np.exp(-((kr / 0.02) ** 2)))  # modulates thread visibility
weave = (weave_h * (0.75 + 0.25 * slub) + weave_v * (0.75 - 0.25 * slub)) / 2

# 3. fine tooth (very small grain), softened
tooth = spectral(np.exp(-((kr / 0.32) ** 2)))


# 4. fibres: short curved strokes, dark and light, drawn with wrap-around
def fibres(count: int, length: tuple[int, int], seed: int) -> np.ndarray:
    r = np.random.default_rng(seed)
    img = Image.new('L', (N, N), 0)
    draw = ImageDraw.Draw(img)
    for _ in range(count):
        x, y = r.uniform(0, N), r.uniform(0, N)
        a = r.uniform(0, math.pi)
        L = r.uniform(*length)
        curl = r.uniform(-0.04, 0.04)
        steps = max(4, int(L / 3))
        pts = []
        for s in range(steps):
            pts.append((x, y))
            a += curl
            x += math.cos(a) * L / steps
            y += math.sin(a) * L / steps
        shade = int(r.uniform(90, 255))
        for dx in (-N, 0, N):
            for dy in (-N, 0, N):
                draw.line([(px + dx, py + dy) for px, py in pts], fill=shade, width=1)
    img = img.filter(ImageFilter.GaussianBlur(0.55))
    return np.asarray(img, dtype=np.float32) / 255


dark_fibres = fibres(300, (6, 24), 7)
light_fibres = fibres(340, (6, 22), 8)

# layer weights (alpha contributions): a whisper of mottling and weave, soft fibres
noise = 0.5 * mottle + 0.5 * weave + 0.06 * tooth
noise = noise / np.abs(noise).max()
w_dark = np.clip(-noise, 0, None) * 0.05 + dark_fibres * 0.08
w_light = np.clip(noise, 0, None) * 0.06 + light_fibres * 0.1
alpha = np.clip(w_dark + w_light, 0, 0.28)

brown = np.array([122, 86, 72], dtype=np.float32)  # warm cocoa-rose, never grey
cream = np.array([255, 250, 244], dtype=np.float32)
rgb = (brown[None, None, :] * w_dark[..., None] + cream[None, None, :] * w_light[..., None]) / np.maximum(
    (w_dark + w_light)[..., None], 1e-6
)
rgba = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)

OUT.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(rgba, 'RGBA').save(OUT, 'WEBP', quality=60, method=6, alpha_quality=70)
print(f'{OUT.name}: {OUT.stat().st_size / 1024:.1f} KB')
