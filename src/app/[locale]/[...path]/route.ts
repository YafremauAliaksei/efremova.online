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
  // Из запроса — только валюта цен и редакция документа: страница лежит в
  // общем кэше (docs/14), Cloudflare кэширует адрес вместе с параметрами
  const query = new URL(request.url).searchParams;
  return publicPageResponse(locale, path, query.get('currency'), query.get('ver'));
}
