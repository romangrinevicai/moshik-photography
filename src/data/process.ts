import type { Localized } from '~/i18n';
import type { IconName } from '~/shared/icons';

export interface Step {
  icon: IconName;
  title: Localized;
  text: Localized;
}

export const process: Step[] = [
  {
    icon: 'message-circle',
    title: { he: 'כותבים לי', en: 'Say hello' },
    text: {
      he: 'שולחים הודעה בוואטסאפ או ממלאים טופס קצר. אחזור אליכם עם תשובה לגבי התאריך — ועם השאלות שחשוב לשאול.',
      en: 'Send a WhatsApp message or fill in the form. I’ll get back to you with availability for your date and all the right questions.',
    },
  },
  {
    icon: 'coffee',
    title: { he: 'נפגשים ומתכננים', en: 'Meet & plan' },
    text: {
      he: 'על קפה או בזום: נכיר, נדבר על מה שחשוב לכם, ונבנה יחד את הלו״ז, הלוקיישנים ורשימת צילומי המשפחה.',
      en: 'Coffee or Zoom: we get to know each other, talk about what matters to you and build the timeline, locations and family-photo list together.',
    },
  },
  {
    icon: 'calendar-check',
    title: { he: 'שומרים את התאריך', en: 'Reserve your date' },
    text: {
      he: 'הסכם דיגיטלי פשוט, מקדמה — והתאריך שלכם. מכאן ועד היום הגדול, אני כאן לכל שאלה.',
      en: 'A simple digital agreement and a deposit — and the date is yours. From here I’m available for any question, all the way to the big day.',
    },
  },
  {
    icon: 'camera',
    title: { he: 'היום הגדול', en: 'The big day' },
    text: {
      he: 'מהכפתור הראשון ועד הריקוד האחרון אני שם — שקט, קשוב, כמעט שקוף. ואתם? פשוט נהנים.',
      en: 'I’m there from the first button to the last dance — calm, attentive and unobtrusive. You simply enjoy.',
    },
  },
  {
    icon: 'images',
    title: { he: 'הגלריה שלכם', en: 'Your gallery' },
    text: {
      he: 'טעימה ראשונה תוך 48 שעות, והגלריה המלאה תוך 4–6 שבועות — פרטית, עם חיפוש לפי פנים לכל האורחים.',
      en: 'A sneak peek within 48 hours and a full private gallery within 4–6 weeks — with face search for every guest.',
    },
  },
];
