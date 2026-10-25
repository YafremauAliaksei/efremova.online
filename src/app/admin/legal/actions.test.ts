import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_LIMITS } from '@/lib/admin/limits';

/**
 * Редакции правовых документов не удаляются никогда (docs/03 п.7), поэтому
 * их рост ограничен: не больше legalPerDocPerDay новых за сутки на документ,
 * и «вернуть» текст, который и так действующий, — не новая редакция.
 * База, сессия и журнал подменены в памяти.
 */

interface Doc {
  id: string;
  slug: string;
  locale: string;
  version: string;
  title: string;
  sections: unknown;
  isDraft: boolean;
  isCurrent: boolean;
  createdAt: Date;
}

const docs: Doc[] = [];
let created = 0;

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock('@/lib/admin/guard', () => ({ requireAdminWrite: () => Promise.resolve() }));
vi.mock('@/lib/audit/log', () => ({ audit: () => Promise.resolve() }));
vi.mock('@/lib/db', () => ({
  db: {
    legalDocument: {
      findMany: ({ where }: { where: { slug: string; locale: string } }) =>
        Promise.resolve(docs.filter((d) => d.slug === where.slug && d.locale === where.locale)),
      findFirst: ({ where }: { where: { id: string } }) =>
        Promise.resolve(docs.find((d) => d.id === where.id && !d.isCurrent) ?? null),
      updateMany: () => Promise.resolve({ count: 1 }),
      create: () => {
        created += 1;
        return Promise.resolve();
      },
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

const { publishLegal, restoreLegal } = await import('./actions');

const SECTIONS = [{ heading: 'Раздел', paragraphs: ['Текст'] }];

function doc(overrides: Partial<Doc>): Doc {
  return {
    id: `00000000-0000-4000-8000-${String(docs.length).padStart(12, '0')}`,
    slug: 'privacy',
    locale: 'pl',
    version: `privacy-2026-10-25-${String(docs.length)}`,
    title: 'Polityka',
    sections: SECTIONS,
    isDraft: true,
    isCurrent: false,
    createdAt: new Date('2020-01-01T00:00:00Z'),
    ...overrides,
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function urlOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return 'no redirect';
  } catch (error) {
    if (error instanceof Redirect) return error.url;
    throw error;
  }
}

beforeEach(() => {
  docs.length = 0;
  created = 0;
});

describe('новая редакция', () => {
  const fields = { slug: 'privacy', locale: 'pl', title: 'Polityka', text: '## Nowy\n\nTreść' };

  it('сверх суточного предела — отказ, введённый текст возвращается', async () => {
    for (let i = 0; i < STORAGE_LIMITS.legalPerDocPerDay; i += 1) {
      docs.push(doc({ createdAt: new Date(), isCurrent: i === 0 }));
    }
    const state = await publishLegal({ attempt: 0, error: null }, form(fields));
    expect(state.error).toEqual({ code: 'limit' });
    expect(state.text).toBe(fields.text);
    expect(created).toBe(0);
  });

  it('старые редакции в суточный предел не входят', async () => {
    for (let i = 0; i < STORAGE_LIMITS.legalPerDocPerDay; i += 1) {
      docs.push(doc({ isCurrent: i === 0 }));
    }
    expect(await urlOf(publishLegal({ attempt: 0, error: null }, form(fields)))).toContain(
      'saved=published'
    );
    expect(created).toBe(1);
  });

  it('предел — на документ и язык: другой язык не задет', async () => {
    for (let i = 0; i < STORAGE_LIMITS.legalPerDocPerDay; i += 1) {
      docs.push(doc({ locale: 'ru', createdAt: new Date() }));
    }
    expect(await urlOf(publishLegal({ attempt: 0, error: null }, form(fields)))).toContain(
      'saved=published'
    );
  });
});

describe('возврат прежней редакции', () => {
  it('прежняя с другим текстом — новая редакция', async () => {
    docs.push(doc({ isCurrent: true, sections: [{ heading: 'Другой', paragraphs: ['x'] }] }));
    const old = doc({});
    docs.push(old);
    expect(await urlOf(restoreLegal(form({ documentId: old.id })))).toContain('saved=restored');
    expect(created).toBe(1);
  });

  it('тот же текст, что у действующей, — копия не создаётся', async () => {
    docs.push(doc({ isCurrent: true }));
    const old = doc({});
    docs.push(old);
    expect(await urlOf(restoreLegal(form({ documentId: old.id })))).toContain('saved=same');
    expect(created).toBe(0);
  });

  it('тот же текст, но другая отметка юриста — это новая редакция', async () => {
    docs.push(doc({ isCurrent: true, isDraft: false }));
    const old = doc({ isDraft: true });
    docs.push(old);
    expect(await urlOf(restoreLegal(form({ documentId: old.id })))).toContain('saved=restored');
  });

  it('сверх суточного предела — отказ', async () => {
    docs.push(doc({ isCurrent: true, sections: [{ heading: 'Другой', paragraphs: ['x'] }] }));
    const old = doc({});
    docs.push(old);
    for (let i = 0; i < STORAGE_LIMITS.legalPerDocPerDay; i += 1) {
      docs.push(doc({ createdAt: new Date() }));
    }
    expect(await urlOf(restoreLegal(form({ documentId: old.id })))).toContain('error=limit');
    expect(created).toBe(0);
  });
});
