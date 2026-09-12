import type { MetadataRoute } from 'next';

/**
 * sitemap.xml — карта сайта для поисковых систем.
 *
 * Генерируется кодом, а не руками: страницу забыли дописать в список —
 * и она не попадает в индекс. Здесь такое невозможно.
 *
 * В карту попадают ТОЛЬКО публичные страницы. Кабинет и служебные адреса
 * не индексируются, и их здесь быть не должно.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const now = new Date();

  // changeFrequency и priority — это подсказки, а не команды: Google давно
  // ориентируется в основном на реальную частоту изменений. Оставляем честные
  // значения, чтобы не вводить в заблуждение и себя.
  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${baseUrl}/o-mne`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/uslugi`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
