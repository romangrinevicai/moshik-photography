/**
 * Accessibility statement & privacy policy.
 * TEMPLATES — TODO(launch): review with a lawyer and fill in the real details.
 */
import { site } from '~/config/site';
import type { Localized } from '~/i18n';

const c = site.contact;
const contactLine = {
  he: `טלפון: <span dir="ltr">${c.phoneDisplay}</span> · אימייל: <a href="mailto:${c.email}">${c.email}</a>`,
  en: `Phone: <span dir="ltr">${c.phoneDisplay}</span> · Email: <a href="mailto:${c.email}">${c.email}</a>`,
};

export interface LegalPage {
  path: string;
  title: Localized;
  description: Localized;
  updated: string;
  html: Localized;
}

export const accessibility: LegalPage = {
  path: '/accessibility/',
  title: { he: 'הצהרת נגישות', en: 'Accessibility statement' },
  description: {
    he: 'הצהרת הנגישות של אתר מושיק — צילום חתונות ואירועים: התאמות שבוצעו, דרכי פנייה ורכז נגישות.',
    en: 'Accessibility statement for Moshik’s photography website: adjustments made, how to reach us and the accessibility coordinator.',
  },
  updated: site.accessibilityContact.lastReviewed,
  html: {
    he: `
<p>אנו רואים חשיבות רבה במתן שירות שוויוני לכל הלקוחות והגולשים, ופועלים כדי שהאתר יהיה נגיש ונוח לשימוש עבור אנשים עם מוגבלות, בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג–2013, ולתקן הישראלי ת״י 5568 המבוסס על הנחיות WCAG ברמה AA.</p>
<h2>מה עשינו כדי להנגיש את האתר</h2>
<ul>
  <li>מבנה סמנטי וכותרות היררכיות, המאפשרים ניווט נוח בקוראי מסך.</li>
  <li>ניווט מלא באמצעות מקלדת, כולל קישור “דלג לתוכן הראשי” וסימון פוקוס ברור.</li>
  <li>טקסט חלופי לתמונות, ותיאורים לרכיבים אינטראקטיביים.</li>
  <li>ניגודיות צבעים מספקת, וטקסט שניתן להגדלה עד 200% ללא אובדן תוכן.</li>
  <li>תפריט נגישות מובנה: הגדלת והקטנת טקסט, ניגודיות גבוהה, הדגשת קישורים, גופן קריא, גווני אפור ועצירת אנימציות.</li>
  <li>כיבוד הגדרת “הפחתת תנועה” של מערכת ההפעלה — האנימציות נעצרות אוטומטית.</li>
  <li>מצגות מתחלפות כוללות כפתור עצירה והפעלה.</li>
  <li>טפסים עם תוויות ברורות, הודעות שגיאה מפורטות ותמיכה בהשלמה אוטומטית.</li>
  <li>האתר מותאם לתצוגה במחשב, בטאבלט ובטלפון הנייד.</li>
</ul>
<h2>הסתייגויות</h2>
<p>למרות מאמצינו, ייתכן שחלקים מסוימים באתר טרם הונגשו במלואם — למשל תמונות רבות בגלריות הלקוחות הפרטיות, שאינן כוללות תיאור מילולי מפורט, או תכנים מוטמעים של צד שלישי. אנו ממשיכים לשפר את הנגישות באופן שוטף.</p>
<h2>נתקלתם בבעיה? דברו איתנו</h2>
<p>אם נתקלתם ברכיב שאינו נגיש, או שאתם זקוקים למידע או לשירות בדרך נגישה אחרת, נשמח לעזור. רכז הנגישות: <strong>${site.accessibilityContact.name.he}</strong>.</p>
<p>${contactLine.he}</p>
<p>כדי שנוכל לטפל בפנייה, נשמח לקבל תיאור הבעיה, הדף שבו נתקלתם בה, וסוג הדפדפן והטכנולוגיה המסייעת שבהם השתמשתם.</p>
`,
    en: `
<p>We believe everyone deserves equal access, and we work to make this website accessible and easy to use for people with disabilities, in line with the Israeli Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 2013, and Israeli Standard IS 5568, which is based on WCAG level AA.</p>
<h2>What we have done</h2>
<ul>
  <li>Semantic structure and a clear heading hierarchy for easy screen-reader navigation.</li>
  <li>Full keyboard navigation, including a “skip to main content” link and visible focus states.</li>
  <li>Text alternatives for images and labels for interactive elements.</li>
  <li>Sufficient colour contrast, and text that can be enlarged to 200% without loss of content.</li>
  <li>A built-in accessibility menu: text size, high contrast, highlighted links, readable font, grayscale and stopping animations.</li>
  <li>The operating system’s “reduce motion” preference is respected — animations stop automatically.</li>
  <li>Rotating slideshows include a pause/play control.</li>
  <li>Forms with clear labels, descriptive error messages and autocomplete support.</li>
  <li>A responsive layout for desktop, tablet and mobile.</li>
</ul>
<h2>Known limitations</h2>
<p>Despite our efforts, some parts of the site may not yet be fully accessible — for example the many images in private client galleries, which do not include detailed descriptions, or embedded third-party content. We keep improving accessibility on an ongoing basis.</p>
<h2>Found a problem? Contact us</h2>
<p>If something isn’t accessible, or you need information or a service in another accessible way, we’re happy to help. Accessibility coordinator: <strong>${site.accessibilityContact.name.en}</strong>.</p>
<p>${contactLine.en}</p>
<p>To help us respond, please describe the problem, the page where it happened, and the browser and assistive technology you were using.</p>
`,
  },
};

