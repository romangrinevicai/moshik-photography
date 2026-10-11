# Architecture & API contract

Developer reference for the Moshik photography site. Everything here is the
**contract** shared by the Worker API, the client gallery and the admin panel.

## Stack

| Layer | Tech |
|---|---|
| Site | Astro 7 (static output), TypeScript, no UI framework; vanilla TS islands via `<script>` |
| Hosting | One Cloudflare Worker: serves `./dist` as static assets + handles `/api/*` and `/media/*` (`wrangler.jsonc`) |
| Storage | Cloudflare R2 bucket (binding `BUCKET`): galleries, photos, face data, leads, settings |
| Images | Marketing photos optimised at build time (`astro:assets`, AVIF/WebP). Gallery photos resized **in the admin's browser** before upload |
| Face AI | `@vladmandic/face-api` (TF.js) running **in the browser** — admin computes face descriptors; guests' selfies never leave their device |
| Lightbox | PhotoSwipe 5 |
| Smooth scroll | Lenis |

## Directory map

```
src/
  config/site.ts          ← Moshik's details (phone, WhatsApp, socials, prices on/off…)
  i18n/                   ← he/en helpers + short UI strings (ui.ts)
  data/                   ← page copy & content (services, packages, stories, faq…)
  shared/                 ← code shared by browser + Worker (types, crc32, face codec, icons)
  components/             ← layout/, ui/, sections/, booking/
  layouts/BaseLayout.astro
  views/                  ← one view per page, rendered by thin route files
  pages/                  ← Hebrew routes at /, English under /en/
  scripts/                ← client-side TS (core.ts, lightbox.ts, availability.ts…)
  styles/global.css       ← design tokens & base styles
worker/                   ← Cloudflare Worker (API)
scripts/                  ← dev tooling (placeholder generator, checklist…)
```

## Front-end conventions (must follow)

- **Bilingual**: every page exists at `/x/` (Hebrew, RTL, default) and `/en/x/`. Views take `lang: 'he' | 'en'`.
  Route files are 3 lines: import the view, render `<View lang="he" />`.
- **Strings**: keep page/app-specific copy in the view or script as `{ he, en }` objects. Do **not** grow
  `src/i18n/ui.ts`. Pass strings to client scripts through a `data-*` JSON attribute or a
  `<script type="application/json">` tag.
- **RTL**: use logical CSS properties only (`margin-inline-start`, `inset-inline-end`, `padding-block`…).
  Directional icons get `class="flip-rtl"` (or handled by `.icon--arrow`).
- **Styling**: use tokens from `global.css` (`--paper`, `--ink`, `--gold`, `--accent`, `--rule`, `--font-display`,
  `--font-body`, `--fs-*`, `--ease-out`…). Scoped `<style>` per component; reference outside ancestors with
  `:global(...)` (e.g. `:global([dir='rtl']) .x`). Dark sections use class `on-noir`. Buttons: `.btn`, `.btn--solid`,
  `.btn--gold`, `.btn--light`, `.btn--sm|lg|block`. Text link: `.link`. Forms: `.field`, `.field__label`, `.input`,
  `.select`, `.textarea`, `.field__error`.
- **Icons**: `<Icon name="…" />` in Astro; `iconSvg('name', { size })` from `~/shared/icons` in client code.
  Available names are the keys of `src/shared/icon-data.ts`.
- **Layout**: app-like pages (gallery, admin) use `<BaseLayout chrome="minimal" noindex alternates={false}>` and
  render their own small header. `[hidden]` is forced to `display:none`.
- **Accessibility**: keyboard reachable, visible focus, labelled controls, focus-trapped modals, `aria-live` for async
  status, honour `prefers-reduced-motion` (and `html.a11y-motion`).
- **Shared files are owned by the lead**: don't edit `global.css`, `ui.ts`, `BaseLayout.astro`, `config/site.ts`,
  `shared/gallery-types.ts`. Add new files instead; mention needed changes in your report.

## URLs

