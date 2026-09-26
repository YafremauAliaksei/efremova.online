import { describe, expect, it } from 'vitest';
import { insertAfter, moveId, numbered } from './order';

describe('порядок блоков', () => {
  const ids = ['a', 'b', 'c'];

  it('выше и ниже', () => {
    expect(moveId(ids, 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(moveId(ids, 'b', 'down')).toEqual(['a', 'c', 'b']);
  });

  it('у края и чужой блок — без изменений', () => {
    expect(moveId(ids, 'a', 'up')).toEqual(ids);
    expect(moveId(ids, 'c', 'down')).toEqual(ids);
    expect(moveId(ids, 'x', 'up')).toEqual(ids);
  });

  it('вставка после блока и в конец', () => {
    expect(insertAfter(ids, 'n', 'a')).toEqual(['a', 'n', 'b', 'c']);
    expect(insertAfter(ids, 'n', null)).toEqual(['a', 'b', 'c', 'n']);
    expect(insertAfter(ids, 'n', 'чужой')).toEqual(['a', 'b', 'c', 'n']);
  });

  it('перенумерация шагом 10', () => {
    expect(numbered(['b', 'a'])).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 10 },
    ]);
  });
});
