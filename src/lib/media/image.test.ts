import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, detectFormat, processImage, variantWidths } from './image';

/**
 * Картинки проверяются на настоящих файлах, собранных тут же: правила
 * docs/13, п.7 держатся не на расширении и не на честности загрузившего.
 */

async function photo(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp' | 'avif' = 'jpeg',
  orientation?: number
): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 160, b: 140 } },
  });
  // Как с телефона: координаты, модель и поворот в EXIF
  const withExif = image.withExif({
    IFD0: { Make: 'DemoPhone', Model: 'Demo 1' },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '54/1 21/1 0/1' },
  });
  const oriented = orientation === undefined ? withExif : withExif.withMetadata({ orientation });
  return oriented.toFormat(format).toBuffer();
}

describe('формат по первым байтам', () => {
  it.each(['jpeg', 'png', 'webp', 'avif'] as const)('%s узнаётся', async (format) => {
    expect(detectFormat(await photo(32, 32, format))).toBe(format);
  });

  it('SVG не принимается, даже под видом .png', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>');
    expect(detectFormat(svg)).toBeNull();
  });

  it('HTML, PDF и короткий мусор — не картинка', () => {
    expect(detectFormat(Buffer.from('<!doctype html><html></html>'))).toBeNull();
    expect(detectFormat(Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj'))).toBeNull();
    expect(detectFormat(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('ширины вариантов', () => {
  it.each([
    [4000, [480, 960, 1600]],
    [1200, [480, 960, 1200]],
    [960, [480, 960]],
    [300, [300]],
  ])('исходная %d → %j, без увеличения', (source, widths) => {
    expect(variantWidths(source)).toEqual(widths);
  });
});

describe('пересборка', () => {
  it('EXIF стирается: ни координат, ни модели телефона', async () => {
    const source = await photo(1200, 800);
    expect((await sharp(source).metadata()).exif).toBeDefined();

    const result = await processImage(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const variant of result.image.variants) {
      const meta = await sharp(variant.bytes).metadata();
      expect(meta.exif).toBeUndefined();
      expect(variant.bytes.includes('DemoPhone')).toBe(false);
    }
  });

  it('варианты: AVIF и WebP каждой ширины, имя — отпечаток содержимого', async () => {
    const result = await processImage(await photo(1200, 800, 'png'));
    if (!result.ok) throw new Error(result.reason);
    expect(result.image.variants.map((v) => `${v.format}:${String(v.width)}`)).toEqual([
      'avif:480',
      'webp:480',
      'avif:960',
      'webp:960',
      'avif:1200',
      'webp:1200',
    ]);
    const hashes = new Set(result.image.variants.map((v) => v.hash));
    expect(hashes.size).toBe(6);
    for (const v of result.image.variants) expect(v.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('фото «на боку» поворачивается по EXIF до стирания метаданных', async () => {
    // orientation 6 — повернуть на 90°: 800×600 в файле — 600×800 на экране
    const result = await processImage(await photo(800, 600, 'jpeg', 6));
    if (!result.ok) throw new Error(result.reason);
    expect([result.image.width, result.image.height]).toEqual([600, 800]);
    const largest = result.image.variants.at(-1);
    expect(largest?.height).toBeGreaterThan(largest?.width ?? Infinity);
  });

  it('тот же файл — тот же отпечаток исходника', async () => {
    const source = await photo(100, 100);
    const [a, b] = await Promise.all([processImage(source), processImage(source)]);
    expect(a.ok && b.ok && a.image.sourceHash === b.image.sourceHash).toBe(true);
  });
});

describe('отказы', () => {
  it('слишком большой файл — до чтения содержимого', async () => {
    expect(await processImage(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toEqual({
      ok: false,
      reason: 'tooLarge',
    });
  });

  it('«архивная бомба»: пикселей больше предела — отказ до распаковки', async () => {
    const source = await photo(2000, 2000, 'png');
    expect(await processImage(source, { maxPixels: 1_000_000 })).toEqual({
      ok: false,
      reason: 'pixels',
    });
  });

  it('испорченный файл с верным началом — отказ, а не исключение', async () => {
    const source = await photo(200, 200);
    const broken = Buffer.concat([source.subarray(0, 40), Buffer.alloc(200, 7)]);
    expect(await processImage(broken)).toEqual({ ok: false, reason: 'broken' });
  });

  it('не картинка — отказ по формату', async () => {
    expect(await processImage(Buffer.from('<svg></svg>'.padEnd(64, ' ')))).toEqual({
      ok: false,
      reason: 'format',
    });
  });
});
