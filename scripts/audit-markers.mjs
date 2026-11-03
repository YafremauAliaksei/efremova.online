#!/usr/bin/env node
/**
 * Список меток AUDIT(...) в коде — с него начинается следующий аудит.
 *
 * Метка стоит там, где ошибка при дальнейшей правке опасна: сырой SQL,
 * исходящий запрос, путь к файлу, сравнение секрета, cookie, общий кэш,
 * сборка разметки, разбор чужих данных, проверка прав, персональные данные
 * (docs/03, п.12). Формат: `// AUDIT(тема): что проверить при правке`.
 *
 * Неизвестная тема — ошибка (код выхода 1): опечатка в метке прятала бы
 * место от следующего аудита.
 *
 *   npm run audit:markers
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOPICS = {
  sql: 'сырой SQL',
  net: 'исходящий запрос сервера',
  fs: 'путь к файлу',
  secret: 'сравнение или хранение секрета',
  cookie: 'cookie',
  cache: 'что попадает в общий кэш',
  html: 'разметка из данных',
  input: 'разбор чужих данных',
  auth: 'проверка прав',
  pii: 'персональные данные',
};

const ROOTS = ['src', 'scripts', 'prisma', 'infra'];
const SKIP = new Set(['node_modules', '.next', 'migrations']);
const EXTENSIONS = /\.(?:ts|tsx|mjs|sh|conf)$/;
const MARKER = /AUDIT\(([a-z]+)\):\s*(.+)$/;

/** Все метки в репозитории: файл, строка, тема, текст */
export function collectMarkers(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (EXTENSIONS.test(entry.name) && !entry.name.includes('.test.')) {
        readFileSync(path, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            const match = MARKER.exec(line);
            // Описание формата в этом файле — не метка
            if (match === null || line.includes('AUDIT(тема)')) return;
            found.push({
              file: relative(root, path),
              line: index + 1,
              topic: match[1] ?? '',
              text: (match[2] ?? '').trim(),
            });
          });
      }
    }
  };
  for (const dir of ROOTS) walk(join(root, dir));
  return found;
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const markers = collectMarkers(root);
  const unknown = markers.filter((m) => !(m.topic in TOPICS));

  for (const [topic, title] of Object.entries(TOPICS)) {
    const list = markers.filter((m) => m.topic === topic);
    console.log(`\n${topic} — ${title} (${String(list.length)})`);
    for (const m of list) console.log(`  ${m.file}:${String(m.line)}  ${m.text}`);
  }
  if (unknown.length > 0) {
    console.error('\nНеизвестная тема метки (список тем — scripts/audit-markers.mjs):');
    for (const m of unknown) console.error(`  ${m.file}:${String(m.line)}  AUDIT(${m.topic})`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
