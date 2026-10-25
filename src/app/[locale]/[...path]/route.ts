import { publicPageResponse } from '@/lib/public/render';

/**
 * Все остальные публичные адреса: /pl/about, /en/services, /ru/privacy…
 * Какая страница по какому адресу — src/lib/public/pages.tsx.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; path: string[] }> }
): Promise<Response> {
  const { locale, path } = await params;
  return publicPageResponse(locale, path);
}
