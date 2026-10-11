/**
 * Packages & prices. All amounts are in ₪ and are PLACEHOLDERS —
 * TODO(launch): replace with Moshik's real pricing.
 * Set `pricing.showPrices = false` in src/config/site.ts to hide prices.
 */
import type { Localized } from '~/i18n';
import type { IconName } from '~/shared/icons';

export interface Tier {
  id: string;
  name: Localized;
  price: number;
  /** e.g. "up to 8 hours" */
  unit?: Localized;
  description: Localized;
  features: Localized<string[]>;
  popular?: boolean;
}

export interface Addon {
  id: string;
  icon: IconName;
  name: Localized;
  description: Localized;
  price: number;
  /** Price per unit, e.g. per hour — allows a quantity picker in the quote builder. */
  perUnit?: Localized;
  maxQty?: number;
}

export interface PricingCategory {
  id: string;
  title: Localized;
  intro: Localized;
  tiers: Tier[];
  addons: string[];
}

export const addons: Addon[] = [
  {
    id: 'second-shooter',
    icon: 'users',
    name: { he: 'צלם/ת נוסף/ת', en: 'Second photographer' },
    description: { he: 'זווית נוספת לכל רגע — במיוחד בחופה ובאירועים גדולים.', en: 'A second angle on every moment — ideal for the ceremony and larger events.' },
    price: 1500,
  },
  {
    id: 'magnets',
    icon: 'magnet',
    name: { he: 'עמדת מגנטים', en: 'Magnet photo station' },
    description: { he: 'צלם ומדפסת באירוע — כל אורח הולך הביתה עם מגנט מעוצב.', en: 'A photographer and printer on site — every guest takes home a designed photo magnet.' },
    price: 1900,
  },
  {
    id: 'pre-wedding',
    icon: 'heart',
    name: { he: 'צילומי פרה־וודינג', en: 'Pre-wedding session' },
    description: { he: 'סשן זוגי של שעה וחצי בלוקיישן לבחירתכם.', en: 'A 90-minute couple session at a location of your choice.' },
    price: 1200,
  },
  {
    id: 'album',
    icon: 'book-open',
    name: { he: 'אלבום פרימיום 30×30', en: 'Premium 30×30 album' },
    description: { he: 'אלבום מעוצב בעבודת יד, 40 עמודים, כריכת פשתן או עור.', en: 'Hand-crafted designed album, 40 pages, linen or leather cover.' },
    price: 1800,
  },
  {
    id: 'parents-albums',
    icon: 'gift',
    name: { he: 'זוג אלבומי הורים', en: 'Two parents’ albums' },
    description: { he: 'עותקים מוקטנים של האלבום שלכם — מתנה מושלמת להורים.', en: 'Smaller copies of your album — the perfect gift for your parents.' },
    price: 1200,
  },
  {
    id: 'film',
    icon: 'film',
    name: { he: 'סרט היילייטס קולנועי', en: 'Cinematic highlight film' },
    description: { he: 'סרט של 3–5 דקות בשיתוף צלם וידאו מהצוות הקבוע שלי.', en: 'A 3–5 minute film, made with a videographer from my regular team.' },
    price: 3900,
  },
  {
    id: 'drone',
    icon: 'plane',
    name: { he: 'צילומי רחפן', en: 'Drone coverage' },
    description: { he: 'צילומי אוויר של הלוקיישן והחופה (בכפוף לאישורי טיסה).', en: 'Aerial images of the venue and ceremony (subject to flight permits).' },
    price: 900,
  },
  {
    id: 'extra-hour',
    icon: 'clock',
    name: { he: 'שעת צילום נוספת', en: 'Extra hour of coverage' },
    description: { he: 'כשהמסיבה לא נגמרת — גם אני לא.', en: 'When the party keeps going — so do I.' },
    price: 450,
    perUnit: { he: 'לשעה', en: 'per hour' },
    maxQty: 4,
  },
  {
    id: 'express',
    icon: 'zap',
    name: { he: 'מסירה מהירה', en: 'Express delivery' },
    description: { he: 'הגלריה המלאה תוך 10 ימים במקום 4–6 שבועות.', en: 'Your full gallery within 10 days instead of 4–6 weeks.' },
    price: 700,
  },
];

