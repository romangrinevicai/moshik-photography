# Moshik · Wedding & Event Photography

The website of Moshik, an Israeli wedding and event photographer. It has three parts:

1. **A marketing site** in Hebrew (RTL, the default) and English.
2. **Private client galleries**, where guests find their own photos with a selfie. The face matching runs on the guest's own device.
3. **An admin panel** where Moshik uploads galleries, answers inquiries and manages his calendar.

Everything runs on **one Cloudflare Worker and one R2 bucket**. At this site's traffic, that fits in Cloudflare's free tier.

| Guide | For |
|---|---|
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Going live on Cloudflare, step by step, plus optional integrations, backups and troubleshooting |
| [`docs/CONTENT.md`](docs/CONTENT.md) | Changing texts, prices, photos, stories and SEO, and how placeholders work |
| [`docs/MOSHIK-GUIDE.he.md`](docs/MOSHIK-GUIDE.he.md) | Moshik's guide, in Hebrew: the admin panel, galleries, inquiries and tips |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Developer reference: API contract, R2 layout, upload and face pipelines |

---

## Feature tour

### Marketing site

- **Bilingual, Hebrew first.** Every page exists at `/page/` (Hebrew, RTL) and `/en/page/` (English, LTR). A language switcher keeps you on the same page.
- **Home page.** A full-screen hero slideshow with captions and pause/play, an intro, services, selected work, stats, featured stories, the process, testimonials, a showcase of the client gallery, a pricing teaser, FAQ and a date checker.
- **Portfolio.** A justified photo grid with category filters and a full-screen PhotoSwipe lightbox.
- **Service pages** for weddings, bar/bat mitzvahs, celebrations, couples, portraits and corporate work. Each has its own gallery, highlights, packages, add-ons and FAQ.
- **Stories.** Long-form case studies where text and photos alternate, with pull quotes and credits.
- **Pricing.** Package cards per category and an **interactive quote builder**: event type, then package, then add-ons, then a live estimate. The visitor can send the estimate on WhatsApp or carry it into the booking form. One switch hides all prices.
- **Booking form.** Four short steps with **live availability** for the chosen date, pre-filled from the quote builder or the URL. It saves the inquiry through the API. **If the API is unreachable, the form offers to send the same details on WhatsApp or by email**, so no lead is lost.
- **Date checker** on most pages. It gives an instant answer (free / almost full / booked) and shows the Hebrew calendar date.
- **WhatsApp everywhere.** A floating button with an **"available now" status** based on Moshik's working hours in Israel time, a mobile action bar (call / WhatsApp / check date) and pre-filled messages per page.
- **"Save contact"** downloads a vCard (`/moshik.vcf`).
- **Accessibility.** A built-in accessibility menu (text size, high contrast, highlighted links, readable font, stop animations, grayscale), keyboard navigation, visible focus and reduced-motion support. It ships with an **accessibility statement** written for Israeli Standard IS 5568, and a privacy policy.
- **SEO.** Canonical URLs, `hreflang` alternates, Open Graph and Twitter cards (images cropped to 1200×630 automatically) and JSON-LD (LocalBusiness, Service, FAQPage, Article, BreadcrumbList). There is also a sitemap and a `robots.txt` that keeps galleries and admin out of search engines.
- **Feel.** Cross-document view transitions, Lenis smooth scrolling, scroll reveals, a subtle film-grain overlay and a custom cursor on desktop. Photos are optimised at build time to AVIF/WebP in responsive sizes.
- **Analytics (optional).** Google Analytics 4 and/or Meta Pixel. They load only after the visitor accepts the cookie banner, and the banner appears only when an ID is set. Leads, WhatsApp clicks and calls are tracked as events.
- **Spam protection.** A hidden honeypot field, plus optional Cloudflare Turnstile.

### Client galleries (`/gallery`)

- **Private by link, code or QR.** Moshik shares a link such as `/gallery/?code=NOA-DANIEL-K7QM`, a short code, or a QR code printed on table cards. Galleries are not indexed by search engines.
- **Viewing.** A full-screen lightbox, sets, a cover and a personal message. **Live galleries** show new photos while the event is still going on.
- **Favourites and album selection.** Clients mark photos with a heart and send their album selection to Moshik with one tap.
- **ZIP downloads**, in web or original quality, split into parts for large galleries. Moshik can turn downloads on or off per gallery.
- **People.** Photos are grouped by the people in them. **"Find me"** works with a selfie: the face is analysed **on the guest's device**, only 128 anonymous numbers are compared, and the selfie is never uploaded or stored.
- **Sharing** on WhatsApp or with a QR code. Galleries can also have an expiry date.

### Admin panel (`/admin`)

