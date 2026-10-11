/**
 * Client gallery copy, in Hebrew and English.
 *
 * Server-rendered components read `galleryCopy.x[lang]`; the browser app gets
 * the strings of one language as JSON (see `clientStrings`). Placeholders use
 * {braces}; plural strings are { one, two?, other } objects.
 */
import type { Lang } from '~/i18n';

export type Plural = { one: string; two?: string; other: string };
type Entry = Record<Lang, string | Plural>;

export const galleryCopy = {
  /* ── page & header ── */
  seoTitle: { he: 'גלריית לקוחות', en: 'Client Gallery' },
  seoDescription: {
    he: 'הגלריה הפרטית שלכם — כל התמונות מהאירוע, מועדפות, הורדה וחיפוש לפי פנים.',
    en: 'Your private gallery — every photo from your event, favourites, downloads and face search.',
  },
  home: { he: 'מושיק — לדף הבית', en: 'Moshik — home' },
  backToSite: { he: 'חזרה לאתר', en: 'Back to site' },
  switchLang: { he: 'Switch to English', en: 'מעבר לעברית' },
  noscript: { he: 'כדי לצפות בגלריה יש לאפשר JavaScript בדפדפן.', en: 'Please enable JavaScript to view your gallery.' },

  /* ── code entry ── */
  entryEyebrow: { he: 'גלריית לקוחות פרטית', en: 'Private client gallery' },
  entryTitle: { he: 'התמונות שלכם *מחכות*', en: 'Your photos are *waiting*' },
  entryLead: {
    he: 'הזינו את הקוד האישי שקיבלתם ממושיק כדי לפתוח את הגלריה.',
    en: 'Enter the private code from Moshik’s message to open your gallery.',
  },
  entryLabel: { he: 'קוד הגלריה', en: 'Gallery code' },
  entryHint: { he: 'אותיות באנגלית ומספרים — עם או בלי מקפים', en: 'Letters and numbers — dashes are optional' },
  entrySubmit: { he: 'לפתיחת הגלריה', en: 'Open my gallery' },
  entryOpening: { he: 'פותחים…', en: 'Opening…' },
  entryEmpty: { he: 'נא להזין את קוד הגלריה', en: 'Please enter your gallery code' },
  entryRecent: { he: 'נפתחו לאחרונה במכשיר הזה', en: 'Recently opened on this device' },
  entryContinue: { he: 'להמשיך אל {title}', en: 'Continue to {title}' },
  entryHelp: { he: 'הקוד הלך לאיבוד?', en: 'Lost your code?' },
  entryHelpLink: { he: 'כתבו למושיק בוואטסאפ', en: 'Message Moshik on WhatsApp' },
  entryMediaTitle: { he: 'לחיות את היום *מחדש*', en: 'Relive the day, *every time*' },
  entryMediaCaption: { he: 'גלריות פרטיות · מושיק צילום', en: 'Private galleries · Moshik Photography' },
  waNeedCode: {
    he: 'היי מושיק! אשמח לקבל את הקוד לגלריית התמונות שלי 🙂',
    en: 'Hi Moshik! Could you send me the code for my photo gallery? 🙂',
  },
  waHelp: {
    he: 'היי מושיק! אני מנסה לפתוח את הגלריה שלי ({ref}) ואשמח לעזרה 🙂',
    en: 'Hi Moshik! I’m trying to open my gallery ({ref}) and could use a hand 🙂',
  },

  /* ── loading & errors ── */
  loading: { he: 'פותחים את הגלריה שלכם…', en: 'Opening your gallery…' },
  errNotFoundTitle: { he: 'לא מצאנו גלריה עם הקוד הזה', en: 'We couldn’t find that code' },
  errNotFoundText: {
    he: 'כדאי לבדוק שאין טעות הקלדה — קוד נראה כך: NOA-DANIEL-K7QM.',
    en: 'Check for typos — codes look like NOA-DANIEL-K7QM.',
  },
  errMissingTitle: { he: 'לא הצלחנו למצוא את הגלריה', en: 'We couldn’t find this gallery' },
  errMissingText: {
    he: 'ייתכן שהקישור חלקי או שהגלריה הוסרה. נסו להזין את הקוד שקיבלתם, או כתבו למושיק.',
    en: 'The link may be incomplete, or the gallery was removed. Try entering your code, or message Moshik.',
  },
  errExpiredTitle: { he: 'תוקף הגלריה הסתיים', en: 'This gallery has expired' },
  errExpiredText: {
    he: 'הגלריות זמינות לתקופה מוגבלת. כתבו למושיק והוא ישמח לפתוח אותה עבורכם מחדש.',
    en: 'Galleries stay online for a limited time. Message Moshik and he’ll happily reopen it for you.',
  },
  errDraftTitle: { he: 'הגלריה עוד לא מוכנה', en: 'This gallery isn’t ready yet' },
  errDraftText: {
    he: 'מושיק עדיין מלטש את התמונות שלכם. תקבלו הודעה ברגע שהגלריה תהיה מוכנה.',
    en: 'Moshik is still putting the finishing touches on your photos. You’ll hear from him the moment it’s ready.',
  },
  errRateTitle: { he: 'יותר מדי ניסיונות', en: 'Too many attempts' },
  errRateText: {
    he: 'לשמירה על הפרטיות שלכם, נא להמתין כמה דקות ולנסות שוב.',
    en: 'To keep galleries private, please wait a few minutes and try again.',
  },
  errOfflineTitle: { he: 'הגלריות עוד לא מחוברות', en: 'Galleries aren’t connected yet' },
  errOfflineText: {
    he: 'שירות הגלריות באתר עדיין לא הופעל. כתבו למושיק והוא ישלח לכם את התמונות בדרך אחרת.',
    en: 'The online gallery service isn’t switched on yet. Message Moshik and he’ll get your photos to you another way.',
  },
  errNetworkTitle: { he: 'אין חיבור לאינטרנט', en: 'You seem to be offline' },
  errNetworkText: { he: 'בדקו את החיבור לאינטרנט ונסו שוב.', en: 'Check your internet connection and try again.' },
  errServerTitle: { he: 'משהו השתבש', en: 'Something went wrong' },
  errServerText: { he: 'נסו שוב בעוד רגע. אם זה חוזר, כתבו למושיק.', en: 'Please try again in a moment. If it keeps happening, message Moshik.' },
  actRetry: { he: 'לנסות שוב', en: 'Try again' },
  actEnterCode: { he: 'להזנת קוד', en: 'Enter a code' },
  actMessage: { he: 'לכתוב למושיק', en: 'Message Moshik' },

  /* ── cover & intro ── */
  coverEyebrow: { he: 'גלריה פרטית', en: 'Private gallery' },
  live: { he: 'בזמן אמת', en: 'Live' },
  liveNote: { he: 'תמונות חדשות מתווספות במהלך האירוע', en: 'New photos are added during the event' },
  viewPhotos: { he: 'לצפייה בתמונות', en: 'View photos' },
  openExternal: { he: 'לפתיחת הגלריה', en: 'Open your gallery' },
  externalNote: { he: 'התמונות שלכם מחכות בגלריה ייעודית.', en: 'Your photos are waiting in a dedicated gallery.' },
  scroll: { he: 'גללו', en: 'Scroll' },
  photos: { he: { one: 'תמונה אחת', other: '{n} תמונות' }, en: { one: '1 photo', other: '{n} photos' } },
  chapters: { he: { one: 'פרק אחד', other: '{n} פרקים' }, en: { one: '1 chapter', other: '{n} chapters' } },
  noteLabel: { he: 'כמה מילים ממושיק', en: 'A note from Moshik' },
  noteSignature: { he: 'מושיק', en: 'Moshik' },
  noteRole: { he: 'הצלם שלכם', en: 'Your photographer' },

  /* ── people ── */
  peopleTitle: { he: 'מי בתמונות', en: 'Who’s in the photos' },
  peopleHint: { he: 'לחצו על פנים כדי לראות את כל התמונות שבהן הם מופיעים', en: 'Tap a face to see every photo they appear in' },
  peopleCount: { he: { one: 'אדם אחד', other: '{n} אנשים' }, en: { one: '1 person', other: '{n} people' } },
  personLabel: { he: 'אדם {n} · {count}', en: 'Person {n} · {count}' },
  peoplePrev: { he: 'אנשים קודמים', en: 'Previous people' },
  peopleNext: { he: 'אנשים נוספים', en: 'More people' },
  peopleDialogTitle: { he: 'מי בתמונות', en: 'Who’s in the photos' },

  /* ── toolbar ── */
  filterLabel: { he: 'סינון תמונות', en: 'Filter photos' },
  tabAll: { he: 'הכל', en: 'All' },
  tabFavs: { he: 'מועדפות', en: 'Favourites' },
  tabMe: { he: 'התמונות שלי', en: 'Photos of you' },
  showingMe: { he: 'מציגים את התמונות שלכם', en: 'Showing photos of you' },
  showingPerson: { he: '{count} עם האדם הזה', en: '{count} with this person' },
  clear: { he: 'ניקוי', en: 'Clear' },
  clearFilter: { he: 'ניקוי הסינון', en: 'Clear filter' },
  findMe: { he: 'מצאו אותי', en: 'Find me' },
  people: { he: 'אנשים', en: 'People' },
  download: { he: 'הורדה', en: 'Download' },
  slideshow: { he: 'מצגת', en: 'Slideshow' },
  share: { he: 'שיתוף', en: 'Share' },
  more: { he: 'עוד', en: 'More' },
  moreTitle: { he: 'אפשרויות', en: 'Options' },
  qr: { he: 'קוד QR לגלריה', en: 'Gallery QR code' },

  /* ── grid ── */
  gridLabel: { he: 'תמונות', en: 'Photos' },
  gridKeys: {
    he: 'בין התמונות עוברים בחיצים; Enter פותח תמונה ו־F מוסיף למועדפות.',
    en: 'Move between photos with the arrow keys; Enter opens a photo and F adds it to favourites.',
  },
  photoAlt: { he: 'תמונה {n} מתוך {total}', en: 'Photo {n} of {total}' },
  favAdd: { he: 'הוספת תמונה {n} למועדפות', en: 'Add photo {n} to favourites' },
  favRemove: { he: 'הסרת תמונה {n} מהמועדפות', en: 'Remove photo {n} from favourites' },
  view: { he: 'צפייה', en: 'View' },
  otherSet: { he: 'רגעים נוספים', en: 'More moments' },
  emptyFavsTitle: { he: 'עוד אין מועדפות', en: 'No favourites yet' },
  emptyFavsText: { he: 'לחצו על הלב שבפינת התמונה כדי לשמור אותה כאן.', en: 'Tap the heart on any photo to keep it here.' },
  emptyGalleryTitle: { he: 'התמונות בדרך', en: 'Your photos are on their way' },
  emptyGalleryText: { he: 'מושיק מעלה את התמונות ממש עכשיו — כדאי לחזור לכאן בקרוב.', en: 'Moshik is uploading them right now — check back soon.' },
  emptyFilterTitle: { he: 'אין כאן תמונות', en: 'Nothing here yet' },
  emptyFilterText: { he: 'נסו סינון אחר.', en: 'Try another filter.' },
  showAll: { he: 'לכל התמונות', en: 'Show all photos' },
  announceShowing: { he: { one: 'מוצגת תמונה אחת', other: 'מוצגות {n} תמונות' }, en: { one: 'Showing 1 photo', other: 'Showing {n} photos' } },
  announceFavAdd: { he: 'נוספה למועדפות', en: 'Added to favourites' },
  announceFavRemove: { he: 'הוסרה מהמועדפות', en: 'Removed from favourites' },

  /* ── favourites bar & selection ── */
  favCount: { he: { one: 'מועדפת אחת', other: '{n} מועדפות' }, en: { one: '1 favourite', other: '{n} favourites' } },
  chosenCount: { he: { one: 'התמונה', other: '{n} התמונות' }, en: { one: 'favourite', other: '{n} favourites' } },
  favSend: { he: 'שליחה למושיק לאלבום', en: 'Send to Moshik for the album' },
  favSendShort: { he: 'שליחה למושיק', en: 'Send to Moshik' },
  favView: { he: 'צפייה', en: 'View' },
  favSent: { he: 'נשלח למושיק', en: 'Sent to Moshik' },
  favSendUpdate: { he: 'שליחת עדכון', en: 'Send an update' },
  selTitle: { he: 'שליחת המועדפות למושיק', en: 'Send your favourites' },
  selIntro: {
    he: 'בוחרים תמונות לאלבום? שלחו למושיק את {count} שבחרתם, והוא ימשיך משם.',
    en: 'Choosing photos for your album? Send Moshik your {count} and he’ll take it from there.',
  },
  selName: { he: 'שם', en: 'Your name' },
  selPhone: { he: 'טלפון', en: 'Phone' },
  selEmail: { he: 'אימייל', en: 'Email' },
  selNote: { he: 'הערה למושיק', en: 'A note for Moshik' },
  selNotePh: {
    he: 'כל מה שחשוב לכם באלבום — גודל, תמונות חובה, מה לדלג…',
    en: 'Anything about the album — size, must-haves, photos to skip…',
  },
  selContactHint: { he: 'טלפון או אימייל — כדי שמושיק יוכל לחזור אליכם', en: 'Phone or email — so Moshik can get back to you' },
  optional: { he: 'לא חובה', en: 'optional' },
  selErrName: { he: 'נא להזין שם', en: 'Please enter your name' },
  selErrContact: { he: 'נא להזין טלפון או אימייל', en: 'Please enter a phone number or an email' },
  selErrPhone: { he: 'נא להזין מספר טלפון תקין', en: 'Please enter a valid phone number' },
  selErrEmail: { he: 'נא להזין אימייל תקין', en: 'Please enter a valid email' },
  selSubmit: { he: { one: 'שליחת תמונה אחת', other: 'שליחת {n} תמונות' }, en: { one: 'Send 1 photo', other: 'Send {n} photos' } },
  selSending: { he: 'שולחים…', en: 'Sending…' },
  selPrivacy: { he: 'הפרטים משמשים רק כדי לחזור אליכם בנוגע לגלריה.', en: 'Your details are only used to get back to you about this gallery.' },
  selDoneTitle: { he: 'נשלח — תודה!', en: 'Sent — thank you!' },
  selDoneText: {
    he: 'מושיק קיבל את {count} שבחרתם ויחזור אליכם בנוגע לאלבום.',
    en: 'Moshik received your {count} and will be in touch about the album.',
  },
  selDoneBack: { he: 'חזרה לתמונות', en: 'Back to the photos' },
  selFailTitle: { he: 'לא הצלחנו לשלוח את הבחירה', en: 'We couldn’t send your selection' },
  selFailText: { he: 'לא נורא — אפשר לשלוח אותה בוואטסאפ בלחיצה:', en: 'No worries — you can send it on WhatsApp in one tap:' },
  selSendWa: { he: 'שליחה בוואטסאפ', en: 'Send on WhatsApp' },
  waSelection: {
    he: 'היי מושיק! אלה התמונות שבחרנו מתוך „{title}” ({count}):\n{list}',
    en: 'Hi Moshik! These are our favourites from “{title}” ({count}):\n{list}',
  },

  /* ── downloads ── */
  dlTitle: { he: 'הורדת תמונות', en: 'Download photos' },
  dlQuality: { he: 'איכות', en: 'Quality' },
  dlWeb: { he: 'לרשת ולשיתוף', en: 'Web & sharing' },
  dlWebSub: { he: 'עד 2048 פיקסלים', en: 'Up to 2048 px' },
  dlOrig: { he: 'קבצי מקור', en: 'Originals' },
  dlOrigSub: { he: 'רזולוציה מלאה, להדפסה', en: 'Full resolution, for print' },
  dlFavs: { he: 'המועדפות שלכם', en: 'Your favourites' },
  dlFavsEmpty: { he: 'סמנו תמונות בלב כדי להוריד רק אותן.', en: 'Heart some photos to download just those.' },
  dlAll: { he: 'כל התמונות', en: 'All photos' },
  dlPart: { he: 'חלק {n}', en: 'Part {n}' },
  dlRange: { he: 'תמונות {a}–{b}', en: 'Photos {a}–{b}' },
  dlNote: {
    he: 'התמונות יורדות כקובצי ZIP. גלריות גדולות מחולקות לחלקים של עד {n} תמונות — מומלץ להוריד ב־Wi-Fi.',
    en: 'Photos download as ZIP files. Big galleries are split into parts of up to {n} photos — best on Wi-Fi.',
  },
  dlStarting: { he: 'ההורדה מתחילה…', en: 'Your download is starting…' },
  dlDisabled: { he: 'ההורדה לא זמינה בגלריה הזו', en: 'Downloads aren’t available for this gallery' },

  /* ── find me ── */
  fmTitle: { he: 'מצאו את עצמכם בתמונות', en: 'Find yourself in the photos' },
  fmIntro: {
    he: 'צלמו סלפי מהיר ונציג לכם את כל התמונות שבהן אתם מופיעים.',
    en: 'Take a quick selfie and we’ll show you every photo you’re in.',
  },
  fmPrivacyTitle: { he: 'הסלפי לא יוצא מהטלפון שלכם', en: 'Your selfie never leaves your phone' },
  fmPrivacy: {
    he: 'התמונה מעובדת כאן, על המכשיר. רק חתימת פנים אנונימית (רצף מספרים) נשלחת להשוואה — ושום דבר לא נשמר.',
    en: 'It’s analysed right here on your device. Only an anonymous face signature (a list of numbers) is compared — nothing is stored.',
  },
  fmCamera: { he: 'צילום סלפי', en: 'Take a selfie' },
  fmCameraSub: { he: 'במצלמה הקדמית', en: 'With your front camera' },
  fmUpload: { he: 'העלאת תמונה', en: 'Upload a photo' },
  fmUploadSub: { he: 'תמונה ברורה של הפנים', en: 'A clear photo of your face' },
  fmGuide: { he: 'מקמו את הפנים במרכז המסגרת', en: 'Centre your face in the frame' },
  fmCapture: { he: 'צילום', en: 'Take photo' },
  fmBack: { he: 'חזרה', en: 'Back' },
  fmPreparing: { he: 'מכינים את זיהוי הפנים…', en: 'Preparing face recognition…' },
  fmDetecting: { he: 'מאתרים את הפנים שלכם…', en: 'Looking for your face…' },
  fmSearching: { he: 'מחפשים בין {count}…', en: 'Searching {count}…' },
  fmFound: { he: { one: 'מצאנו תמונה אחת שלכם', other: 'מצאנו {n} תמונות שלכם' }, en: { one: 'We found 1 photo of you', other: 'We found {n} photos of you' } },
  fmFoundText: { he: 'ההתאמות הקרובות ביותר מוצגות ראשונות.', en: 'Closest matches first.' },
  fmShow: { he: 'להצגת התמונות שלי', en: 'Show my photos' },
  fmRetry: { he: 'לנסות תמונה אחרת', en: 'Try another photo' },
  fmNoneTitle: { he: 'עוד לא מצאנו אתכם', en: 'We couldn’t find you yet' },
  fmNoneText: {
    he: 'זה יכול לקרות עם משקפי שמש, צללים חזקים, או אם התמונות שלכם עוד לא הועלו. נסו סלפי ברור ומואר יותר.',
    en: 'This can happen with sunglasses, strong shadows, or if your photos aren’t uploaded yet. Try a clearer, well-lit selfie.',
  },
  fmNoFaceTitle: { he: 'לא הצלחנו לזהות פנים', en: 'We couldn’t see a face' },
  fmNoFaceText: { he: 'נסו באור טוב יותר והסתכלו ישר למצלמה.', en: 'Try better light and look straight at the camera.' },
  fmUnavailableTitle: { he: 'חיפוש הפנים לא זמין כרגע', en: 'Face search isn’t available right now' },
  fmUnavailableText: {
    he: 'עדיין אפשר לדפדף לפי אנשים או לגלול בגלריה. נסו שוב מאוחר יותר.',
    en: 'You can still browse by people or scroll through the gallery. Please try again later.',
  },
  fmNotReadyTitle: { he: 'חיפוש הפנים עוד לא מוכן כאן', en: 'Face search isn’t ready here yet' },
  fmNotReadyText: { he: 'מושיק עדיין מכין את הגלריה לחיפוש לפי פנים. נסו שוב בקרוב.', en: 'Moshik is still preparing this gallery for face search. Try again soon.' },
  fmCameraDeniedTitle: { he: 'אין גישה למצלמה', en: 'We can’t use your camera' },
  fmCameraDeniedText: {
    he: 'אפשרו גישה למצלמה בהגדרות הדפדפן, או העלו תמונה במקום.',
    en: 'Allow camera access in your browser settings, or upload a photo instead.',
  },
  close: { he: 'סגירה', en: 'Close' },

  /* ── lightbox ── */
  lbClose: { he: 'סגירה', en: 'Close' },
  lbZoom: { he: 'הגדלה', en: 'Zoom' },
  lbPrev: { he: 'התמונה הקודמת', en: 'Previous photo' },
  lbNext: { he: 'התמונה הבאה', en: 'Next photo' },
  lbError: { he: 'לא הצלחנו לטעון את התמונה', en: 'The photo could not be loaded' },
  lbFav: { he: 'הוספה למועדפות', en: 'Add to favourites' },
  lbUnfav: { he: 'הסרה מהמועדפות', en: 'Remove from favourites' },
  lbDownload: { he: 'הורדת התמונה', en: 'Download photo' },
  lbShare: { he: 'שיתוף', en: 'Share' },
  lbPlay: { he: 'הפעלת המצגת', en: 'Play slideshow' },
  lbPause: { he: 'עצירת המצגת', en: 'Pause slideshow' },

  /* ── share, live, footer ── */
  shareTitle: { he: '{title} — צילום: מושיק', en: '{title} — photos by Moshik' },
  shareText: { he: 'התמונות מ„{title}” כאן:', en: 'The photos from “{title}” are here:' },
  linkCopied: { he: 'הקישור הועתק', en: 'Link copied' },
  copyFailed: { he: 'לא הצלחנו להעתיק את הקישור', en: 'Couldn’t copy the link' },
  showQr: { he: 'קוד QR', en: 'QR code' },
  qrTitle: { he: 'סרקו כדי לפתוח את הגלריה', en: 'Scan to open the gallery' },
  qrText: { he: 'מושלם לשיתוף עם חברים ומשפחה, ממש מהטלפון.', en: 'Perfect for passing the gallery to friends and family, phone to phone.' },
  copyLink: { he: 'העתקת הקישור', en: 'Copy link' },
  newPhotos: { he: 'תמונות חדשות הגיעו הרגע', en: 'New photos just arrived' },
  showNew: { he: 'להצגה', en: 'Show' },
  footCredit: { he: 'צולם באהבה על ידי מושיק', en: 'Photographed with love by Moshik' },
  footCta: { he: 'מתכננים שמחה משלכם?', en: 'Planning a celebration of your own?' },
  footCtaLink: { he: 'לבדיקת תאריך', en: 'Check your date' },
  error: { he: 'משהו השתבש, נסו שוב', en: 'Something went wrong — please try again' },
} satisfies Record<string, Entry>;

export type CopyKey = keyof typeof galleryCopy;
export type ClientStrings = Record<CopyKey, string | Plural>;

/** One language's strings, for the browser app. */
export function clientStrings(lang: Lang): ClientStrings {
  return Object.fromEntries(Object.entries(galleryCopy).map(([k, v]) => [k, v[lang]])) as ClientStrings;
}

/** Plain string for server-side rendering (plural entries use their `other` form). */
export function str(key: CopyKey, lang: Lang): string {
  const v = galleryCopy[key][lang];
  return typeof v === 'string' ? v : v.other;
}
