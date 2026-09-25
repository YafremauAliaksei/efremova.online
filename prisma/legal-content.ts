/**
 * ЧЕРНОВИКИ правовых документов для наполнения базы.
 *
 * ⚠️ ЭТО НЕ ГОТОВЫЕ ЮРИДИЧЕСКИЕ ТЕКСТЫ.
 * Структура соответствует требованиям GDPR (ст. 13–14) и польского
 * законодательства о защите прав потребителей, но содержание обязан
 * проверить юрист. Каждая редакция помечена isDraft: true — на сайте
 * поверх неё показывается предупреждение.
 *
 * ⚖️ Польский язык — основной: владелец ведёт деятельность в Польше,
 * и документы для потребителя должны быть доступны на польском.
 * Русский и английский — переводы.
 *
 * Каждый документ — в своём файле в prisma/legal/.
 *
 * Текст хранится структурой, а не HTML: его невозможно превратить
 * в вектор XSS и не нужен парсер разметки.
 */

import { PRIVACY_DOCUMENTS } from './legal/privacy';
import { PROVIDER_DOCUMENTS } from './legal/provider';
import { SITE_TERMS_DOCUMENTS } from './legal/site-terms';
import type { LegalDocumentSeed } from './legal/types';

export type { LegalDocumentSeed, LegalSection } from './legal/types';

const TERMS_VERSION = 'terms-2026-09-13';

export const LEGAL_DOCUMENTS: LegalDocumentSeed[] = [
  ...PRIVACY_DOCUMENTS,
  ...PROVIDER_DOCUMENTS,
  ...SITE_TERMS_DOCUMENTS,

  // ═══════════════════════ REGULAMIN (PL) ═══════════════════════
  {
    slug: 'terms',
    locale: 'pl',
    version: TERMS_VERSION,
    title: 'Regulamin świadczenia usług',
    sections: [
      {
        heading: '1. Przedmiot',
        paragraphs: [
          'Usługodawca świadczy usługi konsultacji psychologicznych w formie wideorozmowy. Dokonując rezerwacji, akceptujesz warunki niniejszego regulaminu.',
        ],
      },
      {
        heading: '2. Czego konsultacja nie zastępuje',
        paragraphs: [
          'Konsultacja psychologiczna nie jest świadczeniem zdrowotnym i nie zastępuje wizyty u lekarza, diagnozy ani leczenia farmakologicznego. Usługa nie jest przeznaczona do sytuacji nagłych.',
          'W razie zagrożenia życia lub zdrowia należy skontaktować się z numerem alarmowym 112.',
        ],
      },
      {
        heading: '3. Rezerwacja, zmiana terminu i odwołanie',
        items: [
          'Rezerwacja odbywa się przez panel klienta na wolny termin w grafiku.',
          'Zmiana terminu lub odwołanie bez utraty opłaty są możliwe nie później niż 24 godziny przed rozpoczęciem konsultacji.',
          'W przypadku spóźnienia konsultacja kończy się w pierwotnie zaplanowanym czasie.',
          'Jeżeli konsultacja nie odbyła się z przyczyn leżących po stronie usługodawcy, termin zostaje przeniesiony lub opłata zwrócona w całości.',
        ],
      },
      {
        heading: '4. Prawo odstąpienia od umowy',
        paragraphs: [
          'Konsumentowi przysługuje prawo odstąpienia od umowy zawartej na odległość w terminie 14 dni. Jeżeli konsultacja ma się odbyć przed upływem tego terminu, wymagana jest wyraźna zgoda na rozpoczęcie świadczenia — wówczas prawo odstąpienia wygasa z chwilą wykonania usługi.',
        ],
      },
      {
        heading: '5. Płatność',
        paragraphs: [
          'Ceny podane są na stronie „Usługi” i zależą od regionu. Płatność następuje przed rozpoczęciem konsultacji. Numery kart płatniczych nie przechodzą przez serwis.',
        ],
      },
      {
        heading: '6. Poufność',
        paragraphs: [
          'Wszystko, co omawiane jest podczas konsultacji, jest poufne. Wyjątki wynikają z przepisów prawa i standardów zawodowych, przede wszystkim w sytuacji bezpośredniego zagrożenia życia.',
        ],
      },
      {
        heading: '7. Reklamacje',
        paragraphs: [
          'Reklamację można złożyć na adres kontaktowy wskazany w serwisie. Odpowiedź następuje w terminie 14 dni. Konsument może również skorzystać z pozasądowych sposobów rozpatrywania reklamacji.',
        ],
      },
    ],
  },

  // ═══════════════════════ ПУБЛИЧНАЯ ОФЕРТА (RU) ═══════════════════════
  {
    slug: 'terms',
    locale: 'ru',
    version: TERMS_VERSION,
    title: 'Условия оказания услуг',
    sections: [
      {
        heading: '1. Предмет',
        paragraphs: [
          'Исполнитель оказывает услуги психологического консультирования в формате видеосвязи. Записываясь на консультацию, вы принимаете условия настоящего документа.',
        ],
      },
      {
        heading: '2. Что консультация не заменяет',
        paragraphs: [
          'Психологическое консультирование не является медицинской помощью и не заменяет обращения к врачу, постановки диагноза или назначения лекарств. Услуга не предназначена для экстренных ситуаций.',
          'При угрозе жизни или здоровью обратитесь в службу экстренной помощи: 112.',
        ],
      },
      {
        heading: '3. Запись, перенос и отмена',
        items: [
          'Запись производится через личный кабинет на свободное время в расписании.',
          'Перенести или отменить консультацию без потери оплаты можно не позднее чем за 24 часа до её начала.',
          'При опоздании консультация завершается в изначально запланированное время.',
          'Если консультация не состоялась по причине, зависящей от исполнителя, она переносится или оплата возвращается полностью.',
        ],
      },
      {
        heading: '4. Право на отказ от договора',
        paragraphs: [
          'Потребитель вправе отказаться от договора, заключённого дистанционно, в течение 14 дней. Если консультация должна состояться до истечения этого срока, требуется явное согласие на начало оказания услуги — в этом случае право на отказ прекращается с момента её оказания.',
        ],
      },
      {
        heading: '5. Оплата',
        paragraphs: [
          'Стоимость указана на странице «Услуги» и зависит от региона. Оплата производится до начала консультации. Номера банковских карт через сайт не проходят.',
        ],
      },
      {
        heading: '6. Конфиденциальность',
        paragraphs: [
          'Всё, что обсуждается на консультации, конфиденциально. Исключения предусмотрены законом и профессиональными стандартами — прежде всего ситуации непосредственной угрозы жизни.',
        ],
      },
      {
        heading: '7. Претензии',
        paragraphs: [
          'Претензию можно направить по контактному адресу, указанному на сайте. Ответ предоставляется в течение 14 дней.',
        ],
      },
    ],
  },
];