| URL | Purpose |
|---|---|
| `/gallery/?code=NOA-DANIEL-K7QM` | Share link Moshik sends (auto-opens the gallery) |
| `/gallery/?g={galleryId}` | Direct gallery URL (after code entry the page switches to this) |
| `/gallery/` | Code entry screen |
| `/admin/` | Admin panel (password) |
| `/media/{gid}/{pid}/thumb` | ≈640 px long edge JPEG |
| `/media/{gid}/{pid}/web` | ≈2048 px long edge JPEG (lightbox) |
| `/media/{gid}/{pid}/original` | original file (only if `allowOriginals`, or admin) |
| `…?dl=1` | same, served as an attachment download (requires `allowDownload`) |
| `/media/{gid}/people/{personId}` | ≈192 px square JPEG face crop |

All English pages mirror under `/en/…` (`/en/gallery/`, `/en/admin/`). Media/API URLs are language-neutral.

## API

JSON in/out. Errors: HTTP status + `{ ok: false, error: string, code?: string }`.
Types referenced below live in `src/shared/gallery-types.ts`.

### Public

| Method & path | Body | Response |
|---|---|---|
| `GET /api/availability` | – | `Availability` (`{ booked: string[], limited: string[] }`, dates `YYYY-MM-DD`) |
| `POST /api/inquiry` | booking payload (see `src/components/booking/booking.ts`) | `{ ok: true, id }` · 400 `invalid` · 429 `rate_limited` · 403 `captcha` · 503 `unavailable` |
| `POST /api/gallery/access` | `{ code }` | `{ ok: true, id, title }` · 404 `not_found` · 410 `expired` · 429 `rate_limited` |
| `GET /api/gallery/{gid}` | – | `{ ok: true, gallery: GalleryManifest }` · 404 · 410 `expired` · 403 `draft` |
| `POST /api/gallery/{gid}/faces/search` | `{ descriptor: number[128] }` | `{ ok: true, matches: FaceSearchMatch[] }` (one per photo, closest first) · 404 `no_faces` |
| `POST /api/gallery/{gid}/selections` | `{ name, email?, phone?, note?, photoIds: string[] }` | `{ ok: true, id }` |
| `GET /api/gallery/{gid}/zip?variant=web\|original&part=N` | – | `application/zip` stream of photos `(N-1)*ZIP_PART_SIZE … N*ZIP_PART_SIZE-1` (1-based part), `Content-Length` set |
| `GET /api/gallery/{gid}/zip?variant=…&ids=a,b,c` | – | ZIP of the listed photos (≤ `ZIP_PART_SIZE`) |

Notes
- Gallery access is **capability-based**: knowing the gallery id (16 random chars) or the code grants viewing.
  Drafts and expired galleries are refused unless the request carries an admin session.
- Number of ZIP parts = `ceil(photos.length / ZIP_PART_SIZE)`; byte sizes per photo are in the manifest
  (`webSize` / `origSize`) so the UI can show “Part 1 · 1.2 GB”.
- Face search: the browser computes the selfie descriptor; only the 128 numbers are sent. Threshold
  `FACE_MATCH_THRESHOLD` (0.5).

### Admin (session cookie `mp_admin`)

Every **mutating** request (POST/PUT/PATCH/DELETE) must send `X-Requested-With: moshik-admin`.
Use `fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'moshik-admin' } })`.

