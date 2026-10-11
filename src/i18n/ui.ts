import type { Lang, Localized } from './index';

/**
 * Short interface strings. Longer page copy lives next to the page or in
 * src/data/*. Hebrew is written for Israeli couples and families; English
 * for olim, tourists and destination weddings.
 */
export const ui = {
  // Navigation
  'nav.home': { he: 'בית', en: 'Home' },
  'nav.portfolio': { he: 'עבודות', en: 'Portfolio' },
  'nav.services': { he: 'שירותים', en: 'Services' },
  'nav.stories': { he: 'סיפורים', en: 'Stories' },
  'nav.pricing': { he: 'מחירים', en: 'Pricing' },
  'nav.about': { he: 'אודות', en: 'About' },
  'nav.faq': { he: 'שאלות נפוצות', en: 'FAQ' },
  'nav.contact': { he: 'צור קשר', en: 'Contact' },
  'nav.gallery': { he: 'גלריית לקוחות', en: 'Client gallery' },
  'nav.cta': { he: 'בדיקת תאריך', en: 'Check your date' },
  'nav.menu': { he: 'תפריט', en: 'Menu' },
  'nav.close': { he: 'סגירה', en: 'Close' },
  'nav.switchLang': { he: 'English', en: 'עברית' },
  'nav.switchLangLabel': { he: 'Switch to English', en: 'מעבר לעברית' },
  'nav.main': { he: 'ניווט ראשי', en: 'Main navigation' },
  'nav.allServices': { he: 'כל השירותים', en: 'All services' },

  // Common
  'common.skip': { he: 'דלג לתוכן הראשי', en: 'Skip to main content' },
  'common.viewPortfolio': { he: 'לצפייה בעבודות', en: 'View portfolio' },
  'common.viewAll': { he: 'לכל העבודות', en: 'View all work' },
  'common.learnMore': { he: 'לפרטים נוספים', en: 'Learn more' },
  'common.readStory': { he: 'לסיפור המלא', en: 'Read the story' },
  'common.allStories': { he: 'לכל הסיפורים', en: 'All stories' },
  'common.from': { he: 'החל מ־', en: 'From ' },
  'common.startingFrom': { he: 'החל מ', en: 'Starting from' },
  'common.contactForQuote': { he: 'הצעת מחיר אישית', en: 'Personal quote' },
  'common.vatIncluded': { he: 'המחירים כוללים מע״מ', en: 'Prices include VAT' },
  'common.whatsapp': { he: 'וואטסאפ', en: 'WhatsApp' },
  'common.call': { he: 'חיוג', en: 'Call' },
  'common.email': { he: 'אימייל', en: 'Email' },
  'common.book': { he: 'לבדיקת תאריך', en: 'Check availability' },
  'common.getQuote': { he: 'לקבלת הצעת מחיר', en: 'Get a quote' },
  'common.next': { he: 'הבא', en: 'Next' },
  'common.prev': { he: 'הקודם', en: 'Previous' },
  'common.back': { he: 'חזרה', en: 'Back' },
  'common.close': { he: 'סגירה', en: 'Close' },
  'common.scroll': { he: 'גללו', en: 'Scroll' },
  'common.mostPopular': { he: 'הכי מבוקש', en: 'Most popular' },
  'common.photos': { he: 'תמונות', en: 'photos' },
  'common.all': { he: 'הכל', en: 'All' },
  'common.or': { he: 'או', en: 'or' },
  'common.loading': { he: 'טוען…', en: 'Loading…' },
  'common.home': { he: 'דף הבית', en: 'Home' },
  'common.breadcrumbs': { he: 'פירורי לחם', en: 'Breadcrumbs' },
  'common.download': { he: 'הורדה', en: 'Download' },
  'common.share': { he: 'שיתוף', en: 'Share' },
  'common.copy': { he: 'העתקה', en: 'Copy' },
  'common.copied': { he: 'הועתק!', en: 'Copied!' },

  // WhatsApp / contact
  'wa.chat': { he: 'דברו איתי בוואטסאפ', en: 'Chat on WhatsApp' },
  'wa.online': { he: 'זמין עכשיו', en: 'Available now' },
  'wa.offline': { he: 'אחזור אליכם בהקדם', en: "I'll get back to you soon" },
  'wa.greeting': {
    he: 'היי מושיק! הגעתי מהאתר ואשמח לשמוע פרטים 🙂',
    en: "Hi Moshik! I found you through your website and I'd love to hear more 🙂",
  },
  'contact.saveContact': { he: 'שמירת איש קשר', en: 'Save contact' },
  'contact.messenger': { he: 'מסנג׳ר', en: 'Messenger' },
  'contact.instagram': { he: 'אינסטגרם', en: 'Instagram' },
  'contact.facebook': { he: 'פייסבוק', en: 'Facebook' },
  'contact.waze': { he: 'ניווט בוויז', en: 'Navigate with Waze' },

  // Footer
  'footer.tagline': {
    he: 'צילום חתונות, בר ובת מצווה ואירועים — באהבה, בסבלנות ובעין לרגעים הקטנים.',
    en: 'Weddings, bar & bat mitzvahs and celebrations — photographed with heart, patience and an eye for the small moments.',
  },
  'footer.explore': { he: 'ניווט', en: 'Explore' },
  'footer.services': { he: 'שירותים', en: 'Services' },
  'footer.contact': { he: 'יצירת קשר', en: 'Get in touch' },
  'footer.rights': { he: 'כל הזכויות שמורות', en: 'All rights reserved' },
  'footer.accessibility': { he: 'הצהרת נגישות', en: 'Accessibility' },
  'footer.privacy': { he: 'מדיניות פרטיות', en: 'Privacy' },
  'footer.photosNote': {
    he: 'כל התמונות באתר מוגנות בזכויות יוצרים.',
    en: 'All photographs on this site are protected by copyright.',
  },
  'footer.backToTop': { he: 'חזרה למעלה', en: 'Back to top' },

  // Accessibility menu
  'a11y.open': { he: 'תפריט נגישות', en: 'Accessibility menu' },
  'a11y.title': { he: 'התאמות נגישות', en: 'Accessibility' },
  'a11y.textSize': { he: 'גודל טקסט', en: 'Text size' },
  'a11y.bigger': { he: 'הגדלת טקסט', en: 'Increase text' },
  'a11y.smaller': { he: 'הקטנת טקסט', en: 'Decrease text' },
  'a11y.contrast': { he: 'ניגודיות גבוהה', en: 'High contrast' },
  'a11y.links': { he: 'הדגשת קישורים', en: 'Highlight links' },
  'a11y.font': { he: 'גופן קריא', en: 'Readable font' },
  'a11y.motion': { he: 'עצירת אנימציות', en: 'Stop animations' },
  'a11y.grayscale': { he: 'גווני אפור', en: 'Grayscale' },
  'a11y.reset': { he: 'איפוס', en: 'Reset' },
  'a11y.statement': { he: 'להצהרת הנגישות', en: 'Accessibility statement' },

  // Forms (shared)
  'form.required': { he: 'שדה חובה', en: 'Required' },
  'form.optional': { he: 'רשות', en: 'Optional' },
  'form.invalidPhone': { he: 'נא להזין מספר טלפון תקין', en: 'Please enter a valid phone number' },
  'form.invalidEmail': { he: 'נא להזין כתובת אימייל תקינה', en: 'Please enter a valid email address' },

  // Lightbox
  'lb.close': { he: 'סגירה', en: 'Close' },
  'lb.next': { he: 'התמונה הבאה', en: 'Next photo' },
  'lb.prev': { he: 'התמונה הקודמת', en: 'Previous photo' },
  'lb.zoom': { he: 'הגדלה', en: 'Zoom' },
  'lb.error': { he: 'לא הצלחנו לטעון את התמונה', en: 'The photo could not be loaded' },
  'lb.view': { he: 'צפייה', en: 'View' },
} satisfies Record<string, Localized>;

export type UiKey = keyof typeof ui;

export function useTranslations(lang: Lang) {
  return (key: UiKey): string => ui[key][lang];
}
