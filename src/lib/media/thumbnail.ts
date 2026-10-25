import { readLimited } from '../http/limited';
import { MAX_UPLOAD_BYTES } from './image';
import { isVideoId, thumbnailUrls } from '../video';

/**
 * Обложка ролика YouTube — скачивает СЕРВЕР, один раз, при сохранении блока.
 *
 * Один из двух исходящих запросов сайта к чужому домену (второй — курсы валют
 * для админки, src/lib/services/rates-fetch.ts), и он устроен так,
 * чтобы им нельзя было воспользоваться (SSRF):
 *   • адрес не приходит из формы: в нём только id из 11 проверенных знаков,
 *     хост зашит — i.ytimg.com;
 *   • переадресации запрещены: ответ «иди на 169.254.169.254» — отказ;
 *   • время и объём ограничены: зависший или бесконечный ответ не держит
 *     сервер и не съедает память;
 *   • ответ дальше идёт той же дорогой, что загрузка владельца: проверка
 *     байт, пересборка, стирание метаданных (image.ts).
 *
 * Данных посетителей в запросе нет — только адрес нашего сервера.
 */

const TIMEOUT_MS = 10_000;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Байты обложки или null: ролика нет, YouTube недоступен, ответ странный.
 * null — не ошибка: блок сохраняется, карточка показывается без обложки.
 */
export async function fetchThumbnail(
  id: string,
  fetchImpl: Fetch = fetch
): Promise<Uint8Array | null> {
  if (!isVideoId(id)) return null;
  for (const url of thumbnailUrls(id)) {
    try {
      const response = await fetchImpl(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'image/jpeg' },
      });
      if (!response.ok) continue;
      const bytes = await readLimited(response, MAX_UPLOAD_BYTES);
      if (bytes !== null && bytes.length > 0) return bytes;
    } catch {
      // Сеть, таймаут, переадресация — пробуем следующую обложку
    }
  }
  return null;
}
