import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { OUTPUT_TYPES, processImage, type OutputFormat } from '@/lib/media/image';

/**
 * Картинки в базе: сохранение загруженного и выдача варианта по имени.
 *
 * Обработка — в image.ts (чистые функции с тестами), здесь только база.
 */

export type UploadResult =
  | { ok: true; assetId: string; duplicate: boolean }
  | { ok: false; reason: 'tooLarge' | 'format' | 'pixels' | 'broken' };

/**
 * Пересобрать и сохранить картинку одной транзакцией: картинка без
 * вариантов (обрыв посередине) в базе не появляется.
 *
 * Тот же файл второй раз — не дубль, а та же картинка; из архива она
 * при этом возвращается: владелец явно хочет её снова.
 */
export async function saveUpload(bytes: Uint8Array, label: string): Promise<UploadResult> {
  const processed = await processImage(bytes);
  if (!processed.ok) return processed;
  const { image } = processed;

  const existing = await db.mediaAsset.findUnique({
    where: { sourceHash: image.sourceHash },
    select: { id: true },
  });
  if (existing !== null) {
    await db.mediaAsset.update({ where: { id: existing.id }, data: { archivedAt: null } });
    return { ok: true, assetId: existing.id, duplicate: true };
  }

  try {
    const created = await db.mediaAsset.create({
      data: {
        sourceHash: image.sourceHash,
        label,
        width: image.width,
        height: image.height,
        variants: {
          create: image.variants.map((variant) => ({
            format: variant.format,
            width: variant.width,
            height: variant.height,
            hash: variant.hash,
            bytes: Uint8Array.from(variant.bytes),
          })),
        },
      },
      select: { id: true },
    });
    return { ok: true, assetId: created.id, duplicate: false };
  } catch (error) {
    // Два разных файла дали побайтно одинаковый вариант (гонка двух
    // одинаковых загрузок или тот же снимок в другом контейнере) — это дубль
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const same = await db.mediaVariant.findFirst({
        where: { hash: { in: image.variants.map((variant) => variant.hash) } },
        select: { assetId: true },
      });
      if (same !== null) return { ok: true, assetId: same.assetId, duplicate: true };
    }
    throw error;
  }
}

export interface MediaFile {
  bytes: Uint8Array;
  contentType: string;
}

/** Вариант по имени файла; картинка в архиве с сайта не отдаётся */
export async function findMediaFile(hash: string, format: OutputFormat): Promise<MediaFile | null> {
  const variant = await db.mediaVariant.findUnique({
    where: { hash },
    select: { format: true, bytes: true, asset: { select: { archivedAt: true } } },
  });
  if (variant?.format !== format || variant.asset.archivedAt !== null) {
    return null;
  }
  return { bytes: variant.bytes, contentType: OUTPUT_TYPES[format] };
}

/** Адрес варианта на сайте */
export function mediaUrl(variant: { hash: string; format: string }): string {
  return `/media/${variant.hash}.${variant.format}`;
}

export interface PageImage {
  width: number;
  height: number;
  variants: { hash: string; format: string; width: number; height: number }[];
}

/**
 * Картинки блоков страницы одним запросом: только адреса и размеры, без
 * байтов. Картинка в архиве или удалённая из базы — её просто нет в ответе,
 * и блок рисуется без фото.
 */
export async function getPageImages(ids: readonly string[]): Promise<Map<string, PageImage>> {
  if (ids.length === 0) return new Map();
  try {
    const assets = await db.mediaAsset.findMany({
      where: { id: { in: [...ids] }, archivedAt: null },
      select: {
        id: true,
        width: true,
        height: true,
        variants: {
          orderBy: { width: 'asc' },
          select: { hash: true, format: true, width: true, height: true },
        },
      },
    });
    return new Map(assets.map(({ id, ...image }) => [id, image]));
  } catch {
    return new Map();
  }
}
