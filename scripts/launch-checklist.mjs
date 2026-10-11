#!/usr/bin/env node
/**
 * Pre-launch checklist: `npm run checklist`
 *
 * Scans the project for placeholders that should not go live: contact
 * details, sample stories and reviews, the generated placeholder photos,
 * the placeholder domain, Worker settings and so on. Prints a colour-coded
 * report grouped into "must fix", "should review" and "done".
 *
 *   npm run checklist                report only, always exits 0
 *   npm run checklist -- --strict    exits 1 while any "must fix" item is left
 *   npm run checklist -- --no-color  plain output
 *
 * Node built-ins only, no dependencies.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: npm run checklist [-- --strict] [-- --no-color]

  --strict    exit with code 1 while any "must fix" item remains
  --no-color  disable colours (NO_COLOR=1 works too)`);
  process.exit(0);
}

const STRICT = args.has('--strict');
const COLOR =
  !args.has('--no-color') &&
  !process.env.NO_COLOR &&
  Boolean(process.stdout.isTTY || process.env.FORCE_COLOR || process.env.GITHUB_ACTIONS === 'true');

const paint = (code) => (s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const red = paint('31');
const yellow = paint('33');
const green = paint('32');
const cyan = paint('36');
const dim = paint('2');
const bold = paint('1');

/* ───────────────────────────── helpers ───────────────────────────── */

const PHOTOS_DIR = 'src/assets/photos';
const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i;

const abs = (rel) => join(ROOT, rel);
const read = (rel) => {
  try {
    return readFileSync(abs(rel), 'utf8');
  } catch {
    return null;
  }
};
const clip = (s, max = 92) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function listDir(rel) {
  try {
    return readdirSync(abs(rel));
  } catch {
    return [];
  }
}

function walk(rel) {
  const out = [];
  for (const name of listDir(rel)) {
    if (name.startsWith('.')) continue;
    const child = `${rel}/${name}`;
    let st;
    try {
      st = statSync(abs(child));
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(child));
    else out.push(child);
  }
  return out;
}

/** `src/data/*.ts` and `src/config/*.ts`, the files holding content and settings. */
const contentFiles = () =>
  ['src/config', 'src/data'].flatMap((dir) =>
    listDir(dir)
      .filter((f) => f.endsWith('.ts'))
      .sort()
      .map((f) => `${dir}/${f}`),
  );

/** Index of the closing quote of the string starting at `i`. */
function skipString(text, i) {
  const quote = text[i];
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === quote) return j;
  }
  return text.length;
}

