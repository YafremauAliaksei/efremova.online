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

/**
 * Тексты-заглушки: понятно, что это демо, и никого не вводит в заблуждение.
 * На трёх языках — польская версия текстов для посетителей обязательна
 * (CLAUDE.md, правило 10), а без переводов нечего проверять в админке.
 */
const DEMO_TEXTS: {
  key: string;
  texts: Record<'ru' | 'pl' | 'en', { title: string; body: string }>;
}[] = [
  {
    key: 'hero.main',
    texts: {
      ru: {
        title: 'Психологические консультации онлайн',
        body: 'Демо-текст первого экрана. Замените его в админке: этот текст хранится в базе данных, а не в коде.',
      },
      pl: {
        title: 'Konsultacje psychologiczne online',
        body: 'Tekst demonstracyjny pierwszego ekranu. Zmień go w panelu administracyjnym: ten tekst jest przechowywany w bazie danych, a nie w kodzie.',
      },
      en: {
        title: 'Online psychological consultations',
        body: 'Demo text for the first screen. Replace it in the admin panel: this text lives in the database, not in the code.',
      },
    },
  },
  {
    key: 'about.main',
    texts: {
      ru: {
        title: 'Обо мне',
        body: 'Демо-текст блока «Обо мне». Здесь будет рассказ о специалисте, образовании и опыте. Для поисковых систем это ключевой блок: Google строже оценивает сайты о здоровье и ждёт подтверждённой квалификации.',
      },
      pl: {
        title: 'O mnie',
        body: 'Tekst demonstracyjny sekcji „O mnie”. Tu pojawi się informacja o specjaliście, wykształceniu i doświadczeniu.',
      },
      en: {
        title: 'About me',
        body: 'Demo text for the “About me” section. It will describe the specialist, their education and experience.',
      },
    },
  },
  {
    key: 'approach.main',
    texts: {
      ru: {
        title: 'Подход к работе',
        body: 'Демо-текст блока «Подход». Здесь описывается метод работы, длительность и формат консультаций.',
      },
      pl: {
        title: 'Podejście do pracy',
        body: 'Tekst demonstracyjny sekcji „Podejście”. Tu opisana będzie metoda pracy, czas trwania i forma konsultacji.',
      },
      en: {
        title: 'My approach',
        body: 'Demo text for the “Approach” section. It will describe the method, duration and format of sessions.',
      },
    },
  },
  {
    key: 'cta.main',
    texts: {
      ru: {
        title: 'Записаться на консультацию',
        body: 'Демо-текст завершающего блока. Здесь будет приглашение связаться — почтой или в мессенджере.',
      },
      pl: {
        title: 'Umów konsultację',
        body: 'Tekst demonstracyjny sekcji końcowej. Tu pojawi się zaproszenie do kontaktu — mailowo lub przez komunikator.',
      },
      en: {
        title: 'Book a session',
        body: 'Demo text for the closing section. It will invite visitors to get in touch by email or messenger.',
      },
    },
  },
];

/** Текст демо-блока по ключу на всех языках */
function texts(key: string): Record<'ru' | 'pl' | 'en', { title: string; body: string }> {
  const block = DEMO_TEXTS.find((candidate) => candidate.key === key);
  if (block === undefined) throw new Error(`Нет демо-текста ${key}`);
  return block.texts;
}

/** Кнопка завершающего блока главной: контакты в один клик (docs/13, п.1) */
function contactCta(): Prisma.InputJsonValue {
  const { ru, pl, en } = texts('cta.main');
  return {
    ru: { ...ru, button: 'Связаться' },
    pl: { ...pl, button: 'Skontaktuj się' },
    en: { ...en, button: 'Get in touch' },
  };
}

