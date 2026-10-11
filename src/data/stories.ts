/**
 * Featured stories (case studies).
 * SAMPLE CONTENT — TODO(launch): replace with Moshik's real stories
 * (with the couples' permission). Photos live in src/assets/photos/stories/<slug>/.
 */
import type { Localized } from '~/i18n';

export interface Story {
  slug: string;
  sample?: boolean;
  /** Matches a service slug, used for the label and related links. */
  service: string;
  title: Localized;
  subtitle: Localized;
  location: Localized;
  date: string; // YYYY-MM
  excerpt: Localized;
  /** Paragraphs; a line starting with "> " renders as a pull quote. */
  body: Localized<string[]>;
  credits?: { role: Localized; name: string }[];
}

export const stories: Story[] = [
  {
    slug: 'noa-and-daniel',
    sample: true,
    service: 'weddings',
    title: { he: 'נועה ודניאל', en: 'Noa & Daniel' },
    subtitle: { he: 'חתונת שקיעה על חוף הים', en: 'A sunset wedding by the sea' },
    location: { he: 'קיסריה', en: 'Caesarea' },
    date: '2025-09',
    excerpt: {
      he: 'רוח ים, אור זהוב ו־260 אורחים שרקדו עד שתיים בלילה. חתונה שבה כל רגע הרגיש כמו סצנה מסרט.',
      en: 'Sea breeze, golden light and 260 guests dancing until 2 a.m. A wedding where every moment felt like a scene from a film.',
    },
    body: {
      he: [
        'נועה ודניאל הכירו בטיול במדבר, ולכן היה ברור להם שהחתונה תהיה בחוץ — מול הים, באור של שעת הזהב.',
        'התחלנו את הבוקר בהתארגנות שקטה: אמא של נועה רוכסת את השמלה, דניאל מתאמן על הנדרים במרפסת. ה־First Look על הצוק היה אחד הרגעים הכי מרגשים שצילמתי השנה.',
        '> “ראינו את התמונות ובכינו שוב. מושיק תפס דברים שבכלל לא ידענו שקרו.”',
        'החופה נערכה בדיוק בשקיעה, והמסיבה — טוב, נגיד שהרחבה לא התרוקנה לרגע. האורחים מצאו את עצמם בגלריה עוד באותו שבוע בעזרת סלפי אחד.',
      ],
      en: [
        'Noa and Daniel met on a desert hike, so they knew their wedding had to be outdoors — facing the sea, in golden-hour light.',
        'We started the morning with a quiet getting-ready: Noa’s mum zipping up the dress, Daniel rehearsing his vows on the balcony. The first look on the cliff was one of the most emotional moments I photographed all year.',
        '> “We saw the photos and cried all over again. Moshik caught things we didn’t even know had happened.”',
        'The chuppah took place right at sunset, and the party — well, let’s just say the dance floor never emptied. Guests found themselves in the gallery that same week with a single selfie.',
      ],
    },
    credits: [
      { role: { he: 'מקום', en: 'Venue' }, name: 'Seaside venue, Caesarea' },
      { role: { he: 'הפקה', en: 'Planning' }, name: 'Event planner' },
    ],
  },
  {
    slug: 'maya-bat-mitzvah',
    sample: true,
    service: 'bar-bat-mitzvah',
    title: { he: 'בת המצווה של מאיה', en: 'Maya’s Bat Mitzvah' },
    subtitle: { he: 'מסמטאות ירושלים לרחבת הריקודים', en: 'From the alleys of Jerusalem to the dance floor' },
    location: { he: 'ירושלים ותל אביב', en: 'Jerusalem & Tel Aviv' },
    date: '2025-06',
    excerpt: {
      he: 'בוקר צילומים באבני ירושלים, ערב של הדלקת נרות מרגשת וחברות שלא הפסיקו לרקוד.',
      en: 'A morning shoot among Jerusalem stone, an emotional candle-lighting and friends who never stopped dancing.',
    },
    body: {
      he: [
        'מאיה הגיעה לצילומי הבוקר עם קצת חששות (“אני לא יודעת להצטלם!”). אחרי עשר דקות היא כבר הובילה אותי לסמטאות האהובות עליה.',
        'התמונות מהבוקר הוקרנו באירוע עצמו — והפתיעו את כל המשפחה.',
        '> “מושיק גרם למאיה להרגיש כמו כוכבת. התמונות מהבוקר הן הדבר הכי יפה שיש לנו.”',
        'בערב תיעדנו את טקס הדלקת הנרות, את סבתא שקראה ברכה שכתבה בעצמה, ואת החברות שקפצו על הרחבה עד הסוף.',
      ],
      en: [
        'Maya arrived at the morning shoot a little nervous (“I don’t know how to pose!”). Ten minutes later she was leading me through her favourite alleys.',
        'The morning images were projected at the celebration itself — and surprised the whole family.',
        '> “Moshik made Maya feel like a star. The morning photos are the most beautiful thing we own.”',
        'In the evening we captured the candle-lighting ceremony, her grandmother reading a blessing she wrote herself, and her friends jumping on the dance floor until the very end.',
      ],
    },
  },
  {
    slug: 'shira-and-amit',
    sample: true,
    service: 'couples',
    title: { he: 'שירה ועמית', en: 'Shira & Amit' },
    subtitle: { he: 'פרה־וודינג ממכתש רמון ועד יפו', en: 'A pre-wedding from the Ramon Crater to Jaffa' },
    location: { he: 'מצפה רמון ויפו', en: 'Mitzpe Ramon & Jaffa' },
    date: '2025-03',
    excerpt: {
      he: 'שני לוקיישנים, יום אחד, ואור שאי אפשר לביים: זריחה במדבר ושקיעה מול הים.',
      en: 'Two locations, one day and light you can’t fake: sunrise in the desert and sunset by the sea.',
    },
    body: {
      he: [
        'שירה ועמית רצו צילומים שמספרים את הסיפור שלהם — הם מטיילים כבדים, אבל גרים בלב תל אביב.',
        'יצאנו לפני הזריחה אל שפת המכתש, ובערב סגרנו את היום בסמטאות יפו ובשקיעה על החוף.',
        '> “הרגשנו כמו בטיול עם חבר, לא כמו בצילומים.”',
        'התמונות שימשו להזמנות, ל־Save the Date ולמצגת שהוקרנה בחתונה.',
      ],
      en: [
        'Shira and Amit wanted photos that tell their story — they’re serious hikers who live in the heart of Tel Aviv.',
        'We set out before sunrise to the edge of the crater, and in the evening closed the day in the alleys of Jaffa with a sunset on the beach.',
        '> “It felt like a trip with a friend, not like a photo shoot.”',
        'The images were used for their invitations, save-the-date and the slideshow at the wedding.',
      ],
    },
  },
];

export const storyBySlug = (slug: string) => stories.find((s) => s.slug === slug);
