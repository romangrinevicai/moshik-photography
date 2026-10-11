#!/usr/bin/env python3
"""
Generate the abstract, film-like placeholder images that ship with the site
template (bokeh, golden-hour seascapes, silk, sparklers...).

They exist only so the design can be previewed before Moshik's real
photographs are added. Replace them by dropping real photos into the same
folders (see README → "Adding photos").

Dev-only. Requires: pip install numpy pillow scipy
Usage:          python3 scripts/placeholders/generate.py
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, zoom

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "assets" / "photos"

L = (1800, 1200)      # landscape 3:2
P = (1200, 1800)      # portrait 2:3
T = (1440, 1800)      # portrait 4:5
S = (1500, 1500)      # square
W = (2400, 1500)      # hero 16:10


# ─────────────────────────────── colour helpers ──────────────────────────────

def hx(h: str) -> np.ndarray:
    h = h.lstrip("#")
    c = np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0
    return srgb_to_lin(c)


def srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


def lin_to_srgb(c):
    c = np.clip(c, 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


class Canvas:
    def __init__(self, size, seed):
        self.w, self.h = size
        self.rng = np.random.default_rng(seed)
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        self.px, self.py = xx, yy
        self.x, self.y = xx / self.w, yy / self.h          # 0..1
        self.aspect = self.w / self.h
        self.img = np.zeros((self.h, self.w, 3), np.float32)

    # ── primitives ───────────────────────────────────────────────────────────
    def vgradient(self, stops, axis="y", warp=0.0):
        t = self.y if axis == "y" else self.x
        if warp:
            t = np.clip(t + self.noise(3, 4) * warp, 0, 1)
        pos = np.array([s[0] for s in stops], np.float32)
        cols = np.stack([hx(s[1]) for s in stops])
        out = np.empty_like(self.img)
        for ch in range(3):
            out[..., ch] = np.interp(t, pos, cols[:, ch])
        self.img = out
        return self

    def noise(self, gx, gy, octaves=1):
        """Smooth value noise in [-1, 1]."""
        acc = np.zeros((self.h, self.w), np.float32)
        amp, total = 1.0, 0.0
        for o in range(octaves):
            nx, ny = gx * 2 ** o + 2, gy * 2 ** o + 2
            base = self.rng.standard_normal((ny, nx)).astype(np.float32)
            up = zoom(base, (self.h / ny * 1.0001, self.w / nx * 1.0001), order=3)[: self.h, : self.w]
            acc += up * amp
            total += amp
            amp *= 0.5
        acc /= total
        return np.clip(acc / (np.abs(acc).max() + 1e-6), -1, 1)

    def glow(self, cx, cy, r, color, strength=1.0, power=2.0):
        d = np.sqrt(((self.x - cx) * self.aspect) ** 2 + (self.y - cy) ** 2) / r
        self.img += hx(color) * (strength * np.exp(-d ** power))[..., None]
        return self

    def bokeh(self, n, palette, rmin, rmax, region=(0, 1, 0, 1), intensity=(0.3, 1.0),
              soft=0.08, rim=0.35, blur=0.0, weights=None):
        layer = np.zeros_like(self.img)
        x0, x1, y0, y1 = region
        for _ in range(n):
            r = self.rng.uniform(rmin, rmax) * self.w
            cx = self.rng.uniform(x0, x1) * self.w
            cy = self.rng.uniform(y0, y1) * self.h
            col = hx(palette[self.rng.choice(len(palette), p=weights)])
            a = self.rng.uniform(*intensity)
            bx0, bx1 = int(max(cx - r - 3, 0)), int(min(cx + r + 3, self.w))
            by0, by1 = int(max(cy - r - 3, 0)), int(min(cy + r + 3, self.h))
            if bx1 <= bx0 or by1 <= by0:
                continue
            sx = self.px[by0:by1, bx0:bx1] - cx
            sy = self.py[by0:by1, bx0:bx1] - cy
            d = np.sqrt(sx * sx + sy * sy)
            s = max(r * soft, 1.0)
            disc = 1.0 / (1.0 + np.exp((d - r) / s))
            ring = np.exp(-((d - r * 0.9) / (r * 0.07 + 1)) ** 2) * rim
            prof = (disc * (0.75 + 0.25 * (d / r)) + ring * disc) * a
            layer[by0:by1, bx0:bx1] += prof[..., None] * col
        if blur:
            layer = gaussian_filter(layer, sigma=(blur, blur, 0))
        self.img += layer
        return self

    def streaks(self, cx, width, y0, y1, color, strength=1.0, density=1.0):
        """Sun reflection on water: horizontal glints in a column."""
        rows = self.rng.random(self.h).astype(np.float32)
        rows = gaussian_filter(rows, 1.2)
        rows = np.clip((rows - 0.45) * 3.5 * density, 0, 1)
        t = np.clip((self.y - y0) / (y1 - y0), 0, 1)
        wcol = width * (0.35 + t * 1.4)
        col = np.exp(-(((self.x - cx) * self.aspect) / wcol) ** 2)
        wobble = 0.6 + 0.4 * self.noise(40, 2)
        m = (self.y > y0) * col * rows[:, None] * wobble * (1 - t * 0.5)
        self.img += hx(color) * (m * strength)[..., None]
        return self

    def blur(self, sigma):
        self.img = gaussian_filter(self.img, sigma=(sigma, sigma, 0))
        return self

    def mix(self, mask, color, amount=1.0):
        m = np.clip(mask * amount, 0, 1)[..., None]
        self.img = self.img * (1 - m) + hx(color) * m
        return self

    # ── finishing ────────────────────────────────────────────────────────────
    def finish(self, vignette=0.35, lift=0.02, warm=0.0, grain=0.010, exposure=1.0, contrast=1.0):
        img = self.img * exposure
        # filmic shoulder to keep highlights soft
        img = img / (1.0 + img * 0.18)
        if vignette:
            d = ((self.x - 0.5) * self.aspect / max(self.aspect, 1)) ** 2 + (self.y - 0.5) ** 2
            img *= (1 - vignette * np.clip(d * 1.6, 0, 1) ** 1.2)[..., None]
        s = lin_to_srgb(img)
        if contrast != 1.0:
            s = np.clip((s - 0.5) * contrast + 0.5, 0, 1)
        if warm:
            s[..., 0] += warm * 0.6 * s[..., 0]
            s[..., 2] -= warm * 0.6 * s[..., 2]
        s = s * (1 - lift * 1.5) + lift
        if grain:
            g = self.rng.normal(0, grain, (self.h, self.w)).astype(np.float32)
            s += g[..., None]
        return Image.fromarray((np.clip(s, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")


# ─────────────────────────────────── scenes ──────────────────────────────────

def golden_sea(size, seed, mood="gold"):
    c = Canvas(size, seed)
    r = c.rng
    hz = r.uniform(0.55, 0.66)
    sky = {
        "gold": [(0, "#5d6b86"), (hz * 0.55, "#c9a1a0"), (hz * 0.9, "#f0b98a"), (hz, "#f7d39a")],
        "rose": [(0, "#4a4f6e"), (hz * 0.5, "#b88a9c"), (hz * 0.9, "#eeb09a"), (hz, "#f6cfae")],
        "blue": [(0, "#3d5f86"), (hz * 0.6, "#86a7c4"), (hz * 0.95, "#e8d3bd"), (hz, "#f4e3cc")],
    }[mood]
    sea = {"gold": ("#8a6a55", "#2d2b30"), "rose": ("#7d5f63", "#272430"), "blue": ("#4f6f84", "#1d2b38")}[mood]
    c.vgradient(sky + [(hz + 0.0005, sea[0]), (1, sea[1])])
    sx = r.uniform(0.3, 0.7)
    c.glow(sx, hz - 0.03, 0.55, "#f3b77e", 0.55, 1.6)
    c.glow(sx, hz - 0.02, 0.10, "#fff1d0", 1.3, 2.0)
    c.glow(sx, hz - 0.02, 0.025, "#ffffff", 3.0, 2.0)
    c.streaks(sx, 0.05, hz, 1.0, "#ffe3b0", 1.1)
    # thin atmospheric haze over horizon
    c.img += hx("#f6d2a6") * (0.25 * np.exp(-((c.y - hz) / 0.05) ** 2))[..., None]
    c.bokeh(14, ["#ffe7c2", "#ffd39a"], 0.01, 0.05, (0, 1, hz - 0.1, hz + 0.25), (0.05, 0.25), blur=3)
    c.blur(2.2)
    return c.finish(vignette=0.4, lift=0.03, warm=0.03)


def reception_bokeh(size, seed, palette=None):
    c = Canvas(size, seed)
    pal = palette or ["#ffcf8a", "#ffb35c", "#fff0d2", "#f6c27a", "#ffdcaa"]
    c.vgradient([(0, "#1a1210"), (0.6, "#2a1d16"), (1, "#120d0b")], warp=0.08)
    c.glow(c.rng.uniform(0.3, 0.7), 0.35, 0.7, "#5a3622", 0.6, 1.4)
    c.bokeh(160, pal, 0.004, 0.012, (0, 1, 0.02, 0.6), (0.4, 1.4), soft=0.15, rim=0.1)  # string lights
    c.bokeh(70, pal, 0.02, 0.06, (0, 1, 0, 0.9), (0.12, 0.55), rim=0.45)
    c.bokeh(12, pal, 0.07, 0.14, (-0.1, 1.1, -0.1, 1.1), (0.06, 0.2), rim=0.5, blur=6)
    c.blur(1.2)
    return c.finish(vignette=0.5, lift=0.025, warm=0.02, exposure=1.05)


def party_bokeh(size, seed):
    c = Canvas(size, seed)
    pal = ["#ff4fa3", "#7a5cff", "#3fd0ff", "#ffb347", "#ff6f61", "#c084fc"]
    c.vgradient([(0, "#0d0a1c"), (0.55, "#1c0f2e"), (1, "#0a0812")], warp=0.1)
    # stage beams
    for _ in range(4):
        ang = c.rng.uniform(-0.6, 0.6)
        x0 = c.rng.uniform(0.1, 0.9)
        d = ((c.x - x0) * math.cos(ang) * c.aspect - (c.y) * math.sin(ang))
        beam = np.exp(-(d / c.rng.uniform(0.02, 0.06)) ** 2) * np.clip(1 - c.y * 1.1, 0, 1)
        c.img += hx(pal[c.rng.integers(len(pal))]) * (beam * 0.35)[..., None]
    c.bokeh(90, pal, 0.012, 0.05, (0, 1, 0, 1), (0.15, 0.8), rim=0.5)
    c.bokeh(14, pal, 0.07, 0.15, (-0.1, 1.1, -0.1, 1.1), (0.05, 0.18), blur=8)
    haze = (c.noise(3, 2, 2) * 0.5 + 0.5) * 0.12
    c.img += hx("#6b4fa0") * haze[..., None]
    c.blur(1.0)
    return c.finish(vignette=0.45, lift=0.02, contrast=1.05)


def silk(size, seed, light="#f6efe6", mid="#e3d3c3", dark="#a8907c", sheen="#fffaf3"):
    c = Canvas(size, seed)
    r = c.rng
    warp = c.noise(2, 2, 2) * 1.6
    f = np.zeros((c.h, c.w), np.float32)
    for k in range(4):
        th = r.uniform(0.5, 1.2) + k * 0.15
        freq = r.uniform(1.2, 2.8) * (1 + k * 0.6)
        ph = r.uniform(0, 6.28)
        f += np.sin(2 * math.pi * (c.x * c.aspect * math.cos(th) + c.y * math.sin(th)) * freq + ph + warp * (1.2 - k * 0.2)) / (1 + k * 0.9)
    f = f / np.abs(f).max()
    t = (f * 0.5 + 0.5)
    t = gaussian_filter(t, 3)
    out = np.empty_like(c.img)
    stops = np.array([0, 0.45, 1.0], np.float32)
    cols = np.stack([hx(dark), hx(mid), hx(light)])
    for ch in range(3):
        out[..., ch] = np.interp(t, stops, cols[:, ch])
    c.img = out
    spec = np.exp(-((t - 0.86) / 0.06) ** 2) * 0.35
    c.img += hx(sheen) * spec[..., None]
    c.glow(r.uniform(0.2, 0.8), r.uniform(0.1, 0.4), 0.8, "#fff4e6", 0.18, 1.5)
    c.blur(1.0)
    return c.finish(vignette=0.25, lift=0.02, warm=0.01)


def candlelight(size, seed):
    c = Canvas(size, seed)
    c.vgradient([(0, "#0b0807"), (0.7, "#1a110c"), (1, "#0e0a08")])
    r = c.rng
    for _ in range(r.integers(5, 9)):
        cx, cy = r.uniform(0.1, 0.9), r.uniform(0.45, 0.85)
        s = r.uniform(0.6, 1.4)
        # flame: vertically stretched glow
        d = np.sqrt(((c.x - cx) * c.aspect / (0.010 * s)) ** 2 + ((c.y - cy) / (0.028 * s)) ** 2)
        c.img += hx("#fff3d6") * (np.exp(-d ** 2) * 2.2)[..., None]
        c.glow(cx, cy, 0.05 * s, "#ffb760", 0.9)
        c.glow(cx, cy + 0.02, 0.22 * s, "#ff8a3d", 0.25, 1.5)
    c.bokeh(30, ["#ffc070", "#ffdca0", "#ff9f50"], 0.03, 0.09, (0, 1, 0, 1), (0.05, 0.3), rim=0.5, blur=2)
    c.blur(1.5)
    return c.finish(vignette=0.55, lift=0.02, warm=0.02)


def sparklers(size, seed):
    c = Canvas(size, seed)
    c.vgradient([(0, "#060a16"), (0.6, "#0d1426"), (1, "#05070d")])
    r = c.rng
    layer = np.zeros((c.h, c.w), np.float32)
    sparks = np.zeros((c.h, c.w), np.float32)

    def plot(xs, ys, buf, wgt=1.0):
        ix = np.clip((xs * c.w).astype(int), 0, c.w - 1)
        iy = np.clip((ys * c.h).astype(int), 0, c.h - 1)
        np.add.at(buf, (iy, ix), wgt)

    paths = []
    if r.random() < 0.5:
        # long-exposure heart, the classic sparkler shot
        t = np.linspace(0, 2 * math.pi, 5000)
        hx_ = 16 * np.sin(t) ** 3
        hy_ = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
        sc = r.uniform(0.012, 0.016)
        cx, cy = r.uniform(0.35, 0.65), r.uniform(0.4, 0.55)
        paths.append((cx + hx_ * sc / c.aspect + r.normal(0, 0.0008, t.size), cy - hy_ * sc + r.normal(0, 0.0008, t.size)))
    for _ in range(r.integers(2, 4)):
        n = 4000
        ang = np.cumsum(gaussian_filter(r.normal(0, 0.06, n), 40)) + r.uniform(0, 6.28)
        step = r.uniform(0.00012, 0.0002)
        xs = r.uniform(0.2, 0.8) + np.cumsum(np.cos(ang)) * step * 1.0
        ys = r.uniform(0.3, 0.7) + np.cumsum(np.sin(ang)) * step * c.aspect
        paths.append((xs, ys))
    for xs, ys in paths:
        plot(xs, ys, layer)
        idx = r.choice(len(xs), 260)
        for i in idx:
            a = r.uniform(0, 6.28)
            ln = r.uniform(0.004, 0.03)
            tt = np.linspace(0, 1, 40)
            plot(xs[i] + np.cos(a) * ln * tt / c.aspect, ys[i] + np.sin(a) * ln * tt, sparks, (1 - tt) * 0.6)
    core = gaussian_filter(layer, 1.0) * 3.5
    bloom = gaussian_filter(layer, 7) * 16 + gaussian_filter(layer, 28) * 38
    c.img += hx("#fff6e0") * np.clip(core, 0, 4)[..., None]
    c.img += hx("#ffb84d") * bloom[..., None]
    c.img += hx("#ffd98f") * (gaussian_filter(sparks, 0.8) * 2.2)[..., None]
    c.bokeh(25, ["#ffd27a", "#ffefc4"], 0.01, 0.05, (0, 1, 0, 1), (0.05, 0.22), blur=3)
    return c.finish(vignette=0.5, lift=0.015)


def garden(size, seed):
    c = Canvas(size, seed)
    c.vgradient([(0, "#c9cba0"), (0.35, "#7f8a55"), (0.75, "#4b5634"), (1, "#2f3624")], warp=0.15)
    n = c.noise(4, 4, 3)
    c.mix(np.clip(n, 0, 1), "#2c3a22", 0.5)
    c.mix(np.clip(-n, 0, 1), "#a9b07a", 0.35)
    c.bokeh(80, ["#fffbe6", "#f3f0c8", "#ffffff", "#e9f0c0"], 0.008, 0.04, (0, 1, 0, 0.65), (0.2, 0.9), rim=0.3)
    c.bokeh(10, ["#fffbe6"], 0.06, 0.14, (-0.1, 1.1, -0.1, 0.8), (0.08, 0.25), blur=6)
    c.glow(c.rng.uniform(0.6, 0.9), 0.05, 0.6, "#fff5d0", 0.5, 1.4)
    c.blur(2.5)
    return c.finish(vignette=0.35, lift=0.03, warm=0.02)


def window_mono(size, seed):
    c = Canvas(size, seed)
    r = c.rng
    c.vgradient([(0, "#3a3a3a"), (1, "#161616")], axis="x" if r.random() < 0.5 else "y")
    cx, cy = r.uniform(0.35, 0.65), r.uniform(0.35, 0.6)
    ww, hh = r.uniform(0.18, 0.28), r.uniform(0.28, 0.42)
    shear = r.uniform(-0.5, 0.5)
    dx = (c.x - cx) * c.aspect - (c.y - cy) * shear
    dy = c.y - cy
    win = ((np.abs(dx) < ww) & (np.abs(dy) < hh)).astype(np.float32)
    # muntins: a cross-shaped frame shadow inside the window light
    bar = 0.012
    frame = ((np.abs(dx) < bar) | (np.abs(dy) < bar * 1.3)).astype(np.float32)
    light = win * (1 - frame * 0.9)
    light = gaussian_filter(light, 10) * 0.75 + gaussian_filter(light, 45) * 0.35
    c.img += hx("#e6e6e6") * light[..., None]
    c.img *= (1 + c.noise(3, 3, 3) * 0.08)[..., None]
    c.glow(cx, cy, 0.7, "#5c5c5c", 0.25, 1.4)
    img = c.finish(vignette=0.5, lift=0.035, grain=0.016, contrast=1.1)
    return img.convert("L").convert("RGB")


def petals(size, seed):
    c = Canvas(size, seed)
    r = c.rng
    c.vgradient([(0, "#efe2d6"), (1, "#d9c6b5")])
    c.glow(0.5, 0.3, 0.8, "#fff6ec", 0.35)
    pal = ["#d98f94", "#e8b0b4", "#fbf5f0", "#c97a80", "#f0c9bf"]
    for layer_blur, count, smin, smax, alpha in ((16, 8, 0.07, 0.14, 0.75), (3, 34, 0.02, 0.05, 0.92), (1.0, 50, 0.01, 0.024, 0.95)):
        acc = np.zeros_like(c.img)
        mask = np.zeros((c.h, c.w), np.float32)
        for _ in range(count):
            cx, cy = r.uniform(0, 1), r.uniform(0, 1)
            a, b = r.uniform(smin, smax), r.uniform(smin, smax) * 0.6
            ang = r.uniform(0, math.pi)
            dx = (c.x - cx) * c.aspect
            dy = c.y - cy
            u = dx * math.cos(ang) + dy * math.sin(ang)
            v = -dx * math.sin(ang) + dy * math.cos(ang)
            e = (u / a) ** 2 + (v / b) ** 2
            m = np.clip(1.2 - e, 0, 1) ** 0.6
            col = hx(pal[r.integers(len(pal))])
            shade = 0.85 + 0.15 * np.clip(-u / a, -1, 1)
            acc += m[..., None] * col * shade[..., None]
            mask += m
        mask = gaussian_filter(np.clip(mask, 0, 1), layer_blur)
        acc = gaussian_filter(acc, sigma=(layer_blur, layer_blur, 0))
        safe = np.maximum(gaussian_filter(np.clip(mask, 1e-3, None), 0.1), 1e-3)
        col = acc / safe[..., None]
        m = (mask * alpha)[..., None]
        c.img = c.img * (1 - m) + np.clip(col, 0, 1) * m
    return c.finish(vignette=0.18, lift=0.01, grain=0.008)


def studio(size, seed, tone="#3a3532"):
    c = Canvas(size, seed)
    c.vgradient([(0, "#1d1a19"), (1, "#141211")])
    c.glow(0.5, 0.42, 0.6, tone, 1.2, 1.6)
    n = c.noise(3, 3, 3)
    c.img *= (1 + n * 0.12)[..., None]
    c.glow(0.5, 0.42, 0.25, "#6b5f57", 0.35, 1.5)
    return c.finish(vignette=0.5, lift=0.03, grain=0.014)


def city_night(size, seed):
    c = Canvas(size, seed)
    c.vgradient([(0, "#0e1730"), (0.45, "#1d3557"), (0.75, "#4a4f6a"), (1, "#c27c4e")])
    pal = ["#ffb05e", "#ffd9a3", "#ff6b4a", "#ffffff", "#7fe0c8"]
    c.bokeh(110, pal, 0.006, 0.03, (0, 1, 0.45, 1.0), (0.3, 1.0), rim=0.4, weights=[0.35, 0.3, 0.12, 0.15, 0.08])
    c.bokeh(14, pal, 0.05, 0.12, (-0.1, 1.1, 0.4, 1.1), (0.08, 0.2), blur=6, weights=[0.35, 0.3, 0.12, 0.15, 0.08])
    c.blur(1.6)
    return c.finish(vignette=0.45, lift=0.02)


def dunes(size, seed):
    c = Canvas(size, seed)
    r = c.rng
    hz = r.uniform(0.42, 0.55)
    c.vgradient([(0, "#6f87a8"), (hz * 0.7, "#d8b49a"), (hz, "#f3c99a"), (1, "#f3c99a")])
    sx = r.uniform(0.25, 0.75)
    c.glow(sx, hz - 0.02, 0.5, "#ffc98a", 0.5, 1.5)
    c.glow(sx, hz - 0.02, 0.05, "#fff3d8", 1.6)
    layers = [("#c9967a", 0.02), ("#b07d63", 0.06), ("#8f5f4a", 0.12), ("#6a4336", 0.22), ("#432a23", 0.36)]
    for i, (col, depth) in enumerate(layers):
        base = hz + depth
        ys = base + sum(r.uniform(0.005, 0.03) * np.sin(c.x[0] * r.uniform(2, 9) * 6.28 + r.uniform(0, 6.28)) for _ in range(3))
        m = (c.y > ys[None, :]).astype(np.float32)
        m = gaussian_filter(m, 1.5 + (len(layers) - i) * 0.6)
        shade = np.clip((c.y - ys[None, :]) * 4, 0, 1)
        colv = hx(col) * (1.12 - shade[..., None] * 0.35)
        c.img = c.img * (1 - m[..., None]) + colv * m[..., None]
        # rim light on dune crest
        c.img += hx("#ffd2a0") * (np.exp(-((c.y - ys[None, :]) / 0.004) ** 2) * 0.25 * (1 - i / len(layers)))[..., None]
    c.blur(0.8)
    return c.finish(vignette=0.35, lift=0.02, warm=0.02)


def jerusalem_stone(size, seed):
    c = Canvas(size, seed)
    r = c.rng
    rows = r.integers(6, 9)
    bh = 1 / rows
    img = np.zeros((c.h, c.w), np.float32)
    tint = np.zeros_like(c.img)
    for i in range(rows):
        y0 = i * bh
        offset = r.uniform(0, 0.2)
        x = -offset
        while x < 1.05:
            bw = r.uniform(0.18, 0.34)
            m = ((c.x >= x + 0.004) & (c.x < x + bw - 0.004) & (c.y >= y0 + 0.006) & (c.y < y0 + bh - 0.006)).astype(np.float32)
            v = r.uniform(0.85, 1.08)
            img += m * v
            tint += m[..., None] * hx(["#e9d3ac", "#e2c79c", "#f0dcb8", "#d8bb8e"][r.integers(4)])
            x += bw
    tex = c.noise(18, 12, 3) * 0.10 + c.noise(90, 60, 1) * 0.07 + c.noise(4, 3, 2) * 0.06
    base = np.where(img[..., None] > 0, tint, hx("#9c8466"))
    c.img = base * (1 + tex[..., None])
    light = np.clip(1.25 - (c.x * 0.7 + c.y * 0.9), 0.18, 1.25)
    c.img *= light[..., None]
    c.glow(0.08, 0.0, 0.75, "#ffd59a", 0.5, 1.3)
    shade = gaussian_filter(((c.x * 0.8 - c.y * 0.6 + r.uniform(-0.2, 0.2)) > 0.15).astype(np.float32), 30)
    c.img *= (1 - shade * 0.45)[..., None]
    # shallow depth of field towards the bottom
    blurred = gaussian_filter(c.img, sigma=(10, 10, 0))
    t = np.clip((c.y - 0.45) * 1.8, 0, 1)[..., None]
    c.img = c.img * (1 - t) + blurred * t
    return c.finish(vignette=0.35, lift=0.02, warm=0.015)


def sea_day(size, seed):
    c = Canvas(size, seed)
    r = c.rng
    hz = r.uniform(0.38, 0.5)
    c.vgradient([(0, "#7fa9c9"), (hz, "#dfe9ee"), (hz + 0.0005, "#4f9db0"), (hz + 0.2, "#2f7f96"), (1, "#c7b79a")])
    c.streaks(r.uniform(0.3, 0.7), 0.25, hz, 0.75, "#ffffff", 0.35, 0.8)
    foam = np.clip(c.noise(3, 40, 2), 0, 1) * np.exp(-((c.y - 0.8) / 0.04) ** 2)
    c.img += hx("#ffffff") * (foam * 0.6)[..., None]
    c.blur(1.4)
    return c.finish(vignette=0.25, lift=0.025)


# ─────────────────────────────────── recipe ──────────────────────────────────

def plan():
    jobs = []

    def add(path, fn, size, seed, **kw):
        jobs.append((path, fn, size, seed, kw))

    # Hero slideshow (cinematic)
    add("hero/01-golden-hour.jpg", golden_sea, W, 11)
    add("hero/02-reception.jpg", reception_bokeh, W, 12)
    add("hero/03-silk.jpg", silk, W, 13)
    add("hero/04-dance-floor.jpg", party_bokeh, W, 14)
    add("hero/05-sparklers.jpg", sparklers, W, 15)

    pf = "portfolio"
    # Weddings
    add(f"{pf}/weddings/01.jpg", golden_sea, L, 101)
    add(f"{pf}/weddings/02.jpg", silk, P, 102)
    add(f"{pf}/weddings/03.jpg", reception_bokeh, L, 103)
    add(f"{pf}/weddings/04.jpg", petals, T, 104)
    add(f"{pf}/weddings/05.jpg", candlelight, L, 105)
    add(f"{pf}/weddings/06.jpg", garden, P, 106)
    add(f"{pf}/weddings/07.jpg", sparklers, L, 107)
    add(f"{pf}/weddings/08.jpg", silk, T, 108, light="#f7ece8", mid="#e8cfc8", dark="#b08a83")
    add(f"{pf}/weddings/09.jpg", golden_sea, P, 109, mood="rose")
    add(f"{pf}/weddings/10.jpg", window_mono, L, 110)
    # Bar / Bat Mitzvah
    add(f"{pf}/bar-bat-mitzvah/01.jpg", jerusalem_stone, L, 201)
    add(f"{pf}/bar-bat-mitzvah/02.jpg", party_bokeh, P, 202)
    add(f"{pf}/bar-bat-mitzvah/03.jpg", reception_bokeh, T, 203, palette=["#ffd38a", "#fff2cf", "#ffbe6b"])
    add(f"{pf}/bar-bat-mitzvah/04.jpg", jerusalem_stone, P, 204)
    add(f"{pf}/bar-bat-mitzvah/05.jpg", party_bokeh, L, 205)
    add(f"{pf}/bar-bat-mitzvah/06.jpg", petals, L, 206)
    # Events
    add(f"{pf}/events/01.jpg", party_bokeh, L, 301)
    add(f"{pf}/events/02.jpg", candlelight, P, 302)
    add(f"{pf}/events/03.jpg", city_night, L, 303)
    add(f"{pf}/events/04.jpg", reception_bokeh, T, 304)
    add(f"{pf}/events/05.jpg", sparklers, P, 305)
    add(f"{pf}/events/06.jpg", garden, L, 306)
    # Portraits & family
    add(f"{pf}/portraits/01.jpg", studio, T, 401)
    add(f"{pf}/portraits/02.jpg", window_mono, P, 402)
    add(f"{pf}/portraits/03.jpg", garden, L, 403)
    add(f"{pf}/portraits/04.jpg", studio, P, 404, tone="#5a4a40")
    add(f"{pf}/portraits/05.jpg", sea_day, L, 405)
    # Couples / pre-wedding
    add(f"{pf}/couples/01.jpg", dunes, L, 501)
    add(f"{pf}/couples/02.jpg", golden_sea, T, 502, mood="blue")
    add(f"{pf}/couples/03.jpg", city_night, P, 503)
    add(f"{pf}/couples/04.jpg", sea_day, P, 504)
    add(f"{pf}/couples/05.jpg", dunes, L, 505)
    add(f"{pf}/couples/06.jpg", jerusalem_stone, T, 506)
    # Corporate & brands
    add(f"{pf}/corporate/01.jpg", city_night, L, 601)
    add(f"{pf}/corporate/02.jpg", window_mono, T, 602)
    add(f"{pf}/corporate/03.jpg", studio, L, 603, tone="#44403c")
    add(f"{pf}/corporate/04.jpg", candlelight, L, 604)

    # Stories
    st = "stories"
    for slug, recipes in {
        "noa-and-daniel": [golden_sea, silk, petals, reception_bokeh, candlelight, sparklers, golden_sea, garden],
        "maya-bat-mitzvah": [jerusalem_stone, party_bokeh, petals, reception_bokeh, party_bokeh, studio],
        "shira-and-amit": [dunes, sea_day, city_night, dunes, window_mono, golden_sea],
    }.items():
        sizes = [L, P, T, L, P, L, T, L]
        for i, fn in enumerate(recipes):
            add(f"{st}/{slug}/{i + 1:02d}.jpg", fn, sizes[i % len(sizes)], 700 + i * 13 + len(slug) * 7)

    # About
    add("about/moshik.jpg", studio, T, 901, tone="#4b413a")
    add("about/behind-the-scenes-01.jpg", reception_bokeh, L, 902)
    add("about/behind-the-scenes-02.jpg", window_mono, P, 903)
    return jobs


def main():
    import sys
    only = sys.argv[1:]
    jobs = [j for j in plan() if not only or any(o in j[1].__name__ or o in j[0] for o in only)]
    for i, (path, fn, size, seed, kw) in enumerate(jobs, 1):
        dest = OUT / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        img = fn(size, seed, **kw)
        img.save(dest, "JPEG", quality=84, optimize=True, progressive=True, subsampling="4:2:0")
        print(f"[{i:02d}/{len(jobs)}] {path}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
