import { createHash } from 'node:crypto';
import sharp from 'sharp';

/**
 * Загруженная картинка → набор вариантов для сайта (docs/13, п.7).
 *
 * Загруженный файл никогда не публикуется как есть. Порядок шагов важен:
 *
 *   1. размер файла — до чтения содержимого (вызывающий проверяет File.size);
 *   2. первые байты, а не расширение: принимаются только JPEG, PNG, WebP,
 *      AVIF. SVG — программа, а не картинка, и не принимается никак;
 *   3. число пикселей — до распаковки: 2 МБ сжатого файла могут развернуться
 *      в 40 000 × 40 000 и съесть память (`limitInputPixels`);
 *   4. пересборка в AVIF и WebP в нескольких ширинах. Метаданные не
 *      переносятся: EXIF с координатами места съёмки, модель телефона
 *      и дата стираются. Фото, сделанное дома, не публикует домашний адрес.
 *
 * Имя варианта — отпечаток его содержимого: по этому адресу содержимое
 * не меняется никогда, поэтому его можно кэшировать навсегда.
 */

/** Больше — отказ до чтения. nginx пропускает 10 МБ вместе с остальной формой. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Подпись картинки в админке */
export const MEDIA_LABEL_MAX = 120;
/** 40 мегапикселей — с запасом для фото с телефона, но не «архивная бомба» */
export const MAX_INPUT_PIXELS = 40_000_000;
/** Ширины вариантов: телефон, планшет и ноутбук, широкий экран */
export const VARIANT_WIDTHS = [480, 960, 1600] as const;

/**
 * Усилие кодировщика AVIF (0–9). По умолчанию 4: фото на 12 Мп — 15 секунд
 * на три ширины, админка ждала бы с зависшей кнопкой. При 2 — около 2,5 секунд,
 * файл крупнее на единицы процентов (замер 2026-10-05).
 */
const AVIF_EFFORT = 2;

export type SourceFormat = 'jpeg' | 'png' | 'webp' | 'avif';
export type OutputFormat = 'avif' | 'webp';

export const OUTPUT_TYPES: Record<OutputFormat, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
};

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

/**
 * Формат по первым байтам файла. Расширение и тип из формы не значат
 * ничего: их задаёт браузер, а подменить их — одна строка.
 */
export function detectFormat(bytes: Uint8Array): SourceFormat | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  ) {
    return 'png';
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  // AVIF — контейнер ISO BMFF: блок ftyp с маркой avif (картинка) или avis (анимация).
  // Анимация не нужна: принимается только avif
  if (ascii(bytes, 4, 8) === 'ftyp' && ascii(bytes, 8, 12) === 'avif') return 'avif';
  return null;
}

/** Какие ширины делать: меньше исходной из набора и сама исходная, но не шире набора */
export function variantWidths(sourceWidth: number): number[] {
  const largest = VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1] ?? sourceWidth;
  const widths: number[] = VARIANT_WIDTHS.filter((width) => width < sourceWidth);
  // Увеличивать картинку бессмысленно: исходная ширина — последний вариант
  widths.push(Math.min(sourceWidth, largest));
  return [...new Set(widths)];
}

export interface ImageVariant {
  format: OutputFormat;
  width: number;
  height: number;
  bytes: Buffer;
  /** sha256 содержимого в hex — имя файла */
  hash: string;
}

export interface ProcessedImage {
  /** sha256 исходного файла: тот же файл второй раз не превращается в дубль */
  sourceHash: string;
  width: number;
  height: number;
  variants: ImageVariant[];
}

export type ProcessResult =
  | { ok: true; image: ProcessedImage }
  | { ok: false; reason: 'tooLarge' | 'format' | 'pixels' | 'broken' };

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Проверка и пересборка. Ошибка libvips на испорченном файле — отказ
 * «broken», а не исключение наружу: в админке это сообщение, а не 500.
 */
export async function processImage(
  input: Uint8Array,
  options: { maxPixels?: number } = {}
): Promise<ProcessResult> {
  if (input.length > MAX_UPLOAD_BYTES) return { ok: false, reason: 'tooLarge' };
  if (detectFormat(input) === null) return { ok: false, reason: 'format' };

  const maxPixels = options.maxPixels ?? MAX_INPUT_PIXELS;
  try {
    // Размер из заголовка файла — до распаковки пикселей
    const meta = await sharp(input, { limitInputPixels: false }).metadata();
    if (meta.width * meta.height > maxPixels) return { ok: false, reason: 'pixels' };
    // Анимацию (многокадровый WebP) не пересобираем: на сайте нужна картинка
    if ((meta.pages ?? 1) > 1) return { ok: false, reason: 'format' };

    // Поворот по EXIF до стирания метаданных: иначе фото «ляжет на бок».
    // Размеры после поворота известны из заголовка, распаковывать ради них не нужно
    const { width, height } = meta.autoOrient;
    const oriented = sharp(input, { limitInputPixels: maxPixels, failOn: 'error' }).autoOrient();

    const variants: ImageVariant[] = [];
    for (const target of variantWidths(width)) {
      const resized = oriented.clone().resize({ width: target, withoutEnlargement: true });
      for (const format of ['avif', 'webp'] as const) {
        const pipeline =
          format === 'avif'
            ? resized.clone().avif({ quality: 55, effort: AVIF_EFFORT })
            : resized.clone().webp({ quality: 80 });
        const { data, info: out } = await pipeline.toBuffer({ resolveWithObject: true });
        variants.push({
          format,
          width: out.width,
          height: out.height,
          bytes: data,
          hash: sha256(data),
        });
      }
    }

    return {
      ok: true,
      image: { sourceHash: sha256(input), width, height, variants },
    };
  } catch {
    return { ok: false, reason: 'broken' };
  }
}
