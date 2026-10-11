import type { Localized } from '~/i18n';
import type { IconName } from '~/shared/icons';

export interface Service {
  slug: string;
  icon: IconName;
  /** Portfolio folder used for this service's gallery. */
  portfolio: string;
  cover: string;
  title: Localized;
  /** Short line for cards and menus. */
  summary: Localized;
  /** Hero headline on the service page. */
  headline: Localized;
  intro: Localized;
  body: Localized<string[]>;
  highlights: Localized<string[]>;
  /** Pricing category key in packages.ts */
  pricing: string;
  seo: { title: Localized; description: Localized };
}

export const services: Service[] = [
  {
    slug: 'weddings',
    icon: 'gem',
    portfolio: 'portfolio/weddings',
    cover: 'portfolio/weddings/01.jpg',
    title: { he: 'חתונות', en: 'Weddings' },
    summary: {
      he: 'מההתארגנות ועד הריקוד האחרון — כל היום, מסופר כמו שהוא באמת היה.',
      en: 'From getting ready to the last dance — the whole day, told the way it really felt.',
    },
    headline: {
      he: 'החתונה שלכם, *כמו שהרגשתם אותה*',
      en: 'Your wedding, *the way it felt*',
    },
    intro: {
      he: 'חתונה היא יום אחד שמכיל עולם שלם: התרגשות של בוקר, דמעות מתחת לחופה, חברים שלא ראיתם שנים ורחבה שלא מתרוקנת. התפקיד שלי הוא לתפוס את כל זה — בלי לביים, בלי להפריע, ועם עין לרגעים הקטנים שאתם אפילו לא תדעו שקרו.',
      en: 'A wedding is one day that holds a whole world: morning nerves, tears under the chuppah, friends you haven’t seen in years and a dance floor that never empties. My job is to catch all of it — without staging, without getting in the way, and with an eye for the small moments you won’t even know happened.',
    },
    body: {
      he: [
        'אני מגיע מוכן: אחרי פגישת תכנון שבה נעבור יחד על לוח הזמנים, על המקומות ועל רשימת צילומי המשפחה — כדי שביום עצמו תוכלו פשוט ליהנות.',
        'הסגנון שלי משלב צילום תיעודי טבעי עם פורטרטים מוקפדים באור הכי יפה של היום. צילומי הזוגיות לוקחים בדרך כלל 20–30 דקות בלבד, ומרגישים כמו הפסקה נעימה ולא כמו עבודה.',
        'אחרי החתונה תקבלו תוך 48 שעות טעימה ראשונה, ואת הגלריה המלאה — ערוכה תמונה־תמונה — בגלריה פרטית ומעוצבת עם זיהוי פנים לאורחים.',
      ],
      en: [
        'I come prepared: after a planning meeting where we go through the timeline, the locations and your family-photo list together — so on the day itself you can simply enjoy.',
        'My style blends natural, documentary storytelling with carefully crafted portraits in the most beautiful light of the day. Couple portraits usually take just 20–30 minutes and feel like a lovely break, not like work.',
        'Within 48 hours you’ll receive a first sneak peek, and the full gallery — every image individually edited — arrives in a private, beautifully designed online gallery with face search for your guests.',
      ],
    },
    highlights: {
      he: ['התארגנות ו־First Look', 'קבלת פנים וחופה', 'צילומי זוגיות באור הזהב', 'מסיבה עד הסוף', 'טעימה ראשונה תוך 48 שעות', 'גלריה פרטית עם זיהוי פנים'],
      en: ['Getting ready & first look', 'Reception & chuppah', 'Golden-hour couple portraits', 'The party, until the end', 'Sneak peek within 48 hours', 'Private gallery with face search'],
    },
    pricing: 'weddings',
    seo: {
      title: { he: 'צלם חתונות', en: 'Wedding Photographer in Israel' },
      description: {
        he: 'צלם חתונות אותנטי וקולנועי בכל רחבי הארץ. חבילות צילום חתונה, צלם נוסף, מגנטים, אלבומים וגלריה פרטית עם זיהוי פנים לאורחים.',
        en: 'Candid, cinematic wedding photography across Israel. Wedding packages with second shooter, magnets, albums and a private gallery with face search for your guests.',
      },
    },
  },
  {
    slug: 'bar-bat-mitzvah',
    icon: 'star',
    portfolio: 'portfolio/bar-bat-mitzvah',
    cover: 'portfolio/bar-bat-mitzvah/01.jpg',
    title: { he: 'בר ובת מצווה', en: 'Bar & Bat Mitzvah' },
    summary: {
      he: 'מצילומי הבוקר בכותל או בטבע ועד הדלקת הנרות והרחבה — חגיגה שלמה.',
      en: 'From a morning shoot at the Western Wall or in nature to candle-lighting and the dance floor.',
    },
    headline: {
      he: 'הרגע שבו הם *מתחילים לגדול*',
      en: 'The moment they *start growing up*',
    },
    intro: {
      he: 'בר ובת מצווה הם רגע מרגש במיוחד — לילדים, להורים, לסבים ולסבתות. אני יודע איך לגרום לבני ובנות 12–13 להרגיש בנוח מול המצלמה (גם את אלה שבטוחים שהם “לא פוטוגניים”), ואיך לתעד את כל המשפחה בחום ובכבוד.',
      en: 'A bar or bat mitzvah is a deeply moving moment — for the kids, the parents and the grandparents. I know how to make 12–13 year-olds comfortable in front of the camera (even the ones who are sure they’re “not photogenic”), and how to capture the whole family with warmth and respect.',
    },
    body: {
      he: [
        'אפשר לפתוח בצילומי בוקר — בכותל, ביפו העתיקה, בחוף או בטבע — ולקבל סט תמונות אישי ומיוחד שמוכן גם להקרנה באירוע.',
        'באירוע עצמו אני מתעד את קבלת הפנים, את טקס הדלקת הנרות על כל הרגעים המרגשים שבו, את המשפחה המורחבת ואת הרחבה.',
        'כל התמונות נמסרות בגלריה פרטית שבה כל אורח יכול למצוא את עצמו בעזרת סלפי — בלי לדפדף באלפי תמונות.',
      ],
      en: [
        'We can start with a morning shoot — at the Western Wall, in Old Jaffa, on the beach or in nature — for a personal set of portraits that’s also ready to be projected at the event.',
        'At the celebration I capture the reception, the candle-lighting ceremony with all its emotional moments, the extended family and the dance floor.',
        'All photos are delivered in a private gallery where every guest can find themselves with a selfie — no scrolling through thousands of images.',
      ],
    },
    highlights: {
      he: ['צילומי בוקר בלוקיישן לבחירה', 'תמונות מוכנות להקרנה', 'טקס הדלקת נרות', 'צילומי משפחה מסודרים', 'עמדת מגנטים לאורחים', 'גלריה עם חיפוש לפי פנים'],
      en: ['Morning shoot at a location you love', 'Images ready for projection', 'Candle-lighting ceremony', 'Organised family portraits', 'Magnet photo station for guests', 'Gallery with face search'],
    },
    pricing: 'bar-bat-mitzvah',
    seo: {
      title: { he: 'צלם בר מצווה ובת מצווה', en: 'Bar & Bat Mitzvah Photographer' },
      description: {
        he: 'צילומי בר מצווה ובת מצווה: צילומי בוקר בכותל או בטבע, תיעוד האירוע, הדלקת נרות, מגנטים וגלריה פרטית לכל המשפחה.',
        en: 'Bar and bat mitzvah photography: morning shoots at the Western Wall or in nature, full event coverage, candle-lighting, magnets and a private family gallery.',
      },
    },
  },
  {
    slug: 'events',
    icon: 'party-popper',
    portfolio: 'portfolio/events',
    cover: 'portfolio/events/01.jpg',
    title: { he: 'אירועים ושמחות', en: 'Celebrations' },
    summary: {
      he: 'ברית ובריתה, חינה, אירוסין, ימי הולדת עגולים ושמחות משפחתיות.',
      en: 'Brit & simchat bat, henna, engagements, milestone birthdays and family celebrations.',
    },
    headline: {
      he: 'כל שמחה ראויה *לתמונות יפות*',
      en: 'Every celebration deserves *beautiful photos*',
    },
    intro: {
      he: 'לא כל אירוע הוא חתונה — אבל כל אירוע הוא רגע שלא יחזור. ברית, חינה צבעונית, מסיבת אירוסין או יום הולדת 70 לסבתא: אני מגיע עם אותה רמת השקעה, אותה עין ואותו חיוך.',
      en: 'Not every event is a wedding — but every event is a moment that won’t come again. A brit, a colourful henna, an engagement party or grandma’s 70th birthday: I bring the same care, the same eye and the same smile.',
    },
    body: {
      he: [
        'אירועים קטנים ואינטימיים דורשים רגישות מיוחדת: להיות שם בלי שירגישו, ולתפוס את המבטים, הצחוקים והחיבוקים.',
        'החבילות לאירועים גמישות ומתומחרות לפי שעות, כך שתשלמו בדיוק על מה שאתם צריכים.',
      ],
      en: [
        'Small, intimate events call for special sensitivity: being there without being noticed, and catching the glances, the laughter and the hugs.',
        'Event packages are flexible and priced by the hour, so you pay for exactly what you need.',
      ],
    },
    highlights: {
      he: ['ברית ובריתה', 'חינה ואירוסין', 'ימי הולדת ושמחות', 'תמחור גמיש לפי שעות', 'מגנטים כתוספת', 'גלריה פרטית לאורחים'],
      en: ['Brit & simchat bat', 'Henna & engagement', 'Birthdays & family milestones', 'Flexible hourly pricing', 'Optional magnet station', 'Private guest gallery'],
    },
    pricing: 'events',
    seo: {
      title: { he: 'צלם אירועים', en: 'Event Photographer' },
      description: {
        he: 'צלם אירועים לברית, חינה, אירוסין, ימי הולדת ושמחות משפחתיות. תמחור גמיש לפי שעות, מגנטים וגלריה פרטית.',
        en: 'Event photography for brit milah, henna, engagements, birthdays and family celebrations. Flexible hourly pricing, magnets and a private gallery.',
      },
    },
  },
  {
    slug: 'couples',
    icon: 'heart',
    portfolio: 'portfolio/couples',
    cover: 'portfolio/couples/01.jpg',
    title: { he: 'זוגיות ופרה־וודינג', en: 'Couples & Pre-wedding' },
    summary: {
      he: 'צילומי זוגיות, Save the Date ופרה־וודינג — במדבר, בים או בעיר.',
      en: 'Couple, save-the-date and pre-wedding sessions — in the desert, by the sea or in the city.',
    },
    headline: {
      he: 'רק שניכם, *והאור הנכון*',
      en: 'Just the two of you, *and the right light*',
    },
    intro: {
      he: 'צילומי זוגיות הם ההזדמנות להכיר אחד את השנייה מול המצלמה — ואותי — עוד לפני היום הגדול. בלי לחץ של לוח זמנים, באור של שעת הזהב ובמקום שאתם אוהבים.',
      en: 'A couple session is the chance to get comfortable in front of the camera — and with me — before the big day. No timeline pressure, golden-hour light and a place you love.',
    },
    body: {
      he: [
        'ממכתש רמון ועד סמטאות יפו, מחוף קיסריה ועד אבני ירושלים — נבחר יחד לוקיישן שמספר משהו עליכם.',
        'התמונות מושלמות להזמנות, ל־Save the Date, להקרנה בחתונה או פשוט לקיר בבית.',
      ],
      en: [
        'From the Ramon Crater to the alleys of Jaffa, from Caesarea’s beach to the stones of Jerusalem — we’ll choose a location together that says something about you.',
        'The images are perfect for invitations, save-the-dates, a slideshow at the wedding or simply the wall at home.',
      ],
    },
    highlights: {
      he: ['שעה וחצי של צילום', 'עד שני לוקיישנים', 'הכוונה לבחירת לבוש', 'תמונות ל־Save the Date', 'גלריה פרטית', 'הנחה בהזמנה עם חתונה'],
      en: ['90 minutes of shooting', 'Up to two locations', 'Styling & outfit guidance', 'Images for your save-the-date', 'Private gallery', 'Discount when booked with a wedding'],
    },
    pricing: 'couples',
    seo: {
      title: { he: 'צילומי זוגיות ופרה וודינג', en: 'Couple & Pre-wedding Photography' },
      description: {
        he: 'צילומי זוגיות, פרה־וודינג ו־Save the Date במדבר, בים, ביפו ובירושלים. שעת הזהב, הכוונה מלאה וגלריה פרטית.',
        en: 'Couple, pre-wedding and save-the-date sessions in the desert, by the sea, in Jaffa and Jerusalem. Golden-hour light, full guidance and a private gallery.',
      },
    },
  },
  {
    slug: 'portraits',
    icon: 'users',
    portfolio: 'portfolio/portraits',
    cover: 'portfolio/portraits/01.jpg',
    title: { he: 'פורטרטים ומשפחה', en: 'Portraits & Family' },
    summary: {
      he: 'צילומי משפחה, הריון ופורטרטים אישיים — טבעיים, חמים ונטולי מתח.',
      en: 'Family, maternity and personal portraits — natural, warm and stress-free.',
    },
    headline: {
      he: 'מי שאתם, *בדיוק עכשיו*',
      en: 'Who you are, *right now*',
    },
    intro: {
      he: 'הילדים גדלים מהר יותר ממה שנדמה. סשן משפחתי רגוע — בבית, בפארק או בחוף — שומר את התקופה הזאת לתמיד, עם כל הבלגן היפה שלה.',
      en: 'Children grow faster than we think. A relaxed family session — at home, in the park or on the beach — keeps this chapter forever, with all its beautiful chaos.',
    },
    body: {
      he: [
        'אני עובד בקצב של הילדים, משחק איתם ונותן להם להיות הם. התוצאה: תמונות אמיתיות שמחייכות אליכם מהקיר עוד שנים.',
        'מתאים גם לצילומי הריון, לפורטרטים אישיים ולצילומי דורות עם סבא וסבתא.',
      ],
      en: [
        'I work at the children’s pace, play with them and let them be themselves. The result: real images that smile back at you from the wall for years.',
        'Also perfect for maternity sessions, personal portraits and multi-generation photos with the grandparents.',
      ],
    },
    highlights: {
      he: ['סשנים של 30–90 דקות', 'בבית, בטבע או בסטודיו', 'הכוונה לבחירת לבוש', 'צילומי הריון ודורות', 'הדפסות ואלבומים', 'גלריה פרטית'],
      en: ['30–90 minute sessions', 'At home, outdoors or in studio', 'Outfit guidance', 'Maternity & generations', 'Prints & albums', 'Private gallery'],
    },
    pricing: 'portraits',
    seo: {
      title: { he: 'צילומי משפחה ופורטרטים', en: 'Family & Portrait Photography' },
      description: {
        he: 'צילומי משפחה, הריון ופורטרטים אישיים באווירה טבעית ונינוחה — בבית, בטבע או בסטודיו.',
        en: 'Family, maternity and personal portrait photography in a natural, relaxed atmosphere — at home, outdoors or in studio.',
      },
    },
  },
  {
    slug: 'corporate',
    icon: 'briefcase',
    portfolio: 'portfolio/corporate',
    cover: 'portfolio/corporate/01.jpg',
    title: { he: 'עסקים ותדמית', en: 'Corporate & Brand' },
    summary: {
      he: 'כנסים, אירועי חברה, השקות, צילומי צוות ותדמית למותגים.',
      en: 'Conferences, company events, launches, team headshots and brand imagery.',
    },
    headline: {
      he: 'העסק שלכם, *במיטבו*',
      en: 'Your business, *at its best*',
    },
    intro: {
      he: 'אירועי חברה, כנסים והשקות דורשים צלם שמבין גם אנשים וגם מותגים: מהיר, דיסקרטי ומדויק — ומספק תמונות שמוכנות לשימוש ברשתות, באתר ובעיתונות.',
      en: 'Company events, conferences and launches call for a photographer who understands people and brands alike: fast, discreet and precise — delivering images ready for social media, your website and the press.',
    },
    body: {
      he: [
        'אפשר לקבל מבחר תמונות ערוכות עוד באותו ערב לפרסום מיידי ברשתות החברתיות.',
        'צילומי צוות ותדמית מתבצעים במשרדים שלכם עם סטודיו נייד — בלי שאף אחד יצטרך לצאת מהבניין.',
      ],
      en: [
        'A selection of edited images can be delivered the same evening for instant social media publishing.',
        'Team headshots and brand portraits are shot at your offices with a mobile studio — nobody needs to leave the building.',
      ],
    },
    highlights: {
      he: ['כנסים ואירועי חברה', 'השקות ואירועי מותג', 'צילומי צוות בסטודיו נייד', 'מסירה באותו ערב', 'רישיון שימוש מסחרי', 'חשבונית מס'],
      en: ['Conferences & company events', 'Launches & brand events', 'Team headshots with a mobile studio', 'Same-evening delivery', 'Commercial usage license', 'Tax invoice provided'],
    },
    pricing: 'corporate',
    seo: {
      title: { he: 'צלם אירועים עסקיים ותדמית', en: 'Corporate Event & Brand Photographer' },
      description: {
        he: 'צילום כנסים, אירועי חברה, השקות וצילומי צוות ותדמית. מסירה מהירה, סטודיו נייד ורישיון שימוש מסחרי.',
        en: 'Photography for conferences, company events, launches, team headshots and brand imagery. Fast delivery, mobile studio and commercial license.',
      },
    },
  },
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);
