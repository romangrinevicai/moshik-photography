/**
 * Fallback availability, used only when the live API (managed from the
 * admin panel at /admin) is unreachable — e.g. when the site is hosted
 * without the Cloudflare Worker. Dates are YYYY-MM-DD.
 * SAMPLE DATA — TODO(launch): clear these or manage dates in the admin panel.
 */
export const fallbackAvailability = {
  booked: ['2026-11-12', '2026-11-19', '2026-12-03', '2027-05-20', '2027-06-10'],
  limited: ['2026-11-26', '2027-05-27'],
};
