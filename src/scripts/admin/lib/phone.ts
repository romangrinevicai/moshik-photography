/**
 * Israeli phone numbers → international digits for wa.me / tel: links.
 *   050-123-4567 → 972501234567 · +972 50 123 4567 → 972501234567
 *   00972501234567 → 972501234567 · 03-1234567 → 97231234567
 * Foreign numbers written with + or 00 are kept as is.
 */
export function toInternational(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.replace(/^0+/, '')}`;
  // 9 digits without the leading 0, e.g. "501234567"
  if (digits.length === 9 && /^[5-9]/.test(digits)) return `972${digits}`;
  return digits;
}

/** Pretty local display: 972501234567 → 050-123-4567 */
export function displayPhone(raw: string | undefined): string {
  if (!raw) return '';
  const intl = toInternational(raw);
  if (/^9725\d{8}$/.test(intl)) {
    const local = `0${intl.slice(3)}`;
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return raw.trim();
}

export const waLink = (phone: string | undefined, text: string) => {
  const n = toInternational(phone);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const telHref = (phone: string | undefined) => {
  const n = toInternational(phone);
  return n ? `tel:+${n}` : '';
};
