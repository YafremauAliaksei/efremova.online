import { mediaUrl, type PageImage } from '@/lib/media/store';

/**
 * Фото блока: AVIF для браузеров, которые его понимают, WebP — для остальных.
 * Браузер сам выбирает ширину по размеру экрана (srcset + sizes), а width и
 * height заранее резервируют место — текст не прыгает, пока фото грузится.
 * Все адреса — свой домен (/media/…): ни одного обращения наружу.
 */
export function Picture({ image, alt, sizes }: { image: PageImage; alt: string; sizes: string }) {
  const srcSet = (format: string) =>
    image.variants
      .filter((variant) => variant.format === format)
      .map((variant) => `${mediaUrl(variant)} ${String(variant.width)}w`)
      .join(', ');
  const fallback = image.variants.filter((variant) => variant.format === 'webp').at(-1);
  if (fallback === undefined) return null;

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
      {/* next/image не нужен: варианты уже пересобраны и лежат на своём домене */}
      <img
        src={mediaUrl(fallback)}
        srcSet={srcSet('webp')}
        sizes={sizes}
        alt={alt}
        width={fallback.width}
        height={fallback.height}
        loading="lazy"
        decoding="async"
        className="h-auto w-full rounded-lg"
      />
    </picture>
  );
}
