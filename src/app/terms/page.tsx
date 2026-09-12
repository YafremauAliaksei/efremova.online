import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Публичная оферта (условия оказания услуг).
 *
 * ⚠️ Как и политика конфиденциальности — это КАРКАС. Оферта является
 * договором: её текст обязан составить или проверить юрист. Особенно разделы
 * об ответственности и об ограничениях: психологическая помощь — не медицинская
 * услуга в юридическом смысле, и границы должны быть сформулированы точно.
 */

export const metadata: Metadata = {
  title: 'Публичная оферта',
  description: 'Условия оказания услуг: формат консультаций, оплата, перенос и отмена.',
};

const UPDATED_AT = '2026-09-12';
const DOCUMENT_VERSION = 'terms-2026-09-12-draft';

export default function TermsPage() {
  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Публичная оферта</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          Версия документа: {DOCUMENT_VERSION} · обновлено {UPDATED_AT}
        </p>

        <div
          role="note"
          className="mt-6 rounded-lg border border-[var(--color-warning)] bg-[#fdf8f0] p-5"
        >
          <p className="font-medium text-[var(--color-warning)]">Черновик</p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Оферта — это договор. До запуска сайта текст должен составить или проверить юрист.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">1. Предмет</h2>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Исполнитель оказывает услуги психологического консультирования в формате видеосвязи.
            Записываясь на консультацию, вы принимаете условия настоящего документа.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">2. Что консультация не заменяет</h2>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Психологическое консультирование не является медицинской помощью и не заменяет обращения
            к врачу, постановки диагноза или назначения лекарств. Услуга не предназначена для
            экстренных ситуаций.
          </p>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Если существует угроза жизни или здоровью, обратитесь в службу экстренной помощи:
            <strong className="text-[var(--color-ink)]"> 112</strong> в Европейском союзе.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">3. Запись, перенос и отмена</h2>
          <ul className="mt-3 space-y-2 text-[var(--color-ink-soft)]">
            <li>Запись производится через личный кабинет на свободное время в расписании.</li>
            <li>
              Перенести или отменить консультацию без потери оплаты можно не позднее чем за 24 часа
              до её начала.
            </li>
            <li>
              При опоздании консультация завершается в изначально запланированное время: следом
              может быть записан другой человек.
            </li>
            <li>
              Если консультация не состоялась по причине, зависящей от исполнителя, она переносится
              или оплата возвращается полностью.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">4. Оплата</h2>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Стоимость указана на странице{' '}
            <Link href="/uslugi" className="underline underline-offset-4">
              «Услуги»
            </Link>{' '}
            и зависит от региона. Оплата производится до начала консультации. Номера банковских карт
            не проходят через сайт — их обрабатывает платёжная система.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">5. Конфиденциальность</h2>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Всё, что обсуждается на консультации, конфиденциально. Исключения предусмотрены законом
            и профессиональными стандартами — прежде всего ситуации непосредственной угрозы жизни.
            Как технически защищены данные, описано в{' '}
            <Link href="/privacy" className="underline underline-offset-4">
              политике конфиденциальности
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">6. Технические требования</h2>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            Для консультации нужны устойчивое интернет-соединение, камера, микрофон и место, где вас
            не прервут. Ссылка на видеовстречу появляется в личном кабинете.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
