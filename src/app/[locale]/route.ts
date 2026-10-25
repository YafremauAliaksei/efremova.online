import { publicPageResponse } from '@/lib/public/render';

/**
 * Главная на языке: /ru, /pl, /en. HTML без JavaScript из кэша Cloudflare (docs/14).
 * Отрисовка — на каждый запрос к серверу; повторы гасит кэш Cloudflare.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> }
): Promise<Response> {
  const { locale } = await params;
  // Из запроса — только валюта цен: страница лежит в общем кэше (docs/14)
  const currency = new URL(request.url).searchParams.get('currency');
  return publicPageResponse(locale, [], currency);
}