| Method & path | Body | Response |
|---|---|---|
| `POST /api/admin/login` | `{ password }` | `{ ok: true }` + cookie · 401 `bad_password` · 429 · 503 `not_configured` |
| `POST /api/admin/logout` | – | `{ ok: true }` |
| `GET /api/admin/session` | – | `{ ok: true }` · 401 |
| `GET /api/admin/galleries` | – | `{ ok: true, galleries: GalleryRecord[] }` newest first |
| `POST /api/admin/galleries` | `{ title, subtitle?, date?, lang?, code? }` | `{ ok: true, gallery: GalleryRecord }` · 409 `code_taken` |
| `GET /api/admin/galleries/{gid}` | – | `{ ok: true, gallery: GalleryRecord, photos: PhotoMeta[], manifestVersion: number \| null, faces: { faces: number, people: number } \| null }` |
| `PATCH /api/admin/galleries/{gid}` | partial `GalleryRecord` (title, subtitle, date, lang, code, status, coverPhotoId, allowDownload, allowOriginals, faceSearch, live, expiresAt, message, externalUrl, sets) | `{ ok: true, gallery }` · 409 `code_taken` |
| `DELETE /api/admin/galleries/{gid}` | – | `{ ok: true, deleted: number }` |
| `PUT /api/admin/galleries/{gid}/photos/{pid}/{thumb\|web\|original}` | raw image bytes; `Content-Type`; for `web` also header `X-Photo-Meta: encodeURIComponent(JSON.stringify(meta))` (PhotoMeta without id; must include `w`,`h`; optional on other variants) | `{ ok: true, size }` · max 100 MB |
| `DELETE /api/admin/galleries/{gid}/photos/{pid}` | – | `{ ok: true }` |
| `PATCH /api/admin/galleries/{gid}/photos` | `{ ids: string[], set: string }` (`''` = no chapter) | `{ ok: true, moved }` — then publish |
| `POST /api/admin/galleries/{gid}/publish` | `{ status?: 'published' \| 'draft' }` | `{ ok: true, manifest: GalleryManifest }` (rebuilds the public manifest from stored photos + faces/people) |
| `PUT /api/admin/galleries/{gid}/faces/index` | `FaceIndex` JSON (≤ 8 MB) | `{ ok: true }` |
| `PUT /api/admin/galleries/{gid}/faces/descriptors` | `application/octet-stream` (see face codec) | `{ ok: true }` |
| `PUT /api/admin/galleries/{gid}/faces/people` | `{ people: Person[] }` | `{ ok: true }` |
| `PUT /api/admin/galleries/{gid}/people/{personId}` | `image/jpeg` crop | `{ ok: true }` |
| `DELETE /api/admin/galleries/{gid}/faces` | – | `{ ok: true }` (removes face data + crops) |
| `GET /api/admin/galleries/{gid}/selections` | – | `{ ok: true, selections: Selection[] }` |
| `GET /api/admin/leads?cursor=…` | – | `{ ok: true, leads: Lead[], cursor?: string }` newest first |
| `PATCH /api/admin/leads/{id}` | `{ status?: LeadStatus, notes?: string }` | `{ ok: true, lead }` |
| `DELETE /api/admin/leads/{id}` | – | `{ ok: true }` |
| `GET /api/admin/availability` | – | `Availability` |
| `PUT /api/admin/availability` | `{ booked: string[], limited: string[] }` | `{ ok: true }` |

Admin-side media: an admin session can also read drafts and originals through `/media/…`.

### Upload pipeline (admin browser)

1. `createImageBitmap(file, { imageOrientation: 'from-image' })` (EXIF rotation applied).
2. Draw to canvas → `web` JPEG (long edge 2048, q≈0.86) and `thumb` JPEG (long edge 640, q≈0.8).
3. Photo id: 16 random base62 chars (`crypto.getRandomValues`), must match `ID_RE`.
4. CRC-32 + size of each stored variant (`src/shared/crc32.ts`) → `webCrc/webSize`, `origCrc/origSize`, `origExt`.
5. Upload `thumb`, then `original` (when kept), then `web` **last** with `X-Photo-Meta`
   (a photo "exists" once its `web` object exists).
6. When done → `POST …/publish` to refresh the public manifest.

### Face data

- Models served from `/models/face-api/` (copied from `node_modules/@vladmandic/face-api/model` at dev/build time).
- Descriptors: 128-d, stored with `src/shared/face-codec.ts` (`encodeDescriptors` / `decodeDescriptors`).
- `FaceIndex.faces[i]` ↔ descriptor `i`: `{ p: photoId, b: [x, y, w, h] normalised 0–1, s: score }`.
- People = clusters of faces across photos (only people seen in ≥ 2 photos), stored via `…/faces/people`,
  each with a crop uploaded to `…/people/{personId}`.

## R2 layout

```
galleries/{gid}/gallery.json              GalleryRecord (admin source of truth)
galleries/{gid}/manifest.json             GalleryManifest (public, rebuilt on publish)
galleries/{gid}/photos/{pid}/thumb|web|original
galleries/{gid}/faces/index.json | descriptors.bin | people.json
galleries/{gid}/people/{personId}         face crops
galleries/{gid}/selections/{id}.json      client album selections
codes/{NORMALISEDCODE}.json               { galleryId }
leads/{invertedTimestamp}-{rand}.json     Lead
settings/availability.json                Availability
```
