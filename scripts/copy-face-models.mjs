#!/usr/bin/env node
/**
 * Copies the face recognition model weights used by src/scripts/faces from
 * node_modules into public/models/face-api/, so they are served (and shipped
 * in dist/) at /models/face-api/. Runs automatically before `npm run dev` and
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

  let copied = 0;
  let bytes = 0;
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dest = path.join(DEST, file);
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
