import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isInternalRequest } from '@/lib/security/internal-auth';
import { recordHoneypotHit } from '@/lib/security/recorder';

/**
 * Приём событий о попадании в ловушку.
 *
 * ── ПОЧЕМУ ЭТО ОТДЕЛЬНЫЙ ОБРАБОТЧИК, А НЕ ЗАПИСЬ ПРЯМО В MIDDLEWARE ───────
 *
 * Middleware работает в Edge Runtime: там нет драйвера PostgreSQL и нет
 * доступа к Prisma. Записать оттуда в базу физически нельзя. Поэтому
 * middleware делает внутренний вызов сюда, в обычную среду Node.
 *
 * ⚠️ У этого решения есть цена, и её важно понимать: каждое такое событие —
 * ЕЩЁ ОДИН запрос к самим себе. Без ограничителя атака на 1000 запросов
 * в секунду превращалась бы в 2000 внутренних. Поэтому middleware вызывает
 * этот обработчик не на каждое попадание, а не чаще раза в минуту на адрес
 * и не чаще потолка в минуту суммарно — см. src/lib/security/throttle.ts.
 *
 * ── ЭТОТ ОБРАБОТЧИК ДОЛГО НЕ СУЩЕСТВОВАЛ ─────────────────────────────────
 *
 * Middleware отправлял сюда события с самого начала, но файла не было.
 * Ошибка глушилась в try/catch — сайт работал, ловушки срабатывали,
 * а журнал оставался пустым, и никто об этом не знал. Разрыв нашли сквозным
 * чтением 2026-09-14 (PROJECT_LOG, шаг 0.39).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Тело запроса — данные, а не команда. Проверяется целиком, даже притом
 * что отправитель наш собственный middleware: обработчик не должен зависеть
 * от добропорядочности вызывающего.
 */
const bodySchema = z.object({
  trapId: z.string().min(1).max(200),
  trapType: z.enum(['PATH', 'FORM_FIELD', 'ROBOTS_BAIT', 'FAKE_API', 'JS_BEACON', 'TIMING']),
  scoreDelta: z.number().int().min(0).max(1000),
  // Длины ограничены: без потолка сюда можно записать мегабайт в поле
  ip: z.string().max(45).nullable().catch(null),
  country: z.string().max(8).nullable().catch(null),
  userAgent: z.string().max(500).nullable().catch(null),
  path: z.string().max(500).nullable().catch(null),
  method: z.string().max(10).nullable().catch(null),
  /** Сколько попаданий склеил ограничитель. Потолок защищает счётчик от накрутки */
  count: z.number().int().min(1).max(100_000).catch(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!isInternalRequest(request)) {
    // 404, а не 403: снаружи этого адреса как бы не существует.
    // Ответ «сюда нельзя» подтвердил бы, что обработчик есть.
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const data = parsed.data;

  await recordHoneypotHit({
    trapId: data.trapId,
    trapType: data.trapType,
    scoreDelta: data.scoreDelta,
    ip: data.ip,
    country: data.country,
    userAgent: data.userAgent,
    path: data.path,
    count: data.count,
  });

  // Тело ответа пустое: middleware его не читает и ждать не должен
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
