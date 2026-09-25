#!/usr/bin/env node
/**
 * Проверка уязвимостей в зависимостях с осознанными исключениями.
 *
 * ЗАЧЕМ НЕ ПРОСТО `npm audit`
 *
 * У обычного `npm audit --audit-level=high` два режима: «падать на всём»
 * или «не падать вообще». Первый быстро приводит к тому, что красный CI
 * становится фоновым шумом, и однажды за ним не замечают настоящую дыру.
 * Второй не защищает вовсе.
 *
 * Здесь третий вариант: падать на всём, КРОМЕ явно перечисленных находок,
 * у каждой из которых есть причина, ответственный план действий и СРОК.
 * Когда срок истекает — проверка падает на самом исключении и заставляет
 * вернуться к вопросу. Исключение не может тихо превратиться в вечное.
 *
 * Запуск:  node scripts/check-audit.mjs [--omit-dev]
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Осознанно принятые риски.
 *
 * ⚠️ Добавлять сюда можно только с объяснением, которое выдержит вопрос
 * «а почему это не опасно именно у нас». Ссылка на план исправления
 * обязательна: исключение — это отсрочка, а не решение.
 */
const ACCEPTED = [
  {
    id: 'GHSA-7pqw-9j4j-h8q3',
    package: 'extract-zip',
    until: '2027-03-31',
    reason:
      'Произвольная запись файлов через символические ссылки внутри архива. ' +
      'ИСПРАВИТЬ НЕЧЕМ: уязвимы все версии <= 2.0.1, а 2.0.1 — последняя выпущенная. ' +
      'Цепочка: @lhci/cli → lighthouse → puppeteer-core → @puppeteer/browsers → extract-zip. ' +
      'Пакет распаковывает архив со СКАЧАННЫМ браузером. Мы браузер не скачиваем ' +
      'никогда: в CI он уже стоит на раннере, локально указываем на установленный ' +
      'через CHROME_PATH. Нет скачивания — нет распаковки — код не выполняется. ' +
      'Инструмент разработки, в образ не попадает (подтверждено: Trivy даёт ноль находок).',
  },
  {
    id: 'GHSA-jmr9-qjv8-65gv',
    package: 'extract-zip',
    until: '2027-03-31',
    reason:
      'Обход каталога через непроверенные символические ссылки. Та же библиотека, ' +
      'та же цепочка и та же причина, что у GHSA-7pqw-9j4j-h8q3: патча не существует, ' +
      'уязвимый путь кода у нас не вызывается. Пересматривать вместе с ним.',
  },
];

/**
 * Делит находки high/critical на принятые и блокирующие.
 *
 * Находка без собственного advisory — следствие другой находки (lighthouse
 * уязвим, потому что внутри extract-zip). Она принята, если приняты все её
 * источники. Отчёт npm упорядочен по алфавиту, а не по цепочке зависимостей:
 * @lhci/cli идёт раньше своего источника extract-zip. Поэтому следствия
 * пересчитываются до тех пор, пока результат не перестанет меняться, —
 * иначе исход зависит от того, как назван пакет.
 *
 * @param {Record<string, {severity: string, via?: unknown[]}>} vulnerabilities
 * @param {{id: string, package: string}[]} accepted
 * @returns {{blocking: string[], skipped: string[]}}
 */
export function classify(vulnerabilities, accepted) {
  const acceptedIds = new Set(accepted.map((item) => item.id));
  const acceptedPackages = new Set(accepted.map((item) => item.package));
  const relevant = Object.entries(vulnerabilities).filter(
    ([, v]) => v.severity === 'high' || v.severity === 'critical'
  );

  // via может содержать как строки (имя пакета-источника), так и объекты с advisory
  const idsOf = (v) =>
    (v.via ?? [])
      .filter((item) => typeof item === 'object' && item !== null)
      .map((item) => item.url?.split('/').pop())
      .filter(Boolean);
  const sourcesOf = (v) => (v.via ?? []).filter((item) => typeof item === 'string');

  const skippedNames = new Set();
  for (const [name, v] of relevant) {
    const ids = idsOf(v);
    if (ids.length > 0 && ids.every((id) => acceptedIds.has(id))) skippedNames.add(name);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, v] of relevant) {
      if (skippedNames.has(name) || idsOf(v).length > 0) continue;
      const sources = sourcesOf(v);
      if (
        sources.length > 0 &&
        sources.every((source) => acceptedPackages.has(source) || skippedNames.has(source))
      ) {
        skippedNames.add(name);
        changed = true;
      }
    }
  }

  const skipped = [];
  const blocking = [];
  for (const [name, v] of relevant) {
    if (skippedNames.has(name)) skipped.push(`${name} (${v.severity})`);
    else blocking.push(`${name} (${v.severity}): ${idsOf(v).join(', ') || 'см. npm audit'}`);
  }
  return { blocking, skipped };
}

function main() {
  const omitDev = process.argv.includes('--omit-dev');
  const scope = omitDev ? 'production-зависимости' : 'все зависимости';

  console.log(`\nПроверка уязвимостей: ${scope}\n`);

  // ─── Сначала проверяем сами исключения: не протухли ли они ───
  const today = new Date().toISOString().slice(0, 10);
  const expired = ACCEPTED.filter((item) => item.until < today);

  if (expired.length > 0) {
    console.error('Срок действия исключений истёк — нужно вернуться к вопросу:\n');
    for (const item of expired) {
      console.error(`  • ${item.id} (${item.package}), срок истёк ${item.until}`);
      console.error(`    ${item.reason}\n`);
    }
    console.error('Либо обновите зависимость, либо продлите срок с новым обоснованием.\n');
    process.exit(1);
  }

  // ─── Запускаем сам аудит ───
  let report;
  try {
    const args = ['npm', 'audit', '--json', omitDev ? '--omit=dev' : ''].filter(Boolean);
    // npm audit возвращает ненулевой код, когда находки есть — это ожидаемо,
    // поэтому разбираем вывод, а не полагаемся на код возврата
    const output = execSync(args.join(' '), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    report = JSON.parse(output);
  } catch (error) {
    const stdout = error instanceof Error && 'stdout' in error ? String(error.stdout) : '';
    if (stdout.trim().length === 0) {
      console.error('Не удалось выполнить npm audit');
      process.exit(1);
    }
    report = JSON.parse(stdout);
  }

  const { blocking, skipped } = classify(report.vulnerabilities ?? {}, ACCEPTED);

  if (skipped.length > 0) {
    console.log('Принятые риски (действуют до указанной даты):');
    for (const item of ACCEPTED) {
      console.log(`  • ${item.id} — ${item.package}, до ${item.until}`);
    }
    console.log(`  затронуто пакетов: ${skipped.join(', ')}\n`);
  }

  if (blocking.length > 0) {
    console.error(
      `Найдены неучтённые уязвимости уровня high/critical: ${String(blocking.length)}\n`
    );
    for (const item of blocking) console.error(`  • ${item}`);
    console.error('\nЧто делать:');
    console.error('  1. npm audit fix — если исправление не ломает совместимость');
    console.error('  2. Обновить зависимость вручную и прогнать npm run verify');
    console.error('  3. Если исправить нельзя — добавить в ACCEPTED со сроком и обоснованием\n');
    process.exit(1);
  }

  console.log('Неучтённых уязвимостей high/critical нет\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