/** Страницы из блоков — та же вёрстка, что до переезда на блоки (docs/13, п.4) */
const PAGES: {
  slug: string;
  sortOrder: number;
  title: Record<string, string>;
  description: Record<string, string>;
  blocks: {
    type: string;
    content: Prisma.InputJsonValue;
    data?: Prisma.InputJsonValue;
    style?: Prisma.InputJsonValue;
  }[];
}[] = [
  {
    slug: 'home',
    sortOrder: 0,
    title: { ru: 'Главная', pl: 'Strona główna', en: 'Home' },
    description: {},
    blocks: [
      { type: 'hero', content: texts('hero.main'), style: { align: 'center' } },
      { type: 'text', content: texts('about.main'), style: { background: 'tinted' } },
      { type: 'text', content: texts('approach.main') },
      {
        type: 'services',
        content: { ru: { title: 'Услуги' }, pl: { title: 'Usługi' }, en: { title: 'Services' } },
        style: { background: 'tinted' },
      },
      {
        type: 'cta',
        content: contactCta(),
        data: { link: 'contacts' },
        style: { align: 'center' },
      },
    ],
  },
  {
    slug: 'about',
    sortOrder: 10,
    title: { ru: 'Обо мне', pl: 'O mnie', en: 'About me' },
    description: {
      ru: 'Образование, опыт и подход к работе.',
      pl: 'Wykształcenie, doświadczenie i podejście do pracy.',
      en: 'Education, experience and approach.',
    },
    blocks: [
      { type: 'text', content: texts('about.main') },
      { type: 'text', content: texts('approach.main') },
      {
        type: 'cta',
        content: {
          ru: { button: 'Услуги и цены' },
          pl: { button: 'Usługi i ceny' },
          en: { button: 'Services and prices' },
        },
        data: { link: 'services' },
      },
    ],
  },
  {
    // Ради этой страницы затевался сайт (docs/13, п.2). Адреса и номера —
    // не здесь, а в «Данных владельца»: в публичном репозитории их нет.
    slug: 'contacts',
    sortOrder: 20,
    title: { ru: 'Контакты', pl: 'Kontakt', en: 'Contact' },
    description: {
      ru: 'Как связаться и договориться о консультации.',
      pl: 'Jak się skontaktować i umówić konsultację.',
      en: 'How to get in touch and arrange a session.',
    },
    blocks: [
      {
        type: 'contacts',
        content: {
          ru: {
            title: 'Контакты',
            body: 'Демо-текст. Напишите в удобный мессенджер или на почту — отвечу и предложу время консультации.',
          },
          pl: {
            title: 'Kontakt',
            body: 'Tekst demonstracyjny. Napisz przez wygodny komunikator lub e-mailem — odpowiem i zaproponuję termin konsultacji.',
          },
          en: {
            title: 'Contact',
            body: 'Demo text. Write via your preferred messenger or by email, and I will reply with a time for a session.',
          },
        },
      },
    ],
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

  for (const page of PAGES) {
    const saved = await db.page.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        titleI18n: page.title,
        descriptionI18n: page.description,
        showInHeader: true,
        showInFooter: true,
        sortOrder: page.sortOrder,
      },
      update: {},
    });
    // Блоки создаются только у пустой страницы: повторный сид не затирает
    // то, что владелец уже поправил или переставил в админке
    const existing = await db.pageBlock.count({ where: { pageId: saved.id } });
    if (existing > 0) continue;
    await db.pageBlock.createMany({
      data: page.blocks.map((block, index) => ({
        pageId: saved.id,
        type: block.type,
        sortOrder: index * 10,
        content: block.content,
        data: block.data ?? {},
        style: block.style ?? {},
      })),
    });
  }
  console.log(`  ✓ Страниц: ${String(PAGES.length)} (блоки на трёх языках)`);

  // Услуги и цены владелец правит в админке: повторный сид создаёт только
  // недостающие и не трогает существующие — ни названия, ни историю цен
  for (const service of SERVICES) {
    const { prices, ...serviceData } = service;
    const existing = await db.service.findUnique({
      where: { slug: service.slug },
      select: { id: true },
    });
    if (existing !== null) continue;
    await db.service.create({ data: { ...serviceData, prices: { create: prices } } });
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
  // черновик той же версии. Новая редакция = новый version: она становится
  // действующей, прежние остаются в истории, но перестают быть текущими —
  // иначе действующих редакций одного документа оказалось бы две.
  //
  // Документ, который владелец хоть раз правил в админке, сид пропускает:
  // образец из кода не должен затирать текст, проверенный юристом.
  let skipped = 0;
  for (const doc of LEGAL_DOCUMENTS) {
    const edited = await db.legalDocument.count({
      where: { slug: doc.slug, locale: doc.locale, fromAdmin: true },
    });
    if (edited > 0) {
      skipped += 1;
      continue;
    }
    await db.$transaction([
      db.legalDocument.updateMany({
        where: { slug: doc.slug, locale: doc.locale, version: { not: doc.version } },
        data: { isCurrent: false },
      }),
      db.legalDocument.upsert({
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
          isCurrent: true,
        },
      }),
    ]);
  }
  console.log(
    `  ✓ Правовых документов: ${String(LEGAL_DOCUMENTS.length - skipped)} (образцы до проверки юристом)` +
      (skipped > 0 ? `, ${String(skipped)} правит владелец — не тронуты` : '')
  );

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
