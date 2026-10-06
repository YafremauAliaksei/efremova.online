import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { fetchThumbnail } from './media/thumbnail';
import { leavePath, parseVideoId, thumbnailUrls, youtubeWatchUrl } from './video';

/**
 * Ролик на сайте — это id из 11 знаков, а не ссылка из формы: все адреса
 * собирает код. Тесты держат именно это, и ещё — что сервер ходит за
 * обложкой только на i.ytimg.com и не идёт за переадресацией.
 */

const ID = 'dQw4w9WgXcQ';

describe('id ролика из ссылки', () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}?si=abc`],
    [`youtu.be/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}`],
  ])('%s', (raw) => {
    expect(parseVideoId(raw)).toBe(ID);
  });

  it.each([
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/@channel',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onerror',
    'javascript:alert(1)',
    '',
  ])('%s — не ролик', (raw) => {
    expect(parseVideoId(raw)).toBeNull();
  });

  it('все адреса собирает код', () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(leavePath(ID)).toBe(`/out/youtube/${ID}`);
    for (const url of thumbnailUrls(ID)) expect(url).toMatch(/^https:\/\/i\.ytimg\.com\/vi\//);
  });
});

describe('обложка — запрос сервера', () => {
  const jpeg = () =>
    sharp({ create: { width: 64, height: 36, channels: 3, background: '#336' } })
      .jpeg()
      .toBuffer();

  it('крупной нет (404) — берётся стандартная; переадресация запрещена', async () => {
    const body = await jpeg();
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      expect(init.redirect).toBe('error');
      return Promise.resolve(
        url.endsWith('maxresdefault.jpg')
          ? new Response(null, { status: 404 })
          : new Response(new Uint8Array(body), { status: 200 })
      );
    });
    const result = await fetchThumbnail(ID, fetchMock);
    expect(result?.length).toBe(body.length);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(thumbnailUrls(ID));
  });

  it('YouTube недоступен — null, а не исключение', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    expect(await fetchThumbnail(ID, fetchMock)).toBeNull();
  });

  it('слишком большой ответ не дочитывается', async () => {
    const huge = new Response(new Uint8Array(9 * 1024 * 1024), {
      headers: { 'content-length': String(9 * 1024 * 1024) },
    });
    expect(await fetchThumbnail(ID, () => Promise.resolve(huge.clone()))).toBeNull();

    // Без заголовка длины — останавливается на пределе, не читая до конца
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    expect(await fetchThumbnail(ID, () => Promise.resolve(new Response(stream)))).toBeNull();
  });

  it('не id — запроса нет вовсе', async () => {
    const fetchMock = vi.fn();
    expect(await fetchThumbnail('../../etc', fetchMock)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
