#!/usr/bin/env python3
"""
NOIR theme — procedural film textures (TEMPORARY, see src/styles/themes/index.css).

Writes small WebP files to public/themes/noir/, referenced from
src/styles/themes/noir.css:

  grain.webp  tileable film grain (ivory specks encoded in alpha)
  leak.webp   a faint warm light leak on warm near-black (section backgrounds)
  dust.webp   sparse dust, fibres and a projector scratch (hero frame overlay)

Deterministic (fixed seeds), so re-running produces the same files.
Requires Pillow and NumPy:  python3 scripts/themes/noir/generate-textures.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[3] / 'public' / 'themes' / 'noir'
OUT.mkdir(parents=True, exist_ok=True)

IVORY = np.array([239, 232, 221], dtype=np.float64)
BLACK = np.array([12, 11, 10], dtype=np.float64)


def periodic_blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian blur with wrap-around edges (keeps the texture tileable)."""
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    kernel = np.exp(-2 * (np.pi ** 2) * (sigma ** 2) * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * kernel))


def grain(size: int = 256) -> None:
    rng = np.random.default_rng(7)
    fine = periodic_blur(rng.normal(0, 1, (size, size)), 0.42)
    clumps = periodic_blur(rng.normal(0, 1, (size, size)), 1.6)
    n = fine / fine.std() + 0.12 * clumps / clumps.std()
    n /= n.std()
    # Only the bright half of the distribution: light specks on a dark site.
    alpha = np.clip((n - 0.25) * 78, 0, 210)
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[..., :3] = IVORY.astype(np.uint8)
    rgba[..., 3] = alpha.astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(OUT / 'grain.webp', 'WEBP', quality=60, alpha_quality=55, method=6)


def blob(h: int, w: int, cx: float, cy: float, rx: float, ry: float, angle: float = 0.0) -> np.ndarray:
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    x, y = x / w - cx, y / h - cy
    ca, sa = np.cos(angle), np.sin(angle)
    xr, yr = x * ca + y * sa, -x * sa + y * ca
    return np.exp(-((xr / rx) ** 2 + (yr / ry) ** 2))


def screen(base: np.ndarray, layer: np.ndarray) -> np.ndarray:
    return 1 - (1 - base) * (1 - layer)


def leak(w: int = 1600, h: int = 900) -> None:
    """Pure-black base: meant to be composited with mix-blend-mode: screen."""
    rng = np.random.default_rng(11)
    img = np.zeros((h, w, 3))
    layers = [
        # (cx, cy, rx, ry, angle, colour, strength) in relative units
        (-0.04, 0.10, 0.34, 0.55, 0.35, (255, 158, 84), 0.42),   # amber burn, top start corner
        (0.02, 0.55, 0.16, 0.65, 0.10, (196, 62, 34), 0.30),     # red-orange bleed along the edge
        (0.20, -0.05, 0.30, 0.22, -0.25, (255, 205, 140), 0.16),  # gold haze
        (1.02, 0.92, 0.30, 0.40, 0.4, (176, 92, 48), 0.12),      # faint echo, far corner
    ]
    for cx, cy, rx, ry, ang, col, k in layers:
        m = blob(h, w, cx, cy, rx, ry, ang)[..., None] * k
        img = screen(img, m * (np.array(col) / 255))
    # soft diagonal ray
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    d = (x / w) * 0.9 + (y / h) * 0.35
    ray = np.exp(-((d - 0.33) / 0.035) ** 2) * np.exp(-((x / w) / 0.55) ** 2) * 0.10
    img = screen(img, ray[..., None] * (np.array([255, 190, 120]) / 255))
    # dither to avoid banding in the dark gradients
    img = img * 255 + np.abs(rng.normal(0, 0.9, img.shape)) * (img > 0.004)
    out = np.clip(np.round(img), 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGB').save(OUT / 'leak.webp', 'WEBP', quality=72, method=6)


def dust(w: int = 1280, h: int = 720) -> None:
    rng = np.random.default_rng(23)
    scale = 2  # draw large, downsample for smooth edges
    im = Image.new('L', (w * scale, h * scale), 0)
    dr = ImageDraw.Draw(im)
    for _ in range(46):  # specks
        x, y = rng.uniform(0, w * scale), rng.uniform(0, h * scale)
        r = rng.uniform(0.7, 2.6) * scale
        dr.ellipse([x - r, y - r, x + r, y + r], fill=int(rng.uniform(90, 230)))
    for _ in range(6):  # fibres
        x, y = rng.uniform(0, w * scale), rng.uniform(0, h * scale)
        pts = [(x, y)]
        ang = rng.uniform(0, np.pi * 2)
        for _ in range(int(rng.integers(6, 14))):
            ang += rng.normal(0, 0.45)
            x += np.cos(ang) * 5 * scale
            y += np.sin(ang) * 5 * scale
            pts.append((x, y))
        dr.line(pts, fill=int(rng.uniform(70, 150)), width=scale)
    for sx, y0, y1 in ((0.23, 0.05, 0.42), (0.23, 0.55, 0.78), (0.79, 0.30, 0.96)):  # broken projector scratches
        x = sx * w * scale
        pts = []
        for yy in range(int(y0 * h * scale), int(y1 * h * scale) + 1, 8 * scale):
            x += rng.normal(0, 0.5 * scale)
            pts.append((x, yy))
        dr.line(pts, fill=44, width=scale)
    im = im.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.4))
    a = np.asarray(im)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = IVORY.astype(np.uint8)
    rgba[..., 3] = a
    Image.fromarray(rgba, 'RGBA').save(OUT / 'dust.webp', 'WEBP', lossless=True, method=6)


if __name__ == '__main__':
    grain()
    leak()
    dust()
    for p in sorted(OUT.glob('*.webp')):
        print(f'{p.name}: {p.stat().st_size / 1024:.1f} KB')
