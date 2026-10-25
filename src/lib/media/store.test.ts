import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_LIMITS } from '@/lib/admin/limits';

/**
 * Сохранение картинки упирается в потолок места (docs/03 п.3.1): новая
 * картинка сверх предела не создаётся, дубль проходит — он места не занимает.
 * Пересборка картинки и база подменены: проверяется решение, а не sharp.
 */

const state = {
  storedBytes: 0,
  lastDay: 0,
  existing: null as { id: string } | null,
  created: 0,
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/media/image', () => ({
  OUTPUT_TYPES: { avif: 'image/avif', webp: 'image/webp' },
  processImage: () =>
    Promise.resolve({
      ok: true,
      image: {
        sourceHash: 'a'.repeat(64),
        width: 10,
        height: 10,
        variants: [
          {
            format: 'avif',
            width: 10,
            height: 10,
            hash: 'b'.repeat(64),
            bytes: new Uint8Array(600),
          },
          {
            format: 'webp',
            width: 10,
            height: 10,
            hash: 'c'.repeat(64),
            bytes: new Uint8Array(400),
          },
        ],
      },
    }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: () => Promise.resolve([{ bytes: BigInt(state.storedBytes) }]),
    mediaAsset: {
      findUnique: () => Promise.resolve(state.existing),
      update: () => Promise.resolve(),
      count: () => Promise.resolve(state.lastDay),
      create: () => {
        state.created += 1;
        return Promise.resolve({ id: 'new-asset' });
      },
    },
  },
}));

const { saveUpload } = await import('./store');
const INPUT = new Uint8Array(10);

beforeEach(() => {
  Object.assign(state, { storedBytes: 0, lastDay: 0, existing: null, created: 0 });
});

describe('потолок картинок', () => {
  it('в пределах — картинка создаётся', async () => {
    expect(await saveUpload(INPUT, '')).toEqual({
      ok: true,
      assetId: 'new-asset',
      duplicate: false,
    });
    expect(state.created).toBe(1);
  });

  it('не помещается по объёму — отказ, строка не создаётся', async () => {
    // Варианты весят 1000 байт, свободно 999
    state.storedBytes = STORAGE_LIMITS.mediaBytes - 999;
    expect(await saveUpload(INPUT, '')).toEqual({ ok: false, reason: 'quota' });
    expect(state.created).toBe(0);
  });

  it('суточный предел новых картинок — отказ', async () => {
    state.lastDay = STORAGE_LIMITS.mediaPerDay;
    expect(await saveUpload(INPUT, '')).toEqual({ ok: false, reason: 'quota' });
    expect(state.created).toBe(0);
  });

  it('дубль проходит и при исчерпанном пределе: места он не занимает', async () => {
    state.storedBytes = STORAGE_LIMITS.mediaBytes;
    state.lastDay = STORAGE_LIMITS.mediaPerDay;
    state.existing = { id: 'old-asset' };
    expect(await saveUpload(INPUT, '')).toEqual({
      ok: true,
      assetId: 'old-asset',
      duplicate: true,
    });
  });
});
