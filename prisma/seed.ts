/**
 * ДЕМО-ДАННЫЕ ДЛЯ РАЗРАБОТКИ.
 *
 * ⚠️ ЭТОТ ФАЙЛ ЛЕЖИТ В ПУБЛИЧНОМ РЕПОЗИТОРИИ.
 *    Здесь не должно быть ни одного настоящего имени, текста, отзыва, цены,
 *    фотографии или контакта. Всё содержимое — обезличенная заготовка.
 *    Настоящие тексты вводятся через админку и живут только в базе на сервере.
 *    Обоснование: docs/06-public-repo-strategy.md
 *
 * Запуск: npm run db:seed
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { LEGAL_DOCUMENTS } from './legal-content';

// Свой экземпляр клиента, а не общий из src/lib/db.ts: тот помечен
// 'server-only' и предназначен для приложения, а это отдельный скрипт.
//
// Адаптер обязателен начиная с Prisma 7 — без него клиент не знает, куда
// подключаться. Строку берём из окружения: prisma db seed загружает .env
// через prisma.config.ts ещё до запуска этого файла.
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Тексты-заглушки: понятно, что это демо, и никого не вводит в заблуждение */
const CONTENT_BLOCKS = [
  {
    key: 'hero.main',
    title: 'Психологические консультации онлайн',
    body: 'Демо-текст первого экрана. Замените его в админке: этот текст хранится в базе данных, а не в коде.',
  },
  {
    key: 'about.main',
    title: 'Обо мне',
    body: 'Демо-текст блока «Обо мне». Здесь будет рассказ о специалисте, образовании и опыте. Для поисковых систем это ключевой блок: Google строже оценивает сайты о здоровье и ждёт подтверждённой квалификации.',
  },
  {
    key: 'approach.main',
    title: 'Подход к работе',
    body: 'Демо-текст блока «Подход». Здесь описывается метод работы, длительность и формат консультаций.',
  },
  {
    key: 'cta.main',
    title: 'Записаться на консультацию',
    body: 'Выберите удобное время в личном кабинете — свободные слоты обновляются в реальном времени.',
  },
];

/** Цены заведомо круглые и демонстрационные */
const SERVICES = [
  {
    slug: 'individual-50',
    titleI18n: {
      ru: 'Индивидуальная консультация',
      en: 'Individual session',
      pl: 'Konsultacja indywidualna',
    },
    descriptionI18n: {
      ru: 'Демо-описание услуги. Формат: видеозвонок один на один.',
      en: 'Demo service description. Format: one-to-one video call.',
      pl: 'Demonstracyjny opis usługi. Format: rozmowa wideo jeden na jeden.',
    },
    durationMinutes: 50,
    sortOrder: 1,
    prices: [
      { region: 'DEFAULT', currency: 'EUR', amountMinor: 6000 },
      { region: 'PL', currency: 'PLN', amountMinor: 25000 },
      { region: 'RU', currency: 'RUB', amountMinor: 500000 },
    ],
  },
  {
    slug: 'couples-90',
    titleI18n: { ru: 'Парная консультация', en: 'Couples session', pl: 'Konsultacja dla par' },
    descriptionI18n: {
      ru: 'Демо-описание услуги. Формат: видеозвонок для двоих.',
      en: 'Demo service description. Format: video call for two.',
      pl: 'Demonstracyjny opis usługi. Format: rozmowa wideo dla dwojga.',
    },
    durationMinutes: 90,
    sortOrder: 2,
    prices: [
      { region: 'DEFAULT', currency: 'EUR', amountMinor: 9000 },
      { region: 'PL', currency: 'PLN', amountMinor: 38000 },
      { region: 'RU', currency: 'RUB', amountMinor: 750000 },
    ],
  },
];

/** Отзывы демонстрационные и подписаны как демонстрационные */
const TESTIMONIALS = [
  {
    authorAlias: 'Демо-отзыв 1',
    body: 'Текст отзыва хранится в базе данных. Это заготовка для вёрстки.',
    rating: 5,
  },
  {
    authorAlias: 'Демо-отзыв 2',
    body: 'Второй демонстрационный отзыв для проверки внешнего вида списка.',
    rating: 5,
  },
];

async function main(): Promise<void> {
  console.log('Заполнение демо-данными...');

  for (const block of CONTENT_BLOCKS) {
    await db.contentBlock.upsert({
      where: { key_locale: { key: block.key, locale: 'ru' } },
      create: { ...block, locale: 'ru' },
      update: { title: block.title, body: block.body },
    });
  }
  console.log(`  ✓ Блоков контента: ${String(CONTENT_BLOCKS.length)}`);

  for (const service of SERVICES) {
    const { prices, ...serviceData } = service;

    const created = await db.service.upsert({
      where: { slug: service.slug },
      create: serviceData,
      update: serviceData,
    });

    for (const price of prices) {
      const existing = await db.servicePrice.findFirst({
        where: { serviceId: created.id, region: price.region, currency: price.currency },
      });

      if (existing === null) {
        await db.servicePrice.create({ data: { ...price, serviceId: created.id } });
      } else {
        await db.servicePrice.update({
          where: { id: existing.id },
          data: { amountMinor: price.amountMinor },
        });
      }
    }
  }
  console.log(`  ✓ Услуг: ${String(SERVICES.length)}`);

  const existingTestimonials = await db.testimonial.count();
  if (existingTestimonials === 0) {
    await db.testimonial.createMany({
      data: TESTIMONIALS.map((item) => ({ ...item, isPublished: true })),
    });
  }
  console.log(`  ✓ Отзывов: ${String(TESTIMONIALS.length)}`);

  // ─── Правовые документы ───
  // Опубликованная редакция не правится «на месте»: upsert обновляет только
  // черновик той же версии. Новая редакция = новый version.
  for (const doc of LEGAL_DOCUMENTS) {
    await db.legalDocument.upsert({
      where: {
        slug_locale_version: { slug: doc.slug, locale: doc.locale, version: doc.version },
      },
      create: {
        slug: doc.slug,
        locale: doc.locale,
        version: doc.version,
        title: doc.title,
        sections: doc.sections as unknown as Prisma.InputJsonValue,
        isDraft: true,
        isCurrent: true,
      },
      update: {
        title: doc.title,
        sections: doc.sections as unknown as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`  ✓ Правовых документов: ${String(LEGAL_DOCUMENTS.length)} (черновики, pl + ru)`);

  console.log('Готово. Настоящие тексты добавляются через админку, а не сюда.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
