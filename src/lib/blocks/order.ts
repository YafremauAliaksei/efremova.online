/**
 * Порядок блоков на странице.
 *
 * Порядок хранится числами sortOrder. После каждого действия блоки
 * перенумеровываются шагом 10: так порядок всегда однозначен, а два блока
 * с одинаковым номером (после сбоя или ручной правки базы) не «слипаются».
 */

export const ORDER_STEP = 10;

/** Блок на шаг выше или ниже; у края — порядок без изменений */
export function moveId(ids: readonly string[], id: string, direction: 'up' | 'down'): string[] {
  const index = ids.indexOf(id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  const moving = next[index];
  const other = next[target];
  if (moving === undefined || other === undefined) return next;
  next[index] = other;
  next[target] = moving;
  return next;
}

/** Новый блок сразу после after; after нет на странице — в конец */
export function insertAfter(ids: readonly string[], id: string, after: string | null): string[] {
  const index = after === null ? -1 : ids.indexOf(after);
  if (index === -1) return [...ids, id];
  return [...ids.slice(0, index + 1), id, ...ids.slice(index + 1)];
}

/** id → номер: 0, 10, 20… */
export function numbered(ids: readonly string[]): { id: string; sortOrder: number }[] {
  return ids.map((id, index) => ({ id, sortOrder: index * ORDER_STEP }));
}