export const pricing: PricingCategory[] = [
  {
    id: 'weddings',
    title: { he: 'חתונות', en: 'Weddings' },
    intro: {
      he: 'כל החבילות כוללות פגישת תכנון, עריכה מלאה של כל תמונה, טעימה ראשונה תוך 48 שעות וגלריה פרטית עם זיהוי פנים.',
      en: 'Every package includes a planning meeting, full individual editing, a sneak peek within 48 hours and a private gallery with face search.',
    },
    tiers: [
      {
        id: 'essential',
        name: { he: 'Essential', en: 'Essential' },
        price: 5900,
        unit: { he: 'עד 8 שעות צילום', en: 'up to 8 hours' },
        description: { he: 'כל מה שצריך כדי לספר את היום שלכם יפה.', en: 'Everything you need to tell your day beautifully.' },
        features: {
          he: ['צלם ראשי', 'עד 8 שעות צילום', '600+ תמונות ערוכות', 'טעימה ראשונה תוך 48 שעות', 'גלריה פרטית עם זיהוי פנים', 'מסירה תוך 4–6 שבועות'],
          en: ['Lead photographer', 'Up to 8 hours of coverage', '600+ edited images', 'Sneak peek within 48 hours', 'Private gallery with face search', 'Delivery within 4–6 weeks'],
        },
      },
      {
        id: 'signature',
        name: { he: 'Signature', en: 'Signature' },
        price: 8900,
        unit: { he: 'יום מלא', en: 'full day' },
        description: { he: 'החבילה האהובה ביותר — שתי זוויות לכל רגע.', en: 'The most loved package — two angles on every moment.' },
        features: {
          he: ['כל מה שב־Essential', 'צלם/ת נוסף/ת', 'צילומי פרה־וודינג', 'כיסוי מההתארגנות ועד הסוף', '900+ תמונות ערוכות', 'אלבום פרימיום 30×30'],
          en: ['Everything in Essential', 'Second photographer', 'Pre-wedding session', 'Coverage from getting ready to the end', '900+ edited images', 'Premium 30×30 album'],
        },
        popular: true,
      },
      {
        id: 'luxe',
        name: { he: 'Luxe', en: 'Luxe' },
        price: 13900,
        unit: { he: 'ללא הגבלת שעות', en: 'no hour limit' },
        description: { he: 'חוויה מלאה, בלי לוותר על שום דבר.', en: 'The complete experience, nothing left out.' },
        features: {
          he: ['כל מה שב־Signature', 'סרט היילייטס קולנועי', 'עמדת מגנטים', 'צילומי רחפן', 'זוג אלבומי הורים', 'מסירה מהירה תוך 10 ימים'],
          en: ['Everything in Signature', 'Cinematic highlight film', 'Magnet photo station', 'Drone coverage', 'Two parents’ albums', 'Express delivery within 10 days'],
        },
      },
    ],
    addons: ['second-shooter', 'magnets', 'pre-wedding', 'album', 'parents-albums', 'film', 'drone', 'extra-hour', 'express'],
  },
  {
    id: 'bar-bat-mitzvah',
    title: { he: 'בר ובת מצווה', en: 'Bar & Bat Mitzvah' },
    intro: {
      he: 'צילומי בוקר אישיים, תיעוד האירוע וגלריה שבה כל אורח מוצא את עצמו.',
      en: 'Personal morning shoots, full event coverage and a gallery where every guest finds themselves.',
    },
    tiers: [
      {
        id: 'celebration',
        name: { he: 'Celebration', en: 'Celebration' },
        price: 4200,
        unit: { he: 'עד 5 שעות', en: 'up to 5 hours' },
        description: { he: 'תיעוד מלא של האירוע.', en: 'Complete coverage of the celebration.' },
        features: {
          he: ['צלם ראשי', 'עד 5 שעות צילום', 'קבלת פנים, טקס הדלקת נרות ורחבה', '400+ תמונות ערוכות', 'גלריה פרטית עם זיהוי פנים'],
          en: ['Lead photographer', 'Up to 5 hours of coverage', 'Reception, candle-lighting & dance floor', '400+ edited images', 'Private gallery with face search'],
        },
      },
      {
        id: 'premium',
        name: { he: 'Premium', en: 'Premium' },
        price: 6400,
        unit: { he: 'כולל צילומי בוקר', en: 'with morning shoot' },
        description: { he: 'צילומי בוקר ואירוע — הסיפור המלא.', en: 'Morning shoot and celebration — the full story.' },
        features: {
          he: ['כל מה שב־Celebration', 'צילומי בוקר בלוקיישן לבחירה', 'תמונות ערוכות להקרנה באירוע', 'אלבום מעוצב 25×25', 'עמדת מגנטים — בהנחה של 20%'],
          en: ['Everything in Celebration', 'Morning shoot at a location of your choice', 'Edited images for projection at the event', 'Designed 25×25 album', 'Magnet station at 20% off'],
        },
        popular: true,
      },
    ],
    addons: ['second-shooter', 'magnets', 'album', 'parents-albums', 'film', 'extra-hour', 'express'],
  },
  {
    id: 'events',
    title: { he: 'אירועים ושמחות', en: 'Celebrations' },
    intro: {
      he: 'ברית, חינה, אירוסין, ימי הולדת — תמחור גמיש לפי שעות.',
      en: 'Brit, henna, engagements, birthdays — flexible hourly pricing.',
    },
    tiers: [
      {
        id: 'intimate',
        name: { he: 'אינטימי', en: 'Intimate' },
        price: 1600,
        unit: { he: 'עד 2 שעות', en: 'up to 2 hours' },
        description: { he: 'מושלם לברית, לבריתה ולאירועים קטנים.', en: 'Perfect for a brit, simchat bat and small gatherings.' },
        features: {
          he: ['עד 2 שעות צילום', '150+ תמונות ערוכות', 'גלריה פרטית', 'מסירה תוך שבועיים'],
          en: ['Up to 2 hours of coverage', '150+ edited images', 'Private gallery', 'Delivery within 2 weeks'],
        },
      },
      {
        id: 'full-event',
        name: { he: 'אירוע מלא', en: 'Full event' },
        price: 2900,
        unit: { he: 'עד 4 שעות', en: 'up to 4 hours' },
        description: { he: 'לחינה, אירוסין וימי הולדת גדולים.', en: 'For henna, engagements and big birthdays.' },
        features: {
          he: ['עד 4 שעות צילום', '300+ תמונות ערוכות', 'גלריה פרטית עם זיהוי פנים', 'טעימה ראשונה תוך 48 שעות'],
          en: ['Up to 4 hours of coverage', '300+ edited images', 'Private gallery with face search', 'Sneak peek within 48 hours'],
        },
        popular: true,
      },
    ],
    addons: ['second-shooter', 'magnets', 'extra-hour', 'express'],
  },
  {
    id: 'couples',
    title: { he: 'זוגיות ופרה־וודינג', en: 'Couples & Pre-wedding' },
    intro: {
      he: 'סשן זוגי באור של שעת הזהב, בלוקיישן שמספר משהו עליכם.',
      en: 'A golden-hour couple session at a location that says something about you.',
    },
    tiers: [
      {
        id: 'session',
        name: { he: 'סשן זוגי', en: 'Couple session' },
        price: 1400,
        unit: { he: 'שעה וחצי', en: '90 minutes' },
        description: { he: 'עד שני לוקיישנים, הכוונה מלאה.', en: 'Up to two locations, full guidance.' },
        features: {
          he: ['90 דקות צילום', 'עד שני לוקיישנים', '60+ תמונות ערוכות', 'הכוונה לבחירת לבוש', 'גלריה פרטית'],
          en: ['90 minutes of shooting', 'Up to two locations', '60+ edited images', 'Outfit guidance', 'Private gallery'],
        },
        popular: true,
      },
    ],
    addons: ['drone', 'express'],
  },
  {
    id: 'portraits',
    title: { he: 'פורטרטים ומשפחה', en: 'Portraits & Family' },
    intro: {
      he: 'סשנים רגועים וטבעיים — בבית, בטבע או בסטודיו.',
      en: 'Relaxed, natural sessions — at home, outdoors or in studio.',
    },
    tiers: [
      {
        id: 'mini',
        name: { he: 'מיני', en: 'Mini' },
        price: 750,
        unit: { he: '30 דקות', en: '30 minutes' },
        description: { he: 'סשן קצר וקולע.', en: 'A short, sweet session.' },
        features: {
          he: ['30 דקות צילום', 'לוקיישן אחד', '20 תמונות ערוכות', 'גלריה פרטית'],
          en: ['30 minutes of shooting', 'One location', '20 edited images', 'Private gallery'],
        },
      },
      {
        id: 'classic',
        name: { he: 'קלאסי', en: 'Classic' },
        price: 1200,
        unit: { he: 'שעה', en: '1 hour' },
        description: { he: 'הזמן הנכון למשפחה שלמה.', en: 'The right amount of time for a whole family.' },
        features: {
          he: ['60 דקות צילום', 'עד שני לוקיישנים', '50 תמונות ערוכות', 'הכוונה לבחירת לבוש', 'גלריה פרטית'],
          en: ['60 minutes of shooting', 'Up to two locations', '50 edited images', 'Outfit guidance', 'Private gallery'],
        },
        popular: true,
      },
    ],
    addons: ['extra-hour', 'express'],
  },
  {
    id: 'corporate',
    title: { he: 'עסקים ותדמית', en: 'Corporate & Brand' },
    intro: {
      he: 'תמחור לעסקים כולל רישיון שימוש מסחרי וחשבונית מס.',
      en: 'Business pricing includes a commercial usage license and a tax invoice.',
    },
    tiers: [
      {
        id: 'half-day',
        name: { he: 'חצי יום', en: 'Half day' },
        price: 2800,
        unit: { he: 'עד 4 שעות', en: 'up to 4 hours' },
        description: { he: 'כנס, השקה או אירוע חברה.', en: 'A conference, launch or company event.' },
        features: {
          he: ['עד 4 שעות צילום', 'מבחר תמונות באותו ערב', 'גלריה מלאה תוך 3 ימי עבודה', 'רישיון מסחרי'],
          en: ['Up to 4 hours of coverage', 'Selection delivered the same evening', 'Full gallery within 3 business days', 'Commercial license'],
        },
      },
      {
        id: 'full-day',
        name: { he: 'יום מלא', en: 'Full day' },
        price: 4900,
        unit: { he: 'עד 9 שעות', en: 'up to 9 hours' },
        description: { he: 'כנסים ארוכים וימי צילום תדמית.', en: 'Multi-session conferences and brand shoot days.' },
        features: {
          he: ['עד 9 שעות צילום', 'סטודיו נייד לצילומי צוות', 'מבחר תמונות באותו ערב', 'רישיון מסחרי'],
          en: ['Up to 9 hours of coverage', 'Mobile studio for team headshots', 'Selection delivered the same evening', 'Commercial license'],
        },
        popular: true,
      },
    ],
    addons: ['second-shooter', 'extra-hour', 'express'],
  },
];

export const addonById = (id: string) => addons.find((a) => a.id === id);
export const pricingById = (id: string) => pricing.find((p) => p.id === id);
export const startingPrice = (id: string) => {
  const cat = pricingById(id);
  return cat ? Math.min(...cat.tiers.map((t) => t.price)) : undefined;
};
