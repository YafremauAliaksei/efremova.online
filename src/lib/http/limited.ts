/**
 * Чтение ответа чужого сервера с потолком объёма.
 *
 * Общий для исходящих запросов сервера (обложки YouTube, курсы валют):
 * зависший или бесконечный ответ не должен съедать память. Объём проверяется
 * и по заголовку, и по факту — заголовку чужого сервера верить нельзя.
 */

/** Тело ответа, но не больше limit байт; больше — null без дочитывания */
export async function readLimited(response: Response, limit: number): Promise<Uint8Array | null> {
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
