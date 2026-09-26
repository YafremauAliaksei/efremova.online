import type { Metadata } from 'next';
import '../globals.css';

/**
 * Корневой макет админки.
 *
 * Отдельный от публичной части: там язык берётся из адреса (/ru, /pl, /en),
 * а админка одна и на русском. Плашки «сайт в разработке» и переключателя
 * языка здесь нет — это части сайта для посетителей.
 */

export const metadata: Metadata = {
  title: { default: 'Админка', template: '%s · Админка' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
