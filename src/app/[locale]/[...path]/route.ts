import { publicPageResponse } from '@/lib/public/render';

/**
 * Все остальные публичные адреса: /pl/about, /en/services, /ru/privacy…
 * Какая страница по какому адресу — src/lib/public/pages.tsx.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; path: string[] }> }
): Promise<Response> {
  const { locale, path } = await params;
  // Из запроса — только валюта цен: страница лежит в общем кэше (docs/14)
  const currency = new URL(request.url).searchParams.get('currency');
  return publicPageResponse(locale, path, currency);
}
