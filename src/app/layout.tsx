import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * Корневой макет. Всё, что здесь, попадает на каждую страницу.
 *
 * lang="ru" — не формальность: без правильного языка Accessibility
 * не даст 100, а скринридер прочитает текст с чужим акцентом.
 */

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Психолог онлайн — консультации',
    template: '%s · Психолог онлайн',
  },
  description:
    'Индивидуальные онлайн-консультации психолога. Конфиденциально, с защищённым личным кабинетом и удобной записью.',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Психолог онлайн',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fbfaf8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        {/* Ссылка для тех, кто ходит по сайту с клавиатуры: позволяет
            перепрыгнуть меню и сразу попасть в содержимое */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2"
        >
          Перейти к содержимому
        </a>
        {children}
      </body>
    </html>
  );
}
