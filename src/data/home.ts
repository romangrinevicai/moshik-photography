import type { Localized } from '~/i18n';

/** Home page copy. Use *asterisks* for accent words and | for line breaks in headlines. */
export const home = {
  seo: {
    title: { he: 'מושיק — צלם חתונות ואירועים', en: 'Moshik — Wedding & Event Photographer in Israel' },
    description: {
      he: 'צילום חתונות, בר ובת מצווה ואירועים — אותנטי, קולנועי ומרגש. חבילות ומחירים, גלריה פרטית עם זיהוי פנים לאורחים ובדיקת תאריך מהירה בוואטסאפ.',
      en: 'Candid, cinematic photography for weddings, bar & bat mitzvahs and celebrations across Israel. Packages, a private gallery with face search for guests, and quick date checks on WhatsApp.',
    },
  },
  hero: {
    eyebrow: { he: 'צילום חתונות ואירועים · בכל הארץ', en: 'Wedding & event photography · Israel' },
    title: { he: 'היום חולף.|*התמונות נשארות.*', en: 'The day flies by.|*The photos stay.*' },
    text: {
      he: 'צילום אותנטי וקולנועי לחתונות, לבר ובת מצווה ולכל שמחה — לאנשים שרוצים להרגיש הכל מחדש, בכל פעם שהם מסתכלים.',
      en: 'Candid, cinematic photography for weddings, bar & bat mitzvahs and every celebration — for people who want to feel it all again, every time they look.',
    },
    captions: [
      { he: 'חתונה · קיסריה', en: 'Wedding · Caesarea' },
      { he: 'קבלת פנים · תל אביב', en: 'Reception · Tel Aviv' },
      { he: 'פרטים · התארגנות', en: 'Details · Getting ready' },
      { he: 'רחבה · בר מצווה', en: 'Dance floor · Bar mitzvah' },
      { he: 'יציאה עם זיקוקים', en: 'Sparkler send-off' },
    ] as Localized[],
    reviews: { he: 'ביקורות', en: 'reviews' },
    pause: { he: 'עצירת המצגת', en: 'Pause slideshow' },
    play: { he: 'הפעלת המצגת', en: 'Play slideshow' },
    nextSlide: { he: 'התמונה הבאה', en: 'Next image' },
  },
  intro: {
    eyebrow: { he: 'נעים מאוד', en: 'Hello' },
    title: { he: 'אני מושיק, ואני מצלם *רגשות*, לא רק תמונות.', en: 'I’m Moshik, and I photograph *feelings*, not just pictures.' },
    text: {
      he: [
        'כבר יותר מעשור אני מצלם אנשים ברגעים הכי חשובים בחיים שלהם — ועדיין מתרגש בכל פעם מחדש. אני מאמין שתמונה טובה לא מתחילה במצלמה, אלא בחיבור.',
        'כשנוח לכם, אתם פשוט אתם. ואז קורה הקסם: מבט, צחוק, דמעה של אבא — רגעים קטנים שהופכים לזיכרונות של כל החיים.',
      ],
      en: [
        'For more than a decade I’ve been photographing people on the most important days of their lives — and it still moves me every single time. I believe a great photograph doesn’t start with the camera, but with connection.',
        'When you’re at ease, you’re simply yourselves. That’s when the magic happens: a glance, a laugh, a father’s tear — small moments that become lifelong memories.',
      ],
    },
    signature: { he: 'מושיק', en: 'Moshik' },
    cta: { he: 'עוד עליי', en: 'More about me' },
  },
  marquee: {
    he: ['חתונות', 'בר מצווה', 'בת מצווה', 'ברית', 'חינה', 'אירוסין', 'פרה־וודינג', 'משפחה', 'אירועי חברה'],
    en: ['Weddings', 'Bar Mitzvah', 'Bat Mitzvah', 'Brit', 'Henna', 'Engagements', 'Pre-wedding', 'Family', 'Corporate'],
  } as Localized<string[]>,
  services: {
    eyebrow: { he: 'מה אני מצלם', en: 'What I photograph' },
    title: { he: 'לכל שמחה יש *סיפור* משלה', en: 'Every celebration has its own *story*' },
    intro: {
      he: 'חתונה גדולה או ברית אינטימית, בר מצווה או כנס חברה — כל אירוע מקבל את אותה תשומת לב, את אותה סקרנות ואת אותה עין לפרטים.',
      en: 'A big wedding or an intimate brit, a bar mitzvah or a company conference — every event gets the same attention, the same curiosity and the same eye for detail.',
    },
  },
  work: {
    eyebrow: { he: 'עבודות נבחרות', en: 'Selected work' },
    title: { he: 'רגעים ששווה *לשמור*', en: 'Moments worth *keeping*' },
  },
  stories: {
    eyebrow: { he: 'סיפורים', en: 'Featured stories' },
    title: { he: 'ימים אמיתיים, *אנשים אמיתיים*', en: 'Real days, *real people*' },
  },
  stats: {
    years: { he: 'שנים מאחורי המצלמה', en: 'Years behind the camera' },
    events: { he: 'אירועים שצילמתי', en: 'Events photographed' },
    couples: { he: 'זוגות מאושרים', en: 'Happy couples' },
    rating: { he: 'דירוג ממוצע', en: 'Average rating' },
  },
  process: {
    eyebrow: { he: 'איך זה עובד', en: 'How it works' },
    title: { he: 'רגוע, פשוט, *אישי*', en: 'Calm, simple, *personal*' },
  },
  testimonials: {
    eyebrow: { he: 'מילים חמות', en: 'Kind words' },
    title: { he: 'מה אומרים *עליי*', en: 'What clients *say*' },
    allReviews: { he: 'לכל הביקורות בגוגל', en: 'Read all reviews on Google' },
  },
  gallery: {
    eyebrow: { he: 'אחרי האירוע', en: 'After the day' },
    title: { he: 'התמונות שלכם, *בגלריה שמגיעה להן*', en: 'Your photos, *delivered beautifully*' },
    intro: {
      he: 'כל לקוח מקבל גלריה פרטית ומעוצבת — עם טכנולוגיה שהאורחים שלכם עוד ידברו עליה.',
      en: 'Every client receives a private, beautifully designed gallery — with technology your guests will be talking about.',
    },
    features: [
      {
        icon: 'scan-face',
        title: { he: 'מוצאים את עצמכם בסלפי', en: 'Find yourself with a selfie' },
        text: {
          he: 'זיהוי פנים חכם מציג לכל אורח את כל התמונות שבהן הוא מופיע. הסלפי מעובד על המכשיר ולא נשמר.',
          en: 'Smart face recognition shows every guest all the photos they appear in. The selfie is processed on the device and never stored.',
        },
      },
      {
        icon: 'users',
        title: { he: 'אלבומים לפי אנשים', en: 'Albums by person' },
        text: {
          he: 'התמונות מתקבצות אוטומטית לפי האנשים שמופיעים בהן — סבתא, החברים מהצבא, הילדים.',
          en: 'Photos are grouped automatically by the people in them — grandma, the army friends, the kids.',
        },
      },
      {
        icon: 'heart',
        title: { he: 'מועדפות ובחירה לאלבום', en: 'Favourites & album picks' },
        text: {
          he: 'מסמנים לב על התמונות האהובות ושולחים לי את הבחירה לאלבום בלחיצה אחת.',
          en: 'Heart the images you love and send me your album selection with one tap.',
        },
      },
      {
        icon: 'qr-code',
        title: { he: 'שיתוף בקוד או ב־QR', en: 'Share with a code or QR' },
        text: {
          he: 'קישור, קוד אישי או QR על השולחן — והאורחים מגיעים לגלריה תוך שניות, גם באמצע האירוע.',
          en: 'A link, a personal code or a QR on the tables — guests reach the gallery in seconds, even during the event.',
        },
      },
    ],
    cta: { he: 'כניסה לגלריית לקוחות', en: 'Open a client gallery' },
    mock: {
      title: { he: 'נועה ודניאל', en: 'Noa & Daniel' },
      date: { he: 'ספטמבר 2025', en: 'September 2025' },
      found: { he: 'נמצאו 48 תמונות שלך', en: '48 photos of you found' },
      people: { he: 'אנשים', en: 'People' },
    },
  },
  pricing: {
    eyebrow: { he: 'השקעה', en: 'Investment' },
    title: { he: 'חבילות *בהתאמה אישית*', en: 'Packages made to *measure*' },
    intro: {
      he: 'מחירים שקופים, בלי אותיות קטנות. בחרו חבילה כנקודת פתיחה — ונתאים אותה בדיוק לאירוע שלכם.',
      en: 'Transparent pricing, no fine print. Pick a package as a starting point — and we’ll tailor it to your event.',
    },
    cta: { he: 'לכל החבילות ולמחשבון', en: 'All packages & quote builder' },
  },
  faq: {
    eyebrow: { he: 'שאלות', en: 'Questions' },
    title: { he: 'טוב *לדעת*', en: 'Good to *know*' },
    all: { he: 'לכל השאלות', en: 'All questions' },
  },
  cta: {
    eyebrow: { he: 'בואו נבדוק', en: 'Let’s check' },
    title: { he: 'התאריך שלכם *עדיין פנוי?*', en: 'Is your date *still free?*' },
    text: {
      he: 'תאריכים מבוקשים נתפסים מהר. בחרו תאריך ותקבלו תשובה מיידית — ואז נמשיך בוואטסאפ או בטופס.',
      en: 'Popular dates go fast. Pick a date for an instant answer — then let’s continue on WhatsApp or through the form.',
    },
  },
};
