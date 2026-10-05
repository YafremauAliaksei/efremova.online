import { MAX_UPLOAD_BYTES } from './image';
import { isVideoId, thumbnailUrls } from '../video';

/**
 * Обложка ролика YouTube — скачивает СЕРВЕР, один раз, при сохранении блока.
 *
 * Это единственный исходящий запрос сайта к чужому домену, и он устроен так,
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

/** Тело ответа, но не больше limit байт; больше — null без дочитывания */
async function readLimited(response: Response, limit: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > limit) return null;
  if (response.body === null) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

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
