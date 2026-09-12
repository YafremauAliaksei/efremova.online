import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Проверка живости сервиса.
 *
 * Кто сюда ходит:
 *   • Docker (healthcheck) — решает, перезапускать ли контейнер
 *   • Внешний мониторинг   — присылает алерт, если сайт лёг
 *
 * ⚠️ Ответ намеренно скудный: ни версий, ни имён хостов, ни текстов ошибок.
 * Эндпоинт открыт всему интернету, и он не должен быть источником разведданных.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, 'ok' | 'fail'> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'fail';
  }

  const healthy = Object.values(checks).every((status) => status === 'ok');

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
