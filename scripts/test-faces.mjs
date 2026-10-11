#!/usr/bin/env node
/**
 * Dev harness for src/scripts/faces (not run in CI).
 *
 * Bundles the module with Vite, serves it together with the models, the
 * face-api demo photos and a mock admin API, then drives headless Chromium
 * (playwright-core) through detection, matching, clustering, selfie, crop,
 * memory and analyzeGallery checks on the sample photos and synthetic
 * variants of them (flips, crops, light changes, rotations, down-scales…).
 *
 * Usage:
 *   node scripts/test-faces.mjs [--quick] [--only=a,b] [--backend=webgl|wasm|cpu] [--no-webgl]
 *   node scripts/test-faces.mjs --compare   (descriptor agreement between saved backend reports)
 * Tests: load timing detect reference composite sizes variants cluster selfie memory crops analyze
 * Env:
 *   CHROMIUM=/path/to/chrome   (default /opt/pw-browsers/chromium)
 *   FACES_TMP=/tmp/faces       work dir: bundle, report-<backend>.json, out/ (crops, debug images)
 *   FACES_WASM=/dir            serve TF.js WASM binaries from this dir at /wasm/ (optional)
 * Headless Chromium usually renders WebGL in software (SwiftShader): timings
 * are far slower than on a real GPU.
 */
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const FACEAPI = path.dirname(require.resolve('@vladmandic/face-api/package.json'));
const TMP = process.env.FACES_TMP || path.join(os.tmpdir(), 'faces');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const ONLY = opt('only')?.split(',');
const QUICK = flag('quick');

const toPosix = (p) => p.split(path.sep).join('/');
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------------------
// 1. Bundle the module (same resolver as the Astro build).

