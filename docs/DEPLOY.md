# Deploying to Cloudflare

This guide takes you from a fresh clone to a live site on your own domain. Follow it in order the first time; it takes about 30–45 minutes. Each step says what you will see when it works.

**What gets deployed:** one Cloudflare Worker named `moshik-photography`. It serves the built site from `dist/` as static assets and runs the API (`/api/*`) and the private gallery images (`/media/*`). Galleries, inquiries and the calendar are stored in one R2 bucket. All of this is configured in [`wrangler.jsonc`](../wrangler.jsonc).

**What you need:**

- Node.js **22.12+** and npm (`node -v`).
- The project installed: `npm install`.
- A Cloudflare account (free).
- For the custom domain: access to the domain's registrar, to change its nameservers.

## Contents

1. [Create a Cloudflare account](#1-create-a-cloudflare-account)
2. [Log in with Wrangler](#2-log-in-with-wrangler)
3. [Create the R2 bucket](#3-create-the-r2-bucket)
4. [Set the site address and Worker variables](#4-set-the-site-address-and-worker-variables)
5. [Deploy](#5-deploy)
6. [Set the admin secrets](#6-set-the-admin-secrets)
7. [Smoke test](#7-smoke-test)
8. [Connect your domain](#8-connect-your-domain)
9. [Optional: deploy automatically from GitHub (Workers Builds)](#9-optional-deploy-automatically-from-github-workers-builds)
10. [Optional integrations](#10-optional-integrations)
11. [Backups](#11-backups)
12. [Updating and rolling back](#12-updating-and-rolling-back)
13. [Troubleshooting](#troubleshooting)

---

## 1. Create a Cloudflare account

1. Sign up at <https://dash.cloudflare.com/sign-up>.
2. Verify your email address.
3. If you already have a domain, add it now so DNS has time to switch over (it can take a few hours):
   1. In the dashboard, click **Add a domain** and enter it, e.g. `moshik-photo.co.il`.
   2. Choose the **Free** plan.
   3. Cloudflare shows two nameservers. At your registrar (where you bought the domain), replace the existing nameservers with those two.
   4. Cloudflare emails you when the domain is **Active**. You need that for [step 8](#8-connect-your-domain).

## 2. Log in with Wrangler

Wrangler is Cloudflare's command-line tool. It is already installed with the project.

```bash
npx wrangler login     # opens the browser; click "Allow"
npx wrangler whoami    # shows your account name and ID
```

> On a server without a browser, create an API token in the dashboard (**My Profile → API Tokens → "Edit Cloudflare Workers" template**) and set it as `CLOUDFLARE_API_TOKEN` instead of logging in.

## 3. Create the R2 bucket

R2 is Cloudflare's file storage. Galleries, inquiries and the calendar live here.

1. In the dashboard, open **R2 Object Storage** and click to enable R2. Cloudflare asks for a payment method before it enables R2. Usage within the free tier (10 GB) costs nothing.
2. Create the bucket. The name must match `bucket_name` in `wrangler.jsonc`:

   ```bash
   npx wrangler r2 bucket create moshik-photography
   ```

   You should see `✅ Created bucket 'moshik-photography' …`. Optionally, add `--location eeur` (Eastern Europe) to place it closer to Israel.

> **Do not enable public access on the bucket** (no r2.dev URL and no custom domain on the bucket). All access goes through the Worker, which checks gallery codes, drafts and expiry dates.

## 4. Set the site address and Worker variables

The site address is used in two places, and both should hold the same final URL, e.g. `https://www.moshik-photo.co.il`.

### a) `SITE_URL` at build time: canonical links, sitemap, social previews

`astro.config.mjs` reads `process.env.SITE_URL` when the site is built and falls back to a placeholder:

```js
const SITE_URL = process.env.SITE_URL || 'https://moshik-photography.example';
```

Choose one option:

- **Simplest, set and forget:** replace the fallback with the real domain and commit the change.
- **Or** set the environment variable whenever you build:
  - macOS/Linux: `SITE_URL=https://www.moshik-photo.co.il npm run deploy`
  - Windows PowerShell: `$env:SITE_URL="https://www.moshik-photo.co.il"; npm run deploy`
  - Workers Builds: add it as a build variable ([step 9](#9-optional-deploy-automatically-from-github-workers-builds)).

If you skip this, every canonical URL, `hreflang` link, social preview and the sitemap point to `moshik-photography.example`, which is bad for SEO. `npm run checklist` warns you about it.

### b) Worker variables in `wrangler.jsonc`

These variables are read by the Worker at runtime:

| Variable | Example | Used for |
|---|---|---|
| `NOTIFY_EMAIL` | `moshik@gmail.com` | Where new inquiries are emailed. Needs Resend, see [10a](#10a-email-notifications-resend). Leave it empty to skip email alerts |
| `MAIL_FROM` | `Moshik Website <site@moshik-photo.co.il>` | The sender of those emails, on a domain verified in Resend |
| `SITE_URL` | `https://www.moshik-photo.co.il` | Links inside notification emails |

```jsonc
"vars": {
  "NOTIFY_EMAIL": "moshik@gmail.com",
  "MAIL_FROM": "Moshik Website <site@moshik-photo.co.il>",
  "SITE_URL": "https://www.moshik-photo.co.il"
}
```

> Treat `wrangler.jsonc` as the source of truth for variables. Every deploy replaces variables that were changed in the dashboard with the values from the file. **Secrets** are different: they are set with `wrangler secret put`, are never in the file, and survive deploys.

## 5. Deploy

```bash
npm run deploy
```

This runs `astro build` (optimises all photos; the first build takes a couple of minutes), then `wrangler deploy`. The first time, Wrangler may ask you to choose a `workers.dev` subdomain. At the end you see something like:

```
Deployed moshik-photography triggers
  https://moshik-photography.<your-subdomain>.workers.dev
```

Open that URL: the site is live. The admin panel says it is not configured until you finish step 6.

## 6. Set the admin secrets

Secrets are encrypted and stored in Cloudflare. They take effect immediately, so you don't need to redeploy.

**`ADMIN_PASSWORD`** is the password for `/admin`. Use a long passphrase and keep it in a password manager.

```bash
npx wrangler secret put ADMIN_PASSWORD
# Enter a secret value: ********   (typing is hidden)
# ✨ Success! Uploaded secret ADMIN_PASSWORD
```

**`SESSION_SECRET`** is a long random string that signs admin sessions. This one-liner generates it and pipes it straight into Wrangler, so you never have to see or paste it:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put SESSION_SECRET
```

(`openssl rand -base64 32` works too, if you prefer to copy and paste.)

To check what is set (names only, never values):

```bash
npx wrangler secret list
```

> Changing `ADMIN_PASSWORD` later does not log out existing sessions. Sessions last 14 days. To log out every device immediately, put a new `SESSION_SECRET` as well.

## 7. Smoke test

Do this on the `workers.dev` URL now, and again after connecting the domain:

- [ ] The home page loads in Hebrew, and `/en/` loads in English. The language switch keeps you on the same page.
- [ ] The date checker answers for a date, and the floating WhatsApp button opens the right number.
- [ ] Send a test inquiry through the booking form. You land on the thank-you page, and the inquiry appears in **/admin → inquiries** (plus email or Telegram, if configured).
- [ ] Log in to **/admin**. Create a test gallery, upload 3–5 photos, run face analysis and publish.
- [ ] Open the share link in a private window. Photos load, the selfie search works, and the ZIP download works if downloads are enabled.
- [ ] Delete the test gallery and the test inquiry.
- [ ] Run `npm run checklist -- --strict` locally. It should end with "Nothing blocks the launch".

## 8. Connect your domain

Your domain must be **Active** on the same Cloudflare account ([step 1](#1-create-a-cloudflare-account)).

1. Open **Workers & Pages → moshik-photography → Settings → Domains & Routes**.
2. Click **Add → Custom domain**, enter `www.moshik-photo.co.il` and click **Add domain**. Cloudflare creates the DNS record and the HTTPS certificate. This usually takes a minute or two.
3. Repeat for the bare domain `moshik-photo.co.il`.
4. Pick **one** address as the official one; it must match `SITE_URL`. Redirect the other address to it under **Rules → Redirect Rules**, which has ready-made templates for "www → root" and "root → www".
5. Optional: under **Domains & Routes**, disable the `workers.dev` route, so the site is only reachable on the real domain.
6. If you haven't yet, update `SITE_URL` in `astro.config.mjs` and in `wrangler.jsonc` `vars`, then run `npm run deploy`.

> **Prefer configuration in code?** Instead of steps 2–3, you can add the domains to `wrangler.jsonc` and deploy:
>
> ```jsonc
> "routes": [
>   { "pattern": "www.moshik-photo.co.il", "custom_domain": true },
>   { "pattern": "moshik-photo.co.il", "custom_domain": true }
> ]
> ```

Remember to add the new hostname to Turnstile ([10c](#10c-spam-protection-cloudflare-turnstile)) if you use it.

## 9. Optional: deploy automatically from GitHub (Workers Builds)

With Workers Builds, every push to `main` builds and deploys the site, so nobody needs to run `npm run deploy` by hand. This is handy if Moshik ever edits texts on GitHub.

1. Push the repository to GitHub. CI in `.github/workflows/ci.yml` runs on every push.
2. Open **Workers & Pages → moshik-photography → Settings → Build** and click **Connect** next to Git repository. Authorise the Cloudflare GitHub app and pick the repository.
3. Fill in the settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` (leave empty) |
   | Build variables | `SITE_URL` = `https://www.moshik-photo.co.il` (and `NODE_VERSION` = `22` if the build complains about Node) |

4. Save, then push a commit. You can follow the build under **Deployments**.

Notes:

- The `name` in `wrangler.jsonc` must match the Worker's name (`moshik-photography`), or the build fails.
- Build variables exist only while the site is built. Runtime variables still come from `wrangler.jsonc`, and secrets from `wrangler secret put`.
- Builds of other branches can upload preview versions without touching production. This is the "non-production branch deploy command" setting.

## 10. Optional integrations

Each of these is off until you configure it. Values in `src/config/site.ts` are baked into the site at build time, so **rebuild and deploy** after changing them. Secrets take effect immediately.

### 10a. Email notifications (Resend)

New inquiries are emailed to Moshik. The free tier is about 3,000 emails/month (100/day).

1. Sign up at <https://resend.com>.
2. Go to **Domains → Add Domain** and enter your domain. Resend shows a few DNS records (SPF/MX and DKIM). Add them in Cloudflare under **DNS → Records**, or use Resend's automatic Cloudflare setup. Click **Verify**; it usually takes a few minutes.
3. Go to **API Keys → Create API Key** with *Sending access*. Copy the key (`re_…`); you only see it once.
4. Store it as a secret:

   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```

5. In `wrangler.jsonc`, set `NOTIFY_EMAIL` (Moshik's inbox) and `MAIL_FROM` (an address on the verified domain, e.g. `Moshik Website <site@moshik-photo.co.il>`). Then run `npm run deploy`.
6. Send a test inquiry. The first email may land in spam; mark it "Not spam". Resend's **Emails** page shows every delivery.

> The default `MAIL_FROM` (`onboarding@resend.dev`) only delivers to the email address of your own Resend account. It is fine for a quick test, not for production.

### 10b. Instant alerts on Telegram

A message on Moshik's phone the moment an inquiry arrives. It is free, and you can use it together with email.

1. In Telegram, open **@BotFather** and send `/newbot`.
2. Choose a display name (e.g. "Moshik Website") and a username ending in `bot` (e.g. `moshik_site_bot`).
3. BotFather replies with a **token** such as `123456789:AAH…`. Store it:

   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   ```

4. Open the new bot in Telegram (`t.me/<username>`), press **Start** and send it any message. A bot cannot write to you until you do this.
5. Find the chat ID. Open this URL in a browser, with your token in it:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

   Look for `"chat":{"id":123456789,…`. That number is the chat ID.

   > For a group chat, add the bot to the group, send a message there, and reload `getUpdates`. Group IDs are negative, e.g. `-1001234567890`.

6. Store the chat ID:

   ```bash
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```

7. Send a test inquiry.

Keep the bot token private: anyone who has it can send messages as the bot.

### 10c. Spam protection (Cloudflare Turnstile)

A privacy-friendly "are you human" check on the booking form. Most visitors never see a puzzle.

1. In the dashboard, go to **Turnstile → Add widget**.
2. Name it, add your hostnames (`moshik-photo.co.il`, `www.moshik-photo.co.il`, and the `workers.dev` host if you test there), choose **Managed** mode and create it.
3. Copy the **Site Key** into `src/config/site.ts`:

   ```ts
   integrations: {
     turnstileSiteKey: '0x4AAAAAAA…',
   ```

4. Store the **Secret Key**:

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

5. Run `npm run deploy`. The widget appears at the last step of the booking form.

**Always set both keys together.** If the Worker expects a token that the page never sends, every inquiry is rejected and visitors are pushed to the WhatsApp fallback. To test locally, use Cloudflare's always-pass test keys: site key `1x00000000000000000000AA` and, in `.dev.vars`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`.

### 10d. Google Analytics 4 and Meta Pixel

Set either ID and the **cookie consent banner appears automatically**. Nothing loads until the visitor clicks Accept, and the choice is remembered.

**GA4:**

1. Open <https://analytics.google.com> and go to **Admin → Create → Property**. Use Israel time and ILS.
2. Add a **Web** data stream for your domain and copy the **Measurement ID** (`G-XXXXXXXXXX`).
3. In `src/config/site.ts`, set `integrations.ga4: 'G-XXXXXXXXXX'`, then deploy.
4. After the first real inquiry, open **Admin → Events** and mark `generate_lead` as a **key event**. That is a booking-form lead. Other events: `whatsapp_click`, `phone_click`, `email_click`, `quote_whatsapp`, `date_check`, `booking_step`, `booking_fallback`.

**Meta Pixel:**

1. Open **Meta Events Manager → Connect data sources → Web → Meta Pixel**, create the pixel and copy its numeric **Pixel ID**.
2. Set `integrations.metaPixel: '1234567890…'`, then deploy.
3. The site sends `PageView`, the standard `Contact` event on leads and WhatsApp clicks, and the events above as custom events.

### 10e. Google reviews link

The hero rating and the testimonials section can link to Moshik's Google reviews.

1. Find the business on Google Maps, open its profile, click **Share** and copy the link (e.g. `https://maps.app.goo.gl/…`).
2. Set `social.googleReviews` in `src/config/site.ts` to that link and remove its `TODO(launch)` comment.
3. Deploy.

For **asking** clients to write a review, use a different link: Google Business Profile → **Ask for reviews**. It gives a link like `https://g.page/r/…/review`. Moshik's guide includes a message template for sending it.

### 10f. Rate limiting

The Worker limits how often one visitor can try gallery codes, admin passwords and booking submissions. Without bindings, it uses a simple in-memory fallback. For proper limits across Cloudflare's network, add this to `wrangler.jsonc` and deploy:

```jsonc
"ratelimits": [
  // Gallery code attempts (POST /api/gallery/access)
  { "name": "ACCESS_LIMITER", "namespace_id": "1001", "simple": { "limit": 20, "period": 60 } },
  // Admin login attempts
  { "name": "LOGIN_LIMITER", "namespace_id": "1002", "simple": { "limit": 5, "period": 60 } },
  // Booking form submissions
  { "name": "INQUIRY_LIMITER", "namespace_id": "1003", "simple": { "limit": 5, "period": 60 } }
]
```

- `namespace_id` is any positive whole number, written as a string, that is unique within your Cloudflare account.
- `period` is `10` or `60` seconds.
- Counts are approximate (kept per Cloudflare location), which is fine for stopping abuse.

---

## 11. Backups

| What | Where it lives | How it is backed up |
|---|---|---|
| Code, texts, marketing photos | Git (GitHub) | Every clone is a full copy |
| Galleries, face data, album selections, inquiries, calendar | R2 bucket `moshik-photography` | Copy with rclone (below) |
| Secrets (`ADMIN_PASSWORD`, API keys) | Cloudflare only (encrypted, write-only) | Keep them in a password manager |
| Moshik's original photo files | His own computer and drives | Gallery uploads are copies; R2 is not his archive |

### Single files with Wrangler

Note the `--remote` flag. Without it, Wrangler uses the local test bucket.

```bash
# download
npx wrangler r2 object get moshik-photography/settings/availability.json --file availability.json --remote
# upload back
npx wrangler r2 object put moshik-photography/settings/availability.json --file availability.json --content-type application/json --remote
```

Wrangler cannot list objects. To browse the bucket, use the dashboard: **R2 → moshik-photography → Objects**. The folder layout is documented in [`ARCHITECTURE.md`](ARCHITECTURE.md#r2-layout).

### Everything with rclone (recommended monthly)

1. Install [rclone](https://rclone.org/install/).
2. In the dashboard, open **R2 → Manage API tokens → Create API token**. Choose **Object Read only**, limit it to the `moshik-photography` bucket and create it. Copy the **Access Key ID**, the **Secret Access Key** and the **S3 endpoint** (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
3. Add a remote to rclone's config file (`rclone config file` shows where it is):

   ```ini
   [r2]
   type = s3
   provider = Cloudflare
   access_key_id = <ACCESS_KEY_ID>
   secret_access_key = <SECRET_ACCESS_KEY>
   endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   acl = private
   no_check_bucket = true
   ```

4. Back up:

   ```bash
   rclone lsd r2:moshik-photography                      # connection test: lists top-level folders
   rclone copy r2:moshik-photography ./backups/moshik-photography --progress
   rclone copy r2:moshik-photography/leads ./backups/leads   # inquiries only
   ```

   `rclone copy` is incremental, so later runs only download what changed.

5. To restore, create a token with **Object Read & Write** and copy the other way: `rclone copy ./backups/moshik-photography r2:moshik-photography`.

## 12. Updating and rolling back

**Content changes** (texts, prices, photos):

1. Edit the files.
2. Run `npm run dev` to look, then `npm run checklist`.
3. Commit and push (with Workers Builds), or run `npm run deploy`.

**Dependencies:**

```bash
npm outdated                                # what's new
npm update                                  # minor/patch updates within package.json ranges
npx @astrojs/upgrade                        # Astro and its integrations, incl. major versions
npm install -D wrangler@latest
npm run check && npm test && npm run build && npm run preview   # test before deploying
```

Read the release notes before a major upgrade. After testing with `npm run preview`, you may also move `compatibility_date` in `wrangler.jsonc` forward.

**Rolling back a bad deploy:** open **Workers & Pages → moshik-photography → Deployments**, pick an earlier version and click **Rollback**. You can also run `npx wrangler rollback`. A rollback changes code only; R2 data (galleries, inquiries) is untouched.

---

## Troubleshooting

**Logs first.** Open **Workers & Pages → moshik-photography → Logs** (observability is enabled in `wrangler.jsonc`), or stream live logs with `npx wrangler tail`.

| Symptom | Likely cause | Fix |
|---|---|---|
| The booking form says it couldn't send and offers WhatsApp/email | The fallback for an unreachable or failing `/api/inquiry`. No lead is lost, but find the cause | With `npm run dev` this is expected (no Worker), so use `npm run preview`. In production, check the logs. Common causes: Turnstile site key without a secret (or the reverse), a hostname missing in the Turnstile widget, or the R2 binding missing (`503 unavailable`) |
| Admin says "not configured" | `ADMIN_PASSWORD` is not set (the login API returns `503 not_configured`) | `npx wrangler secret put ADMIN_PASSWORD`. Locally: `cp .dev.vars.example .dev.vars` and restart `npm run preview` |
| Admin says too many attempts | Login rate limit | Wait a minute and try again |
| Admin logs out unexpectedly | `SESSION_SECRET` changed, or the 14-day session ended | Log in again |
| New or replaced photos don't show on the site | No rebuild/deploy yet, a wrong folder, or an unsupported format (iPhone **HEIC** is not picked up) | Export as JPG into the right folder under `src/assets/photos/`, run `npm run deploy`, and hard-refresh the browser (Ctrl/Cmd + Shift + R) |
| The build fails with `[photos] "…" was not found` | Code refers to a photo file that was renamed or removed (e.g. `about/moshik.jpg`, `portfolio/<category>/01.jpg`) | Restore a photo with that exact name, or update the reference. `npm run checklist` lists all of these |
| A gallery shows no photos or old photos | Upload still running, the gallery is a draft, or it hasn't been published since the last upload | Wait for uploads to finish, then click **Publish** in the admin (it rebuilds the public gallery) |
| The gallery link says expired or not found | The expiry date passed, or the code was changed | Edit the gallery in the admin: clear or extend the expiry, or share the new link |
| Face search finds nothing | Faces were not analysed for this gallery, face search is off, or the selfie is dark or side-on | In the admin, run face analysis and publish. Use a well-lit, front-facing selfie |
| No inquiry emails | `NOTIFY_EMAIL` empty, `RESEND_API_KEY` missing, `MAIL_FROM` not on a verified domain, or the mail went to spam | Check each item in [10a](#10a-email-notifications-resend). Resend's **Emails** log shows what happened |
| No Telegram alerts | You never pressed **Start** on the bot, wrong chat ID (group IDs are negative), or a typo in the token | Repeat [10b](#10b-instant-alerts-on-telegram) steps 4–6 |
| Social previews or Google show `moshik-photography.example` | `SITE_URL` was not set at build time | [Step 4a](#a-site_url-at-build-time-canonical-links-sitemap-social-previews), then deploy again |
| `wrangler deploy` fails: bucket not found | The R2 bucket does not exist, or the name differs from `wrangler.jsonc` | `npx wrangler r2 bucket create moshik-photography` |
| A Workers Build fails on the Node version | The build image uses an older Node | Add the build variable `NODE_VERSION` = `22` |
| Error 1027 (daily limit) or 1102 (CPU limit) | The free plan's limits were exceeded, e.g. a viral gallery or very heavy requests | Switch the account to **Workers Paid** ($5/month) under **Workers & Pages → Plans** |
| `npm run preview` shows old data | Local R2 data persists in `.wrangler/state/` | That is by design. Delete `.wrangler/state/` to start fresh |
