#!/usr/bin/env node
/**
 * Copies the face recognition model weights used by src/scripts/faces from
 * node_modules into public/models/face-api/, so they are served (and shipped
 * in dist/) at /models/face-api/. Also self-hosts the TF.js WebAssembly
 * binaries (fallback for devices without WebGL) at /models/tfjs-wasm/, so no
 * third-party CDN is ever contacted. Runs automatically before `npm run dev` and
 * `npm run build` (predev / prebuild).
 *
 * Idempotent: files whose content is already up to date are skipped.
 * Usage: node scripts/copy-face-models.mjs [--quiet]
 */
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Model weight sets used by the browser module (manifest + binary shards). */
const MODELS = ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model'];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'public', 'models', 'face-api');
const WASM_DEST = path.join(ROOT, 'public', 'models', 'tfjs-wasm');
const WASM_FILES = ['tfjs-backend-wasm.wasm', 'tfjs-backend-wasm-simd.wasm', 'tfjs-backend-wasm-threaded-simd.wasm'];
const quiet = process.argv.includes('--quiet');

function packageModelDir() {
  const require = createRequire(path.join(ROOT, 'package.json'));
  try {
    return path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
  } catch {
    throw new Error('@vladmandic/face-api is not installed (run npm install).');
  }
}

async function sameContent(src, dest) {
  const [a, b] = await Promise.all([stat(src), stat(dest).catch(() => null)]);
  if (!b || a.size !== b.size) return false;
  const [x, y] = await Promise.all([readFile(src), readFile(dest)]);
  return x.equals(y);
}

async function main() {
  const srcDir = packageModelDir();
  await mkdir(DEST, { recursive: true });

  const files = [];
  for (const model of MODELS) {
    const manifest = `${model}-weights_manifest.json`;
    files.push(manifest);
    const groups = JSON.parse(await readFile(path.join(srcDir, manifest), 'utf8'));
    for (const group of groups) for (const shard of group.paths) files.push(shard);
  }

  const jobs = files.map((file) => ({ src: path.join(srcDir, file), dest: path.join(DEST, file) }));
  try {
    const require = createRequire(path.join(ROOT, 'package.json'));
    const wasmDir = path.join(path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')), 'dist');
    await mkdir(WASM_DEST, { recursive: true });
    for (const file of WASM_FILES) jobs.push({ src: path.join(wasmDir, file), dest: path.join(WASM_DEST, file) });
  } catch {
    if (!quiet) console.warn('[face models] @tensorflow/tfjs-backend-wasm not installed — devices without WebGL will use the slower CPU fallback.');
  }

  let copied = 0;
  let bytes = 0;
  for (const { src, dest } of jobs) {
    if (await sameContent(src, dest)) continue;
    // Copy to a temp name first so an interrupted run never leaves a truncated model behind.
    const tmp = `${dest}.tmp-${process.pid}`;
    await copyFile(src, tmp);
    await rename(tmp, dest);
    copied++;
    bytes += (await stat(dest)).size;
  }

  if (!quiet) {
    const rel = path.relative(ROOT, DEST) || DEST;
    const summary = copied
      ? `${copied} file(s) copied (${(bytes / 1048576).toFixed(1)} MB)`
      : 'already up to date';
    console.log(`[face models] ${summary} → ${rel.split(path.sep).join('/')}`);
  }
}

main().catch((err) => {
  console.error(`[face models] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
