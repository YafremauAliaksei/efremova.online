import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOPICS, collectMarkers } from './audit-markers.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const markers = collectMarkers(root);

describe('метки для аудита', () => {
  it('у каждой метки известная тема', () => {
    const unknown = markers.filter((m) => !(m.topic in TOPICS));
    expect(unknown).toEqual([]);
  });

  it('каждая тема где-то отмечена — список не устаревает молча', () => {
    const used = new Set(markers.map((m) => m.topic));
    expect(Object.keys(TOPICS).filter((topic) => !used.has(topic))).toEqual([]);
  });

  it('у метки есть пояснение, что проверять', () => {
    expect(markers.filter((m) => m.text.length < 10)).toEqual([]);
  });
});
