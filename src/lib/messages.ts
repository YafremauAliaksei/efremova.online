import type { Locale } from '@/lib/i18n';

/**
 * Подписи интерфейса: меню, кнопки, служебные строки.
 *
 * Здесь нет ни одного текста владельца — только то, что одинаково на любом
 * сайте психолога («Услуги», «минут», «Перейти к содержимому»). Тексты о себе,
 * услугах и подходе живут в базе и правятся в админке (docs/06).
 *
 * `satisfies` заставляет каждый язык иметь те же ключи, что и русский:
 * забытый перевод — ошибка проверки типов, а не пустое место на сайте.
 */

const ru = {
  siteName: 'Психолог онлайн',
  siteDescription: 'Индивидуальные онлайн-консультации психолога. Конфиденциально.',
  skipLink: 'Перейти к содержимому',
  sectionsNav: 'Разделы сайта',
  mainNav: 'Главное меню',
  languageNav: 'Язык сайта',
  nav: {
    services: 'Услуги',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия консультаций',
    siteTerms: 'Положения о сайте',
    provider: 'Данные владельца',
  },
  services: {
    title: 'Услуги и цены',
    description: 'Форматы консультаций, длительность и стоимость.',
    introBefore:
      'Указана итоговая цена; валюту можно выбрать. Порядок оплаты, переноса и отмены — в ',
    introLink: 'условиях консультаций',
    introAfter: '.',
    empty: 'Список услуг пока не заполнен.',
    onRequest: 'по запросу',
    minutes: 'минут',
    currencyNav: 'Валюта цен',
    archiveLink: 'Архив цен',
  },
  priceArchive: {
    title: 'Архив цен',
    description: 'Все цены на услуги с датами: какая цена действовала в какой период.',
    intro:
      'Цены не переписываются задним числом: новая цена закрывает прежнюю датой, и обе остаются здесь.',
    since: 'с',
    until: 'по',
    now: 'действует сейчас',
    empty: 'Цен пока нет.',
  },
  contacts: {
    title: 'Контакты',
    listLabel: 'Способы связи',
    empty: 'Контакты скоро появятся.',
    kinds: {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      viber: 'Viber',
      email: 'Почта',
      phone: 'Телефон',
    },
  },
  video: {
    watch: 'Смотреть на YouTube',
    leaveTitle: 'Переход на YouTube',
    leaveBody:
      'Ролик открывается на сайте YouTube, который принадлежит Google. Google получит ваш IP-адрес и может сохранить cookie в браузере — по своим правилам, а не по правилам этого сайта.',
    leaveGo: 'Перейти на YouTube',
    leaveBack: 'Вернуться на сайт',
    leavePrivacy: 'Подробнее — в политике конфиденциальности',
  },
  testimonials: {
    title: 'Отзывы',
    description: 'Отзывы клиентов, опубликованные с их письменного согласия.',
    empty: 'Отзывы скоро появятся.',
    all: 'Все отзывы',
    verification:
      'Каждый отзыв оставил человек, который был на консультации, и опубликован только с его письменного согласия, полученного вне сайта. Имена заменены, детали, по которым можно узнать автора, убраны. Согласие можно отозвать в любой момент — отзыв исчезнет сразу. ⟦ЮРИСТ: формулировка о проверке подлинности отзывов (директива Omnibus)⟧',
  },
  notFound: {
    title: 'Страница не найдена',
    body: 'Такой страницы нет. Возможно, адрес набран с ошибкой.',
    home: 'На главную',
  },
};

export type Messages = typeof ru;