export const privacy: LegalPage = {
  path: '/privacy/',
  title: { he: 'מדיניות פרטיות', en: 'Privacy policy' },
  description: {
    he: 'איך אנחנו אוספים, שומרים ומשתמשים במידע — טופס יצירת הקשר, גלריות הלקוחות וזיהוי הפנים.',
    en: 'How we collect, store and use information — the contact form, client galleries and face search.',
  },
  updated: '2026-10-11',
  html: {
    he: `
<p>הפרטיות שלכם חשובה לנו. מדיניות זו מסבירה איזה מידע נאסף באתר, למה, ומה הזכויות שלכם, בהתאם לחוק הגנת הפרטיות, התשמ״א–1981 והתקנות שמכוחו.</p>
<h2>איזה מידע אנחנו אוספים</h2>
<ul>
  <li><strong>טופס יצירת קשר:</strong> שם, טלפון, אימייל, פרטי האירוע (סוג, תאריך, מקום, מספר אורחים), החבילה והתוספות שבחרתם, וכל מה שתכתבו בהודעה.</li>
  <li><strong>פניות בוואטסאפ, בטלפון או במייל:</strong> המידע שתבחרו לשתף.</li>
  <li><strong>גלריות לקוחות:</strong> התמונות מהאירוע, וכן בחירות שתבצעו בגלריה (כמו תמונות מועדפות לאלבום).</li>
  <li><strong>מדידה:</strong> אם הופעל כלי מדידה (כגון Google Analytics), נאסף מידע סטטיסטי אנונימי — וזאת רק לאחר אישורכם.</li>
</ul>
<h2>למה אנחנו משתמשים במידע</h2>
<p>כדי לחזור אליכם, להכין הצעת מחיר, לתאם ולספק את שירותי הצילום, למסור את התמונות ולשפר את האתר. איננו מוכרים מידע ואיננו מעבירים אותו לצדדים שלישיים, למעט ספקי שירות הכרחיים (אחסון, שליחת התראות במייל) הפועלים מטעמנו.</p>
<h2>גלריות לקוחות וזיהוי פנים</h2>
<ul>
  <li>הגלריות פרטיות ונגישות רק למי שקיבל קישור או קוד גישה. אינן מופיעות במנועי חיפוש.</li>
  <li><strong>חיפוש לפי סלפי:</strong> הזיהוי מתבצע על המכשיר שלכם בלבד. הסלפי אינו נשלח לשרת ואינו נשמר. לשרת נשלח רק וקטור מספרי אנונימי לצורך ההשוואה, והוא אינו נשמר.</li>
  <li><strong>קיבוץ לפי אנשים:</strong> כדי להציג אלבומים לפי אנשים, מחושבים עבור תמונות הגלריה וקטורים מספריים של פנים. הם נשמרים יחד עם הגלריה בלבד, משמשים אך ורק לגלריה זו, ונמחקים עם מחיקתה.</li>
  <li>אורח שמעדיף שתמונותיו או נתוני הפנים שלו יוסרו מהגלריה — מוזמן לפנות אלינו ונטפל בבקשה בהקדם.</li>
</ul>
<h2>אבטחה ושמירה</h2>
<p>המידע נשמר בשרתי Cloudflare עם הצפנה בתעבורה ובגישה מוגבלת. פניות נשמרות כל עוד הן נחוצות לטיפול ולמתן השירות; גלריות נשמרות לתקופה שסוכמה עם הלקוח.</p>
<h2>עוגיות</h2>
<p>האתר משתמש באחסון מקומי בדפדפן כדי לזכור העדפות (כמו הגדרות נגישות ותמונות מועדפות). עוגיות מדידה או פרסום מופעלות רק אם אישרתם זאת.</p>
<h2>הזכויות שלכם</h2>
<p>אתם רשאים לבקש לעיין במידע שנשמר עליכם, לתקן אותו או למחוק אותו. לפניות: ${contactLine.he}</p>
`,
    en: `
<p>Your privacy matters to us. This policy explains what information the site collects, why, and what your rights are, in line with the Israeli Protection of Privacy Law, 1981 and its regulations.</p>
<h2>What we collect</h2>
<ul>
  <li><strong>Contact form:</strong> name, phone, email, event details (type, date, place, guests), the package and add-ons you chose, and anything you write in your message.</li>
  <li><strong>WhatsApp, phone or email inquiries:</strong> whatever you choose to share.</li>
  <li><strong>Client galleries:</strong> the photos from your event, and selections you make in the gallery (such as favourites for your album).</li>
  <li><strong>Measurement:</strong> if an analytics tool (such as Google Analytics) is enabled, anonymous statistics are collected — only after you agree.</li>
</ul>
<h2>Why we use it</h2>
<p>To get back to you, prepare a quote, arrange and deliver the photography services, deliver your photos and improve the site. We never sell information or share it with third parties, except essential service providers (hosting, email notifications) acting on our behalf.</p>
<h2>Client galleries and face search</h2>
<ul>
  <li>Galleries are private and available only to people who received a link or access code. They are not indexed by search engines.</li>
  <li><strong>Selfie search:</strong> recognition happens on your own device. Your selfie is never uploaded or stored. Only an anonymous numeric vector is sent to the server for matching, and it is not stored.</li>
  <li><strong>People albums:</strong> to group photos by person, numeric face vectors are computed for the gallery photos. They are stored only with that gallery, used only for that gallery, and deleted together with it.</li>
  <li>Guests who prefer that their photos or face data be removed from a gallery are welcome to contact us and we’ll take care of it promptly.</li>
</ul>
<h2>Security and retention</h2>
<p>Information is stored on Cloudflare servers with encryption in transit and restricted access. Inquiries are kept as long as needed to handle them and provide the service; galleries are kept for the period agreed with the client.</p>
<h2>Cookies</h2>
<p>The site uses your browser’s local storage to remember preferences (such as accessibility settings and favourite photos). Measurement or advertising cookies are used only if you agree.</p>
<h2>Your rights</h2>
<p>You may ask to see the information stored about you, correct it or delete it. Contact: ${contactLine.en}</p>
`,
  },
};
