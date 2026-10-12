#!/usr/bin/env python3
"""
Romance theme — botanical line-art ornaments (olive and eucalyptus sprigs).

Writes stroke-only SVGs to public/themes/romance/. The theme uses them as CSS
masks (mask-image), so the stroke colour here is irrelevant: each ornament is
tinted with background-color in romance.css. Deterministic (fixed seeds), so
re-running it reproduces the committed files.

    python3 scripts/themes/romance/botanicals.py
"""
from __future__ import annotations

import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / 'public' / 'themes' / 'romance'
Point = tuple[float, float]


def bez(p0, p1, p2, p3, t) -> Point:
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
    )


def bez_angle(p0, p1, p2, p3, t) -> float:
    u = 1 - t
    dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
    dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    return math.atan2(dy, dx)


def off(p: Point, angle: float, dist: float) -> Point:
    return (p[0] + math.cos(angle) * dist, p[1] + math.sin(angle) * dist)


class Drawing:
    """Collects path data and the points it touches (for an automatic viewBox)."""

    def __init__(self) -> None:
        self.d: list[str] = []
        self.pts: list[Point] = []

    @staticmethod
    def _n(v: float) -> str:
        s = f'{v:.1f}'
        return s[:-2] if s.endswith('.0') else s

    def _p(self, p: Point) -> str:
        return f'{self._n(p[0])},{self._n(p[1])}'

    def cubic(self, p0, p1, p2, p3, move=True) -> None:
        self.d.append(f'{"M" + self._p(p0) if move else ""}C{self._p(p1)} {self._p(p2)} {self._p(p3)}')
        self.pts += [bez(p0, p1, p2, p3, i / 12) for i in range(13)]

    def quad(self, p0, c, p1) -> None:
        self.d.append(f'M{self._p(p0)}Q{self._p(c)} {self._p(p1)}')
        self.pts += [p0, p1, ((p0[0] + 2 * c[0] + p1[0]) / 4, (p0[1] + 2 * c[1] + p1[1]) / 4)]

    def svg(self, stroke: float, pad: float = 6) -> str:
        xs = [p[0] for p in self.pts]
        ys = [p[1] for p in self.pts]
        x0, y0 = math.floor(min(xs) - pad), math.floor(min(ys) - pad)
        w, h = math.ceil(max(xs) + pad) - x0, math.ceil(max(ys) + pad) - y0
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {w} {h}" width="{w}" height="{h}" '
            f'fill="none" stroke="#000" stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="{"".join(self.d)}"/></svg>\n'
        )


def leaf(dr: Drawing, base: Point, angle: float, length: float, width: float, rng: random.Random,
         *, bend: float = 0.0, widest: float = 0.42, blunt: float = 0.0, vein: float = 0.78, petiole: float = 0.0) -> None:
    """
    A single leaf outline with a midrib. `bend` curves the leaf sideways (radians),
    `widest` is where the blade is broadest (0–1 of its length), `blunt` rounds the tip.
    """
    if petiole:
        joint = off(base, angle, petiole)
        dr.quad(base, off(off(base, angle, petiole * 0.5), angle + math.pi / 2, petiole * 0.12), joint)
        base = joint
    n = angle + math.pi / 2
    tip = off(base, angle + bend, length)
    mid = off(base, angle + bend * 0.5, length * 0.5)
    wa = width * rng.uniform(0.92, 1.08)
    wb = width * rng.uniform(0.85, 1.0)
    # side A
    a1 = off(off(base, angle, length * widest * 0.55), n, wa * 1.05)
    a2 = off(off(base, angle + bend * 0.6, length * (0.78 + blunt * 0.2)), n, wa * (0.55 + blunt * 0.5))
    # side B (slightly narrower, for asymmetry)
    b1 = off(off(base, angle, length * widest * 0.6), n, -wb * 1.05)
    b2 = off(off(base, angle + bend * 0.6, length * (0.8 + blunt * 0.2)), n, -wb * (0.5 + blunt * 0.5))
    dr.cubic(base, a1, a2, tip)
    dr.cubic(tip, b2, b1, base, move=False)
    if vein:
        v1 = off(base, angle + bend * 0.7, length * vein)
        dr.quad(off(base, angle, length * 0.04), mid if bend else off(mid, n, (wa - wb) * 0.2), v1)


