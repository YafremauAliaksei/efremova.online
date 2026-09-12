import { NextResponse } from 'next/server';
import { getAuthMethodsStatus } from '@/lib/auth/providers';

/**
 * Текущая доступность способов входа.
 *
 * Зачем отдельный эндпоинт, если страница входа и так знает статус:
 *   • внешний мониторинг увидит «Google отвалился» раньше, чем клиент
 *   • при отладке видно, ЧТО именно не так, без чтения логов сервера
 *
 * 🔒 В ответе нет и не может быть значений секретов — только имена
 *    переменных окружения, состояние и человеческое объяснение.
 *    Проверяется тестом src/lib/auth/providers.test.ts.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const methods = await getAuthMethodsStatus();
  const anyAvailable = methods.some((method) => method.state === 'AVAILABLE');

  return NextResponse.json(
    {
      // Если не работает ни один способ — войти нельзя в принципе.
      // Мониторинг должен считать это аварией, а не мелочью.
      status: anyAvailable ? 'ok' : 'no-login-methods',
      methods,
    },
    {
      status: anyAvailable ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
