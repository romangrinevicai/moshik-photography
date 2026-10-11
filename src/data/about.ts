/**
 * About page copy.
 * TODO(launch): replace the story with Moshik's own words — how he started,
 * what he loves, a personal detail or two. Couples book the person.
 */
import type { Localized } from '~/i18n';
import type { IconName } from '~/shared/icons';

export const about = {
  seo: {
    title: { he: 'אודות מושיק — צלם חתונות ואירועים', en: 'About Moshik — Wedding & Event Photographer' },
    description: {
      he: 'הכירו את מושיק: הסיפור, הגישה והאנשים שמאחורי המצלמה. צילום אותנטי, רגוע ואישי לחתונות ולאירועים.',
      en: 'Meet Moshik: the story, the approach and the person behind the camera. Candid, calm and personal photography for weddings and celebrations.',
    },
  },
  eyebrow: { he: 'אודות', en: 'About' },
  title: { he: 'נעים מאוד, *אני מושיק*', en: 'Nice to meet you, *I’m Moshik*' },
  intro: {
    he: 'צלם חתונות ואירועים, מספר סיפורים באור, ואדם שמאמין שהתמונות הכי טובות נולדות כשמרגישים בנוח.',
    en: 'Wedding and event photographer, storyteller in light, and someone who believes the best photos happen when people feel at ease.',
  },
  story: {
    he: [
      'התאהבתי בצילום בגלל הרגעים שבין הרגעים: המבט של אמא רגע לפני החופה, הצחוק של חבר ילדות באמצע נאום, היד של סבא שמחזיקה חזק. את הרגעים האלה אי אפשר לביים — אפשר רק להיות שם, קשוב ומוכן.',
      'מאז צילמתי מאות חתונות, בר ובת מצווה ושמחות משפחתיות בכל רחבי הארץ. בכל אירוע אני מגיע עם אותה סקרנות ואותו כבוד לאנשים ולמנהגים שלהם — מחתונת חוף קלילה ועד חתונה מסורתית עם אלף אורחים.',
      'הסגנון שלי משלב תיעוד טבעי עם פורטרטים מוקפדים: מעט הכוונה, הרבה תשומת לב, ואור שמחמיא לכולם. אחרי האירוע אני עורך כל תמונה בעצמי — כי בעיניי העריכה היא חצי מהסיפור.',
      'כשאני לא מצלם, תמצאו אותי מטייל עם המשפחה, מחפש לוקיישנים חדשים לשעת הזהב או שותה קפה טוב מדי.',
    ],
    en: [
      'I fell in love with photography because of the moments between moments: a mother’s glance just before the chuppah, a childhood friend laughing mid-speech, a grandfather’s hand holding on tight. You can’t stage those moments — you can only be there, attentive and ready.',
      'Since then I’ve photographed hundreds of weddings, bar and bat mitzvahs and family celebrations all over Israel. I bring the same curiosity and the same respect for people and their customs to every event — from a breezy beach wedding to a traditional celebration with a thousand guests.',
      'My style blends natural storytelling with carefully crafted portraits: a little direction, a lot of attention, and light that flatters everyone. After the event I edit every image myself — because editing is half of the story.',
      'When I’m not photographing, you’ll find me travelling with my family, scouting new golden-hour locations or drinking slightly too much good coffee.',
    ],
  } as Localized<string[]>,
  quote: {
    he: 'אני לא מצלם איך היום נראה. אני מצלם איך הוא הרגיש.',
    en: 'I don’t photograph how the day looked. I photograph how it felt.',
  },
  valuesTitle: { he: 'מה חשוב *לי*', en: 'What matters *to me*' },
  values: [
    {
      icon: 'heart' as IconName,
      title: { he: 'אמיתי, לא מבוים', en: 'Real over posed' },
      text: { he: 'רגעים אמיתיים מנצחים פוזות. אני מכוון בעדינות ונותן לכם להיות אתם.', en: 'Real moments beat poses. I guide gently and let you be yourselves.' },
    },
    {
      icon: 'feather' as IconName,
      title: { he: 'נוכחות שקטה', en: 'A calm presence' },
      text: { he: 'רגוע, דיסקרטי ומאורגן — כדי שאתם תוכלו פשוט ליהנות מהיום.', en: 'Calm, discreet and organised — so you can simply enjoy your day.' },
    },
    {
      icon: 'aperture' as IconName,
      title: { he: 'עין לפרטים', en: 'An eye for detail' },
      text: { he: 'מהטבעת ועד הרקמה על השמלה — הפרטים הקטנים מספרים את הסיפור הגדול.', en: 'From the ring to the lace on the dress — small details tell the big story.' },
    },
    {
      icon: 'gift' as IconName,
      title: { he: 'מסירה מושקעת', en: 'Delivered with care' },
      text: { he: 'גלריה מעוצבת עם זיהוי פנים, אלבומים בעבודת יד וזמני מסירה שעומדים בהם.', en: 'A designed gallery with face search, hand-crafted albums and delivery times I keep.' },
    },
  ],
  bts: { he: 'מאחורי הקלעים', en: 'Behind the scenes' },
  btsText: {
    he: 'ציוד מקצועי כפול, גיבוי בזמן אמת, ותכנון מראש של כל רגע — כדי שביום עצמו הכל ירגיש קליל.',
    en: 'Professional backup gear, real-time dual-card backup and careful planning of every moment — so that on the day itself everything feels effortless.',
  },
};