const pl = {
  siteName: 'Psycholog online',
  siteDescription: 'Indywidualne konsultacje psychologiczne online. Poufnie.',
  skipLink: 'Przejdź do treści',
  sectionsNav: 'Sekcje serwisu',
  mainNav: 'Menu główne',
  languageNav: 'Język serwisu',
  nav: {
    services: 'Usługi',
    privacy: 'Polityka prywatności',
    terms: 'Warunki konsultacji',
    siteTerms: 'Regulamin serwisu',
    provider: 'Informacje o usługodawcy',
  },
  services: {
    title: 'Usługi i ceny',
    description: 'Formy konsultacji, czas trwania i cena.',
    introBefore:
      'Podana jest cena końcowa; walutę można wybrać. Zasady płatności, zmiany terminu i odwołania — w ',
    introLink: 'warunkach konsultacji',
    introAfter: '.',
    empty: 'Lista usług nie została jeszcze uzupełniona.',
    onRequest: 'na zapytanie',
    minutes: 'minut',
    currencyNav: 'Waluta cen',
    archiveLink: 'Archiwum cen',
  },
  priceArchive: {
    title: 'Archiwum cen',
    description: 'Wszystkie ceny usług z datami: jaka cena obowiązywała w jakim okresie.',
    intro:
      'Ceny nie są zmieniane wstecz: nowa cena zamyka poprzednią datą, a obie pozostają tutaj.',
    since: 'od',
    until: 'do',
    now: 'obowiązuje obecnie',
    empty: 'Nie ma jeszcze cen.',
  },
  contacts: {
    title: 'Kontakt',
    listLabel: 'Sposoby kontaktu',
    empty: 'Dane kontaktowe pojawią się wkrótce.',
    kinds: {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      viber: 'Viber',
      email: 'E-mail',
      phone: 'Telefon',
    },
  },
  video: {
    watch: 'Obejrzyj w YouTube',
    leaveTitle: 'Przejście do YouTube',
    leaveBody:
      'Film otworzy się w serwisie YouTube, należącym do Google. Google otrzyma Twój adres IP i może zapisać pliki cookie w przeglądarce — na własnych zasadach, a nie na zasadach tego serwisu.',
    leaveGo: 'Przejdź do YouTube',
    leaveBack: 'Wróć do serwisu',
    leavePrivacy: 'Więcej w polityce prywatności',
  },
  testimonials: {
    title: 'Opinie',
    description: 'Opinie klientów opublikowane za ich pisemną zgodą.',
    empty: 'Opinie wkrótce się pojawią.',
    all: 'Wszystkie opinie',
    verification:
      'Każdą opinię napisała osoba, która uczestniczyła w konsultacji, i jest opublikowana wyłącznie za jej pisemną zgodą uzyskaną poza serwisem. Imiona są zmienione, a szczegóły pozwalające rozpoznać autora — usunięte. Zgodę można wycofać w każdej chwili — opinia zniknie niezwłocznie. ⟦ЮРИСТ: sformułowanie o weryfikacji autentyczności opinii (dyrektywa Omnibus)⟧',
  },
  notFound: {
    title: 'Nie znaleziono strony',
    body: 'Taka strona nie istnieje. Możliwe, że adres zawiera błąd.',
    home: 'Strona główna',
  },
} satisfies Messages;

const en = {
  siteName: 'Online psychologist',
  siteDescription: 'Individual online sessions with a psychologist. Confidential.',
  skipLink: 'Skip to content',
  sectionsNav: 'Site sections',
  mainNav: 'Main menu',
  languageNav: 'Site language',
  nav: {
    services: 'Services',
    privacy: 'Privacy policy',
    terms: 'Terms of sessions',
    siteTerms: 'Website terms',
    provider: 'Service provider',
  },
  services: {
    title: 'Services and prices',
    description: 'Session formats, duration and price.',
    introBefore:
      'Prices are final; you can choose the currency. Payment, rescheduling and cancellation are described in the ',
    introLink: 'terms of sessions',
    introAfter: '.',
    empty: 'The list of services has not been filled in yet.',
    onRequest: 'on request',
    minutes: 'minutes',
    currencyNav: 'Price currency',
    archiveLink: 'Price archive',
  },
  priceArchive: {
    title: 'Price archive',
    description: 'All service prices with dates: which price applied in which period.',
    intro:
      'Prices are never rewritten retroactively: a new price closes the previous one with a date, and both stay here.',
    since: 'from',
    until: 'to',
    now: 'current',
    empty: 'No prices yet.',
  },
  contacts: {
    title: 'Contact',
    listLabel: 'Ways to get in touch',
    empty: 'Contact details will appear soon.',
    kinds: {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      viber: 'Viber',
      email: 'Email',
      phone: 'Phone',
    },
  },
  video: {
    watch: 'Watch on YouTube',
    leaveTitle: 'Leaving for YouTube',
    leaveBody:
      'The video opens on YouTube, which is owned by Google. Google will receive your IP address and may store cookies in your browser under its own rules, not the rules of this website.',
    leaveGo: 'Go to YouTube',
    leaveBack: 'Back to the website',
    leavePrivacy: 'More in the privacy policy',
  },
  testimonials: {
    title: 'Testimonials',
    description: 'Client testimonials published with their written consent.',
    empty: 'Testimonials will appear soon.',
    all: 'All testimonials',
    verification:
      'Each testimonial was written by a person who attended a consultation and is published only with their written consent, obtained outside this website. Names are changed and details that could identify the author are removed. Consent can be withdrawn at any time — the testimonial disappears immediately. ⟦ЮРИСТ: wording on how review authenticity is verified (Omnibus Directive)⟧',
  },
  notFound: {
    title: 'Page not found',
    body: 'This page does not exist. The address may contain a typo.',
    home: 'Home page',
  },
} satisfies Messages;

const MESSAGES: Record<Locale, Messages> = { ru, pl, en };

export function messages(locale: Locale): Messages {
  return MESSAGES[locale];
}
