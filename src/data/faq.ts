import type { Localized } from '~/i18n';

export interface FaqItem {
  id: string;
  /** Topics let a page show only the relevant questions. */
  topics: ('booking' | 'delivery' | 'gallery' | 'day' | 'pricing' | 'general')[];
  q: Localized;
  a: Localized;
}

export const faq: FaqItem[] = [
  {
    id: 'how-early',
    topics: ['booking', 'general'],
    q: { he: 'כמה זמן מראש כדאי לסגור צלם?', en: 'How far in advance should we book?' },
    a: {
      he: 'לחתונות בעונה (מאי–אוקטובר) ולימי חמישי — מומלץ 9–14 חודשים מראש, כי התאריכים המבוקשים נתפסים ראשונים. לאירועים קטנים יותר לרוב מספיקים חודש־חודשיים. בכל מקרה שווה לבדוק — לפעמים גם תאריך קרוב עדיין פנוי.',
      en: 'For weddings in high season (May–October) and on Thursdays, 9–14 months ahead is ideal — popular dates go first. Smaller events usually need just a month or two. Either way it’s worth asking: sometimes even a close date is still free.',
    },
  },
  {
    id: 'reserve',
    topics: ['booking', 'pricing'],
    q: { he: 'איך שומרים את התאריך?', en: 'How do we reserve our date?' },
    a: {
      he: 'אחרי שיחת היכרות ובחירת חבילה, נחתום על הסכם דיגיטלי פשוט ותשלמו מקדמה של 20%. מאותו רגע התאריך שמור רק לכם. היתרה משולמת עד יום האירוע — בהעברה בנקאית, בביט או בכרטיס אשראי.',
      en: 'After an intro call and choosing a package, we sign a simple digital agreement and you pay a 20% deposit — from that moment the date is yours. The balance is due by the event day, by bank transfer, Bit or credit card.',
    },
  },
  {
    id: 'when-photos',
    topics: ['delivery', 'general'],
    q: { he: 'מתי נקבל את התמונות?', en: 'When will we get our photos?' },
    a: {
      he: 'טעימה ראשונה של 30–50 תמונות תוך 48 שעות, והגלריה המלאה — כשכל תמונה ערוכה בנפרד — תוך 4–6 שבועות. צריכים מהר יותר? אפשר להוסיף מסירה מהירה תוך 10 ימים.',
      en: 'A sneak peek of 30–50 images within 48 hours, and the full gallery — every image individually edited — within 4–6 weeks. Need it sooner? Add express delivery within 10 days.',
    },
  },
  {
    id: 'gallery',
    topics: ['delivery', 'gallery'],
    q: { he: 'איך מקבלים את התמונות?', en: 'How do we receive the photos?' },
    a: {
      he: 'בגלריה אונליין פרטית ומעוצבת, עם קישור וקוד אישי. אפשר לצפות, לסמן מועדפות לאלבום, להוריד ברזולוציה מלאה ולשתף עם האורחים — שיכולים למצוא את כל התמונות שלהם בעזרת סלפי אחד.',
      en: 'In a private, beautifully designed online gallery with a personal link and code. You can view, mark favourites for your album, download in full resolution and share with guests — who can find all their photos with a single selfie.',
    },
  },
  {
    id: 'face-search',
    topics: ['gallery'],
    q: { he: 'איך עובד החיפוש לפי פנים? הסלפי שלי נשמר?', en: 'How does face search work? Is my selfie stored?' },
    a: {
      he: 'הזיהוי מתבצע ישירות על הטלפון או המחשב שלכם: הסלפי לא נשלח לשום מקום ולא נשמר. המערכת משווה בין “טביעת פנים” מתמטית לבין התמונות בגלריה הספציפית בלבד, ומציגה לכם את התמונות שבהן אתם מופיעים.',
      en: 'Recognition happens right on your phone or computer: your selfie is never uploaded or stored. The system compares a mathematical “face signature” only against the photos in that specific gallery, and shows you the ones you appear in.',
    },
  },
  {
    id: 'travel',
    topics: ['booking', 'pricing', 'general'],
    q: { he: 'אתה מגיע לכל הארץ?', en: 'Do you travel?' },
    a: {
      he: 'בהחלט — מהגליל ועד אילת. בצפון הרחוק ובדרום הרחוק עשויה להתווסף עלות נסיעה סמלית. מצלם גם חתונות יעד בחו״ל — דברו איתי.',
      en: 'Absolutely — from the Galilee to Eilat. A small travel fee may apply for the far north and south. I also photograph destination weddings abroad — let’s talk.',
    },
  },
  {
    id: 'second-shooter',
    topics: ['day', 'pricing'],
    q: { he: 'צריך צלם נוסף?', en: 'Do we need a second photographer?' },
    a: {
      he: 'מעל 250 אורחים, או כשרוצים לתעד במקביל את ההתארגנות של שני הצדדים — מומלץ מאוד. צלם נוסף נותן זווית שנייה לחופה, לריקוד הראשון ולכל רגע שקורה בשני מקומות בבת אחת.',
      en: 'For 250+ guests, or if you’d like both getting-ready sessions covered at the same time — highly recommended. A second photographer adds another angle on the ceremony, the first dance and every moment happening in two places at once.',
    },
  },
  {
    id: 'religious',
    topics: ['day', 'general'],
    q: { he: 'אתה מצלם גם אירועים דתיים ומסורתיים?', en: 'Do you photograph religious and traditional events?' },
    a: {
      he: 'כמובן. יש לי ניסיון רב בחתונות דתיות ומסורתיות, בהפרדה בריקודים ובטקסים מכל העדות — ואני מקפיד לכבד את המנהגים ואת הרצונות של כל משפחה.',
      en: 'Of course. I have extensive experience with religious and traditional weddings, separate dancing and ceremonies of every community — and I always respect each family’s customs and wishes.',
    },
  },
  {
    id: 'album',
    topics: ['delivery', 'pricing'],
    q: { he: 'איך בוחרים תמונות לאלבום?', en: 'How do we choose photos for the album?' },
    a: {
      he: 'פשוט מסמנים לב על התמונות האהובות בגלריה ושולחים לי את הבחירה בלחיצה. אני מעצב את האלבום, שולח לכם הדמיה לאישור, ורק אז הוא יוצא להדפסה.',
      en: 'Just tap the heart on your favourite images in the gallery and send me your selection with one click. I design the album, send you a preview to approve, and only then does it go to print.',
    },
  },
  {
    id: 'raw',
    topics: ['delivery'],
    q: { he: 'אפשר לקבל את כל התמונות הלא ערוכות?', en: 'Can we get the unedited (RAW) files?' },
    a: {
      he: 'אני מוסר רק תמונות ערוכות — העריכה היא חלק בלתי נפרד מהסגנון שלי. אבל אל דאגה: אני מוסר את כל הרגעים הטובים, ולא רק “מבחר”.',
      en: 'I deliver edited images only — editing is an inseparable part of my style. But don’t worry: you get every good moment, not just a “selection”.',
    },
  },
  {
    id: 'magnets',
    topics: ['day', 'pricing'],
    q: { he: 'יש עמדת מגנטים?', en: 'Do you offer a magnet station?' },
    a: {
      he: 'כן — צלם ייעודי ומדפסת באירוע, כך שכל אורח הולך הביתה עם מגנט מעוצב בעיצוב האירוע שלכם. אפשר להוסיף לכל חבילה.',
      en: 'Yes — a dedicated photographer and printer at your event, so every guest goes home with a photo magnet designed to match your celebration. It can be added to any package.',
    },
  },
  {
    id: 'weather',
    topics: ['day'],
    q: { he: 'ומה אם יורד גשם?', en: 'What if it rains?' },
    a: {
      he: 'גשם בחתונה הוא סימן למזל (וגם לתמונות מיוחדות במיוחד). תמיד יש לי תוכנית ב׳ לצילומי הזוגיות, ומטריות שקופות באוטו.',
      en: 'Rain on your wedding day is good luck — and makes for very special photos. I always have a plan B for the couple portraits, and clear umbrellas in the car.',
    },
  },
];
