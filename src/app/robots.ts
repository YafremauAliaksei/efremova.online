import type { MetadataRoute } from 'next';

/**
 * robots.txt — инструкция для поисковых роботов.
 *
 * 🔒 Главное здесь — запрет на индексацию личного кабинета. Нарушение этого
 * правила означает утечку персональных страниц в поисковую выдачу.
 * Запрет продублирован заголовком X-Robots-Tag в middleware: robots.txt —
 * это просьба, а заголовок — указание, которое честные роботы исполняют строго.
 *
 * ⚠️ Строка с /internal-admin-v2/ — это приманка (docs/03, п.4.2, ловушка №3).
 * Честный краулер её послушается. Сканер уязвимостей полезет именно туда,
 * потому что «запрещено — значит интересно», и попадёт в ловушку.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/cabinet/',
          '/api/',
          '/login',
          '/_next/',
          // Приманка для сканеров — обычной страницы по этому адресу не существует
          '/internal-admin-v2/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
