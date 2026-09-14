import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isInternalRequest } from '@/lib/security/internal-auth';
import { recordSecurityEvent } from '@/lib/security/recorder';

/**
 * Приём событий безопасности: отказ проверки источника (CSRF), аномалии.
 *
 * Устроен так же, как приём попаданий в ловушки, и по тем же причинам —
 * см. подробный комментарий в соседнем файле honeypot/route.ts.
 *
 * Отличие одно: сюда приходит поле details — произвольный набор значений
 * для разбора. Его размер ограничен, а содержимое никогда не попадает
 * на страницу: журнал читают запросом к базе, а не выводом в разметку.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  kind: z.enum([
    'LOGIN_FAILED',
    'OTP_BRUTEFORCE',
    'HONEYPOT',
    'RATE_LIMIT',
    'CSRF_FAIL',
    'SSRF_BLOCK',
    'WEBHOOK_BAD_SIGNATURE',
    'TOKEN_REUSE',
    'ANOMALY',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).catch('LOW'),
  ip: z.string().max(45).nullable().catch(null),
  country: z.string().max(8).nullable().catch(null),
  path: z.string().max(500).nullable().catch(null),
  // Потолок на объём: без него сюда кладётся сколько угодно
  details: z.record(z.string().max(100), z.unknown()).catch({}),
  count: z.number().int().min(1).max(100_000).catch(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!isInternalRequest(request)) {
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

  await recordSecurityEvent({
    kind: data.kind,
    severity: data.severity,
    ip: data.ip,
    country: data.country,
    path: data.path,
    details: data.details,
    count: data.count,
  });

  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