/** Splits a line of code into the code and its trailing `//` comment (ignoring `//` inside strings). */
function splitComment(line) {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" || ch === '"' || ch === '`') i = skipString(line, i);
    else if (ch === '/' && line[i + 1] === '/') return { code: line.slice(0, i), comment: line.slice(i + 2) };
  }
  return { code: line, comment: '' };
}

const isCommentLine = (line) => /^\s*(\*|\/\*|\/\/)/.test(line);

/** Parent object keys of a line, e.g. ["stats"] for `events: 650` inside `stats: { … }`. */
function keyPath(lines, i) {
  const indent = (s) => s.match(/^\s*/)[0].length;
  let level = indent(lines[i]);
  const path = [];
  for (let j = i - 1; j >= 0 && level > 0; j--) {
    const l = lines[j];
    if (!l.trim() || isCommentLine(l) || indent(l) >= level) continue;
    level = indent(l);
    const m = l.match(/^\s*['"]?([\w-]+)['"]?\s*:\s*[{[]/);
    if (m) path.unshift(m[1]);
  }
  return path;
}

/** A config line shown with its parent keys, e.g. `stats.events: 650`. */
function describeLine(lines, i) {
  const code = splitComment(lines[i]).code.trim().replace(/,$/, '');
  const path = keyPath(lines, i);
  return path.length ? `${path.join('.')}.${code}` : code;
}

/** Joins short parts with " · " into lines of at most `width` characters. */
function wrapList(parts, width = 84) {
  const lines = [];
  let line = '';
  for (const part of parts) {
    if (line && line.length + part.length + 3 > width) {
      lines.push(line);
      line = '';
    }
    line += line ? ` · ${part}` : part;
  }
  if (line) lines.push(line);
  return lines;
}

/** Minimal JSONC reader (comments + trailing commas), enough for wrangler.jsonc. */
function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const end = skipString(text, i);
      out += text.slice(i, end + 1);
      i = end;
    } else if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl < 0 ? text.length : nl - 1;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
    } else {
      out += ch;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/**
 * Top-level objects of every `export const name: Type[] = [ … ]` in a file,
 * so sample entries can be counted without running TypeScript.
 */
function exportedArrays(text) {
  const arrays = [];
  const head = /export\s+const\s+(\w+)\s*(?::[^=]+)?=\s*\[/g;
  let m;
  while ((m = head.exec(text))) {
    const items = [];
    let depth = 0;
    let start = -1;
    let i = head.lastIndex;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === "'" || ch === '"' || ch === '`') {
        i = skipString(text, i);
      } else if (ch === '/' && text[i + 1] === '/') {
        const nl = text.indexOf('\n', i);
        i = nl < 0 ? text.length : nl;
      } else if (ch === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        i = end < 0 ? text.length : end + 1;
      } else if ('{[('.includes(ch)) {
        if (depth === 0 && ch === '{') start = i;
        depth++;
      } else if ('}])'.includes(ch)) {
        if (depth === 0) break;
        depth--;
        if (depth === 0 && ch === '}' && start >= 0) {
          items.push({ text: text.slice(start, i + 1), line: lineOf(text, start) });
          start = -1;
        }
      }
    }
    arrays.push({ name: m[1], items });
    head.lastIndex = i;
  }
  return arrays;
}

/** Width × height of a JPEG or PNG from its header (null for other formats). */
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** Reads `key: 'value'` (or true/false/number) from the site config source. */
function configValue(text, key) {
  const m = text.match(new RegExp(`\\b${key}\\s*:\\s*(?:(['"\`])(.*?)\\1|(true|false|-?\\d+(?:\\.\\d+)?))`));
  if (!m) return undefined;
  if (m[3] === 'true') return true;
  if (m[3] === 'false') return false;
  if (m[3] !== undefined) return Number(m[3]);
  return m[2];
}

/* ───────────────────────────── results ───────────────────────────── */

const results = { must: [], should: [], done: [] };
const optionalTodo = [];

function add(level, title, { details = [], hint } = {}) {
  results[level].push({ title, details, hint });
}

function check(name, fn) {
  try {
    fn();
  } catch (err) {
    add('should', `The "${name}" check could not run`, { details: [String(err?.message ?? err)] });
  }
}

const SITE = 'src/config/site.ts';
const siteSrc = read(SITE) ?? '';

/* ───────────────────────── 1. contact details ───────────────────────── */

const reportedLines = new Set();