async function bundle() {
  const site = path.join(TMP, 'site');
  const dist = path.join(TMP, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(site, { recursive: true });
  const src = (f) => toPosix(path.join(ROOT, 'src/scripts/faces', f));
  await writeFile(
    path.join(site, 'entry.js'),
    `import * as faces from '${src('index.ts')}';
import { tuning } from '${src('detect.ts')}';
import { settings, tfRuntime } from '${src('runtime.ts')}';
window.faces = faces;
window.faceInternals = { tuning, settings, tfRuntime, engine: () => import('@vladmandic/face-api/dist/face-api.esm.js') };
window.harnessReady = true;
`,
  );
  await writeFile(
    path.join(site, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>faces harness</title></head><body><script type="module" src="./entry.js"></script></body></html>`,
  );
  const { build } = await import(require.resolve('vite'));
  const t0 = Date.now();
  const out = await build({
    root: site,
    configFile: false,
    logLevel: 'warn',
    // entry.js lives outside the repo: resolve the engine to the same file the module uses.
    resolve: { alias: { '@vladmandic/face-api': FACEAPI } },
    build: { outDir: dist, emptyOutDir: true, minify: true, reportCompressedSize: false, chunkSizeWarningLimit: 4096 },
  });
  const chunks = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output ?? []).filter((c) => c.type === 'chunk');
  log(`bundle: ${chunks.length} chunks in ${Date.now() - t0} ms`);
  for (const c of chunks) log(`  ${c.fileName.padEnd(40)} ${(c.code.length / 1024).toFixed(0).padStart(6)} KB${c.isEntry ? '  (entry)' : c.isDynamicEntry ? '  (lazy)' : ''}`);
  return dist;
}

// ---------------------------------------------------------------------------
// 2. Static server + mock admin API.

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.css': 'text/css' };

function serveFile(res, file) {
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
}

function startServer(dist) {
  const photos = new Map(); // `${gid}/${pid}` -> Buffer
  const calls = [];
  const modelsDir = existsSync(path.join(ROOT, 'public/models/face-api')) ? path.join(ROOT, 'public/models/face-api') : path.join(FACEAPI, 'model');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    const body = await new Promise((resolve) => {
      const parts = [];
      req.on('data', (c) => parts.push(c));
      req.on('end', () => resolve(Buffer.concat(parts)));
    });
    const json = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    let m;
    if ((m = p.match(/^\/__mock\/photo\/([^/]+)\/([^/]+)$/)) && req.method === 'POST') {
      photos.set(`${m[1]}/${m[2]}`, body);
      return json(200, { ok: true });
    }
    if (p === '/__mock/calls') return json(200, calls);
    if (p === '/__mock/reset') {
      calls.length = 0;
      return json(200, { ok: true });
    }
    if ((m = p.match(/^\/media\/([^/]+)\/([^/]+)\/web$/))) {
      if (m[1].startsWith('AuthFail')) return json(401, { ok: false, error: 'unauthorized', code: 'unauthorized' });
      const buf = photos.get(`${m[1]}/${m[2]}`);
      if (!buf) return json(404, { ok: false, error: 'not found' });
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return res.end(buf);
    }
    if (p.startsWith('/api/admin/')) {
      const rec = {
        method: req.method,
        path: p,
        type: req.headers['content-type'] || '',
        xrw: req.headers['x-requested-with'] || '',
        size: body.length,
      };
      if (rec.type.includes('json')) rec.json = JSON.parse(body.toString('utf8') || 'null');
      if (rec.type.includes('octet-stream')) rec.bytes = [...body.subarray(0, 8)];
      calls.push(rec);
      if (rec.xrw !== 'moshik-admin') return json(403, { ok: false, error: 'missing header', code: 'csrf' });
      return json(200, { ok: true });
    }
    if (p.startsWith('/models/face-api/')) {
      const f = path.join(modelsDir, path.basename(p));
      return existsSync(f) ? serveFile(res, f) : json(404, { ok: false });
    }
    if (p.startsWith('/samples/')) {
      const f = path.join(FACEAPI, 'demo', path.basename(p));
      return existsSync(f) ? serveFile(res, f) : json(404, { ok: false });
    }
    if (p.startsWith('/wasm/') && process.env.FACES_WASM) {
      const f = path.join(process.env.FACES_WASM, path.basename(p));
      return existsSync(f) ? serveFile(res, f) : json(404, { ok: false });
    }
    const f = path.join(dist, p === '/' ? 'index.html' : p);
    if (f.startsWith(dist) && existsSync(f) && (await stat(f)).isFile()) return serveFile(res, f);
    json(404, { ok: false });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

// ---------------------------------------------------------------------------
// 3. In-page test library (serialised into the page).

/* eslint-disable no-undef */
function pageLib() {
  const F = window.faces;
  const dist = (a, b) => F.faceDistance(a, b);
  const now = () => performance.now();
  const loadImg = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  const canvasOf = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.round(w);
    c.height = Math.round(h);
    return c;
  };
  const toBlob = (c, type = 'image/jpeg', q = 0.9) => new Promise((r) => c.toBlob(r, type, q));
  const blobToImg = async (blob) => {
    const url = URL.createObjectURL(blob);
    try {
      return await loadImg(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const iou = (a, b) => {
    const x1 = Math.max(a[0], b[0]);
    const y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
    const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return i / (a[2] * a[3] + b[2] * b[3] - i || 1);
  };
  const pct = (arr, p) => {
    if (!arr.length) return NaN;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
  };
  const stats = (arr) => ({
    n: arr.length,
    min: +pct(arr, 0).toFixed(3),
    p5: +pct(arr, 5).toFixed(3),
    p50: +pct(arr, 50).toFixed(3),
    p95: +pct(arr, 95).toFixed(3),
    max: +pct(arr, 100).toFixed(3),
  });
  /**
   * Variant generator. Each variant has a forward transform mapping original
   * pixel coords to variant pixel coords (to label faces by identity).
   */
  function makeVariant(img, kind) {
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    let c;
    let ctx;
    let fwd = (x, y) => [x, y];
    switch (kind) {
      case 'flip':
        c = canvasOf(W, H);
        ctx = c.getContext('2d');
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        fwd = (x, y) => [W - x, y];
        break;
      case 'crop': {
        const cx = W * 0.12;
        const cy = H * 0.08;
        const cw = W * 0.76;
        const ch = H * 0.84;
        c = canvasOf(cw, ch);
        c.getContext('2d').drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
        fwd = (x, y) => [x - cx, y - cy];
        break;
      }
      case 'bright':
      case 'dark':
      case 'blur':
      case 'gray':
        c = canvasOf(W, H);
        ctx = c.getContext('2d');
        ctx.filter = { bright: 'brightness(1.35) contrast(0.8)', dark: 'brightness(0.65) contrast(1.25)', blur: 'blur(2px)', gray: 'grayscale(1) contrast(1.1)' }[kind];
        ctx.drawImage(img, 0, 0);
        break;
      case 'half':
      case 'third':
      case 'small': {
        const k = { half: 0.5, third: 0.33, small: 0.22 }[kind];
        c = canvasOf(W * k, H * k);
        ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        fwd = (x, y) => [x * (c.width / W), y * (c.height / H)];
        break;
      }
      case 'rot12':
      case 'rotm20': {
        const a = ((kind === 'rot12' ? 12 : -20) * Math.PI) / 180;
        c = canvasOf(W, H);
        ctx = c.getContext('2d');
        ctx.fillStyle = '#777';
        ctx.fillRect(0, 0, W, H);
        ctx.translate(W / 2, H / 2);
        ctx.rotate(a);
        ctx.drawImage(img, -W / 2, -H / 2);
        fwd = (x, y) => {
          const dx = x - W / 2;
          const dy = y - H / 2;
          return [W / 2 + dx * Math.cos(a) - dy * Math.sin(a), H / 2 + dx * Math.sin(a) + dy * Math.cos(a)];
        };
        break;
      }
      default:
        c = canvasOf(W, H);
        c.getContext('2d').drawImage(img, 0, 0);
    }
    return { canvas: c, fwd };
  }
  return { F, dist, now, loadImg, canvasOf, toBlob, blobToImg, iou, pct, stats, makeVariant };
}

// ---------------------------------------------------------------------------
// 4. Tests (each runs inside the page).

const TESTS = {
  /** Model loading: progress events, backend, timing. */
  async load() {
    const { F, now } = window.lib;
    const events = [];
    const t0 = now();
    await F.loadFaceModels((e) => events.push(e));
    const ms = now() - t0;
    const info = await F.getFaceRuntimeInfo();
    const bytes = events.filter((e) => e.message !== 'engine' && e.message !== 'ready').map((e) => e.total);
    return {
      ms: Math.round(ms),
      backend: info.backend,
      events: events.length,
      stages: [...new Set(events.map((e) => e.message))],
      totalBytes: Math.max(0, ...bytes),
      last: events.at(-1),
      again: await (async () => {
        const t = now();
        await F.loadFaceModels();
        return Math.round(now() - t);
      })(),
    };
  },

  /** Per-stage timing after warm-up (normal and thorough). */
  async timing() {
    const { F, now, loadImg } = window.lib;
    const T = window.faceInternals.tuning;
    const img = await createImageBitmap(await loadImg('/samples/sample1.jpg'));
    const t0 = now();
    await F.detectFaces(img); // warm-up: compiles GPU programs
    const warm = now() - t0;
    const run = async (thorough) => {
      T.timings = {};
      const t = now();
      const faces = await F.detectFaces(img, { thorough });
      const total = now() - t;
      const stages = Object.fromEntries(Object.entries(T.timings).map(([k, v]) => [k, Math.round(v)]));
      T.timings = null;
      return { faces: faces.length, total: Math.round(total), ...stages };
    };
    return { backend: (await F.getFaceRuntimeInfo()).backend, warmupMs: Math.round(warm), normal: await run(false), thorough: await run(true) };
  },

  /** Detection counts and timing per sample, normal vs thorough (+ warm-up cost). */
  async detect({ samples }) {
    const { F, now, loadImg } = window.lib;
    const out = [];
    for (const name of samples) {
      const img = await loadImg(`/samples/${name}`);
      const bmp = await createImageBitmap(img);
      const t0 = now();
      const normal = await F.detectFaces(bmp);
      const t1 = now();
      const thorough = await F.detectFaces(bmp, { thorough: true });
      const t2 = now();
      out.push({
        name,
        size: `${bmp.width}x${bmp.height}`,
        normal: normal.length,
        thorough: thorough.length,
        msNormal: Math.round(t1 - t0),
        msThorough: Math.round(t2 - t1),
        scores: thorough.map((f) => f.score.toFixed(2)).join(' '),
        sizes: thorough.map((f) => Math.round(Math.min(f.box[2] * bmp.width, f.box[3] * bmp.height))).join(' '),
        quality: thorough.map((f) => f.quality.toFixed(2)).join(' '),
        // kept in the report file (not printed): cross-backend comparison
        descriptors: thorough.map((f) => ({ box: f.box, d: Array.from(f.descriptor, (v) => +v.toFixed(5)) })),
      });
      bmp.close();
    }
    return out;
  },

  /** Our pipeline vs the engine's own high-level API on the same photos (descriptor agreement). */
  async reference({ samples }) {
    const { F, loadImg, iou, dist, stats } = window.lib;
    const api = await window.faceInternals.engine();
    const T = window.faceInternals.tuning;
    const flat = [];
    const rot = [];
    const ious = [];
    let refCount = 0;
    let mine = 0;
    let unmatched = 0;
    for (const name of samples) {
      const img = await loadImg(`/samples/${name}`);
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const ref = await api.detectAllFaces(img, new api.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptors();
      T.rotateChips = false;
      const a = await F.detectFaces(img);
      T.rotateChips = true;
      const b = await F.detectFaces(img);
      refCount += ref.length;
      mine += a.length;
      for (const r of ref) {
        const d = r.detection.box;
        const rb = [d.x / W, d.y / H, d.width / W, d.height / H];
        let best = -1;
        let bestIou = 0;
        a.forEach((m, i) => {
          const v = iou(rb, m.box);
          if (v > bestIou) [bestIou, best] = [v, i];
        });
        if (best < 0 || bestIou < 0.5) {
          unmatched++;
          continue;
        }
        ious.push(bestIou);
        flat.push(dist(r.descriptor, a[best].descriptor));
        rot.push(dist(r.descriptor, b[best].descriptor));
      }
    }
    return { referenceFaces: refCount, ourFaces: mine, unmatched, boxIoU: stats(ious), distNoRotation: stats(flat), distWithRotation: stats(rot) };
  },

  /** Small faces: collages of the samples (faces ≈ 50 px / ≈ 35 px), normal vs thorough, 3×2 vs 2×2 tiles. */
  async composite() {
    const { F, loadImg, canvasOf, now } = window.lib;
    const T = window.faceInternals.tuning;
    const imgs = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => loadImg(`/samples/sample${i}.jpg`)));
    const perSample = [];
    for (const img of imgs) perSample.push((await F.detectFaces(img, { thorough: true })).length);
    const collage = (cols, rows) => {
      const W = 2048;
      const H = 1365;
      const c = canvasOf(W, H);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, W, H);
      const cw = W / cols;
      const ch = H / rows;
      let expected = 0;
      for (let k = 0; k < cols * rows; k++) {
        const img = imgs[k % 6];
        expected += perSample[k % 6];
        const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
        const w = img.naturalWidth * s;
        const h = img.naturalHeight * s;
        const x = (k % cols) * cw + (cw - w) / 2;
        const y = Math.floor(k / cols) * ch + (ch - h) / 2;
        ctx.save();
        if (k >= 6) {
          ctx.translate(x + w, y);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, w, h);
        } else ctx.drawImage(img, x, y, w, h);
        ctx.restore();
      }
      return { c, expected, faceScale: Math.min(cw / 1920, ch / 1280) };
    };
    const out = {};
    for (const [label, cols, rows] of [['4x3 (faces ~50px)', 4, 3], ['6x4 (faces ~35px)', 6, 4]]) {
      const { c, expected, faceScale } = collage(cols, rows);
      const res = { expected, faceScale: +faceScale.toFixed(3) };
      let t = now();
      res.normal = (await F.detectFaces(c)).length;
      res.msNormal = Math.round(now() - t);
      for (const target of [900, 1200]) {
        T.tileTarget = target;
        t = now();
        const faces = await F.detectFaces(c, { thorough: true });
        res[`thorough_tile${target}`] = faces.length;
        res[`ms_tile${target}`] = Math.round(now() - t);
        if (target === 900) {
          res.minFacePx = Math.round(Math.min(...faces.map((f) => Math.min(f.box[2] * c.width, f.box[3] * c.height))));
          res.minScore = +Math.min(...faces.map((f) => f.score)).toFixed(2);
          // Debug image with the boxes (saved by the harness).
          const dbg = canvasOf(c.width, c.height);
          const g = dbg.getContext('2d');
          g.drawImage(c, 0, 0);
          g.lineWidth = 3;
          for (const f of faces) {
            g.strokeStyle = f.score > 0.8 ? '#0f0' : '#f00';
            g.strokeRect(f.box[0] * c.width, f.box[1] * c.height, f.box[2] * c.width, f.box[3] * c.height);
            g.fillStyle = '#ff0';
            g.font = '16px sans-serif';
            g.fillText(f.score.toFixed(2), f.box[0] * c.width, f.box[1] * c.height - 3);
          }
          res.debugImage = dbg.toDataURL('image/jpeg', 0.85);
        }
      }
      T.tileTarget = 900;
      out[label] = res;
    }
    return { perSample, ...out };
  },

  /** Descriptor stability vs face size: the same faces down-scaled to ~120 … 28 px. */
  async sizes({ samples }) {
    const { F, loadImg, canvasOf, dist, stats } = window.lib;
    const buckets = {};
    for (const name of samples) {
      const img = await loadImg(`/samples/${name}`);
      const W = img.naturalWidth;
      const ref = await F.detectFaces(img);
      if (!ref.length) continue;
      const med = ref.map((f) => Math.min(f.box[2] * W, f.box[3] * img.naturalHeight)).sort((a, b) => a - b)[ref.length >> 1];
      for (const target of [120, 80, 60, 48, 40, 34, 28]) {
        const k = target / med;
        const c = canvasOf(W * k, img.naturalHeight * k);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const faces = await F.detectFaces(c, { thorough: true, minFaceSize: 16 });
        for (const r of ref) {
          const cx = r.box[0] + r.box[2] / 2;
          const cy = r.box[1] + r.box[3] / 2;
          const m = faces.find((f) => Math.abs(f.box[0] + f.box[2] / 2 - cx) < r.box[2] / 2 && Math.abs(f.box[1] + f.box[3] / 2 - cy) < r.box[3] / 2);
          (buckets[target] ??= { found: 0, missed: 0, d: [], small: [] });
          if (!m) buckets[target].missed++;
          else {
            buckets[target].found++;
            buckets[target].d.push(dist(m.descriptor, r.descriptor));
            buckets[target].small.push({ name, ref: r, d: m.descriptor });
          }
        }
      }
      (window.store.sizeRefs ??= []).push(...ref.map((r) => ({ name, r })));
    }
    // Impostors: a small face against the full-resolution faces of everyone else.
    const all = window.store.sizeRefs;
    return Object.fromEntries(
      Object.entries(buckets).map(([k, v]) => {
        const imp = [];
        for (const s of v.small) for (const o of all) if (o.r !== s.ref) imp.push(dist(s.d, o.r.descriptor));
        return [`${k}px`, { found: v.found, missed: v.missed, samePerson: stats(v.d), otherPeople: stats(imp) }];
      }),
    );
  },

  /**
   * Labelled faces: originals + synthetic variants; identity follows the known
   * geometric transform. Same-person vs different-person distance distributions,
   * with and without roll correction of the chips.
   */
  async variants({ samples }) {
    const { F, loadImg, makeVariant, dist, stats } = window.lib;
    const T = window.faceInternals.tuning;
    const kinds = ['flip', 'crop', 'bright', 'dark', 'blur', 'gray', 'half', 'third', 'rot12', 'rotm20'];
    const labelAll = async (kindsToRun) => {
      const labeled = [];
      const recall = {};
      let falsePositives = 0;
      for (const [si, name] of samples.entries()) {
        const img = await loadImg(`/samples/${name}`);
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const orig = await F.detectFaces(img, { thorough: true });
        orig.forEach((f, j) => labeled.push({ id: `${name}:${j}`, photo: name, kind: 'orig', face: f }));
        for (const kind of kindsToRun) {
          const { canvas, fwd } = makeVariant(img, kind);
          const vw = canvas.width;
          const vh = canvas.height;
          const proj = orig.map((f) => {
            const cx = (f.box[0] + f.box[2] / 2) * W;
            const cy = (f.box[1] + f.box[3] / 2) * H;
            const half = (Math.max(f.box[2] * W, f.box[3] * H) || 1) / 2;
            const [x, y] = fwd(cx, cy);
            const [x2, y2] = fwd(cx + half, cy);
            const s = Math.hypot(x2 - x, y2 - y) * 2;
            return { x, y, s, visible: x - s / 2 >= 0 && y - s / 2 >= 0 && x + s / 2 <= vw && y + s / 2 <= vh };
          });
          const faces = await F.detectFaces(canvas, { thorough: true });
          const used = new Set();
          for (const f of faces) {
            const cx = (f.box[0] + f.box[2] / 2) * vw;
            const cy = (f.box[1] + f.box[3] / 2) * vh;
            let best = -1;
            let bd = Infinity;
            proj.forEach((p, j) => {
              const d = Math.hypot(p.x - cx, p.y - cy);
              if (d < bd) [bd, best] = [d, j];
            });
            if (best >= 0 && bd < 0.4 * proj[best].s && !used.has(best)) {
              used.add(best);
              labeled.push({ id: `${name}:${best}`, photo: `${name}#${kind}`, kind, face: f, px: Math.round(Math.min(f.box[2] * vw, f.box[3] * vh)) });
            } else falsePositives++;
          }
          const r = (recall[kind] ??= { found: 0, visible: 0 });
          r.visible += proj.filter((p) => p.visible).length;
          r.found += [...used].filter((j) => proj[j].visible).length;
        }
      }
      // The woman on the right of sample1 and in the middle of sample3 is the same person
      // (checked visually): count that pair as one identity when their originals do match.
      const [a, b] = ['sample1.jpg:2', 'sample3.jpg:1'].map((id) => labeled.find((l) => l.id === id && l.kind === 'orig'));
      const aliased = !!(a && b && dist(a.face.descriptor, b.face.descriptor) < 0.5);
      if (aliased) {
        const [from, to] = [b.id, a.id];
        for (const l of labeled) if (l.id === from) [l.id, l.originalId] = [to, from];
      }
      return { labeled, recall, falsePositives, aliased };
    };
    const summarise = (labeled) => {
      // Same person = the variant vs the original it was made from.
      const origOf = new Map(labeled.filter((l) => l.kind === 'orig').map((l) => [l.photo + (l.originalId ?? l.id), l]));
      const perKind = {};
      const same = [];
      const worst = [];
      for (const l of labeled) {
        if (l.kind === 'orig') continue;
        const o = origOf.get(l.photo.split('#')[0] + (l.originalId ?? l.id));
        const d = dist(l.face.descriptor, o.face.descriptor);
        same.push(d);
        (perKind[l.kind] ??= []).push(d);
        worst.push({ id: l.originalId ?? l.id, kind: l.kind, d: +d.toFixed(3), score: l.face.score, quality: l.face.quality, px: l.px, origQuality: o.face.quality });
      }
      worst.sort((x, y) => y.d - x.d);
      const diff = [];
      const diffOrig = [];
      const closeAll = [];
      let closest = { d: Infinity };
      for (let i = 0; i < labeled.length; i++) {
        for (let j = i + 1; j < labeled.length; j++) {
          if (labeled[i].id === labeled[j].id) continue;
          const d = dist(labeled[i].face.descriptor, labeled[j].face.descriptor);
          diff.push(d);
          if (d < 0.5) closeAll.push({ d: +d.toFixed(3), a: `${labeled[i].originalId ?? labeled[i].id}@${labeled[i].kind}`, b: `${labeled[j].originalId ?? labeled[j].id}@${labeled[j].kind}` });
          if (labeled[i].kind === 'orig' && labeled[j].kind === 'orig') {
            diffOrig.push(d);
            if (d < closest.d) closest = { d: +d.toFixed(3), a: labeled[i].id, b: labeled[j].id };
          }
        }
      }
      const rates = {};
      for (const t of [0.35, 0.4, 0.45, 0.5, 0.55, 0.6]) {
        rates[t] = { missSame: +(same.filter((d) => d >= t).length / same.length).toFixed(4), falseMatch: +(diff.filter((d) => d < t).length / diff.length).toFixed(5) };
      }
      return {
        faces: labeled.length,
        sameAll: stats(same),
        samePerKind: Object.fromEntries(Object.entries(perKind).map(([k, v]) => [k, stats(v)])),
        worstSamePerson: worst.slice(0, 6),
        closestDifferentAll: closeAll.sort((x, y) => x.d - y.d).slice(0, 8),
        differentBelow05: closeAll.length,
        diffAll: stats(diff),
        diffOriginalsOnly: stats(diffOrig),
        closestDifferentOriginals: closest,
        rates,
      };
    };
    const subset = ['rot12', 'rotm20', 'flip'];
    const configured = T.refineLandmarks;
    T.rotateChips = true;
    const withRot = await labelAll(kinds);
    window.store.labeled = withRot.labeled;
    T.refineLandmarks = !configured;
    const alternative = await labelAll(kinds);
    T.rotateChips = false;
    const noRot = await labelAll(subset);
    T.rotateChips = true;
    T.refineLandmarks = configured;
    const pick = (v) => (v ? { p50: v.p50, p95: v.p95, max: v.max } : null);
    const sub = (labeled) => {
      const s = summarise(labeled);
      return { rot12: pick(s.samePerKind.rot12), rotm20: pick(s.samePerKind.rotm20), flip: pick(s.samePerKind.flip), different: pick(s.diffOriginalsOnly) };
    };
    const brief = (labeled) => {
      const s = summarise(labeled);
      return { same: pick(s.sameAll), different: pick(s.diffAll), rates: s.rates, worst: s.worstSamePerson.slice(0, 3).map((w) => `${w.id}@${w.kind}=${w.d}`) };
    };
    return {
      refineLandmarks: configured,
      recall: withRot.recall,
      falsePositives: withRot.falsePositives,
      samePersonPairMerged: withRot.aliased,
      ...summarise(withRot.labeled),
      [`withRefineLandmarks_${!configured}`]: brief(alternative.labeled),
      rotationCorrection: {
        roll: sub(withRot.labeled.filter((l) => ['orig', ...subset].includes(l.kind))),
        [`roll_refine_${!configured}`]: sub(alternative.labeled.filter((l) => ['orig', ...subset].includes(l.kind))),
        none: sub(noRot.labeled),
      },
    };
  },

  /** Clustering of the labelled faces: purity, completeness, cannot-link, stability, scale. */
  async cluster() {
    const { F, now } = window.lib;
    const L = window.store.labeled;
    if (!L) throw new Error('run the variants test first');
    const items = L.map((l) => ({ photoId: l.photo, face: l.face }));
    const evaluate = (clusters, labels) => {
      const where = new Map();
      clusters.forEach((c, ci) => c.members.forEach((m) => where.set(m, ci)));
      let tp = 0;
      let fp = 0;
      let fn = 0;
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const same = labels[i].id === labels[j].id;
          const together = where.has(i) && where.get(i) === where.get(j);
          if (same && together) tp++;
          else if (together) fp++;
          else if (same) fn++;
        }
      }
      const frag = new Map();
      clusters.forEach((c, ci) => c.members.forEach((m) => frag.set(labels[m].id, (frag.get(labels[m].id) ?? new Set()).add(ci))));
      return {
        clusters: clusters.length,
        identities: new Set(labels.map((l) => l.id)).size,
        impure: clusters.filter((c) => new Set(c.members.map((m) => labels[m].id)).size > 1).length,
        samePhotoViolations: clusters.filter((c) => new Set(c.members.map((m) => labels[m].photo)).size !== c.members.length).length,
        precision: +(tp / (tp + fp || 1)).toFixed(4),
        recall: +(tp / (tp + fn || 1)).toFixed(4),
        maxFragmentsPerPerson: Math.max(0, ...[...frag.values()].map((s) => s.size)),
      };
    };
    const sweep = {};
    for (const t of [0.4, 0.45, 0.5, 0.55, 0.6, 0.65]) {
      const t0 = now();
      const cl = F.clusterFaces(items, { threshold: t, minPhotos: 1 });
      sweep[t] = { ...evaluate(cl, L), ms: Math.round(now() - t0) };
    }
    const def = F.clusterFaces(items);
    const repsOk = def.every((c) => c.members.includes(c.representative) && c.photoIds.length >= 2);
    const sortedOk = def.every((c, i) => i === 0 || def[i - 1].photoIds.length >= c.photoIds.length);
    // Stability: shuffled input → same partition and ids.
    const perm = items.map((_, i) => i).sort((a, b) => ((a * 7919 + 13) % items.length) - ((b * 7919 + 13) % items.length));
    const shuffled = F.clusterFaces(perm.map((i) => items[i]));
    const sig = (cl, map) => cl.map((c) => `${c.id}:${c.members.map(map).sort((a, b) => a - b).join(',')}`).sort().join('|');
    const stable = sig(def, (m) => m) === sig(shuffled, (m) => perm[m]);
    // Scale test on synthetic descriptors (5000 faces, 250 people, ≤ 1 face per person per photo).
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const people = Array.from({ length: 250 }, () => Float32Array.from({ length: 128 }, () => gauss() * 0.05));
    const synth = [];
    const synthLabels = [];
    for (let p = 0; p < 1500; p++) {
      const used = new Set();
      const count = 1 + Math.floor(rnd() * 6);
      for (let k = 0; k < count; k++) {
        const who = Math.floor(Math.pow(rnd(), 2) * people.length); // a few very frequent people (the couple)
        if (used.has(who)) continue;
        used.add(who);
        const d = Float32Array.from(people[who], (v) => v + gauss() * 0.02);
        synth.push({ photoId: `p${p}`, face: { box: [rnd() * 0.8, rnd() * 0.8, 0.05, 0.07], score: 0.9, descriptor: d } });
        synthLabels.push({ id: who, photo: `p${p}` });
      }
    }
    const t0 = now();
    const big = F.clusterFaces(synth, { minPhotos: 1 });
    const bigMs = now() - t0;
    const t1 = now();
    const bigAsync = await F.clusterFacesAsync(synth, { minPhotos: 1 });
    const asyncMs = now() - t1;
    return {
      faces: items.length,
      sweep,
      default: { people: def.length, representativesValid: repsOk, sortedBySize: sortedOk, stableUnderShuffle: stable, sampleIds: def.slice(0, 3).map((c) => c.id) },
      synthetic: { faces: synth.length, ms: Math.round(bigMs), asyncMs: Math.round(asyncMs), sameAsSync: big.length === bigAsync.length, ...evaluate(big, synthLabels) },
    };
  },

  /** describeSelfie on a file, a bitmap, a large canvas, a <video>, a mirrored selfie, another person and a photo without a face. */
  async selfie() {
    const { F, loadImg, canvasOf, toBlob, dist } = window.lib;
    const img = await loadImg('/samples/sample3.jpg');
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const faces = await F.detectFaces(img, { thorough: true });
    const byArea = [...faces].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
    const shot = (face, out = 900, factor = 1.7) => {
      const [x, y, w, h] = [face.box[0] * W, face.box[1] * H, face.box[2] * W, face.box[3] * H];
      const side = Math.max(w, h) * factor;
      const c = canvasOf(out, out);
      c.getContext('2d').drawImage(img, x + w / 2 - side / 2, y + h / 2 - side * 0.45, side, side, 0, 0, out, out);
      return c;
    };
    const target = byArea[0];
    const other = byArea[1];
    const selfie = shot(target);
    const describe = async (label, src, ref = target) => {
      const t = performance.now();
      const r = await F.describeSelfie(src);
      return { label, faces: r?.faces ?? 0, distance: r ? +dist(r.descriptor, ref.descriptor).toFixed(3) : null, ms: Math.round(performance.now() - t) };
    };
    const out = [];
    out.push(await describe('jpeg blob', await toBlob(selfie)));
    out.push(await describe('ImageBitmap', await createImageBitmap(selfie)));
    const big = canvasOf(3000, 3000);
    big.getContext('2d').drawImage(selfie, 0, 0, 3000, 3000);
    out.push(await describe('3000px canvas (scaled down)', big));
    const mirror = canvasOf(900, 900);
    const mctx = mirror.getContext('2d');
    mctx.translate(900, 0);
    mctx.scale(-1, 1);
    mctx.drawImage(selfie, 0, 0);
    out.push(await describe('mirrored (front camera)', await toBlob(mirror)));
    out.push(await describe('small face 300px', shot(target, 300, 2.5)));
    // <video> fed by a canvas stream
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const stream = selfie.captureStream(30);
    const ticker = setInterval(() => selfie.getContext('2d').fillRect(0, 0, 1, 1), 30);
    video.srcObject = stream;
    await video.play();
    for (let i = 0; i < 100 && !video.videoWidth; i++) await new Promise((r) => setTimeout(r, 50));
    out.push(await describe(`video ${video.videoWidth}x${video.videoHeight}`, video));
    clearInterval(ticker);
    stream.getTracks().forEach((t) => t.stop());
    out.push(await describe('other person (should be far)', await toBlob(shot(other))));
    const bg = canvasOf(500, 400);
    bg.getContext('2d').drawImage(img, 0, 0, 500, 400, 0, 0, 500, 400);
    out.push(await describe('no face (background)', await toBlob(bg)));
    let badFile;
    try {
      await F.describeSelfie(new Blob(['not an image'], { type: 'image/jpeg' }));
    } catch (err) {
      badFile = `${err.name}:${err.code}`;
    }
    return { results: out, corruptFile: badFile };
  },

  /** Tensor / GPU memory across many thorough detections (leak check) + per-image time. */
  async memory({ samples }) {
    const { F, loadImg, makeVariant, now, stats } = window.lib;
    const tf = window.faceInternals.tfRuntime(await window.faceInternals.engine());
    const imgs = [];
    for (const name of samples) {
      const img = await loadImg(`/samples/${name}`);
      imgs.push(img, makeVariant(img, 'half').canvas, makeVariant(img, 'rot12').canvas);
    }
    for (const c of imgs.slice(0, 3)) await F.detectFaces(c, { thorough: true });
    const before = tf.memory();
    const times = [];
    for (let round = 0; round < 2; round++) {
      for (const c of imgs) {
        const t = now();
        await F.detectFaces(c, { thorough: true });
        times.push(now() - t);
      }
    }
    const after = tf.memory();
    const pick = (m) => ({ tensors: m.numTensors, bytes: m.numBytes, gpuBytes: m.numBytesInGPU, gpuAllocated: m.numBytesInGPUAllocated });
    return { detections: times.length, before: pick(before), after: pick(after), msPerImage: stats(times) };
  },

  /** Face thumbnails (saved by the harness for a visual check), incl. a face at the image corner. */
  async crops() {
    const { F, loadImg } = window.lib;
    const out = [];
    for (const name of ['sample1.jpg', 'sample5.jpg']) {
      const img = await loadImg(`/samples/${name}`);
      const faces = await F.detectFaces(img);
      for (const f of [...faces, { box: [0.93, 0.9, 0.07, 0.1] }]) {
        const blob = await F.cropFace(img, f.box);
        const bmp = await createImageBitmap(blob);
        const dataUrl = await new Promise((r) => {
          const fr = new FileReader();
          fr.onload = () => r(fr.result);
          fr.readAsDataURL(blob);
        });
        out.push({ name, box: f.box.map((v) => +v.toFixed(3)), type: blob.type, bytes: blob.size, size: `${bmp.width}x${bmp.height}`, dataUrl });
      }
    }
    return out;
  },

  /** End-to-end analyzeGallery against the mock admin API: uploads, cache, abort, auth error. */
  async analyze() {
    const { F, loadImg, makeVariant, toBlob, now } = window.lib;
    const gid = 'TestGallery01';
    const list = [];
    let n = 0;
    for (let i = 1; i <= 6; i++) {
      const img = await loadImg(`/samples/sample${i}.jpg`);
      for (const kind of ['orig', ...(i <= 3 ? ['flip', 'bright'] : ['crop', 'dark'])]) {
        const { canvas } = makeVariant(img, kind);
        const pid = `Ph${String(++n).padStart(3, '0')}xQ7mZk2LpR`;
        await fetch(`/__mock/photo/${gid}/${pid}`, { method: 'POST', body: await toBlob(canvas, 'image/jpeg', 0.9) });
        list.push({ id: pid, w: canvas.width, h: canvas.height, sample: i, kind });
      }
    }
    list.push({ id: 'MissingPhoto0001', w: 10, h: 10, sample: 0, kind: 'missing' }); // 404 → skipped
    const photos = list.map(({ id, w, h }) => ({ id, w, h }));
    await F.clearFaceCache(gid);
    await fetch('/__mock/reset');
    const events = [];
    let t = now();
    const res = await F.analyzeGallery({ galleryId: gid, photos, onProgress: (e) => events.push(e), useCache: true });
    const ms1 = Math.round(now() - t);
    const calls = await (await fetch('/__mock/calls')).json();
    const idx = calls.find((c) => c.path.endsWith('/faces/index'));
    const desc = calls.find((c) => c.path.endsWith('/faces/descriptors'));
    const ppl = calls.find((c) => c.path.endsWith('/faces/people'));
    const crops = calls.filter((c) => /\/people\/[^/]+$/.test(c.path));
    const people = ppl?.json?.people ?? [];
    const sampleOf = new Map(list.map((p) => [p.id, p.sample]));
    const checks = {
      allHaveHeader: calls.every((c) => c.xrw === 'moshik-admin'),
      order: calls.map((c) => c.path.split('/').slice(-2).join('/').replace(/people\/\w+$/, 'people/{id}')).filter((v, i, a) => a.indexOf(v) === i),
      indexDims: idx?.json?.dims,
      indexFaces: idx?.json?.faces?.length,
      indexVersionIsTime: typeof idx?.json?.version === 'number' && idx.json.version > 1.6e12,
      boxesNormalised: idx?.json?.faces?.every((f) => f.b.length === 4 && f.b.every((v) => v >= 0 && v <= 1) && f.b[0] + f.b[2] <= 1.0001 && f.b[1] + f.b[3] <= 1.0001),
      indexPhotoOrder: idx?.json?.faces?.every((f, i, a) => i === 0 || photos.findIndex((p) => p.id === a[i - 1].p) <= photos.findIndex((p) => p.id === f.p)),
      descriptorType: desc?.type,
      descriptorBytes: desc?.size,
      descriptorBytesOk: desc?.size === res.faces * 132,
      cropCount: crops.length,
      cropsJpeg: crops.every((c) => c.type === 'image/jpeg' && c.size > 1500),
      peopleCountOk: people.every((p) => p.count === p.photoIds.length && p.count >= 2 && p.hasCrop === true),
      peopleIdsMatchCrops: people.every((p) => crops.some((c) => c.path.endsWith(`/people/${p.id}`))),
      peopleSingleSample: people.map((p) => [...new Set(p.photoIds.map((id) => sampleOf.get(id)))].join('+')),
    };
    const stages = events.map((e) => e.stage).filter((v, i, a) => a.indexOf(v) === i);
    const lastDetect = events.filter((e) => e.stage === 'detect').at(-1);
    // Second run: detections come from the IndexedDB cache.
    await fetch('/__mock/reset');
    t = now();
    const res2 = await F.analyzeGallery({ galleryId: gid, photos, useCache: true });
    const ms2 = Math.round(now() - t);
    const calls2 = await (await fetch('/__mock/calls')).json();
    const people2 = calls2.find((c) => c.path.endsWith('/faces/people'))?.json?.people ?? [];
    const mediaFetchesSecondRun = performance.getEntriesByType('resource').filter((r) => r.name.includes('/media/')).length;
    // Abort during detection.
    const ctrl = new AbortController();
    let aborted = 'not aborted';
    t = now();
    try {
      await F.analyzeGallery({ galleryId: gid, photos, useCache: false, signal: ctrl.signal, onProgress: (e) => e.stage === 'detect' && e.done >= 1 && ctrl.abort() });
    } catch (err) {
      aborted = err.name;
    }
    const abortMs = Math.round(now() - t);
    // Expired session.
    let auth = 'no error';
    try {
      await F.analyzeGallery({ galleryId: 'AuthFail01', photos: photos.slice(0, 2), useCache: false });
    } catch (err) {
      auth = { name: err.name, code: err.code, status: err.status, message: err.message };
    }
    return {
      result: res,
      ms: ms1,
      stages,
      lastDetect,
      checks,
      people: people.map((p) => `${p.id}:${p.count}`),
      cached: { result: res2, ms: ms2, samePeopleIds: JSON.stringify(people.map((p) => p.id)) === JSON.stringify(people2.map((p) => p.id)), mediaFetchesTotal: mediaFetchesSecondRun },
      abort: { error: aborted, ms: abortMs },
      auth,
    };
  },
};

