# Editing content

How to change texts, prices, photos and settings on the marketing site. Everything here lives in plain files in the repository, and there is no database for the marketing site. The things Moshik manages himself in **/admin** (galleries, inquiries, the availability calendar) are covered in [`MOSHIK-GUIDE.he.md`](MOSHIK-GUIDE.he.md).

| I want to change… | File |
|---|---|
| Phone, WhatsApp, email, social links, working hours, stats | [`src/config/site.ts`](../src/config/site.ts) |
| Prices, packages, add-ons, hide prices | [`src/data/packages.ts`](../src/data/packages.ts) (+ `pricing.showPrices` in `site.ts`) |
| Service pages (weddings, bar mitzvah…) | [`src/data/services.ts`](../src/data/services.ts) |
| Stories (case studies) | [`src/data/stories.ts`](../src/data/stories.ts) + `src/assets/photos/stories/<slug>/` |
| Testimonials | [`src/data/testimonials.ts`](../src/data/testimonials.ts) |
| FAQ | [`src/data/faq.ts`](../src/data/faq.ts) |
| Home page copy, about page, "how it works" | [`src/data/home.ts`](../src/data/home.ts), [`about.ts`](../src/data/about.ts), [`process.ts`](../src/data/process.ts) |
| Photos | `src/assets/photos/…` ([section 8](#8-photos)) |
| Accessibility statement and privacy policy | [`src/data/legal.ts`](../src/data/legal.ts) |
| Page titles and descriptions for Google | [section 10](#10-seo-texts) |
| Short interface labels (menu, buttons) | [`src/i18n/ui.ts`](../src/i18n/ui.ts) |

---

## How editing works

Texts are stored as pairs, one per language:

```ts
title: { he: 'חתונות', en: 'Weddings' },
```

**Rules that keep the build happy:**

- Keep the quotes and the comma at the end of each line. A missing quote is the most common error, and `npm run dev` points at the exact line.
- Strings use straight single quotes `'…'`. Inside them:
  - English apostrophes: use the typographic `’` (as the existing copy does), or write `\'`.
  - Hebrew geresh and gershayim: use the Hebrew characters `׳` and `״` (as in `צ׳ק`, `תשע״ג`), never a plain `'`.
- In headlines, `*word*` is shown in the accent style (italic, gold), e.g. `'החתונה שלכם, *כמו שהרגשתם אותה*'`. In the home hero title, `|` starts a new line.
- Lists are written as `['first', 'second']`.
- Every text needs **both** `he` and `en`. If one is missing, `npm run check` names the file and line.

**See your change:** run `npm run dev` and open <http://localhost:4321> (Hebrew) or <http://localhost:4321/en/> (English). The page reloads as you save.

**Editing on GitHub:** open the file on github.com, click the ✏️ pencil, edit it and click **Commit changes**. CI checks the build. If Workers Builds is connected, the site deploys by itself a few minutes later ([DEPLOY.md, step 9](DEPLOY.md#9-optional-deploy-automatically-from-github-workers-builds)).

### Placeholders: `TODO(launch)` and `sample: true`

The template ships with believable placeholder content so the design can be judged. All of it is marked:

| Marker | Meaning | What to do |
|---|---|---|
| `// TODO(launch)` at the end of a line | This value is a placeholder | Put the real value in, then **delete the comment** |
| `TODO(launch)` in a comment at the top of a file | The copy in this file is a template | Personalise it, then delete the note |
| `sample: true` on a story or testimonial | Invented sample entry | Replace it with a real one, or delete it |
| The photos in `src/assets/photos/` | Generated abstract images | Replace them with real photos ([section 8](#8-photos)) |

`npm run checklist` lists every remaining marker with its file and line ([section 11](#11-the-placeholder-system-and-npm-run-checklist)).

---

## 1. Moshik's details: `src/config/site.ts`

| Setting | Example | Where it shows |
|---|---|---|
| `brand` | `'MOSHIK'` | The logo wordmark |
| `name` | `{ he: 'מושיק', en: 'Moshik' }` | Page titles ("… \| מושיק — …"), footer, social previews, structured data |
| `fullName` | `{ he: 'מושיק כהן', en: 'Moshik Cohen' }` | Author tag, structured data for Google (founder, article author), the vCard |
| `tagline` | `{ he: 'צילום חתונות ואירועים', … }` | Page titles, social previews, structured data |
| `since` | `2012` | "Years behind the camera" counter |
| `contact.whatsapp` | `'972541234567'` | All WhatsApp links. **International format, digits only**, no `+`, no leading `0` |
| `contact.phone` | `'+972541234567'` | Tap-to-call links |
| `contact.phoneDisplay` | `'054-123-4567'` | The number as people read it |
| `contact.email` | `'hello@moshik-photo.co.il'` | Contact page, footer, the form's email fallback, legal pages |
| `social.*` | `'https://www.instagram.com/moshik.photo'` | Footer, contact page, structured data. **An empty string `''` hides the link everywhere** |
| `social.googleReviews` | Google Maps link to the profile | "Read all reviews on Google" and the hero rating ([DEPLOY 10e](DEPLOY.md#10e-google-reviews-link)) |
| `schedulerUrl` | Calendly / Cal.com link | Reserved for an online scheduler (not shown on pages yet) |
| `location.base`, `serviceArea` | `'Based in Central Israel'` | Footer and contact page |
| `location.address`, `waze`, `googleMaps` | `null` / links | Only when there is a studio to visit |
| `hours.schedule` | `0: ['09:00', '21:00']` (0 = Sunday … 6 = Saturday) | The **"available now"** dot on the WhatsApp button (Israel time). Leave a day out to show "usually replies within an hour" all day |
| `hours.replyTime` | `{ he: 'בדרך כלל עונה תוך שעה', … }` | Shown next to WhatsApp outside working hours |
| `stats.*` | `events: 650`, `rating: '5.0'`, `reviews: 140` | Home page counters and hero rating. **Use real numbers only** |
| `pricing.showPrices` | `true` / `false` | `false` hides every price and shows "personal quote" instead |
| `pricing.includesVat` | `true` | Shows "prices include VAT". Israeli consumer law requires consumer prices to include VAT |
| `integrations.*` | Turnstile site key, GA4 ID, Meta Pixel ID | See [DEPLOY.md, section 10](DEPLOY.md#10-optional-integrations) |
| `features.clientGalleries` | `true` | `false` removes the "client gallery" link from the header menu (e.g. when hosting without the Worker) |
| `features.accessibilityMenu` | `true` | The floating accessibility menu |
| `accessibilityContact` | name + `lastReviewed: '2026-10-11'` | The accessibility statement. Update the date when you review it |

## 2. Prices: `src/data/packages.ts`

Prices are grouped in **categories**. Each category's `id` matches a service slug (`weddings`, `bar-bat-mitzvah`, `events`, `couples`, `portraits`, `corporate`). Each category has **tiers** (packages) and a list of **add-ons**.

```ts
{
  id: 'signature',
  name: { he: 'Signature', en: 'Signature' },
  price: 8900,                                     // ₪, including VAT
  unit: { he: 'יום מלא', en: 'full day' },          // small line under the price
  description: { he: '…', en: '…' },
  features: { he: ['…', '…'], en: ['…', '…'] },    // bullet list, same order in both languages
  popular: true,                                   // "most popular" badge (one per category)
},
```

- **Add-ons** are defined once, in the `addons` list, and each category picks the ones it offers by id (`addons: ['second-shooter', 'album', …]`). For things sold per unit (e.g. an extra hour), set `perUnit` and `maxQty`; the quote builder then shows a quantity picker.
- **"From ₪…"** on service cards and pages is calculated automatically from the cheapest tier.
- The **quote builder** and the **booking form** read the same data, so there is nothing else to update.
- **Hiding prices:** set `pricing.showPrices: false` in `site.ts`. Cards show "personal quote", the quote builder works without amounts, and structured data omits prices.
- When the real prices are in, delete the `TODO(launch)` note at the top of the file.

## 3. Services: `src/data/services.ts`

| Field | Notes |
|---|---|
| `slug` | Part of the URL (`/services/weddings/`). **Avoid changing it after launch**, because old links and Google results would break |
| `icon` | Any key of `src/shared/icon-data.ts` |
| `portfolio` | Photo folder for this service's gallery, e.g. `'portfolio/weddings'` |
| `cover` | Card and hero photo, e.g. `'portfolio/weddings/01.jpg'` (must exist) |
| `title`, `summary`, `headline`, `intro`, `body`, `highlights` | Page copy. `body` is a list of paragraphs |
| `pricing` | The category id in `packages.ts` |
| `seo` | Google title and description ([section 10](#10-seo-texts)) |

**To add a service:**

1. Add an entry to `services.ts`.
2. Create `src/assets/photos/portfolio/<slug>/` with photos, including `01.jpg` if you use it as the cover.
3. Add a pricing category with the same `id` in `packages.ts`.

Routes, menus, the portfolio filter, the booking form and the sitemap pick it up automatically.

## 4. Stories: `src/data/stories.ts`

A story is a case study: text and photos from one event.

| Field | Notes |
|---|---|
| `slug` | Latin letters and dashes; becomes `/stories/<slug>/` and the photo folder name |
| `service` | Service slug, used for the label and related links |
| `title`, `subtitle`, `location`, `excerpt` | The excerpt is also the Google description |
| `date` | `'2025-09'` (year-month) |
| `body` | Paragraphs. A paragraph starting with `> ` becomes a large pull quote |
| `credits` | Optional: venue, planner, etc. |

**To add a story:**

1. Ask the couple for permission to publish.
2. Create `src/assets/photos/stories/<slug>/` with 8–20 photos named `01.jpg`, `02.jpg`, … The first photo is the cover; the rest are placed between the paragraphs in order.
3. Add the entry to `stories.ts`, without `sample: true`.
4. Check it with `npm run dev`: `/stories/<slug>/`.

**To remove a sample story:** delete its entry **and** its photo folder. A story without photos breaks the build, and `npm run checklist` warns about it.

> The home page section that shows off the client gallery borrows photos from `stories/noa-and-daniel/`. When that sample folder is gone, the section falls back to wedding photos automatically. It also shows a small mock-up with sample names (`home.gallery.mock` in `home.ts`), which you can personalise.

## 5. Testimonials: `src/data/testimonials.ts`

- Use **real reviews only**, with the client's permission (e.g. copied from Google or Facebook). Never publish invented reviews.
- `service` (optional) also shows the review on that service's page.
- `photo` (optional) is a photo id such as `'portfolio/weddings/01.jpg'` and must exist.
- Remove `sample: true` from real entries, and delete the remaining samples.

## 6. FAQ: `src/data/faq.ts`

Each question has `topics`, which decide where it appears:

| Page | Shows questions tagged |
|---|---|
| FAQ page | Questions tagged `booking`, `day`, `delivery` or `gallery`, grouped by those topics |
| Home page | `general` or `booking` (first 6) |
| Contact page | `booking` (first 4) |
| Pricing page | `pricing` |
| Service pages | `booking`, `delivery`, `gallery` or `day` (first 5) |

Give every question **at least one of `booking`, `day`, `delivery` or `gallery`**, otherwise it is missing from the FAQ page. All questions are also published as FAQ structured data for Google.

## 7. Home, about and "how it works"

- **`home.ts`**: copy for every home page section. `hero.captions` are the small captions on the hero slideshow, **one per hero photo, in file-name order**. Update them when you change the hero photos.
- **`about.ts`**: Moshik's story, quote and values. The current text is a template. Couples book the person, so rewrite it in his own words (how he started, what he loves, a personal detail), then remove the `TODO(launch)` note.
- **`process.ts`**: the four "how it works" steps.

## 8. Photos

All marketing photos are files under `src/assets/photos/`. **Every image in these folders is picked up automatically** and optimised at build time (AVIF/WebP, several sizes). You never need to resize photos for the web yourself.

| Folder | Used for | Tips |
|---|---|---|
| `hero/` | Home page slideshow (first 6) and the default social preview image | 5–6 landscape "jaw-droppers", ≥ 2400 px wide |
| `portfolio/<category>/` | Portfolio grid and filter, service galleries | Category folder = service slug; mix portrait and landscape |
| `stories/<slug>/` | One folder per story | 8–20 photos, `01.jpg` is the cover |
| `about/` | Moshik's portrait and behind-the-scenes photos | A warm, natural portrait works best |

**Order and names**

- Photos are sorted by file name with natural number order (`01`, `02`, … `10`). Use two-digit prefixes: `01.jpg`, `02.jpg`, or `01-golden-hour.jpg`.
- **Keep these file names**, because the code refers to them directly. Replace the file but keep its name:
  - `about/moshik.jpg` and `about/behind-the-scenes-01.jpg`
  - `portfolio/<category>/01.jpg` (service covers and testimonial photos)
  - any other photo named in `services.ts` (`cover`) or `testimonials.ts` (`photo`)

  If one of them is missing, the build stops with `[photos] "…" was not found`, and `npm run checklist` lists it beforehand.
- Formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`. iPhone **HEIC files are not picked up**; export them as JPG.
- When replacing a whole folder, delete any leftover placeholder files. The checklist counts how many placeholders remain per folder.

**Export settings (Lightroom or similar)**

| Setting | Value |
|---|---|
| Size | Long edge **2400–3000 px** (minimum 2400 for hero photos, 2000 for the rest) |
| Format | JPEG, quality 80–90 |
| Colour space | sRGB |
| Metadata | Copyright only; **remove location (GPS) data** |
| Watermark | None (it looks dated on a portfolio site) |
| File size | Ideally under 3–5 MB each, to keep the repository and builds lean |

Facebook downloads and WhatsApp copies are heavily compressed; use the original exports. Publish only photos the people in them are happy to see online.

**Alt text** (for screen readers and Google) is generated from the folder, e.g. "Wedding photography by Moshik". For important photos, write it yourself in `src/data/photos.ts`:

```ts
const altText: Record<string, Localized> = {
  'about/moshik.jpg': { he: 'מושיק, צלם חתונות ואירועים', en: 'Moshik, wedding and event photographer' },
  'portfolio/weddings/03.jpg': { he: 'זוג רוקד באור נרות, קיסריה', en: 'A couple dancing by candlelight, Caesarea' },
};
```

**`photos-inbox/`** is a drop zone. Moshik can upload new photos there on GitHub (**Add file → Upload files**), using sub-folders to say what each photo is (see [`photos-inbox/README.md`](../photos-inbox/README.md)). The build does **not** read this folder. Someone needs to sort the photos into `src/assets/photos/` and rename them.

## 9. Legal pages: `src/data/legal.ts`

- **Accessibility statement** (`/accessibility/`), written for the Israeli accessibility regulations and IS 5568 (WCAG AA). It names the accessibility coordinator (`accessibilityContact.name` in `site.ts`) and pulls the phone and email from the site config. Update `accessibilityContact.lastReviewed` whenever you review it; once a year is a good rhythm.
- **Privacy policy** (`/privacy/`), covering the contact form, client galleries, face search, cookies and visitors' rights under the Israeli Privacy Protection Law.
- Both are templates in Hebrew and English. **Have a lawyer review them**, update the `updated` dates, then remove the `TODO(launch)` note.
- The content is HTML inside template strings: `<p>`, `<h2>`, `<ul><li>`.

## 10. SEO texts

Each page has a **title** (aim for about 60 characters or fewer) and a **description** (about 155 characters or fewer). The brand is added to titles automatically: `Title | מושיק — צילום חתונות ואירועים`.

| Page | Where its title and description live |
|---|---|
| Home | `home.ts` → `seo` |
| About | `about.ts` → `seo` |
| Each service | `services.ts` → `seo` |
| Each story | `title` + `subtitle` (title) and `excerpt` (description) in `stories.ts` |
| Portfolio, pricing, contact, FAQ, services index, stories index | `copy.seo` near the top of `src/views/<Page>View.astro` |
| Legal pages | `legal.ts` → `title`, `description` |

The rest is automatic:

- Canonical URLs, Hebrew/English `hreflang` links and the sitemap (from `SITE_URL`, see [DEPLOY.md, step 4](DEPLOY.md#4-set-the-site-address-and-worker-variables)).
- Social preview images: the page's own photo, or the first hero photo, cropped to 1200×630.
- Structured data (LocalBusiness, Service, FAQ, Article, breadcrumbs), built from `site.ts`.

Write descriptions for people: say what the page offers and where (e.g. "צלם חתונות בכל הארץ").

## 11. The placeholder system and `npm run checklist`

`npm run checklist` (source: [`scripts/launch-checklist.mjs`](../scripts/launch-checklist.mjs)) scans the project and prints three groups: **❌ must fix**, **⚠️ should review** and **✅ done**.

| Check | Looks at | Group when not done |
|---|---|---|
| Contact placeholders | `972500000000`, `050-000-0000`, `…example` emails, a bare `instagram.com/` in `site.ts` and `src/data/` | ❌ |
| WhatsApp/phone format | `contact.whatsapp` digits only with country code; `contact.phone` as `+972…` | ❌ / ⚠️ |
| Placeholder values | Lines ending in `// TODO(launch)` in `src/config/*.ts` and `src/data/*.ts` | ❌ |
| Prices | The `TODO(launch)` note in `packages.ts` | ❌ (⚠️ if prices are hidden) |
| Template copy | `TODO(launch)` notes in other data files (about, legal) | ⚠️ |
| Sample entries | `sample: true` in data files, counted per file | ❌ |
| Placeholder photos | The SHA-1 of every image in `src/assets/photos/`, compared with `scripts/placeholders/hashes.json` | ❌ |
| Photo references | Photo names and folders used in the code exist and are not empty | ❌ (build would fail) |
| Photo sizes | Real JPG/PNG photos smaller than recommended, or over 10 MB | ⚠️ |
| Site address | `SITE_URL` env var, or the fallback in `astro.config.mjs`, still `*.example` | ❌ |
| Fallback calendar | Sample dates in `src/data/availability.ts` | ⚠️ |
| Worker settings | `wrangler.jsonc`: R2 binding, `NOTIFY_EMAIL`, `MAIL_FROM`, `SITE_URL` | ❌ / ⚠️ |
| Local secrets | `.dev.vars` is git-ignored (a local `.dev.vars` is fine) | ❌ |
| Accessibility statement | Reviewed within the last year | ⚠️ |
| Optional extras | Turnstile, GA4, Meta Pixel, Google reviews link, scheduler, rate limiting | listed as optional |

- It always exits with code 0. **`npm run checklist -- --strict`** exits with 1 while any ❌ item remains. Use it as a launch gate, or in CI after launch.
- It cannot see production secrets. Check those with `npx wrangler secret list`.
- **About the placeholder photos:** they were made by `scripts/placeholders/generate.py`, a dev-only tool that needs Python with numpy, Pillow and SciPy. **Never run it once real photos are in place**: it writes files with the same names into `src/assets/photos/` and would overwrite them. `hashes.json` holds the fingerprints the checklist uses to recognise the placeholders.

## 12. Translating and adding a language

**Where the words are:**

- Page copy: the `{ he, en }` pairs in `src/data/*.ts`, plus the page-specific `copy` objects at the top of each `src/views/*View.astro` and component.
- Short interface labels (menu, buttons, accessibility menu): `src/i18n/ui.ts`.
- Booking-form labels and the WhatsApp summary: `src/components/booking/`.

To improve a translation, edit the `he` or `en` value; nothing else is needed.

**Adding a language (e.g. Russian):**

1. In `src/i18n/index.ts`, add it to `languages`, e.g. `ru: { label: 'Русский', short: 'RU', dir: 'ltr', locale: 'ru-RU', ogLocale: 'ru_RU' }`.
2. Run `npm run check`. Because every text is typed as "one value per language", TypeScript now lists **every place that needs a Russian translation**. Translate them; a native speaker is strongly recommended.
3. Create the routes: copy `src/pages/en/` to `src/pages/ru/` and change `lang="en"` to `lang="ru"` in each file.
4. Add `ru: 'ru-RU'` to the sitemap `locales` in `astro.config.mjs`.
5. The header's language switch currently toggles between two languages (`otherLang`). Turn it into a small menu.
6. Load a Cyrillic subset of the fonts (Fontsource provides them), and check the layout with longer words.

`hreflang` links, canonical URLs and URL prefixes (`/ru/…`) then work automatically.