check('contact details', () => {
  const patterns = [
    /972500000000/,
    /050-000-0000/,
    /[\w.+-]+@(?:[\w-]+\.)*example(?:\.[a-z]{2,})?\b/i,
    /instagram\.com\/?['"`]/,
  ];
  const hits = [];
  for (const file of contentFiles()) {
    const lines = (read(file) ?? '').split('\n');
    lines.forEach((line, i) => {
      const { code } = splitComment(line);
      if (isCommentLine(line) || !patterns.some((re) => re.test(code))) return;
      hits.push(`${file}:${i + 1}  ${clip(describeLine(lines, i), 76)}`);
      reportedLines.add(`${file}:${i + 1}`);
    });
  }
  if (hits.length) {
    add('must', 'Contact details are still placeholders', {
      details: hits,
      hint: `Put Moshik's real WhatsApp, phone, email and Instagram in ${SITE}, then delete each // TODO(launch) comment.`,
    });
    return;
  }

  const wa = String(configValue(siteSrc, 'whatsapp') ?? '');
  const phone = String(configValue(siteSrc, 'phone') ?? '');
  const email = String(configValue(siteSrc, 'email') ?? '');
  if (!/^[1-9]\d{9,14}$/.test(wa)) {
    add('must', `WhatsApp number "${wa}" will not work in wa.me links`, {
      hint: 'Use international format, digits only, no "+" or dashes: 054-123-4567 → 972541234567.',
    });
  }
  if (!/^\+\d{9,15}$/.test(phone)) {
    add('should', `Phone "${phone}" should be in +972… format`, { hint: 'Used for tap-to-call links, e.g. +972541234567.' });
  }
  if (/^[1-9]\d{9,14}$/.test(wa) && /^\+\d{9,15}$/.test(phone)) {
    add('done', `Contact details set (WhatsApp ${wa}, ${email || 'no email'})`);
  }
});

/* ─────────────────────── 2. TODO(launch) markers ─────────────────────── */

// Files whose TODO(launch) note is covered by a dedicated check below.
const NOTE_HANDLED_BY = {
  'src/data/stories.ts': 'samples',
  'src/data/testimonials.ts': 'samples',
  'src/data/availability.ts': 'availability',
  'src/data/packages.ts': 'prices',
};
const notes = {}; // file → [{ line, text }]

check('TODO(launch) markers', () => {
  const values = [];
  for (const file of contentFiles()) {
    const lines = (read(file) ?? '').split('\n');
    lines.forEach((line, i) => {
      // `TODO(launch)` in backticks is documentation, not a marker.
      const stripped = line.replace(/`TODO\(launch\)`/g, '');
      const at = stripped.indexOf('TODO(launch)');
      if (at < 0) return;
      const hint = stripped
        .slice(at + 'TODO(launch)'.length)
        .replace(/^\s*[:—-]?\s*/, '')
        .replace(/\*\/\s*$/, '')
        .trim();
      if (isCommentLine(stripped)) {
        (notes[file] ??= []).push({ line: i + 1, text: hint || stripped.trim().replace(/^[/*\s]+/, '') });
        return;
      }
      if (reportedLines.has(`${file}:${i + 1}`)) return;
      values.push(`${file}:${i + 1}  ${clip(describeLine(lines, i), 64)}${hint ? dim(`  ← ${clip(hint, 40)}`) : ''}`);
    });
  }
  if (values.length) {
    add('must', `${plural(values.length, 'placeholder value')} marked TODO(launch)`, {
      details: values,
      hint: 'Replace each value with the real one (or confirm it is right), then delete its // TODO(launch) comment.',
    });
  } else {
    add('done', 'No TODO(launch) placeholder values left in the config and data files');
  }

  const templates = Object.entries(notes)
    .filter(([file]) => !NOTE_HANDLED_BY[file])
    .flatMap(([file, list]) => list.map((n) => `${file}:${n.line}  ${clip(n.text, 70)}`));
  if (templates.length) {
    add('should', 'Template copy to personalise', {
      details: templates,
      hint: "Rewrite it in Moshik's own words (have the legal pages checked), then remove the TODO(launch) note.",
    });
  }
});

/* ───────────────────────────── 3. prices ───────────────────────────── */

check('prices', () => {
  const file = 'src/data/packages.ts';
  const src = read(file);
  if (src === null) return;
  const showPrices = configValue(siteSrc, 'showPrices') !== false;
  const marker = (notes[file] ?? [])[0];
  if (!marker && !src.includes('TODO(launch)')) {
    add('done', `Prices reviewed (${showPrices ? 'shown on the site' : 'hidden, "personal quote" shown instead'})`);
  } else if (showPrices) {
    add('must', "Prices are still the template's sample prices", {
      details: [`${file}:${marker?.line ?? '?'}  ${clip(marker?.text ?? 'TODO(launch)', 70)}`],
      hint: `Update the packages and add-ons in ${file}, then remove the TODO(launch) note. Not ready yet? Set pricing.showPrices = false in ${SITE}.`,
    });
  } else {
    add('should', 'Prices are hidden, but the sample amounts are still in packages.ts', {
      hint: `Update ${file} before turning pricing.showPrices back on.`,
    });
  }
});

/* ─────────────────────── 4. sample stories & reviews ─────────────────────── */

check('sample content', () => {
  for (const file of contentFiles()) {
    const src = read(file) ?? '';
    if (!/\bsample\??\s*:\s*(true|boolean)\b/.test(src)) continue;
    const noun = file.split('/').pop().replace(/\.ts$/, '');
    const items = exportedArrays(src).flatMap((a) => a.items);
    const samples = items.filter((it) => /\bsample\s*:\s*true\b/.test(it.text));
    if (!samples.length) {
      add('done', `No sample ${noun} left (${items.length} real)`);
      continue;
    }
    const label = (it) =>
      it.text.match(/\bslug\s*:\s*(['"`])(.*?)\1/)?.[2] ??
      it.text.match(/\b(?:name|title)\s*:\s*\{[^}]*?\ben\s*:\s*(['"`])(.*?)\1/)?.[2] ??
      'entry';
    const isReviews = /testimonial|review/i.test(noun);
    add('must', `${samples.length} of ${items.length} ${noun} are sample content${isReviews ? ' (never publish invented reviews)' : ''}`, {
      details: samples.map((it) => `${file}:${it.line}  ${label(it)}`),
      hint: isReviews
        ? 'Paste real reviews (e.g. from Google, with permission) without sample: true, or delete the samples.'
        : `Replace them with real ${noun} (with permission) or delete them, together with their photo folders. See docs/CONTENT.md.`,
    });
  }
});

/* ───────────────────────────── 5. photos ───────────────────────────── */

check('photos', () => {
  const hashesText = read('scripts/placeholders/hashes.json');
  const placeholderHashes = new Set(hashesText ? Object.values(JSON.parse(hashesText)) : []);
  const files = walk(PHOTOS_DIR).filter((f) => IMAGE_RE.test(f));
  if (!files.length) {
    add('must', `No photos found in ${PHOTOS_DIR}`, { hint: 'See docs/CONTENT.md → Photos.' });
    return;
  }

  const groups = new Map(); // folder → { total, placeholders }
  const small = [];
  const huge = [];
  let placeholders = 0;
  for (const file of files) {
    const id = file.slice(PHOTOS_DIR.length + 1);
    const parts = id.split('/');
    const folder = parts.length > 2 ? parts.slice(0, 2).join('/') : parts.length > 1 ? parts[0] : '(root)';
    const g = groups.get(folder) ?? { total: 0, placeholders: 0 };
    g.total++;
    const buf = readFileSync(abs(file));
    const isPlaceholder = placeholderHashes.has(createHash('sha1').update(buf).digest('hex'));
    if (isPlaceholder) {
      g.placeholders++;
      placeholders++;
    } else {
      const size = imageSize(buf);
      const min = folder === 'hero' ? 2400 : 2000;
      if (size && Math.max(size.w, size.h) < min) small.push(`${id}  ${size.w}×${size.h} ${dim(`(aim for ≥ ${min} px)`)}`);
      if (buf.length > 10 * 1024 * 1024) huge.push(`${id}  ${(buf.length / 1048576).toFixed(1)} MB`);
    }
    groups.set(folder, g);
  }

  if (placeholders) {
    const summary = [...groups].filter(([, g]) => g.placeholders).map(([folder, g]) => `${folder} ${g.placeholders}/${g.total}`);
    add('must', `${placeholders} of ${files.length} photos are the generated placeholders`, {
      details: wrapList(summary),
      hint: 'Drop real photos into the same folders. Keep the file names the code uses (e.g. about/moshik.jpg, portfolio/*/01.jpg). See docs/CONTENT.md → Photos.',
    });
  } else {
    add('done', `All ${files.length} photos are real, no placeholders left`);
  }
  if (small.length) {
    add('should', `${plural(small.length, 'photo is', 'photos are')} smaller than recommended`, {
      details: small.slice(0, 12).concat(small.length > 12 ? [dim(`…and ${small.length - 12} more`)] : []),
      hint: 'They may look soft on big screens and in the lightbox. Export at 2400–3000 px on the long edge.',
    });
  }
  if (huge.length) {
    add('should', `${plural(huge.length, 'photo is', 'photos are')} over 10 MB`, {
      details: huge.slice(0, 8),
      hint: 'Export at 2400–3000 px, JPEG quality 80–90: huge files slow down every build and bloat the repository.',
    });
  }
});

check('photo references', () => {
  const missing = [];
  const empty = { must: [], should: [] };
  const hasImages = (folder) => listDir(`${PHOTOS_DIR}/${folder}`).some((f) => IMAGE_RE.test(f));
  const sources = walk('src').filter((f) => /\.(astro|ts)$/.test(f) && f !== 'src/data/photos.ts' && !f.startsWith(PHOTOS_DIR));
  for (const file of sources) {
    const src = read(file) ?? '';
    for (const m of src.matchAll(/(['"`])((?:hero|about|portfolio|stories)\/[\w\-./]+?\.(?:jpe?g|png|webp|avif))\1/gi)) {
      if (!existsSync(abs(`${PHOTOS_DIR}/${m[2]}`))) missing.push(`${file}:${lineOf(src, m.index)}  → ${m[2]}`);
    }
    for (const m of src.matchAll(/\b(firstIn|photosIn)\(\s*(['"`])([\w\-/]+)\2\s*\)/g)) {
      if (!hasImages(m[3])) (m[1] === 'firstIn' ? empty.must : empty.should).push(`${file}:${lineOf(src, m.index)}  ${m[1]}('${m[3]}')`);
    }
  }
  const storiesSrc = read('src/data/stories.ts') ?? '';
  for (const it of exportedArrays(storiesSrc).flatMap((a) => a.items)) {
    const slug = it.text.match(/\bslug\s*:\s*(['"`])(.*?)\1/)?.[2];
    if (slug && !hasImages(`stories/${slug}`)) empty.must.push(`src/data/stories.ts:${it.line}  story "${slug}" → ${PHOTOS_DIR}/stories/${slug}/`);
  }
  if (missing.length) {
    add('must', 'Photos referenced in the code are missing (the build will fail)', {
      details: missing,
      hint: 'Add a photo with exactly that name, or update the reference to an existing photo.',
    });
  }
  if (empty.must.length) {
    add('must', 'Photo folders that must not be empty (the build will fail)', {
      details: empty.must,
      hint: 'Add at least one photo to each folder, or remove the story that needs it.',
    });
  }
  if (empty.should.length) {
    add('should', 'Photo folders used by the site are empty', {
      details: empty.should,
      hint: 'Those sections will show fewer photos (or fall back to others). Add photos or adjust the component.',
    });
  }
  if (!missing.length && !empty.must.length) add('done', 'Every photo the code refers to exists');
});

/* ───────────────────────────── 6. SITE_URL ───────────────────────────── */

check('SITE_URL', () => {
  const env = (process.env.SITE_URL ?? '').trim();
  const config = read('astro.config.mjs') ?? '';
  const fallback = config.match(/process\.env\.SITE_URL\s*\|\|\s*(['"`])(.*?)\1/)?.[2] ?? '';
  const isPlaceholder = (url) => /\.example(\/|$)|example\.(com|org)|localhost/i.test(url);
  if (env && !isPlaceholder(env)) {
    add('done', `SITE_URL is ${env} (from the environment)`);
  } else if (env) {
    add('must', `SITE_URL is set to a placeholder address: ${env}`, {
      hint: 'Use the real domain, e.g. SITE_URL=https://www.moshik-photo.co.il',
    });
  } else if (fallback && !isPlaceholder(fallback)) {
    add('done', `Site address is ${fallback} (astro.config.mjs)`);
  } else {
    add('must', "The site's public address is not set (SITE_URL)", {
      details: [`astro.config.mjs falls back to ${fallback || '(nothing)'}: canonical links, hreflang, social previews and the sitemap would point there`],
      hint: 'Replace the fallback in astro.config.mjs with the real domain (simplest), or set SITE_URL in the build environment (e.g. Workers Builds → Variables).',
    });
  }
});

/* ─────────────────────── 7. fallback availability ─────────────────────── */

check('availability', () => {
  const file = 'src/data/availability.ts';
  const src = read(file);
  if (src === null) return;
  const SAMPLE_DATES = ['2026-11-12', '2026-11-19', '2026-12-03', '2027-05-20', '2027-06-10', '2026-11-26', '2027-05-27'];
  const dates = [...src.matchAll(/['"](\d{4}-\d{2}-\d{2})['"]/g)].map((m) => m[1]);
  const samples = dates.filter((d) => SAMPLE_DATES.includes(d));
  if (samples.length) {
    add('should', `The fallback calendar still has ${plural(samples.length, 'sample date')} (${file})`, {
      hint: 'Clear them (booked: [], limited: []); the live calendar is managed in /admin. These dates only show if the API is unreachable.',
    });
  } else {
    add('done', dates.length ? `Fallback calendar has ${plural(dates.length, 'date')}, no samples` : 'Fallback calendar is empty (the live calendar in /admin is used)');
  }
});

/* ─────────────────────────── 8. Worker settings ─────────────────────────── */

let wrangler = null;
check('wrangler.jsonc', () => {
  const text = read('wrangler.jsonc');
  if (text === null) {
    add('must', 'wrangler.jsonc is missing');
    return;
  }
  wrangler = parseJsonc(text);
  const vars = wrangler.vars ?? {};
  const bucket = (wrangler.r2_buckets ?? []).find((b) => b.binding === 'BUCKET');
  if (bucket) add('done', `R2 bucket binding BUCKET → ${bucket.bucket_name}`);
  else add('must', 'No R2 bucket bound as BUCKET in wrangler.jsonc', { hint: 'Galleries, inquiries and the calendar are stored there. See docs/DEPLOY.md.' });

  const notify = String(vars.NOTIFY_EMAIL ?? '').trim();
  const from = String(vars.MAIL_FROM ?? '');
  if (!notify) {
    add('should', 'No email alerts for new inquiries (wrangler.jsonc → vars.NOTIFY_EMAIL is empty)', {
      hint: 'Set NOTIFY_EMAIL plus the RESEND_API_KEY secret, and/or Telegram alerts. Inquiries are saved in /admin either way.',
    });
  } else {
    add('done', `Inquiry emails go to ${notify} (needs the RESEND_API_KEY secret)`);
    if (/@resend\.dev\b/.test(from)) {
      add('should', "MAIL_FROM still uses Resend's test sender (onboarding@resend.dev)", {
        hint: 'It only delivers to the address of your own Resend account. Verify your domain in Resend and use e.g. "Moshik Website <site@your-domain>".',
      });
    }
  }
  if (!String(vars.SITE_URL ?? '').trim()) {
    add('should', 'wrangler.jsonc → vars.SITE_URL is empty', {
      hint: 'Set it to the live address so links in notification emails point to the right place.',
    });
  }
});

/* ─────────────────────────── 9. local secrets ─────────────────────────── */

check('.dev.vars', () => {
  const ignored = (read('.gitignore') ?? '').split('\n').some((l) => l.trim() === '.dev.vars');
  if (!existsSync(abs('.dev.vars'))) {
    if (!ignored) add('should', '.dev.vars is not listed in .gitignore', { hint: 'Add it, so local secrets can never be committed.' });
    return;
  }
  if (ignored) add('done', '.dev.vars found: local secrets for npm run preview (git-ignored, never deployed)');
  else add('must', '.dev.vars exists but is not git-ignored', { hint: 'Add .dev.vars to .gitignore so secrets are never committed.' });
});

/* ───────────────────── 10. accessibility statement ───────────────────── */

check('accessibility statement', () => {
  const reviewed = configValue(siteSrc, 'lastReviewed');
  if (typeof reviewed !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reviewed)) return;
  const days = (Date.now() - Date.parse(`${reviewed}T00:00:00Z`)) / 86_400_000;
  if (days > 365) {
    add('should', `The accessibility statement was last reviewed on ${reviewed}`, {
      hint: `Review it (src/data/legal.ts) and update accessibilityContact.lastReviewed in ${SITE}. Once a year is a good rhythm.`,
    });
  } else {
    add('done', `Accessibility statement reviewed on ${reviewed}`);
  }
});

/* ─────────────────────── 11. optional integrations ─────────────────────── */

check('optional integrations', () => {
  const optional = [
    ['turnstileSiteKey', 'Turnstile spam protection', 'remember the TURNSTILE_SECRET_KEY secret'],
    ['ga4', 'Google Analytics 4', 'consent banner shown automatically'],
    ['metaPixel', 'Meta Pixel', 'consent banner shown automatically'],
    ['googleReviews', 'Google reviews link', ''],
    ['schedulerUrl', 'online scheduler (Calendly / Cal.com)', ''],
  ];
  for (const [key, label, note] of optional) {
    const value = configValue(siteSrc, key);
    if (typeof value === 'string' && value.trim()) add('done', `${label} set${note ? ` (${note})` : ''}`);
    else if (key !== 'googleReviews' || !siteSrc.match(/googleReviews:.*TODO\(launch\)/)) optionalTodo.push(label);
  }
  if (wrangler) {
    const limiters = (wrangler.ratelimits ?? []).map((r) => r.name);
    if (limiters.length) add('done', `Rate limiting bindings: ${limiters.join(', ')}`);
    else optionalTodo.push('rate-limit bindings');
  }
});

/* ───────────────────────────── report ───────────────────────────── */

const out = [];
const rule = dim('─'.repeat(64));
out.push('', `  ${bold('📸 Moshik Photography · launch checklist')}`, `  ${rule}`);

const sections = [
  ['must', '❌', 'Must fix before launch', red, '✗'],
  ['should', '⚠️ ', 'Should review', yellow, '!'],
  ['done', '✅', 'Done', green, '✓'],
];
for (const [key, emoji, heading, color, mark] of sections) {
  const items = results[key];
  if (!items.length) continue;
  out.push('', `  ${emoji} ${bold(color(heading))} ${dim(`(${items.length})`)}`, '');
  for (const item of items) {
    out.push(`    ${color(mark)} ${key === 'done' ? item.title : bold(item.title)}`);
    for (const d of item.details) out.push(`        ${dim('·')} ${d}`);
    if (item.hint) out.push(`        ${cyan('→')} ${item.hint}`);
    if (key !== 'done') out.push('');
  }
}

if (optionalTodo.length) {
  out.push('', `  ${dim('Optional, not set up yet:')} ${optionalTodo.join(dim(' · '))}`, `  ${dim('How to add them: docs/DEPLOY.md → Optional integrations')}`);
}

const { must, should, done } = results;
out.push(
  '',
  `  ${rule}`,
  `  ${bold('Summary')}  ${red(`✗ ${must.length} must fix`)}   ${yellow(`! ${should.length} to review`)}   ${green(`✓ ${done.length} done`)}`,
  `  ${dim('Production secrets are not visible from here. Check them with: npx wrangler secret list')}`,
  `  ${dim('Guides: docs/CONTENT.md (what to change) · docs/DEPLOY.md (going live)')}`,
);
if (!must.length) out.push('', `  ${green(bold('Nothing blocks the launch. Mazal tov! 🎉'))}`);
else if (STRICT) out.push('', `  ${red('--strict: exiting with code 1 until the must-fix items are done.')}`);
out.push('');

console.log(out.join('\n'));
process.exit(STRICT && must.length ? 1 : 0);
