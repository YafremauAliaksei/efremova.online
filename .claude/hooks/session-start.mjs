#!/usr/bin/env node
/**
 * ПОДГОТОВКА ОБЛАЧНОЙ СЕССИИ — хук SessionStart для Claude Code.
 *
 * Облачный контейнер приходит с чистой копией репозитория: без node_modules,
 * без клиента Prisma и без git-хуков. Без этого `npm run verify` падает
 * на проверке типов, а коммит уходит без проверки секретов.
 *
 * Установка — так же, как в CI: `npm ci --ignore-scripts` (код пакетов при
 * установке не выполняется) и отдельно `prisma generate`. Если node_modules
 * уже соответствуют package-lock.json (контейнер из кэша), установка пропускается.
 *
 * На машине разработчика хук ничего не делает: там всё поставлено руками.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.CLAUDE_CODE_REMOTE !== 'true') process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
// Сообщения — в stderr: stdout хука SessionStart попадает в контекст агента.
const log = (message) => process.stderr.write(`[session-start] ${message}\n`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  log(`${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
}

/** npm пишет node_modules/.package-lock.json в конце успешной установки. */
function dependenciesUpToDate() {
  const installed = join(root, 'node_modules', '.package-lock.json');
  if (!existsSync(installed)) return false;
  return statSync(installed).mtimeMs >= statSync(join(root, 'package-lock.json')).mtimeMs;
}

try {
  if (dependenciesUpToDate()) {
    log('зависимости уже установлены');
  } else {
    run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  }
  run(npm, ['run', 'db:generate']);
  // Проверка секретов перед каждым коммитом (.githooks/pre-commit).
  run('git', ['config', 'core.hooksPath', '.githooks']);
  log('готово: npm run verify и pre-commit работают');
} catch (error) {
  // Сессия всё равно стартует: агент увидит причину и повторит шаг руками.
  log(`не удалось подготовить окружение: ${String(error)}`);
  process.exit(1);
}
