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

import { spawnSync } from 'node:child_process';

const quick = process.argv.includes('--quick');

/**
 * Проверка задаётся ОДНИМ из двух способов:
 *
 *   cmd  — строка, которую исполняет командная оболочка. Годится, когда команда
 *          целиком является константой и нужны возможности оболочки (например,
 *          перенаправление файла на вход через `<`).
 *   argv — массив «программа + аргументы». Оболочки нет вовсе.
 *
 * ⚠️ ПРАВИЛО: всё, куда подставляется путь к проекту (%CWD%), обязано быть argv.
 *
 * Почему. В строке для оболочки путь становится частью исполняемого текста.
 * Кавычки спасают от пробелов, но не от кавычки или $(...) в самом имени папки:
 * проект, лежащий в каталоге пользователя O'Brien, превращает служебную команду
 * в исполнение чего-то постороннего. У нас путь сейчас безобидный — но «у нас
 * путь нормальный» плохо стареет и не переносится на другую машину.
 * Находка CodeQL js/shell-command-injection-from-environment (#3).
 *
 * В массиве аргумент остаётся ровно одним аргументом, что бы внутри него ни было:
 * разбирать его некому, оболочка не участвует. Тот же приём и по той же причине
 * применён в scripts/run-next.mjs.
 *
 * @type {{name: string, gate: string, why: string, cmd?: string, argv?: string[],
 *         needsDocker?: boolean, slow?: boolean}[]}
 */
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
    // Через npm run lint, а не напрямую npx eslint: у скрипта в package.json
    // стоит ограничение памяти (scripts/run-eslint.mjs), без которого линтер
    // на этой машине падает с out of memory. Прямой вызов его обходил —
    // и локальный прогон отличался бы от того, что делает workflow.
    cmd: 'npm run lint',
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
    // argv, а не cmd: сюда подставляется путь к проекту — см. правило выше
    argv: [
      'docker',
      'run',
      '--rm',
      '-v',
      '%CWD%:/repo',
      'zricethezav/gitleaks:latest',
      'detect',
      '--source',
      '/repo',
      '--redact',
      '-v',
      '--config',
      '/repo/.gitleaks.toml',
    ],
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
    // argv, а не cmd: сюда подставляется путь к проекту — см. правило выше
    argv: [
      'docker',
      'run',
      '--rm',
      '-v',
      '%CWD%:/tf',
      'bridgecrew/checkov:latest',
      '--directory',
      '/tf/infra/terraform',
      '--framework',
      'terraform',
      '--compact',
      '--quiet',
    ],
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

  const result = runCheck(check);

  if (result.error === undefined && result.status === 0) {
    console.log('OK');
  } else {
    console.log('ОШИБКА');
    const output = [
      String(result.stdout ?? ''),
      String(result.stderr ?? ''),
      result.error ? `Не удалось запустить команду: ${result.error.message}` : '',
    ]
      .join('\n')
      .trim();

    failed.push({ check, output });
  }
}

/**
 * Запускает проверку и возвращает результат, не бросая исключений.
 *
 * Ветка argv идёт БЕЗ оболочки (shell: false) — путь к проекту подставляется
 * в отдельный аргумент, а не в исполняемую строку. Ветка cmd оболочку использует,
 * но там команда целиком константа: подставлять в неё нечего.
 *
 * @param {{cmd?: string, argv?: string[]}} check
 */
function runCheck(check) {
  const options = { encoding: /** @type {const} */ ('utf8'), maxBuffer: 20 * 1024 * 1024 };

  if (check.argv !== undefined) {
    const [file, ...args] = check.argv;
    return spawnSync(
      file,
      args.map((arg) => arg.replace(/%CWD%/g, cwd)),
      { ...options, shell: false }
    );
  }

  return spawnSync(String(check.cmd), { ...options, shell: true });
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
  const shown = check.argv !== undefined ? check.argv.join(' ') : String(check.cmd);
  console.log(`Команда:          ${shown.replace(/%CWD%/g, '<проект>')}`);
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
