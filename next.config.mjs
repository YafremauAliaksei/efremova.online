/**
 * Конфигурация Next.js.
 *
 * Здесь две группы настроек:
 *   • те, что дают баллы Lighthouse (гейт CI, пороги в .lighthouserc.json)
 *   • те, что закрывают дыры (docs/03-security-policy.md)
 *
 * Заголовки безопасности задаются в src/middleware.ts — там они динамические
 * (CSP с nonce на каждый запрос). Здесь только то, что статично.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Убирает заголовок X-Powered-By: Next.js.
  // Меньше информации о стеке — меньше поводов подобрать готовый эксплойт.
  poweredByHeader: false,

  // Для сборки в Docker: образ ~180 МБ вместо ~1,2 ГБ.
  // Меньше образ → меньше поверхность атаки и быстрее деплой.
  output: 'standalone',

  // Адаптер базы — внешний модуль, а не часть серверного бандла. Иначе Next.js
  // встраивает его в свои файлы, в node_modules образа его нет, и скрипт входа
  // в админку (scripts/admin-link.mjs) на сервере падает с «Cannot find package».
  // @prisma/client и pg Next.js и так держит внешними.
  serverExternalPackages: ['@prisma/adapter-pg'],

  // Автоматический AVIF/WebP. Экономия 60-80 % веса картинок — главный вклад в LCP.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    // remotePatterns намеренно пуст: картинки бывают только со своего домена.
    // Обложки роликов скачиваются к себе при добавлении видео, а не подгружаются
    // у посетителя из i.ytimg.com — иначе Google узнавал бы его IP
    // (docs/13-site-architecture.md, п.1.1).
    remotePatterns: [],
    // SVG — не картинка, а программа для рисовальщика: внутри может быть <script>
    // и геометрия, которая вешает отрисовку. Не принимаем ни в каком виде.
    dangerouslyAllowSVG: false,
  },

  // Сжатие ответов на уровне приложения
  compress: true,

  // Линтер во время сборки не запускаем. Причины:
  //   1. Он уже прогоняется отдельным шагом (npm run lint) и отдельными
  //      воротами в CI — дублировать работу незачем.
  //   2. Типизированные правила ESLint на этом проекте требуют много памяти,
  //      и внутри сборки процесс падал с out of memory.
  // ⚠️ Это НЕ ослабление проверок: `npm run verify` и CI по-прежнему
  //    обязаны быть зелёными, иначе merge заблокирован.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // В продакшене вырезаем console.* при сборке: защита от случайной
  // утечки персональных данных в консоль браузера (docs/03, красная линия №6)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  async redirects() {
    return [
      // Единственный канонический адрес: дубли вредят SEO
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.efremova.online' }],
        destination: 'https://efremova.online/:path*',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        // Статика с хешем в имени файла: можно кэшировать навсегда.
        // При изменении файла меняется имя — старая версия не «залипнет».
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