def olive(dr: Drawing, base: Point, angle: float, size: float) -> None:
    """A small olive on a curved stalk, with a highlight stroke."""
    stalk = off(base, angle + 0.25, size * 1.2)
    dr.quad(base, off(base, angle + 0.6, size * 0.7), stalk)
    n = angle + math.pi / 2
    tip = off(stalk, angle, size * 2.1)
    rx = size * 0.78
    c1 = off(off(stalk, angle, size * 0.1), n, rx * 1.25)
    c2 = off(off(stalk, angle, size * 2.05), n, rx * 1.15)
    c3 = off(off(stalk, angle, size * 2.05), n, -rx * 1.15)
    c4 = off(off(stalk, angle, size * 0.1), n, -rx * 1.25)
    dr.cubic(stalk, c1, c2, tip)
    dr.cubic(tip, c3, c4, stalk, move=False)
    h0 = off(off(stalk, angle, size * 0.75), n, rx * 0.42)
    h1 = off(off(stalk, angle, size * 1.45), n, rx * 0.38)
    dr.quad(h0, off(off(stalk, angle, size * 1.1), n, rx * 0.55), h1)


def olive_branch(seed=7) -> Drawing:
    rng = random.Random(seed)
    dr = Drawing()
    s = ((96, 520), (36, 380), (252, 262), (182, 30))
    dr.cubic(*s)
    count = 16
    for i in range(count):
        t = 0.08 + 0.88 * i / (count - 1)
        base = bez(*s, t)
        tan = bez_angle(*s, t)
        side = 1 if i % 2 == 0 else -1
        length = (86 - 40 * t) * rng.uniform(0.86, 1.1)
        leaf(dr, base, tan + side * math.radians(rng.uniform(26, 40)), length, length * rng.uniform(0.13, 0.16), rng,
             bend=side * math.radians(rng.uniform(5, 13)), petiole=3)
    leaf(dr, s[3], bez_angle(*s, 1) - math.radians(3), 44, 6, rng, bend=math.radians(6))

    # two side twigs
    for tb, turn, lens in ((0.34, -50, (54, 46, 40)), (0.6, 46, (44, 38))):
        tbase = bez(*s, tb)
        a = bez_angle(*s, tb) + math.radians(turn)
        q1 = off(tbase, a, 36)
        q2 = off(q1, a + math.radians(-14 if turn < 0 else 12), 34)
        q3 = off(q2, a + math.radians(-6 if turn < 0 else 4), 30)
        tw = (tbase, q1, q2, q3)
        dr.cubic(*tw)
        for k, L in enumerate(lens):
            t = 0.32 + 0.6 * k / max(1, len(lens) - 1)
            side = 1 if k % 2 == 0 else -1
            leaf(dr, bez(*tw, t), bez_angle(*tw, t) + side * math.radians(34), L, L * 0.15, rng,
                 bend=side * math.radians(9), petiole=2.5)
        leaf(dr, q3, bez_angle(*tw, 1), 36, 5.4, rng, bend=math.radians(-7 if turn < 0 else 7))

    # olives, in a small cluster and a single one
    for t, ang, size in ((0.49, 2.25, 12), (0.53, 2.8, 10.5), (0.76, -0.5, 10)):
        olive(dr, bez(*s, t), ang, size)
    return dr


def eucalyptus_sprig(seed=11) -> Drawing:
    rng = random.Random(seed)
    dr = Drawing()
    s = ((122, 470), (152, 336), (70, 196), (134, 24))
    dr.cubic(*s)
    count = 12
    for i in range(count):
        t = 0.07 + 0.86 * i / (count - 1)
        base = bez(*s, t)
        tan = bez_angle(*s, t)
        side = 1 if i % 2 == 0 else -1
        length = (64 - 36 * t) * rng.uniform(0.9, 1.06)
        leaf(dr, base, tan + side * math.radians(rng.uniform(58, 74)), length, length * rng.uniform(0.4, 0.46), rng,
             bend=side * math.radians(rng.uniform(4, 10)), widest=0.5, blunt=0.55, vein=0.7, petiole=length * 0.14)
    leaf(dr, s[3], bez_angle(*s, 1), 20, 8, rng, widest=0.5, blunt=0.5, vein=0.6, petiole=3)
    return dr


def tiny_sprig(seed=3) -> Drawing:
    rng = random.Random(seed)
    dr = Drawing()
    s = ((6, 24), (40, 31), (80, 14), (118, 17))
    dr.cubic(*s)
    for i in range(7):
        t = 0.12 + 0.72 * i / 6
        side = 1 if i % 2 == 0 else -1
        L = 19 - i * 1.3
        leaf(dr, bez(*s, t), bez_angle(*s, t) + side * math.radians(36), L, L * 0.2, rng,
             bend=side * math.radians(8), vein=0)
    leaf(dr, s[3], bez_angle(*s, 1), 12, 2.6, rng, vein=0)
    return dr


def write(name: str, dr: Drawing, stroke: float) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    svg = dr.svg(stroke)
    (OUT / name).write_text(svg)
    print(f'{name}: {len(svg)} bytes')


if __name__ == '__main__':
    write('olive.svg', olive_branch(), stroke=1.3)
    write('eucalyptus.svg', eucalyptus_sprig(), stroke=1.25)
    write('sprig.svg', tiny_sprig(), stroke=2)  # used small (eyebrows, dividers): a heavier line
