#!/usr/bin/env node
/**
 * Стили публичных страниц одним файлом: public/site.css (docs/14).
 *
 * Публичная страница — HTML, который отрисовывает свой обработчик маршрута,
 * а не страница Next.js, поэтому сборщик Next её стили не подключает.
 * Здесь тот же src/app/globals.css проходит через тот же Tailwind
 * (@tailwindcss/postcss из devDependencies) — новых зависимостей нет.
 *
 * Запускается из scripts/run-next.mjs перед `dev` и `build`; вручную —
 * `npm run css`. Файл в .gitignore: это результат сборки, а не исходник.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const source = 'src/app/globals.css';
const target = 'public/site.css';

const result = await postcss([
  tailwind({ base: process.cwd(), optimize: { minify: true } }),
]).process(readFileSync(source, 'utf8'), { from: source, to: target });

mkdirSync('public', { recursive: true });
writeFileSync(target, result.css);
console.log(`[css] ${target}: ${String(Math.round(result.css.length / 1024))} КБ`);