// ---------------------------------------------------------------------------
// 5. Runner.

/** --compare: descriptor agreement between the saved per-backend reports (same photos, same faces). */
async function compareBackends() {
  const { readFile } = await import('node:fs/promises');
  const reports = {};
  for (const b of ['webgl', 'wasm', 'cpu']) {
    try {
      reports[b] = JSON.parse(await readFile(path.join(TMP, `report-${b}.json`), 'utf8'));
    } catch {
      /* not run */
    }
  }
  const names = Object.keys(reports).filter((b) => reports[b].detect?.[0]?.descriptors);
  const euclid = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  const overlap = (a, b) => {
    const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
    const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
    return w > 0 && h > 0 ? (w * h) / (a[2] * a[3] + b[2] * b[3] - w * h) : 0;
  };
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const ds = [];
      let unmatched = 0;
      for (const ra of reports[names[i]].detect) {
        const rb = reports[names[j]].detect.find((r) => r.name === ra.name);
        for (const fa of ra.descriptors) {
          const fb = rb?.descriptors.find((f) => overlap(f.box, fa.box) > 0.7);
          if (fb) ds.push(euclid(fa.d, fb.d));
          else unmatched++;
        }
      }
      ds.sort((a, b) => a - b);
      log(`${names[i]} vs ${names[j]}: ${ds.length} faces, distance median ${ds[ds.length >> 1]?.toFixed(4)}, max ${ds.at(-1)?.toFixed(4)}, unmatched ${unmatched}`);
    }
  }
  if (names.length < 2) log('need at least two report-<backend>.json files with the detect test');
}

