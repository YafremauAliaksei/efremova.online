import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MAX_CODE_ATTEMPTS, completeSecondFactor, pendingSecondFactor } from '@/lib/auth/admin';
import { audit } from '@/lib/audit/log';
import { recordSecurityEvent } from '@/lib/security/recorder';

/**
 * Второй фактор: код из приложения-аутентификатора (PROJECT_LOG, задача 13).
 *
 * Сюда ведёт только одноразовая ссылка из терминала: она оставляет
 * пятиминутный пропуск. Без пропуска страница — тот же отказ, что и
 * неверная ссылка, ничего не объясняя. На код — пять попыток, потом
 * пропуск сгорает и нужна новая ссылка.
 */

export const metadata: Metadata = {
  title: 'Код входа',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ left?: string }>;
}

export default async function SecondFactorPage({ searchParams }: PageProps) {
  if ((await pendingSecondFactor()) === null) redirect('/admin/denied');
  const { left } = await searchParams;
  // В адресе — только число, текст собирается здесь
  const leftCount = Number(left);
  const wrong = Number.isInteger(leftCount) && leftCount > 0 && leftCount < MAX_CODE_ATTEMPTS;

  return (
    <main id="main" className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-2xl font-semibold">Код входа</h1>
      <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
        Шесть цифр из приложения-аутентификатора на телефоне. Код меняется каждые 30 секунд.
      </p>
      {wrong && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          Код не подошёл. Осталось попыток: {leftCount}.
        </p>
      )}
      <form action={submitCode} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Код
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 text-center text-2xl tracking-widest"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--color-accent)] px-5 py-2 font-medium text-white"
        >
          Войти
        </button>
      </form>
    </main>
  );
}

async function submitCode(formData: FormData) {
  'use server';
  const code = formData.get('code');
  const result = await completeSecondFactor(typeof code === 'string' ? code : '');
  const headerList = await headers();
  const ip =
    headerList.get('cf-connecting-ip') ??
    headerList.get('x-real-ip') ??
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  if (result.ok) {
    await recordSecurityEvent({
      kind: 'ANOMALY',
      severity: 'MEDIUM',
      ip,
      country: null,
      path: '/admin/2fa',
      details: { event: 'ADMIN_LOGIN', outcome: 'success', factors: 'link+totp' },
      count: 1,
    });
    await audit('session.login', null, { factors: 'link+totp' });
    redirect('/admin');
  }

  // Неверный код — событие безопасности: ссылка уже была верной,
  // значит, либо ошибся владелец, либо ссылка в чужих руках
  await recordSecurityEvent({
    kind: 'LOGIN_FAILED',
    severity: result.reason === 'locked' ? 'HIGH' : 'MEDIUM',
    ip,
    country: null,
    path: '/admin/2fa',
    details: { event: 'ADMIN_TOTP_FAILED', reason: result.reason },
    count: 1,
  });
  if (result.reason === 'wrong') redirect(`/admin/2fa?left=${String(result.left)}`);
  redirect('/admin/denied');
}
