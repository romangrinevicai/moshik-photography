#!/usr/bin/env node
/**
 * Import Moshik's real photos from photos-inbox/ into src/assets/photos/.
 *
 *   node scripts/import-photos.mjs            # import
 *   node scripts/import-photos.mjs --dry-run  # show what would happen
 *
 * - Fixes rotation (EXIF), converts to sRGB, resizes to max 2400 px and
 *   strips metadata (including GPS location) before anything is published.
 * - Placeholder images in a destination folder are removed the first time
 *   real photos are imported into it.
 * - Files are numbered 01.jpg, 02.jpg… in the order of their file names.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const INBOX = resolve(ROOT, process.argv.slice(2).find((a) => !a.startsWith('-')) ?? 'photos-inbox');
const DEST = join(ROOT, 'src/assets/photos');
const DRY = process.argv.includes('--dry-run');
const MAX = 2400;
const IMAGE = /\.(jpe?g|png|webp|tiff?|avif|heic|heif)$/i;

const MAP = {
  hero: 'hero',
  weddings: 'portfolio/weddings',
  'bar-bat-mitzvah': 'portfolio/bar-bat-mitzvah',
  events: 'portfolio/events',
  couples: 'portfolio/couples',
  portraits: 'portfolio/portraits',
  corporate: 'portfolio/corporate',
  about: 'about',
};

const placeholderHashes = new Set(Object.values(JSON.parse(readFileSync(join(ROOT, 'scripts/placeholders/hashes.json'), 'utf8'))));
const sha1 = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');
const images = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => IMAGE.test(f) && statSync(join(dir, f)).isFile()).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : []);
const c = { green: (s) => `\x1b[32m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };

async function importFolder(srcDir, destRel, opts = {}) {
  const files = images(srcDir);
  if (!files.length) return 0;
  const destDir = join(DEST, destRel);
  mkdirSync(destDir, { recursive: true });
  const existing = images(destDir);
  const placeholders = existing.filter((f) => placeholderHashes.has(sha1(join(destDir, f))));
  const real = existing.filter((f) => !placeholders.includes(f));
  if (placeholders.length) {
    console.log(c.dim(`  removing ${placeholders.length} placeholder(s) from ${destRel}/`));
    if (!DRY) placeholders.forEach((f) => rmSync(join(destDir, f)));
  }
  let n = real.reduce((max, f) => Math.max(max, Number.parseInt(basename(f), 10) || 0), 0);
  const width = Math.max(2, String(n + files.length).length);
  let count = 0;
  for (const file of files) {
    let name;
    if (opts.about) {
      const isPortrait = /^(moshik|portrait|me)\b/i.test(file) || (count === 0 && !files.some((f) => /^(moshik|portrait|me)\b/i.test(f)));
      name = isPortrait && !real.includes('moshik.jpg') && !opts.portraitDone ? 'moshik.jpg' : `behind-the-scenes-${String(++n).padStart(2, '0')}.jpg`;
      if (name === 'moshik.jpg') opts.portraitDone = true;
    } else {
      name = `${String(++n).padStart(width, '0')}.jpg`;
    }
    const out = join(destDir, name);
    try {
      if (!DRY) {
        const img = sharp(join(srcDir, file), { failOn: 'none' }).rotate().toColorspace('srgb');
        const meta = await img.metadata();
        await img
          .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 86, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' })
          .toFile(out);
        if (Math.max(meta.width ?? 0, meta.height ?? 0) < 1600) console.log(c.yellow(`  ⚠ ${file} is small (${meta.width}×${meta.height}) — it may look soft on large screens`));
      }
      console.log(`  ${c.green('✓')} ${destRel}/${name} ${c.dim(`← ${file}`)}`);
      count++;
    } catch (err) {
      console.log(c.yellow(`  ⚠ skipped ${file}: ${err.message}`));
    }
  }
  return count;
}

async function main() {
  if (!existsSync(INBOX)) {
    console.error(`No inbox folder at ${INBOX}`);
    process.exit(1);
  }
  console.log(c.bold(`\nImporting photos from ${INBOX}${DRY ? ' (dry run)' : ''}\n`));
  let total = 0;
  for (const [folder, dest] of Object.entries(MAP)) {
    const src = join(INBOX, folder);
    if (!existsSync(src)) continue;
    console.log(c.bold(`${folder}/ → src/assets/photos/${dest}/`));
    total += await importFolder(src, dest, { about: folder === 'about' });
  }
  const storiesDir = join(INBOX, 'stories');
  if (existsSync(storiesDir)) {
    const known = readFileSync(join(ROOT, 'src/data/stories.ts'), 'utf8');
    for (const slug of readdirSync(storiesDir).filter((d) => statSync(join(storiesDir, d)).isDirectory())) {
      const clean = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      console.log(c.bold(`stories/${slug}/ → src/assets/photos/stories/${clean}/`));
      total += await importFolder(join(storiesDir, slug), `stories/${clean}`);
      if (!known.includes(`slug: '${clean}'`)) console.log(c.yellow(`  ⚠ add a story entry with slug '${clean}' in src/data/stories.ts so it appears on the site`));
    }
  }
  // Loose files in the inbox root go to the wedding portfolio.
  if (images(INBOX).length) {
    console.log(c.bold('photos-inbox/ (loose files) → src/assets/photos/portfolio/weddings/'));
    total += await importFolder(INBOX, 'portfolio/weddings');
  }
  console.log(c.bold(`\n${total} photo(s) ${DRY ? 'would be ' : ''}imported.`), 'Next: review alt text in src/data/photos.ts, then run `npm run checklist`.\n');
}

main();
