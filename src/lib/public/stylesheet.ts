import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Адрес стилей публичных страниц: /site.css?v=<хеш содержимого>.
 *
 * Файл собирает scripts/build-site-css.mjs перед `next dev` и `next build`
 * (scripts/run-next.mjs). Хеш в адресе — чтобы файл кэшировался навсегда
 * (next.config.mjs), а новая сборка стилей сразу получала новый адрес.
 *
 * В продакшене читается один раз на процесс: стили меняются только с новой
 * сборкой. В разработке — на каждый запрос, чтобы `npm run css` был виден сразу.
 * Standalone-сервер и Docker кладут public рядом с server.js и запускаются
 * из той же папки, поэтому путь — от рабочего каталога.
 */

let cached: string | null = null;

export function stylesheetHref(): string {
  if (cached !== null && process.env.NODE_ENV === 'production') return cached;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- путь собран из констант, ничего извне в нём нет
    const css = readFileSync(join(process.cwd(), 'public', 'site.css'));
    const version = createHash('sha256').update(css).digest('hex').slice(0, 12);
    cached = `/site.css?v=${version}`;
  } catch {
    // Стилей нет — страница без оформления, но с текстом и контактами.
    // Падать из-за этого хуже: посетитель не увидел бы ничего
    console.error('public/site.css не найден — запустите npm run build');
    cached = '/site.css';
  }
  return cached;
}
