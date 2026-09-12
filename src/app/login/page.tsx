import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getAuthMethodsStatus,
  isUsable,
  type AuthAvailabilityState,
  type AuthMethodStatus,
} from '@/lib/auth/providers';

/**
 * Страница входа.
 *
 * Главная идея: кнопка способа входа активна ТОЛЬКО если система прямо сейчас
 * убедилась, что провайдер принимает наши ключи (src/lib/auth/providers.ts).
 * Никаких ручных переключателей «включить/выключить» — они рассинхронизируются
 * с реальностью, и клиент упирается в чужую страницу ошибки.
 */

export const metadata: Metadata = {
  title: 'Вход в личный кабинет',
  robots: { index: false, follow: false }, // кабинет и вход не индексируются
};

export const dynamic = 'force-dynamic';

/** Как показать состояние человеку: цвет, подпись, можно ли нажимать */
const STATE_PRESENTATION: Record<
  AuthAvailabilityState,
  { badge: string; tone: string; explanation: string }
> = {
  AVAILABLE: {
    badge: 'доступно',
    tone: 'text-[var(--color-accent)]',
    explanation: '',
  },
  NOT_CONFIGURED: {
    badge: 'не подключено',
    tone: 'text-[var(--color-ink-soft)]',
    explanation: 'Способ входа ещё не настроен администратором сайта.',
  },
  MISCONFIGURED: {
    badge: 'недоступно',
    tone: 'text-[var(--color-danger)]',
    explanation:
      'Способ входа временно не работает из-за ошибки конфигурации на нашей стороне. Мы уже знаем об этом.',
  },
  PROVIDER_ERROR: {
    badge: 'временно недоступно',
    tone: 'text-[var(--color-warning)]',
    explanation: 'Сервис входа не отвечает. Попробуйте другой способ или повторите позже.',
  },
};

export default async function LoginPage() {
  const methods = await getAuthMethodsStatus();
  const usable = methods.filter(isUsable);
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Вход в личный кабинет</h1>

      <p className="mt-4 text-[var(--color-ink-soft)]">
        Пароля нет и не будет. Вход — через доверенный сервис или одноразовый код.{' '}
        <Link href="/privacy#auth" className="underline underline-offset-4">
          Почему так безопаснее
        </Link>
      </p>

      {usable.length === 0 && (
        <div
          role="alert"
          className="mt-8 rounded-lg border border-[var(--color-danger)] bg-[#fdf4f4] p-5"
        >
          <p className="font-medium text-[var(--color-danger)]">
            Сейчас ни один способ входа не доступен
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Это неполадка на нашей стороне, а не у вас. Напишите нам — мы ответим и поможем
            записаться вручную.
          </p>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {methods.map((method) => (
          <li key={method.id}>
            <AuthMethodRow method={method} showTechnicalReason={isDev} />
          </li>
        ))}
      </ul>

      {/*
        Ответ на вопрос «а не палится ли IP, как со шрифтами».
        Показываем это ДО нажатия, а не прячем в политике конфиденциальности:
        человек должен выбирать осознанно.
      */}
      <section className="mt-12 rounded-lg bg-[var(--color-paper-alt)] p-6">
        <h2 className="text-lg font-medium">Что видит внешний сервис при входе</h2>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Пока вы не нажали кнопку, ваш браузер не обращается ни к Google, ни к Apple, ни к
          кому-либо ещё: доступность способов входа проверяет наш сервер со своего адреса. После
          нажатия выбранный сервис увидит ваш IP-адрес и факт входа именно на этот сайт — избежать
          этого невозможно, такова природа входа через внешний аккаунт.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[var(--color-ink-soft)]">
          {methods.map((method) => (
            <li key={method.id}>
              <span className="font-medium text-[var(--color-ink)]">{method.label}:</span>{' '}
              {method.thirdPartyDataFlow}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
          Содержание консультаций, записи и заметки никогда никуда не передаются — ни одному из этих
          сервисов.
        </p>
      </section>
    </main>
  );
}

function AuthMethodRow({
  method,
  showTechnicalReason,
}: {
  method: AuthMethodStatus;
  showTechnicalReason: boolean;
}) {
  const presentation = STATE_PRESENTATION[method.state];
  const available = isUsable(method);

  if (available) {
    return (
      <a
        href={`/api/auth/signin/${method.id}`}
        className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-white p-5 transition-colors hover:border-[var(--color-accent)]"
      >
        <span>
          <span className="font-medium">Войти через {method.label}</span>
          <span className="mt-1 block text-sm text-[var(--color-ink-soft)]">{method.hint}</span>
        </span>
        <span aria-hidden="true">→</span>
      </a>
    );
  }

  return (
    <div
      className="rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-paper-alt)] p-5"
      // aria-disabled вместо простого серого цвета: скринридер тоже должен
      // понять, что вариант недоступен, а не просто «бледный»
      aria-disabled="true"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-[var(--color-ink-soft)]">Войти через {method.label}</span>
        <span className={`text-sm whitespace-nowrap ${presentation.tone}`}>
          {presentation.badge}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{presentation.explanation}</p>

      {/*
        Техническая причина видна только в режиме разработки.
        В проде посетителю не нужно знать, какой переменной окружения не хватает:
        это подсказка для атакующего о внутреннем устройстве системы.
      */}
      {showTechnicalReason && (
        <p className="mt-2 font-mono text-xs text-[var(--color-ink-soft)]">
          [dev] {method.state}: {method.reason}
        </p>
      )}
    </div>
  );
}