async function main() {
  if (flag('compare')) return compareBackends();
  const dist = await bundle();
  const { server, port } = await startServer(dist);
  const base = `http://127.0.0.1:${port}`;
  const pw = await import(require.resolve('playwright-core'));
  const chromium = pw.chromium ?? pw.default.chromium;
  const launchArgs = ['--no-sandbox'];
  if (flag('no-webgl')) launchArgs.push('--disable-webgl', '--disable-3d-apis');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: launchArgs });
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) log(`  [page ${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => log(`  [page error] ${err.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/media/AuthFail') && !r.url().endsWith('/favicon.ico')) log(`  [http ${r.status()}] ${r.url()}`);
  });
  await page.goto(base);
  await page.waitForFunction(() => window.harnessReady === true);
  await page.evaluate(`window.lib = (${pageLib.toString()})(); window.store = {};`);
  const backend = opt('backend');
  await page.evaluate(
    ({ backend, wasm }) => {
      if (backend) window.faces.configureFaces({ backend });
      if (wasm) window.faces.configureFaces({ wasmPath: '/wasm/' });
    },
    { backend, wasm: !!process.env.FACES_WASM },
  );

  const samples = QUICK ? ['sample1.jpg', 'sample3.jpg'] : [1, 2, 3, 4, 5, 6].map((i) => `sample${i}.jpg`);
  const report = {};
  let failed = 0;
  const outDir = path.join(TMP, 'out');
  await mkdir(outDir, { recursive: true });
  if (ONLY?.includes('cluster') && !ONLY.includes('variants')) ONLY.push('variants');
  for (const [name, fn] of Object.entries(TESTS)) {
    if (ONLY && !ONLY.includes(name) && name !== 'load') continue;
    const t0 = Date.now();
    try {
      const result = await page.evaluate(`(${fn.toString().replace(/^async\s+\w+\s*\(/, 'async function(')})(${JSON.stringify({ samples, base })})`);
      if (name === 'crops') {
        for (const [i, c] of result.entries()) {
          await writeFile(path.join(outDir, `crop-${i + 1}.jpg`), Buffer.from(c.dataUrl.split(',')[1], 'base64'));
          delete c.dataUrl;
        }
        log(`  crops saved to ${outDir}`);
      }
      if (name === 'composite') {
        for (const [label, r] of Object.entries(result)) {
          if (!r?.debugImage) continue;
          await writeFile(path.join(outDir, `composite-${label.split(' ')[0]}.jpg`), Buffer.from(r.debugImage.split(',')[1], 'base64'));
          delete r.debugImage;
        }
      }
      report[name] = result;
      log(`\n== ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      log(JSON.stringify(result, (k, v) => (k === 'descriptors' ? undefined : v), 1));
    } catch (err) {
      failed++;
      report[name] = { error: String(err) };
      log(`\n== ${name} FAILED: ${err}`);
    }
  }
  await mkdir(TMP, { recursive: true });
  const reportFile = path.join(TMP, `report-${report.load?.backend ?? 'unknown'}.json`);
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
  log(`\nreport: ${reportFile}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
