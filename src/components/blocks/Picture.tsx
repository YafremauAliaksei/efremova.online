import { mediaUrl, type PageImage } from '@/lib/media/store';

/**
 * Фото блока: AVIF для браузеров, которые его понимают, WebP — для остальных.
 * Браузер сам выбирает ширину по размеру экрана (srcset + sizes), а width и
 * height заранее резервируют место — текст не прыгает, пока фото грузится.
 * Все адреса — свой домен (/media/…): ни одного обращения наружу.
 */
export function Picture({
  image,
  alt,
  sizes,
  priority = false,
}: {
  image: PageImage;
  alt: string;
  sizes: string;
  /**
   * Фото в первом экране — главный элемент для метрики LCP: грузится сразу
   * и с высоким приоритетом. Остальные — лениво, когда до них дошла прокрутка.
   */
  priority?: boolean;
}) {
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
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="h-auto w-full rounded-lg"
      />
    </picture>
  );
}
