import { findMediaFile } from '@/lib/media/store';

/**
 * Картинки сайта: /media/<sha256>.<avif|webp>.
 *
 * Имя — отпечаток содержимого, поэтому ответ кэшируется навсегда
 * (`immutable`): новая картинка — новое имя. Middleware такие адреса
 * не трогает (matcher пропускает .avif и .webp), поэтому заголовки
 * безопасности ставятся здесь сами.
 */

const FILE = /^([0-9a-f]{64})\.(avif|webp)$/;

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
): Promise<Response> {
  const match = FILE.exec((await params).file);
  if (match === null) return notFound();
  const [, hash, format] = match;
  if (hash === undefined || (format !== 'avif' && format !== 'webp')) return notFound();

  let file;
  try {
    file = await findMediaFile(hash, format);
  } catch {
    // База недоступна — не 500 с подробностями, а «нет такого файла» без кэша
    return notFound();
  }
  if (file === null) return notFound();

  return new Response(Buffer.from(file.bytes), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Браузер не угадывает тип по содержимому: картинка остаётся картинкой
      'X-Content-Type-Options': 'nosniff',
      // Открытая отдельно картинка ничего не исполняет и никуда не ходит
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}
