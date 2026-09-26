import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getContentBlock, getServices } from '@/lib/content';
import { languageAlternates, langIfDifferent } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { pageLocale, type LocaleParams } from '@/lib/page-locale';
import { ServiceList } from '@/components/ServiceList';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Главная страница.
 *
 * Все тексты и цены приходят из базы (docs/06): в этом файле нет
 * ни одного личного слова владельца — только разметка.
 *
 * ⚠️ ЧЕСТНО О КЭШИРОВАНИИ: страница помечена force-dynamic, то есть собирается
 * заново на КАЖДОГО посетителя и на каждого ходит в базу. Причина — чтение
 * страны из заголовка ради валюты. Это дорого и мешает Cloudflare кэшировать
 * ответ. Переход на заранее собранную страницу запланирован отдельной веткой
 * (docs/13-site-architecture.md, раздел «Кэширование»); там же переключатель
 * валюты уезжает на сторону браузера.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  return { alternates: languageAlternates(locale, '/') };
}

export default async function HomePage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const headerList = await headers();
  // Страну сообщает Cloudflare. Никаких сторонних geo-IP сервисов:
  // иначе IP посетителя утекал бы третьей стороне (docs/03).
  const region = headerList.get('cf-ipcountry') ?? 'DEFAULT';

  const [hero, about, approach, cta, services] = await Promise.all([
    getContentBlock('hero.main', locale),
    getContentBlock('about.main', locale),
    getContentBlock('approach.main', locale),
    getContentBlock('cta.main', locale),
    getServices(region, locale),
  ]);

  return (
    <main id="main">
      {/* ЭКРАН 1 — Первое впечатление */}
      <section
        lang={langIfDifferent(hero.locale, locale)}
        className="mx-auto max-w-3xl px-6 py-24 text-center"
      >
        <h1 className="text-4xl font-semibold text-balance sm:text-5xl">{hero.title}</h1>
        {hero.body !== null && (
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-ink-soft)]">{hero.body}</p>
        )}
        {/* Кнопка вела в личный кабинет. Кабинет уехал на отдельный поддомен,
            здесь на её месте появится кнопка к контактам (ветка contacts). */}
      </section>

      {/* ЭКРАН 2 — Обо мне */}
      <section lang={langIfDifferent(about.locale, locale)} className="bg-[var(--color-paper-alt)]">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-semibold">{about.title}</h2>
          {about.body !== null && (
            <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{about.body}</p>
          )}
        </div>
      </section>

      {/* ЭКРАН 3 — Подход */}
      <section
        lang={langIfDifferent(approach.locale, locale)}
        className="mx-auto max-w-3xl px-6 py-20"
      >
        <h2 className="text-3xl font-semibold">{approach.title}</h2>
        {approach.body !== null && (
          <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{approach.body}</p>
        )}
      </section>

      {/* ЭКРАН 4 — Услуги и цены */}
      <section className="bg-[var(--color-paper-alt)]">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-semibold">{messages(locale).nav.services}</h2>
          <ServiceList services={services} locale={locale} headingLevel="h3" />
        </div>
      </section>

      {/* ЭКРАН 5 — Призыв к действию */}
      <section
        lang={langIfDifferent(cta.locale, locale)}
        className="mx-auto max-w-3xl px-6 py-24 text-center"
      >
        <h2 className="text-3xl font-semibold">{cta.title}</h2>
        {cta.body !== null && <p className="mt-4 text-[var(--color-ink-soft)]">{cta.body}</p>}
      </section>

      <SiteFooter locale={locale} />
    </main>
  );
}
