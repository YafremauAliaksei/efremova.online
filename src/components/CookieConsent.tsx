'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Баннер согласия на использование cookie.
 *
 * ⚖️ ЧТО ТРЕБУЕТ ЗАКОН (и что здесь сделано именно поэтому)
 *
 * 1. Отказаться должно быть так же просто, как согласиться. Кнопки
 *    «Принять всё» и «Отклонить всё» одинакового размера и заметности.
 *    Баннер, где «Принять» — большая зелёная кнопка, а отказ спрятан
 *    в настройках, польский регулятор (UODO) считает нарушением.
 * 2. Галочки не проставлены заранее. Согласие — это действие, а не
 *    отсутствие возражения (GDPR ст. 4 п. 11).
 * 3. Технически необходимые cookie не отключаются и согласия не требуют:
 *    их основание — необходимость для оказания услуги, а не согласие.
 * 4. Согласие можно отозвать в любой момент — ссылка в подвале сайта.
 * 5. Пока выбор не сделан, никакие необязательные скрипты не грузятся.
 *    У нас их и нет вовсе, но правило зафиксировано в коде, чтобы завтра
 *    аналитика не появилась «просто так».
 */

const CONSENT_COOKIE = 'consent-state';

interface Choice {
  analytics: boolean;
  marketing: boolean;
}

const TEXT = {
  pl: {
    title: 'Pliki cookie',
    body: 'Używamy wyłącznie plików niezbędnych do działania logowania. Nie stosujemy reklam ani śledzenia. Możesz zgodzić się na dodatkowe pliki lub odmówić — serwis będzie działał tak samo.',
    acceptAll: 'Zgadzam się na wszystkie',
    rejectAll: 'Tylko niezbędne',
    settings: 'Ustawienia',
    analytics: 'Statystyka odwiedzin (anonimowa)',
    marketing: 'Marketing',
    save: 'Zapisz wybór',
    more: 'Polityka prywatności',
    necessary: 'Niezbędne — zawsze włączone',
  },
  ru: {
    title: 'Файлы cookie',
    body: 'Мы используем только файлы, без которых не работает вход. Рекламы и слежения нет. Вы можете разрешить дополнительные файлы или отказаться — сайт будет работать одинаково.',
    acceptAll: 'Принять все',
    rejectAll: 'Только необходимые',
    settings: 'Настройки',
    analytics: 'Статистика посещений (обезличенная)',
    marketing: 'Маркетинг',
    save: 'Сохранить выбор',
    more: 'Политика конфиденциальности',
    necessary: 'Необходимые — всегда включены',
  },
} as const;

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [choice, setChoice] = useState<Choice>({ analytics: false, marketing: false });
  // Язык определяется в браузере, а не на сервере: иначе каждая страница
  // стала бы динамической ради одного баннера и потеряла бы статическую
  // отдачу (docs/13, раздел 6). Польский — значение по умолчанию.
  const [locale, setLocale] = useState<'pl' | 'ru'>('pl');
  const t = TEXT[locale];

  useEffect(() => {
    if (navigator.language.toLowerCase().startsWith('ru')) setLocale('ru');

    // Баннер появляется только если выбор ещё не сделан.
    // Читаем cookie, а не localStorage: решение должно быть видно и серверу.
    const hasConsent = document.cookie
      .split(';')
      .some((part) => part.trim().startsWith(`${CONSENT_COOKIE}=`));
    setVisible(!hasConsent);

    // Ссылка «Настройки приватности» в подвале снова открывает баннер:
    // отзыв согласия должен быть не сложнее его выдачи
    const reopen = () => {
      setVisible(true);
      setShowSettings(true);
    };
    window.addEventListener('privacy-settings:open', reopen);
    return () => {
      window.removeEventListener('privacy-settings:open', reopen);
    };
  }, []);

  async function save(value: Choice) {
    setVisible(false);
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...value, locale }),
      });
    } catch {
      // Сеть недоступна — баннер всё равно закрыт: навязывать его повторно
      // человеку, который уже сделал выбор, неуважительно
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-line)] bg-white p-5 shadow-lg"
    >
      <div className="mx-auto max-w-3xl">
        <h2 id="cookie-consent-title" className="font-medium">
          {t.title}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          {t.body}{' '}
          <Link href={`/privacy?lang=${locale}#cookies`} className="underline underline-offset-4">
            {t.more}
          </Link>
        </p>

        {showSettings && (
          <fieldset className="mt-4 space-y-2 text-sm">
            <label className="flex items-center gap-2 text-[var(--color-ink-soft)]">
              <input type="checkbox" checked disabled aria-describedby="necessary-hint" />
              <span id="necessary-hint">{t.necessary}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={choice.analytics}
                onChange={(event) => {
                  setChoice((prev) => ({ ...prev, analytics: event.target.checked }));
                }}
              />
              {t.analytics}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={choice.marketing}
                onChange={(event) => {
                  setChoice((prev) => ({ ...prev, marketing: event.target.checked }));
                }}
              />
              {t.marketing}
            </label>
          </fieldset>
        )}

        {/* Кнопки одинакового веса: отказаться не сложнее, чем согласиться */}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void save({ analytics: true, marketing: true })}
            className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white"
          >
            {t.acceptAll}
          </button>
          <button
            type="button"
            onClick={() => void save({ analytics: false, marketing: false })}
            className="rounded-lg border border-[var(--color-accent)] px-5 py-2 text-sm font-medium text-[var(--color-accent)]"
          >
            {t.rejectAll}
          </button>
          {showSettings ? (
            <button
              type="button"
              onClick={() => void save(choice)}
              className="rounded-lg border border-[var(--color-line)] px-5 py-2 text-sm text-[var(--color-ink-soft)]"
            >
              {t.save}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowSettings(true);
              }}
              className="rounded-lg border border-[var(--color-line)] px-5 py-2 text-sm text-[var(--color-ink-soft)]"
            >
              {t.settings}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