- Password login with a 14-day session.
- **Galleries.** Create, edit, set the code, cover and message, choose draft / published / archived, and set options (downloads, originals, face search, live, expiry).
- **Uploads with resizing in the browser.** Photos are resized to web and thumbnail sizes before upload. Keeping the originals is optional.
- **Face analysis** runs in Moshik's browser, then the people albums and the selfie search are published with the gallery.
- **Sharing tools.** A ready-made WhatsApp message, a QR code and table cards for events.
- **Album selections** sent by clients.
- **Inquiries inbox.** Every booking request, with status (new / contacted / booked / lost), notes and a **one-tap WhatsApp reply**. Optional alerts arrive by email (Resend) or Telegram.
- **Availability calendar.** Booked and almost-full dates feed the date checker and the booking form instantly.

---

## Tech stack

| Layer | Tech |
|---|---|
| Site | [Astro 7](https://astro.build) (static output), TypeScript, no UI framework, small vanilla TS scripts |
| Hosting | One Cloudflare Worker. It serves `dist/` as static assets and handles `/api/*` and `/media/*` |
| Storage | Cloudflare R2 (binding `BUCKET`): galleries, photos, face data, inquiries, settings |
| Images | `astro:assets` + sharp at build time. Gallery photos are resized in the admin's browser |
| Face AI | [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) (TensorFlow.js), running in the browser only |
| UI libraries | PhotoSwipe 5 (lightbox), Lenis (smooth scroll), uqr (QR codes), self-hosted variable fonts (Frank Ruhl Libre, Assistant, Cormorant Garamond) |
| Notifications | Resend (email) and the Telegram Bot API, both optional |
| Tooling | Wrangler 4, Vitest, `astro check`, GitHub Actions |

---

## Quick start

You need **Node.js 22.12 or newer** (`node -v`) and npm.

```bash
npm install
npm run dev            # http://localhost:4321, the site with hot reload
```

`npm run dev` serves the site only. The API is not running, so the booking form shows its WhatsApp/email fallback, the calendar uses the sample dates in `src/data/availability.ts`, and galleries and the admin panel cannot load data.

To run the **whole thing** locally (API, galleries, admin, with a simulated R2 bucket):

```bash
cp .dev.vars.example .dev.vars   # then edit: ADMIN_PASSWORD, SESSION_SECRET
npm run preview                  # builds, then starts the Worker at http://localhost:8787
```

Wrangler reads `.dev.vars` automatically. Local R2 data is kept in `.wrangler/state/`. Both are git-ignored. Log in at `http://localhost:8787/admin/` with the password from `.dev.vars`.

> The first build optimises every photo, which takes about 2 minutes. Later builds reuse the cache in `node_modules/.astro` and are much faster.

---

## Project structure

```
.
├── src/
│   ├── config/site.ts        ← Moshik's details, feature switches, integration IDs
│   ├── data/                 ← page copy: services, packages, stories, testimonials, FAQ, legal…
│   ├── assets/photos/        ← marketing photos: hero/, portfolio/<category>/, stories/<slug>/, about/
│   ├── i18n/                 ← he/en helpers and short UI strings
│   ├── views/                ← one view per page, rendered for both languages
│   ├── pages/                ← routes: Hebrew at /, English under /en/ (incl. /gallery and /admin)
│   ├── components/           ← layout/, sections/, ui/, booking/
│   ├── scripts/              ← browser code: core, lightbox, availability, faces/…
│   ├── shared/               ← shared by browser and Worker: types, CRC-32, face codec, icons
│   ├── layouts/BaseLayout.astro
│   └── styles/               ← design tokens and fonts
├── worker/                   ← the Cloudflare Worker: API + private media
├── public/                   ← favicons, web manifest, film-grain texture
├── scripts/
│   ├── launch-checklist.mjs  ← npm run checklist
│   └── placeholders/         ← generator + fingerprints of the sample photos
├── photos-inbox/             ← drop zone for Moshik's photos before they are sorted
├── docs/                     ← ARCHITECTURE, DEPLOY, CONTENT, MOSHIK-GUIDE.he
├── .github/workflows/ci.yml  ← type check, tests, build, checklist
├── astro.config.mjs          ← site URL, sitemap, build options
└── wrangler.jsonc            ← Worker config: assets, R2 bucket, vars
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server with hot reload (site only, no API) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Build, then run the real Worker locally with Wrangler (API, galleries, admin, local R2) |
| `npm run deploy` | Build and deploy to Cloudflare (`astro build && wrangler deploy`) |
| `npm run check` | Type-check the site (`astro check`) and the Worker (`tsc`) |
| `npm test` | Unit tests (Vitest) |
| `npm run checklist` | Pre-launch report: placeholders, sample content, missing settings. Add `-- --strict` to exit with code 1 while must-fix items remain |

CI (`.github/workflows/ci.yml`) runs `check`, `test` and `build`, then the checklist in report-only mode on every push and pull request. The checklist also appears on the run's summary page.

---

## Edit content

Almost everything you will want to change is in **two places**:

- `src/config/site.ts`: phone, WhatsApp, email, social links, working hours, stats, prices on/off, analytics IDs.
- `src/data/*.ts`: packages and prices, services, stories, testimonials, FAQ, home and about copy, legal pages.

Photos are files in `src/assets/photos/`. The site picks them up automatically, sorted by file name.

Placeholder values are marked `TODO(launch)`, and sample entries have `sample: true`. Run **`npm run checklist`** to see what still needs real content.

**Full guide: [`docs/CONTENT.md`](docs/CONTENT.md).**

## Deploy

In short:

1. Create a Cloudflare account and run `npx wrangler login`.
2. Create the bucket: `npx wrangler r2 bucket create moshik-photography`.
3. Set the real domain: change the `SITE_URL` fallback in `astro.config.mjs` and `vars` in `wrangler.jsonc`.
4. Deploy: `npm run deploy`.
5. Set the admin secrets: `npx wrangler secret put ADMIN_PASSWORD` and `SESSION_SECRET`.
6. Add the custom domain in the Cloudflare dashboard.

**Full guide, including Git-connected auto-deploys and all optional integrations: [`docs/DEPLOY.md`](docs/DEPLOY.md).**

### Preview on GitHub Pages

Every push also publishes a static preview to <https://romangrinevicai.github.io/moshik-photography/> through [`.github/workflows/pages.yml`](.github/workflows/pages.yml). It needs a one-time switch in the repository: **Settings → Pages → Source: GitHub Actions**.

The preview has no Cloudflare backend. It is built with `BASE_PATH=/moshik-photography` (the site lives under a sub-path) and `PUBLIC_STATIC_SITE=1`. In that mode:

- the booking form goes straight to its WhatsApp / email fallback;
- the availability calendar uses the sample dates in `src/data/availability.ts`;
- the admin panel shows a notice instead of the login;
- every page is `noindex` and shows the "Preview" tag.

To try the same build locally: `BASE_PATH=/moshik-photography PUBLIC_STATIC_SITE=1 npm run build`, then serve the folder that contains `dist/` renamed to `moshik-photography/`.

---

## Costs

Running the site costs nothing except the domain.

| Service | Free allowance | Used for |
|---|---|---|
| Cloudflare Workers | **100,000 requests/day** | API calls and gallery images (`/api/*`, `/media/*`) |
| Workers static assets | **Free and unlimited** | Every marketing page, photo, script and font |
| Cloudflare R2 | **10 GB storage/month, zero egress fees**, 1M write / 10M read operations per month | Galleries, face data, inquiries, calendar |
| Resend (optional) | About 3,000 emails/month (100/day) at the time of writing | Inquiry notification emails |
| Telegram, Turnstile, GA4, Meta Pixel | Free | Optional alerts, spam protection, analytics |
| GitHub + Actions | Free (2,000 CI minutes/month for private repos) | Code hosting and CI |
| Domain | About ₪50–100/year for a `.co.il` domain | The only real cost |

What fits in 10 GB: a web-quality gallery photo plus its thumbnail is roughly 0.5–1 MB, so a 1,000-photo wedding takes about 1 GB. If Moshik also keeps full-resolution originals for download, a gallery can take several GB. Past 10 GB, R2 costs about $0.015 per GB per month: 100 GB is about $1.35/month.

If traffic ever grows beyond the Workers free tier, **Workers Paid is $5/month** (10 million requests). You switch it on in the dashboard, and no code changes.

---

## FAQ for maintainers

**Where do I change the phone number, prices, texts or photos?**
See [`docs/CONTENT.md`](docs/CONTENT.md). Settings are in `src/config/site.ts`, copy is in `src/data/`, and photos are in `src/assets/photos/`.

**The booking form says it couldn't send and offers WhatsApp. Is something broken?**
That is the fallback for when `/api/inquiry` is unreachable. With `npm run dev` it is expected, because no Worker is running; use `npm run preview`. In production, check the Worker logs: Cloudflare dashboard → Workers & Pages → `moshik-photography` → Logs, or `npx wrangler tail`. Then see [Troubleshooting](docs/DEPLOY.md#troubleshooting).

**Where are inquiries stored?**
As JSON files in R2 under `leads/`. Moshik sees them in the admin inbox. Email and Telegram alerts are optional extras on top.

**How do I change the admin password, or log everyone out?**
Run `npx wrangler secret put ADMIN_PASSWORD` with the new password. Existing sessions stay valid until they expire (14 days). To end all sessions now, also put a new `SESSION_SECRET`.

**Will the free tier be enough on a busy day?**
The marketing site is static assets, which are free and unlimited. Only API calls and gallery images count toward the 100,000 requests/day. A guest scrolling through a gallery loads many thumbnails, so a huge gallery shared with hundreds of guests on the same day can come close to the limit. If that happens, switch on Workers Paid ($5/month).

**How many portfolio photos can the site hold?**
Each marketing photo becomes about 20 optimised files (sizes × AVIF/WebP). The free plan allows **20,000 static files per deployment**, so keep the curated portfolio under roughly 800 photos. Client galleries live in R2 and don't count.

**Can I add a page?**
Create a view in `src/views/` that takes `lang`, and two 3-line route files: `src/pages/x.astro` and `src/pages/en/x.astro`. Add it to `src/data/nav.ts` if it belongs in the menu. Follow the conventions in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): logical CSS properties for RTL, `{ he, en }` strings, and design tokens.

**Can I add a service?**
Add an entry to `src/data/services.ts`, a photo folder `src/assets/photos/portfolio/<slug>/`, and a pricing category with the same id in `src/data/packages.ts`. Routes, menus, the portfolio filter, the booking form and the sitemap pick it up automatically.

**Is face search legal and private?**
The selfie never leaves the guest's device. Only a 128-number descriptor is sent, compared with that one gallery, and not stored. Face data of gallery photos is stored with that gallery only and is deleted with it. The privacy policy (`src/data/legal.ts`) explains this in both languages. Have a lawyer review it before launch. Moshik can delete a gallery's face data at any time, and can turn face search off per gallery.

**Can the site run without the Worker (e.g. on a static host)?**
The marketing site works. The booking form falls back to WhatsApp/email, and the calendar uses `src/data/availability.ts`. Galleries and the admin panel need the Worker and R2. Setting `features.clientGalleries` to `false` removes the gallery link from the header.

**What do I run before pushing?**
`npm run check && npm test && npm run build`, which is the same as CI. `npm run checklist` shows what still blocks the launch.

**What should I never commit?**
`.dev.vars`, `.env` and any API keys. They are git-ignored. Production secrets live only in Cloudflare (`npx wrangler secret list`).

---

## Suggested upgrades

These ideas need an account, an API key or a decision from you (Roman), so they are not built in yet.

| Upgrade | What it adds | What it needs from you | Effort |
|---|---|---|---|
| **Real Google reviews** | Live star rating and the latest reviews, instead of hand-copied testimonials | A Google Cloud project with the Places API enabled, an API key, the business's Place ID. Fetch at build time or cache in the Worker, so the key stays private and costs stay near zero | M |
| **Instagram feed** | The latest posts on the home page | An Instagram Business/Creator account linked to a Facebook Page, a Meta app, and a long-lived Graph API token (refresh it every 60 days, e.g. from a scheduled Worker) | M |
| **AWS Rekognition face matching** | Even more accurate matching for group shots and profiles | An AWS account, IAM keys and a region; about $1 per 1,000 photos indexed. **Trade-off:** selfies would then leave the device, so update the privacy policy and ask for consent | L |
| **WhatsApp Business auto-replies** | Instant answers, booking-link replies and templates | No-code option: the free WhatsApp Business app's greeting and away messages. API option: a Meta Business account, a dedicated number, a Cloud API token and approved templates (paid per conversation) | S–L |
| **Cal.com / Calendly booking** | Self-service intro calls | An account and an event link. `schedulerUrl` already exists in `src/config/site.ts`; showing it on the contact and thank-you pages is a small change | S |
| **CMS so Moshik edits texts himself** | A friendly web editor for copy, prices and stories | Choose Keystatic or Decap. Move the copy from `src/data/*.ts` into content files, set up GitHub sign-in (Keystatic GitHub App, or an OAuth proxy for Decap), and let Workers Builds deploy on each save | L |
| **Print and album store** | Clients order prints or albums from their favourites | A payment provider (e.g. Stripe, or an Israeli one such as Cardcom, Tranzila or Grow), a print lab, prices and business details for invoices | L |
| **Russian version** | A third language for a large audience | Native-speaker translations. Technically: add `ru` to `languages` in `src/i18n/index.ts` (TypeScript then lists every missing translation), add `src/pages/ru/`, the sitemap locale, a three-way language switcher and Cyrillic font subsets | M–L |
| **Ads tracking with conversions** | Measure which ads bring real leads | GA4 key event `generate_lead`, a Google Ads conversion ID and/or the Meta Pixel. Optionally the Meta Conversions API from the Worker (an access token) for iOS and ad-block resilience. The consent banner is already in place | S–M |
| **Blog and SEO landing pages** | Rank for searches like "wedding photographer in Tel Aviv" or "photographer at a specific venue" | Moshik's content and real photos per venue or city. Build it with Astro content collections, internal links and JSON-LD | M |

Effort: **S** about half a day, **M** one to three days, **L** a week or more.
