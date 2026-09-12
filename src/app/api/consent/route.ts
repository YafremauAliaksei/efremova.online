import { createHash, randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { getCurrentVersion, isLocale, DEFAULT_LOCALE } from '@/lib/legal';

/**
 * Запись согласия на использование cookie.
 *
 * ⚖️ GDPR (ст. 7 ч. 1) требует, чтобы согласие можно было ДОКАЗАТЬ:
 * что именно человек принял, когда и какую редакцию документа при этом видел.
 * Поэтому недостаточно поставить cookie в браузере — нужна запись на сервере.
 *
 * Что при этом НЕ делается:
 *   • не сохраняется IP — только его необратимый хеш с секретной солью;
 *   • идентификатор посетителя случайный и ни с чем не связан;
 *   • отказ фиксируется так же тщательно, как согласие: «нет» — тоже
 *     юридически значимый факт, и его тоже нужно уметь доказать.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VISITOR_COOKIE = 'visitor-id';
const CONSENT_COOKIE = 'consent-state';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const bodySchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  locale: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { analytics, marketing } = parsed.data;
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : DEFAULT_LOCALE;

  const cookieStore = await cookies();
  const headerList = await headers();

  // Идентификатор посетителя: случайный, живёт в cookie, ни с чем не связан
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? randomUUID();

  const documentVersion = await getCurrentVersion('privacy', locale);

  try {
    await db.cookieConsent.create({
      data: {
        visitorId,
        necessary: true, // основание — необходимость, а не согласие: отключить нельзя
        analytics,
        marketing,
        locale,
        documentVersion,
        ipHash: hashIp(headerList),
        userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
      },
    });
  } catch {
    // Сбой записи не должен мешать человеку пользоваться сайтом.
    // Cookie всё равно выставляется: выбор посетителя важнее нашей статистики.
  }

  const response = NextResponse.json({ ok: true, documentVersion });

  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true, // браузерному коду этот идентификатор не нужен
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
  });

  // Этот cookie читает баннер, поэтому httpOnly здесь неуместен.
  // Чувствительных данных в нём нет — только собственный выбор посетителя.
  response.cookies.set(
    CONSENT_COOKIE,
    JSON.stringify({ analytics, marketing, v: documentVersion }),
    {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ONE_YEAR_SECONDS,
      path: '/',
    }
  );

  return response;
}

/**
 * Необратимый отпечаток IP.
 *
 * Зачем вообще: доказать обстоятельства согласия, если возникнет спор.
 * Почему не сам адрес: IP — персональные данные, и хранить их ради
 * одной лишь квитанции о согласии непропорционально.
 */
function hashIp(headerList: Headers): string | null {
  const ip =
    headerList.get('cf-connecting-ip') ??
    headerList.get('x-real-ip') ??
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  if (ip === null) return null;

  const salt = env().AUTH_SECRET ?? 'no-salt-configured';
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex').slice(0, 32);
}
