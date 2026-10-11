/**
 * Client testimonials.
 * SAMPLE CONTENT — TODO(launch): replace with real reviews (e.g. copied from
 * Google or Facebook with the clients' permission). Never publish invented reviews.
 */
import type { Localized } from '~/i18n';

export interface Testimonial {
  sample?: boolean;
  name: Localized;
  event: Localized;
  quote: Localized;
  /** Optional photo id from src/assets/photos */
  photo?: string;
}

export const testimonials: Testimonial[] = [
  {
    sample: true,
    name: { he: 'נועה ודניאל', en: 'Noa & Daniel' },
    event: { he: 'חתונה בקיסריה', en: 'Wedding in Caesarea' },
    quote: {
      he: 'מושיק היה כמו עוד חבר באירוע — רגוע, מצחיק ותמיד במקום הנכון. כשקיבלנו את הגלריה ישבנו שעתיים מול המחשב ובכינו. כל רגע שחשוב לנו נמצא שם.',
      en: 'Moshik felt like another friend at the wedding — calm, funny and always in the right place. When the gallery arrived we sat in front of the screen for two hours crying. Every moment that matters to us is there.',
    },
    photo: 'portfolio/weddings/01.jpg',
  },
  {
    sample: true,
    name: { he: 'משפחת לוי', en: 'The Levi family' },
    event: { he: 'בת מצווה בירושלים', en: 'Bat mitzvah in Jerusalem' },
    quote: {
      he: 'צילומי הבוקר בירושלים היו חוויה בפני עצמה. מאיה, שבדרך כלל שונאת להצטלם, ביקשה עוד. והאורחים לא הפסיקו להתלהב מזה שמצאו את עצמם בגלריה עם סלפי.',
      en: 'The morning shoot in Jerusalem was an experience in itself. Maya, who usually hates being photographed, asked for more. And our guests couldn’t stop raving about finding themselves in the gallery with a selfie.',
    },
    photo: 'portfolio/bar-bat-mitzvah/01.jpg',
  },
  {
    sample: true,
    name: { he: 'שירה ועמית', en: 'Shira & Amit' },
    event: { he: 'פרה־וודינג וחתונה', en: 'Pre-wedding & wedding' },
    quote: {
      he: 'סגרנו את מושיק אחרי שיחה אחת. הוא הקשיב, הבין בדיוק מה אנחנו אוהבים, והתמונות יצאו טבעיות ומרגשות — בלי פוזות מאולצות.',
      en: 'We booked Moshik after one conversation. He listened, understood exactly what we love, and the photos came out natural and moving — no forced poses.',
    },
    photo: 'portfolio/couples/01.jpg',
  },
  {
    sample: true,
    name: { he: 'רונית ואבי', en: 'Ronit & Avi' },
    event: { he: 'ברית לנכד', en: 'Our grandson’s brit' },
    quote: {
      he: 'אירוע קטן ומשפחתי, ומושיק התייחס אליו כאילו היה החתונה של השנה. תמונות מלאות חום ואהבה.',
      en: 'A small family event, and Moshik treated it like the wedding of the year. Photos full of warmth and love.',
    },
    photo: 'portfolio/events/02.jpg',
  },
  {
    sample: true,
    name: { he: 'צוות הייטק תל אביבי', en: 'A Tel Aviv tech team' },
    event: { he: 'כנס חברה שנתי', en: 'Annual company conference' },
    quote: {
      he: 'מקצועי, מהיר ודיסקרטי. קיבלנו מבחר תמונות עוד באותו ערב, והפוסטים ברשתות עלו בזמן אמת.',
      en: 'Professional, fast and discreet. We had a selection of photos the same evening, and our social posts went live in real time.',
    },
    photo: 'portfolio/corporate/01.jpg',
  },
];
