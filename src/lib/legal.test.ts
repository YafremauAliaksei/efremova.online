import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Редакция правового документа по адресу ?ver= (src/lib/legal.ts).
 * База подменена в памяти: проверяется выбор редакции, а не Postgres.
 */

interface Row {
  slug: string;
  locale: string;
  version: string;
  title: string;
  sections: unknown;
  isDraft: boolean;
  isCurrent: boolean;
  publishedAt: Date;
}

const rows: Row[] = [];
let down = false;

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => {
  const match = (row: Row, where: Partial<Row>) =>
    Object.entries(where).every(([key, value]) => row[key as keyof Row] === value);
  return {
    db: {
      legalDocument: {
        findMany: ({ where }: { where: Partial<Row> }) =>
          down
            ? Promise.reject(new Error('down'))
            : Promise.resolve(
                rows
                  .filter((row) => match(row, where))
                  .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
              ),
        findFirst: ({ where }: { where: Partial<Row> }) =>
          Promise.resolve(rows.find((row) => match(row, where)) ?? null),
      },
    },
  };
});

const { getLegalDocument, versionKey } = await import('./legal');

function row(locale: string, version: string, isCurrent: boolean, day: string): Row {
  return {
    slug: 'privacy',
    locale,
    version,
    title: `Polityka ${version}`,
    sections: [],
    isDraft: false,
    isCurrent,
    publishedAt: new Date(`${day}T10:00:00Z`),
  };
}

beforeEach(() => {
  rows.length = 0;
  down = false;
  rows.push(
    row('pl', 'privacy-2026-01-05', false, '2026-01-05'),
    row('pl', 'privacy-2026-06-11', false, '2026-06-11'),
    row('pl', 'privacy-2026-06-11-2', true, '2026-06-11'),
    row('ru', 'privacy-2026-10-07-draft', true, '2026-10-07')
  );
});

describe('редакция по адресу', () => {
  it('ключ в адресе — имя редакции без документа', () => {
    expect(versionKey('privacy', 'privacy-2026-06-11-2')).toBe('2026-06-11-2');
    expect(versionKey('site-terms', 'site-terms-2026-09-25-draft')).toBe('2026-09-25-draft');
  });

  it('без ?ver= — переброс на действующую', async () => {
    expect(await getLegalDocument('privacy', 'pl', null)).toEqual({
      kind: 'redirect',
      ver: '2026-06-11-2',
    });
  });

  it('прежняя редакция находится и знает действующую', async () => {
    const result = await getLegalDocument('privacy', 'pl', '2026-01-05');
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.document.isCurrent).toBe(false);
    expect(result.document.current.ver).toBe('2026-06-11-2');
    expect(result.document.revisions.map((r) => r.ver)).toHaveLength(3);
  });

  it('редакция из сида с «-draft» открывается', async () => {
    const result = await getLegalDocument('privacy', 'ru', '2026-10-07-draft');
    expect(result.kind).toBe('found');
  });

  it.each([['1999-01-01'], ['../admin'], ['2026-01-05<script>'], ['']])(
    '%j — такой редакции нет, но есть ссылка на действующую',
    async (ver) => {
      const result = await getLegalDocument('privacy', 'pl', ver);
      expect(result).toMatchObject({ kind: 'unknownVersion', current: { ver: '2026-06-11-2' } });
    }
  );

  it('нет языка — польская редакция', async () => {
    const result = await getLegalDocument('privacy', 'en', '2026-01-05');
    expect(result.kind === 'found' && result.document.locale).toBe('pl');
  });

  it('база недоступна — «нет документа», без переброса', async () => {
    down = true;
    expect(await getLegalDocument('privacy', 'pl', null)).toEqual({ kind: 'missing' });
  });
});
