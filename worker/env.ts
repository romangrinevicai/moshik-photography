export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Static site built by Astro (./dist). */
  ASSETS: Fetcher;
  /** R2 bucket for galleries, leads and settings. */
  BUCKET?: R2Bucket;

  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;

  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  MAIL_FROM?: string;
  SITE_URL?: string;

  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  TURNSTILE_SECRET_KEY?: string;

  ACCESS_LIMITER?: RateLimiter;
  LOGIN_LIMITER?: RateLimiter;
  INQUIRY_LIMITER?: RateLimiter;
}
