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
    description: 'Форматы консультаций, длительность и стоимость в валюте вашего региона.',
    introBefore:
      'Указана итоговая цена в валюте вашего региона. Порядок оплаты, переноса и отмены — в ',
    introLink: 'условиях консультаций',
    introAfter: '.',
    empty: 'Список услуг пока не заполнен.',
    onRequest: 'по запросу',
    minutes: 'минут',
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
    description: 'Formy konsultacji, czas trwania i cena w walucie Twojego regionu.',
    introBefore:
      'Podana jest cena końcowa w walucie Twojego regionu. Zasady płatności, zmiany terminu i odwołania — w ',
    introLink: 'warunkach konsultacji',
    introAfter: '.',
    empty: 'Lista usług nie została jeszcze uzupełniona.',
    onRequest: 'na zapytanie',
    minutes: 'minut',
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
    description: 'Session formats, duration and price in your regional currency.',
    introBefore:
      'Prices are final and shown in your regional currency. Payment, rescheduling and cancellation are described in the ',
    introLink: 'terms of sessions',
    introAfter: '.',
    empty: 'The list of services has not been filled in yet.',
    onRequest: 'on request',
    minutes: 'minutes',
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
