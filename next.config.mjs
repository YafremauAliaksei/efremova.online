/**
 * Конфигурация Next.js.
 *
 * Здесь две группы настроек:
 *   • те, что дают баллы Lighthouse (docs/04-seo-performance.md)
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

  // Автоматический AVIF/WebP. Экономия 60-80 % веса картинок — главный вклад в LCP.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com', pathname: '/**' }],
    // SVG из внешних источников — вектор XSS (внутри может быть <script>)
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

  experimental: {
    // Импортируем только используемые части библиотек — меньше JS в бандле
    optimizePackageImports: ['date-fns'],
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
