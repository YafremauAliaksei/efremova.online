#!/usr/bin/env node
/**
 * ТЕ ЖЕ ПРОВЕРКИ, ЧТО НА GITHUB — НО НА ВАШЕЙ МАШИНЕ.
 *
 * ── Зачем этот файл появился ──────────────────────────────────────────────
 * Первые три захода выглядели одинаково: «готово, делайте push» → CI краснеет
 * → разбор → снова push. Причина системная, а не случайная: часть проверок
 * (Trivy, Hadolint, Checkov, Gitleaks) запускалась ТОЛЬКО на GitHub, и узнать
 * их вердикт можно было лишь после отправки кода.
 *
 * Теперь их можно прогнать здесь. Правило простое:
 * если эта команда зелёная — GitHub тоже будет зелёным.
 *
 * ── Как пользоваться ──────────────────────────────────────────────────────
 *   npm run ci            все ворота (нужен запущенный Docker, ~5-10 минут)
 *   npm run ci:quick      только быстрые: типы, линтер, формат, тесты, аудит
 *
 * Каждая проверка печатает, ЧТО она означает и что делать, если она упала.
 */

import { execSync } from 'node:child_process';

const quick = process.argv.includes('--quick');

/** @type {{name: string, gate: string, why: string, cmd: string, needsDocker?: boolean, slow?: boolean}[]} */
const CHECKS = [
  {
    name: 'Типы TypeScript',
    gate: '🧹 Типы, линтер, формат, тесты',
    why: 'Ошибка типов — это баг, который иначе всплыл бы у клиента',
    cmd: 'npx tsc --noEmit',
  },
  {
    name: 'Линтер',
    gate: '🧹 Типы, линтер, формат, тесты',
    why: 'Опасные конструкции: eval, any, dangerouslySetInnerHTML',
    cmd: 'npx eslint . --max-warnings=0',
  },
  {
    name: 'Форматирование',
    gate: '🧹 Типы, линтер, формат, тесты',
    why: 'Единый стиль. Чинится одной командой: npm run format',
    cmd: 'npx prettier --check .',
  },
  {
    name: 'Тесты',
    gate: '🧹 Типы, линтер, формат, тесты',
    why: 'Ловушки-honeypot и прочая логика безопасности',
    cmd: 'npx vitest run',
  },
  {
    name: 'Уязвимости в production-зависимостях',
    gate: '📦 Уязвимости в библиотеках',
    why: 'Библиотеки, которые реально уезжают на сервер',
    cmd: 'node scripts/check-audit.mjs --omit-dev',
  },
  {
    name: 'Секреты в истории git',
    gate: '🔑 Поиск секретов в коде',
    why: 'Ключ, попавший в коммит, придётся отзывать — лучше поймать сейчас',
    cmd:
      'docker run --rm -v "%CWD%:/repo" zricethezav/gitleaks:latest ' +
      'detect --source /repo --redact -v --config /repo/.gitleaks.toml',
    needsDocker: true,
  },
  {
    name: 'Качество Dockerfile',
    gate: '🐳 Docker и Terraform',
    why: 'Hadolint: те же замечания, что и на GitHub',
    cmd:
      'docker run --rm -i hadolint/hadolint:latest hadolint --failure-threshold error - ' +
      '< infra/docker/Dockerfile',
    needsDocker: true,
  },
  {
    name: 'Сборка образа',
    gate: '🐳 Docker и Terraform',
    why: 'Образ должен собираться — именно он поедет на сервер',
    cmd: 'docker build -f infra/docker/Dockerfile -t efremova:ci .',
    needsDocker: true,
    slow: true,
  },
  {
    name: 'Уязвимости в образе',
    gate: '🐳 Docker и Terraform',
    why: 'Trivy проверяет системные библиотеки и содержимое образа',
    cmd:
      'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest ' +
      'image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --timeout 10m efremova:ci',
    needsDocker: true,
    slow: true,
  },
  {
    name: 'Terraform',
    gate: '🐳 Docker и Terraform',
    why: 'Checkov: открытые порты, незашифрованные хранилища и подобное',
    cmd:
      'docker run --rm -v "%CWD%:/tf" bridgecrew/checkov:latest ' +
      '--directory /tf/infra/terraform --framework terraform --compact --quiet',
    needsDocker: true,
    slow: true,
  },
];

const cwd = process.cwd().replace(/\\/g, '/');
const selected = quick ? CHECKS.filter((check) => check.needsDocker !== true) : CHECKS;

console.log('\n════════════════════════════════════════════════════════════');
console.log(quick ? '  БЫСТРЫЕ ПРОВЕРКИ' : '  ВСЕ ВОРОТА CI — ЛОКАЛЬНО');
console.log('════════════════════════════════════════════════════════════');
console.log(
  `  Проверок: ${String(selected.length)}${quick ? '  (Docker-проверки пропущены)' : ''}`
);
console.log('  Если всё зелёное — GitHub тоже будет зелёным\n');

const failed = [];
let index = 0;

for (const check of selected) {
  index += 1;
  const prefix = `[${String(index)}/${String(selected.length)}]`;
  const slowHint = check.slow === true ? ' (может занять несколько минут)' : '';
  process.stdout.write(`${prefix} ${check.name}${slowHint}... `);

  try {
    execSync(check.cmd.replace(/%CWD%/g, cwd), {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    console.log('OK');
  } catch (error) {
    console.log('ОШИБКА');
    const output = [
      error instanceof Error && 'stdout' in error ? String(error.stdout ?? '') : '',
      error instanceof Error && 'stderr' in error ? String(error.stderr ?? '') : '',
    ]
      .join('\n')
      .trim();

    failed.push({ check, output });
  }
}

console.log('\n════════════════════════════════════════════════════════════');

if (failed.length === 0) {
  console.log('  ВСЁ ЗЕЛЁНОЕ. Можно отправлять на GitHub:');
  console.log('    git push\n');
  process.exit(0);
}

console.log(`  НЕ ПРОЙДЕНО: ${String(failed.length)} из ${String(selected.length)}`);
console.log('════════════════════════════════════════════════════════════\n');

for (const { check, output } of failed) {
  console.log(`─── ${check.name} ───`);
  console.log(`Ворота на GitHub: ${check.gate}`);
  console.log(`Что проверяет:    ${check.why}`);
  console.log(`Команда:          ${check.cmd.replace(/%CWD%/g, '<проект>')}`);
  console.log('\nВывод (последние строки):');
  console.log(
    output
      .split('\n')
      .slice(-25)
      .map((line) => `  ${line}`)
      .join('\n')
  );
  console.log('');
}

console.log('Отправлять на GitHub пока не нужно — там будет то же самое.\n');
process.exit(1);
