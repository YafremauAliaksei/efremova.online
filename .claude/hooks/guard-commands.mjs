#!/usr/bin/env node
/**
 * СТОРОЖ КОМАНД ИИ-АГЕНТА — хук PreToolUse для Claude Code.
 *
 * Агент работает сам: ветки, коммиты, push своей ветки, pull request.
 * Владелец проверяет и сливает PR на GitHub. Всё обычное разрешено
 * в .claude/settings.json без вопросов; этот файл отсекает немногое, что
 * необратимо или проходит мимо слияния.
 *
 * Правила settings.json сравнивают только НАЧАЛО строки и обходятся любой
 * иной записью: `git -C . push`, `bash -c "git push"`, `cd x && git push`.
 * Здесь команда разбирается целиком.
 *
 * Сторож только ужесточает: отвечает deny, изредка ask, иначе молчит.
 * ask остаётся в одном случае — push ветки, где изменены CI, git-хуки или
 * правила агента: workflow из PR выполняется с секретами репозитория ещё
 * до слияния, поэтому проверка на слиянии там опаздывает.
 *
 * Кроме терминала сторож смотрит на инструменты GitHub-коннектора (mcp__…github…):
 * в облаке через них идёт вся работа с GitHub, и среди них есть слияние PR
 * и запись файлов мимо git. И на токены в переменных окружения: в облачном
 * контейнере там лежит ключ GitHub, а `curl` с ним прошёл бы мимо разбора git и gh.
 *
 * Настоящий замок на main — ruleset на GitHub: обязательное одобрение владельца,
 * отдельный аккаунт агента, без обходов (docs/03, п.10). Сторож не граница,
 * а сеть: ловит ошибки и подброшенные инструкции до того, как они уйдут в сеть.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PROTECTED_BRANCH = 'main';
const ALLOWED_REMOTE = 'origin';

/** Файлы, управляющие безопасностью процесса: CI, git-хуки, правила агента. */
const GUARDED_PATH = /(^|[\\/"'\s=:])(\.claude[\\/]|\.githooks([\\/]|$)|\.github[\\/]|CLAUDE\.md$)/;

function isGuardedFile(file) {
  return (
    file === 'CLAUDE.md' ||
    file.startsWith('.claude/') ||
    file.startsWith('.githooks/') ||
    file.startsWith('.github/')
  );
}

/** Файлы с секретами — те же, что в deny для Read в settings.json. */
const SECRET_FILE =
  /(^|[\\/])(\.env(\.(local|production|staging|development|test))?|id_rsa|id_ed25519|terraform\.tfvars|\.git-credentials|[._]netrc|[^\\/]*\.(pem|key|tfstate))$/i;

/**
 * Обращение к переменной окружения, по имени похожей на секрет: $GH_TOKEN,
 * ${GITHUB_TOKEN}, $env:X_TOKEN, %X_SECRET%, printenv X, process.env.X.
 * Присваивание (FOO_SECRET=test npm test) сюда не попадает — оно не читает.
 */
const SECRET_ENV_REF =
  /(\$\{?|\$env:|\benv:|%|\bprintenv\s+|\bprocess\.env(\.|\[\s*['"])|\bos\.environ(\.get\(|\[)\s*['"]|\bgetenv\(\s*['"])[A-Za-z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|CREDENTIAL|GIT_CONFIG_VALUE)/i;

/** Всё окружение целиком: process.env без имени, /proc/…/environ. */
const WHOLE_ENV_REF =
  /\bprocess\.env\b(?!\s*(\.|\[))|\bos\.environ\b(?!\s*(\.get\(|\[))|\/proc\/[^\s/]+\/environ/;

/** Прямые запросы к API GitHub: для этого есть gh и коннектор, которые проверяются. */
const GITHUB_API_HOST = /\b(api|uploads)\.github\.com\b/i;

/** Программы, которые выводят содержимое файла — их запуск на секрете запрещён. */
const FILE_READERS = new Set([
  'cat',
  'type',
  'get-content',
  'gc',
  'head',
  'tail',
  'less',
  'more',
  'grep',
  'rg',
  'sed',
  'awk',
  'strings',
  'base64',
  'xxd',
  'od',
  'hexdump',
  'sort',
  'uniq',
  'findstr',
  'select-string',
  'sls',
  'bat',
  'nl',
  'cut',
  'tac',
  'diff',
  'certutil',
  'openssl',
  'node',
]);

/** Программы, которые пишут, переносят или удаляют файлы. */
const FILE_WRITERS = new Set([
  'rm',
  'mv',
  'cp',
  'tee',
  'touch',
  'chmod',
  'ln',
  'truncate',
  'dd',
  'install',
  'rmdir',
  'set-content',
  'add-content',
  'out-file',
  'remove-item',
  'move-item',
  'copy-item',
  'new-item',
  'rename-item',
  'clear-content',
  'ri',
  'del',
  'erase',
  'move',
  'copy',
  'ren',
]);

/** Обёртки, которые запускают следующую за ними программу как есть. */
const PASSTHROUGH = new Set(['env', 'command', 'sudo', 'time', 'nohup', 'exec', 'nice', 'timeout']);

/** Обёртки, которые исполняют СТРОКУ — её разбираем как отдельную команду. */
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'pwsh', 'powershell', 'cmd']);

/**
 * После обратной косой черты в bash экранируется только служебный символ.
 * В остальных случаях это разделитель пути Windows (infra\terraform\x) —
 * его надо сохранить, иначе путь склеится и секрет не распознается.
 */
const ESCAPABLE = new Set([' ', '\t', '"', "'", '\\', '$', ';', '&', '|', '<', '>', '(', ')', '`']);

// ───────────────────────────── разбор строки ─────────────────────────────

/**
 * Делит строку на простые команды и слова, учитывая кавычки.
 * Разделители: && || ; | & и перевод строки.
 *
 * @param {string} input
 * @returns {{words: string[]}[]}
 */
export function splitCommands(input) {
  const commands = [];
  let words = [];
  let word = '';
  let hasWord = false;
  let quote = null;

  const endWord = () => {
    if (hasWord) words.push(word);
    word = '';
    hasWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push({ words });
    words = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quote !== null) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && ESCAPABLE.has(input[i + 1] ?? '')) {
        i += 1;
        word += input[i];
      } else {
        word += ch;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      hasWord = true;
    } else if (ch === '\\' && ESCAPABLE.has(input[i + 1] ?? '')) {
      i += 1;
      word += input[i];
      hasWord = true;
    } else if (ch === '\n' || ch === ';' || ch === '|' || ch === '&') {
      endCommand();
    } else if (ch === ' ' || ch === '\t' || ch === '\r') {
      endWord();
    } else if (ch === '>' || ch === '<') {
      // Перенаправление — отдельное слово, чтобы «>файл» распознавался как запись.
      // Номер дескриптора перед ним («2>») — часть перенаправления, не аргумент.
      if (hasWord && /^\d+$/.test(word)) {
        word = '';
        hasWord = false;
      } else {
        endWord();
      }
      let op = ch;
      while (input[i + 1] === '>') {
        i += 1;
        op += '>';
      }
      // «>&1», «2>&-»: перенаправление в дескриптор, «&» здесь не разделитель команд.
      if (input[i + 1] === '&') {
        i += 1;
        op += '&';
        while (/[\d-]/.test(input[i + 1] ?? '')) {
          i += 1;
          op += input[i];
        }
      }
      words.push(op);
    } else {
      word += ch;
      hasWord = true;
    }
  }
  endCommand();
  return commands;
}

/** Содержимое $( … ) и `…` — вложенные команды проверяются так же, как внешние. */
function nestedCommands(input) {
  const found = [];
  for (const match of input.matchAll(/\$\(([^()]*)\)/g)) found.push(match[1]);
  for (const match of input.matchAll(/`([^`]*)`/g)) found.push(match[1]);
  return found;
}

function programName(word) {
  const base = word.split(/[\\/]/).pop() ?? word;
  return base.toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
}

// ───────────────────────────── вердикт ─────────────────────────────

const RANK = { none: 0, ask: 1, deny: 2 };

class Verdict {
  constructor() {
    this.decision = 'none';
    this.reasons = [];
  }
  add(decision, reason) {
    if (RANK[decision] > RANK[this.decision]) this.decision = decision;
    this.reasons.push(`${decision === 'deny' ? '⛔' : '❓'} ${reason}`);
  }
  merge(other) {
    this.reasons.push(...other.reasons);
    if (RANK[other.decision] > RANK[this.decision]) this.decision = other.decision;
  }
}

/**
 * Вердикт по всей строке команды.
 *
 * @param {string} command
 * @param {GuardContext} ctx
 * @returns {Verdict}
 *
 * @typedef {object} GuardContext
 * @property {() => string|null} currentBranch  имя текущей ветки
 * @property {() => string|null} upstream       «origin/xxx» или null
 * @property {(ref: string) => string[]|null} changedFiles  файлы ref против main
 */
export function evaluate(command, ctx, depth = 0) {
  const verdict = new Verdict();
  if (depth > 3) {
    verdict.add('ask', 'Слишком глубокая вложенность команд — разобрать не удалось');
    return verdict;
  }
  // Строка целиком смотрится один раз: вложенные команды — её же части.
  if (depth === 0) checkRawText(command, verdict);
  for (const inner of nestedCommands(command)) verdict.merge(evaluate(inner, ctx, depth + 1));
  for (const { words } of splitCommands(command)) checkSimpleCommand(words, ctx, verdict, depth);
  return verdict;
}

/**
 * Приметы, которые не зависят от того, какая программа запущена: токен можно
 * передать в curl, node, python или записать в файл — разбирать каждую нет смысла.
 */
function checkRawText(command, verdict) {
  if (SECRET_ENV_REF.test(command)) {
    verdict.add(
      'deny',
      'Обращение к секрету в переменной окружения: в облаке там ключ доступа к GitHub. ' +
        'Для поиска по коду — инструмент Grep, а не терминал'
    );
  }
  if (WHOLE_ENV_REF.test(command)) {
    verdict.add('deny', 'Вывод всего окружения процесса — вместе с ним уходят токены');
  }
  if (GITHUB_API_HOST.test(command)) {
    verdict.add(
      'deny',
      'Прямой запрос к API GitHub мимо gh и коннектора — сторож не видит, что он делает'
    );
  }
}

/** Команды, которые без аргументов печатают все переменные окружения. */
function dumpsEnvironment(program, args) {
  const operands = args.filter((a) => !a.startsWith('-') && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(a));
  switch (program) {
    case 'env':
    case 'printenv':
      return operands.length === 0;
    case 'set':
      // «set -e» и «set -x» — режимы оболочки; печатает только голый set.
      return args.length === 0;
    case 'export':
      return operands.length === 0 && (args.length === 0 || args.includes('-p'));
    case 'declare':
    case 'typeset':
      // «declare -a arr» ничего не печатает; печатают голые и -p/-x без имени.
      return (
        operands.length === 0 && (args.length === 0 || args.some((a) => /^-[a-z]*[px]/.test(a)))
      );
    case 'compgen':
      return args.includes('-e');
    case 'get-childitem':
    case 'gci':
    case 'ls':
    case 'dir':
    case 'get-item':
      return args.some((a) => /^env:[\\/*]?$/i.test(a));
    default:
      return false;
  }
}

/**
 * Аргументы без перенаправлений: «git push origin x 2>/dev/null» — это push
 * в origin, а не в remote «/dev/null». Файлы-цели проверяет checkFiles отдельно.
 */
function withoutRedirects(args) {
  const plain = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '>' || arg === '>>' || arg === '<') {
      i += 1;
    } else if (!/^[<>]+&/.test(arg)) {
      plain.push(arg);
    }
  }
  return plain;
}

function checkSimpleCommand(input, ctx, verdict, depth) {
  let words = input;
  // Присваивания переменных перед командой: FOO=1 git push
  while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words = words.slice(1);
  if (
    words.length > 0 &&
    dumpsEnvironment(programName(words[0]), withoutRedirects(words.slice(1)))
  ) {
    verdict.add('deny', 'Вывод всех переменных окружения — среди них токены доступа');
    return;
  }
  while (words.length > 0 && PASSTHROUGH.has(programName(words[0]))) {
    words = words.slice(1);
    while (words.length > 0 && words[0].startsWith('-')) words = words.slice(1);
  }
  if (words.length === 0) return;

  const program = programName(words[0]);
  checkFiles(program, words.slice(1), verdict);
  const args = withoutRedirects(words.slice(1));

  if (SHELLS.has(program)) {
    const flagIndex = args.findIndex((a) => /^(-c|-lc|-command|\/c|\/k)$/i.test(a));
    if (flagIndex >= 0 && flagIndex + 1 < args.length) {
      verdict.merge(evaluate(args.slice(flagIndex + 1).join(' '), ctx, depth + 1));
    } else if (args.some((a) => /^-(encodedcommand|enc|e)$/i.test(a))) {
      verdict.add('deny', 'Закодированная команда PowerShell — её содержимое не проверить');
    }
    return;
  }

  switch (program) {
    case 'git':
      checkGit(args, ctx, verdict);
      break;
    case 'gh':
      checkGh(args, verdict);
      break;
    case 'npm':
      if (
        [
          'publish',
          'unpublish',
          'deprecate',
          'owner',
          'token',
          'adduser',
          'login',
          'access',
          'dist-tag',
        ].includes(args[0] ?? '')
      ) {
        verdict.add('deny', `npm ${args[0] ?? ''}: публикация или учётная запись npm`);
      }
      break;
    case 'terraform':
      if (args.some((a) => ['apply', 'destroy', 'import'].includes(a))) {
        verdict.add(
          'deny',
          'terraform меняет настоящую инфраструктуру мимо слияния — это делает владелец'
        );
      }
      break;
    case 'docker':
      if (args[0] === 'push' || args[0] === 'login') {
        verdict.add('deny', `docker ${args[0]}: публикация образа наружу`);
      }
      break;
    default:
      break;
  }
}

/** Секреты и файлы-правила, упомянутые в любой команде. */
function checkFiles(program, args, verdict) {
  const redirectsTo = new Set();
  for (let i = 0; i < args.length - 1; i += 1) {
    if (args[i] === '>' || args[i] === '>>') redirectsTo.add(args[i + 1]);
  }

  for (const arg of args) {
    if (arg === '>' || arg === '>>' || arg === '<') continue;
    const path = arg.replace(/^[^=]*=/, '');
    if (FILE_READERS.has(program) && SECRET_FILE.test(path) && !/\.example$/.test(path)) {
      verdict.add('deny', `Чтение файла с секретами (${path})`);
    }
    const writes =
      FILE_WRITERS.has(program) ||
      redirectsTo.has(arg) ||
      (program === 'sed' && args.some((a) => /^-[a-z]*i/.test(a))) ||
      (program === 'git' && ['rm', 'mv', 'checkout', 'restore', 'apply'].includes(args[0] ?? ''));
    if (writes && GUARDED_PATH.test(path)) {
      verdict.add('ask', `Правка правил процесса через терминал (${path})`);
    }
  }
}

// ───────────────────────────── git ─────────────────────────────

/** Ключи git config, через которые отключаются хуки или подменяется адрес. */
const DANGEROUS_GIT_CONFIG =
  /^(core\.hookspath|core\.sshcommand|alias\.|credential\.|url\.|remote\..*\.(url|pushurl)|push\.default|http\..*extraheader)/i;

/** Ключи git config, в которых лежат учётные данные: их нельзя даже читать. */
const SECRET_GIT_CONFIG = /^(credential\.|http\..*extraheader)/i;

function checkGit(input, ctx, verdict) {
  let args = input;
  // Глобальные параметры до подкоманды: -C путь, -c ключ=значение и т. п.
  while (args.length > 0 && args[0].startsWith('-')) {
    const flag = args[0];
    if (flag === '-C' || flag === '-c' || flag === '--git-dir' || flag === '--work-tree') {
      if (flag === '-c' && DANGEROUS_GIT_CONFIG.test(args[1] ?? '')) {
        verdict.add('deny', `git -c ${args[1] ?? ''}: подмена настроек, отключающая защиту`);
      }
      args = args.slice(2);
    } else {
      args = args.slice(1);
    }
  }
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === undefined) return;

  if (rest.includes('--no-verify')) {
    verdict.add('deny', `git ${sub} --no-verify: обход проверки секретов перед коммитом`);
  }

  switch (sub) {
    case 'push':
      checkGitPush(rest, ctx, verdict);
      break;
    case 'commit':
      if (shortFlags(rest, ['-m', '-F', '-C', '-c', '-t', '--author']).includes('n')) {
        verdict.add('deny', 'git commit -n: обход проверки секретов перед коммитом');
      }
      if (ctx.currentBranch() === PROTECTED_BRANCH) {
        verdict.add('deny', `Коммит прямо в ${PROTECTED_BRANCH} — сначала отдельная ветка`);
      }
      break;
    case 'config':
      if (rest.some((a) => DANGEROUS_GIT_CONFIG.test(a)) && !rest.includes('--get')) {
        verdict.add('deny', 'git config: ключ, через который отключаются хуки или меняется адрес');
      }
      // В облаке git получает часть настроек из окружения (GIT_CONFIG_*) — там могут быть учётные данные.
      if (rest.some((a) => SECRET_GIT_CONFIG.test(a))) {
        verdict.add('deny', 'git config: чтение ключа с учётными данными');
      }
      if (rest.some((a) => ['-l', '--list', '--get-regexp', '--get-urlmatch'].includes(a))) {
        verdict.add(
          'deny',
          'git config --list: вместе с настройками может напечатать учётные данные. ' +
            'Нужный ключ — git config --get <ключ>'
        );
      }
      break;
    case 'var':
      if (rest.includes('-l')) {
        verdict.add('deny', 'git var -l: печатает все настройки, включая учётные данные');
      }
      break;
    case 'remote':
      if (['add', 'set-url', 'rename', 'remove', 'rm', 'set-head'].includes(rest[0] ?? '')) {
        verdict.add('deny', `git remote ${rest[0] ?? ''}: смена адреса, куда уходит код`);
      }
      break;
    case 'filter-repo':
    case 'filter-branch':
    case 'replace':
      verdict.add('deny', `git ${sub}: переписывание истории`);
      break;
    case 'credential':
    case 'credential-manager':
    case 'credential-store':
      verdict.add('deny', 'git credential: доступ к сохранённым паролям и токенам');
      break;
    default:
      break;
  }
}

/**
 * Одиночные флаги, включая склеенные (-uf = -u -f). Значения флагов из
 * withValue пропускаются: текст после -m — сообщение, а не набор флагов.
 */
function shortFlags(args, withValue) {
  const letters = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (withValue.includes(arg)) {
      i += 1;
      continue;
    }
    if (/^-[A-Za-z]+$/.test(arg)) {
      // -mСООБЩЕНИЕ: всё после буквы-со-значением — само значение
      for (const ch of arg.slice(1)) {
        letters.push(ch);
        if (withValue.includes(`-${ch}`)) break;
      }
    }
  }
  return letters;
}

function checkGitPush(args, ctx, verdict) {
  const flags = args.filter((a) => a.startsWith('-'));
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (['--repo', '--receive-pack', '--exec'].includes(args[i])) {
      verdict.add('deny', `git push ${args[i]}: отправка не туда, куда смотрит origin`);
      i += 1;
    } else if (args[i] === '-o' || args[i] === '--push-option') {
      i += 1;
    } else if (!args[i].startsWith('-')) {
      positional.push(args[i]);
    }
  }

  const letters = shortFlags(args, ['-o']);
  if (
    letters.includes('f') ||
    flags.some((f) => /^--(force|force-with-lease|force-if-includes)(=|$)/.test(f))
  ) {
    verdict.add('deny', 'Принудительный push (force) переписывает историю на GitHub');
  }
  if (letters.includes('d') || flags.includes('--delete') || flags.includes('--prune')) {
    verdict.add('deny', 'Удаление веток на GitHub — это делает GitHub после слияния');
  }
  if (flags.some((f) => /^--(mirror|all|repo=|receive-pack=|exec=)/.test(f))) {
    verdict.add('deny', 'git push всех веток или в другой адрес');
  }

  const [remote, ...refspecs] = positional;
  if (remote !== undefined && remote !== ALLOWED_REMOTE) {
    verdict.add('deny', `git push в «${remote}»: разрешён только ${ALLOWED_REMOTE}`);
  }

  const branch = ctx.currentBranch();
  const targets = [];
  const sources = [];

  if (refspecs.length === 0) {
    const upstream = ctx.upstream();
    targets.push(
      upstream?.startsWith(`${ALLOWED_REMOTE}/`)
        ? upstream.slice(ALLOWED_REMOTE.length + 1)
        : branch
    );
    sources.push('HEAD');
  }
  for (const spec of refspecs) {
    if (spec.startsWith('+')) verdict.add('deny', `Принудительный push через «${spec}»`);
    if (spec.startsWith(':')) verdict.add('deny', `«${spec}» удаляет ветку на GitHub`);
    const clean = spec.replace(/^\+/, '');
    const [src, dst] = clean.includes(':') ? clean.split(':', 2) : [clean, clean];
    targets.push(
      (dst === 'HEAD' || dst === '@' ? branch : dst)?.replace(/^refs\/heads\//, '') ?? null
    );
    if (src !== '' && !src.startsWith('refs/tags/')) sources.push(src);
  }

  for (const target of targets) {
    if (target === null || target === undefined) {
      verdict.add('ask', 'Не удалось определить, в какую ветку уйдёт push');
    } else if (target === PROTECTED_BRANCH) {
      verdict.add('deny', `Push в ${PROTECTED_BRANCH} — только через pull request`);
    }
  }

  for (const src of sources) {
    const files = ctx.changedFiles(src);
    if (files === null) {
      verdict.add('ask', `Не удалось сравнить «${src}» с main — неясно, меняет ли ветка CI`);
      continue;
    }
    const guarded = files.filter(isGuardedFile);
    if (guarded.length > 0) {
      verdict.add(
        'ask',
        `В ветке изменены правила процесса (${guarded.slice(0, 5).join(', ')}). ` +
          'Workflow из PR выполняется с секретами ещё до слияния — нужно «да» владельца'
      );
    }
  }
}

// ───────────────────────────── gh ─────────────────────────────

function checkGh(input, verdict) {
  let args = input;
  const repoIndex = args.findIndex((a) => a === '-R' || a === '--repo' || a.startsWith('--repo='));
  if (repoIndex >= 0) {
    const inline = args[repoIndex].startsWith('--repo=');
    const value = inline ? args[repoIndex].slice(7) : args[repoIndex + 1];
    if (!/^(YafremauAliaksei\/)?efremova\.online$/i.test(value ?? '')) {
      verdict.add('deny', `gh --repo ${value ?? ''}: работа с чужим репозиторием`);
    }
    args = args.filter((_, i) => i !== repoIndex && (inline || i !== repoIndex + 1));
  }

  const [group, action] = args;
  const readOnly = ['view', 'list', 'status', 'checks', 'diff', 'watch', 'check', 'get'];

  switch (group) {
    case 'auth':
      if (action !== 'status') {
        verdict.add('deny', `gh auth ${action ?? ''}: вход и токены — только владелец`);
      }
      return;
    case 'pr':
      if (action === 'merge') verdict.add('deny', 'Слияние PR — решение владельца на GitHub');
      return;
    case 'api':
      checkGhApi(args.slice(1), verdict);
      return;
    case 'repo':
    case 'release':
    case 'workflow':
    case 'ruleset':
    case 'secret':
    case 'variable':
    case 'gist':
    case 'ssh-key':
    case 'gpg-key':
    case 'extension':
    case 'alias':
    case 'config':
      if (!readOnly.includes(action ?? '')) {
        verdict.add(
          'deny',
          `gh ${group} ${action ?? ''}: настройки репозитория, секреты или публикация наружу`
        );
      }
      return;
    default:
      return;
  }
}

const GH_API_VALUE_FLAGS = [
  '-H',
  '--header',
  '-q',
  '--jq',
  '-t',
  '--template',
  '--cache',
  '-p',
  '--preview',
  '--hostname',
];

function checkGhApi(args, verdict) {
  let method = null;
  let hasBody = false;
  let endpoint = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-X' || arg === '--method') {
      method = (args[i + 1] ?? '').toUpperCase();
      i += 1;
    } else if (/^--method=/.test(arg) || /^-X[A-Za-z]/.test(arg)) {
      method = arg.replace(/^(--method=|-X)/, '').toUpperCase();
    } else if (['-f', '-F', '--field', '--raw-field', '--input'].includes(arg)) {
      hasBody = true;
      i += 1;
    } else if (/^(-[fF]|--(raw-)?field=|--input=)/.test(arg)) {
      hasBody = true;
    } else if (GH_API_VALUE_FLAGS.includes(arg)) {
      i += 1;
    } else if (!arg.startsWith('-') && endpoint === null) {
      endpoint = arg;
    }
  }
  if (endpoint === 'graphql') {
    // Чтение в GraphQL — тоже POST, поэтому смотрим на слово mutation.
    if (args.some((a) => /\bmutation\b/i.test(a))) {
      verdict.add('deny', 'gh api graphql mutation: запись в GitHub');
    }
    return;
  }
  const effective = method ?? (hasBody ? 'POST' : 'GET');
  if (effective !== 'GET' && effective !== 'HEAD') {
    verdict.add('deny', `gh api ${effective}: запись в GitHub в обход обычных команд`);
  }
}

// ───────────────────────────── GitHub-коннектор ─────────────────────────────

const OWN_REPO = { owner: 'yafremaualiaksei', repo: 'efremova.online' };

/** Инструменты коннектора, которые агенту не нужны ни при каких условиях. */
const API_WRITE = 'Запись в репозиторий через API мимо git: без pre-commit и без проверки сторожем';
const MCP_FORBIDDEN = new Map([
  ['merge_pull_request', 'Слияние PR — решение владельца на GitHub'],
  ['enable_pr_auto_merge', 'Автослияние — то же слияние, только отложенное'],
  ['create_or_update_file', API_WRITE],
  ['push_files', API_WRITE],
  ['delete_file', API_WRITE],
  ['create_repository', 'Создание репозиториев — не часть работы над сайтом'],
  ['fork_repository', 'Форк уводит код туда, где не действуют правила репозитория'],
]);

/**
 * Перезапуск упавших проверок и отмена — безопасны: выполняется тот же workflow
 * с того же коммита. Запуск workflow по ветке выполнил бы файл из этой ветки,
 * удаление логов стирает след.
 */
const ACTIONS_ALLOWED = new Set(['rerun_failed_jobs', 'rerun_workflow_run', 'cancel_workflow_run']);

/** Чтение не меняет ничего, его можно делать и в чужих репозиториях. */
function isReadOnlyTool(tool) {
  return /^(get|list|search)_/.test(tool) || /_read$/.test(tool);
}

/**
 * Вердикт по вызову инструмента MCP. Смотрим только серверы GitHub:
 * имя вида mcp__github__merge_pull_request или mcp__plugin_github_github__…
 *
 * @param {string} toolName
 * @param {Record<string, unknown>} input
 * @returns {Verdict}
 */
export function evaluateMcp(toolName, input) {
  const verdict = new Verdict();
  const [, server = '', ...rest] = toolName.split('__');
  if (!/github/i.test(server)) return verdict;
  const tool = rest.join('__');

  const forbidden = MCP_FORBIDDEN.get(tool);
  if (forbidden !== undefined) verdict.add('deny', `${tool}: ${forbidden}`);

  if (tool === 'actions_run_trigger' && !ACTIONS_ALLOWED.has(String(input.method ?? ''))) {
    verdict.add(
      'deny',
      `actions_run_trigger ${String(input.method ?? '')}: разрешены только перезапуск и отмена`
    );
  }

  if (String(input.event ?? '').toUpperCase() === 'APPROVE') {
    verdict.add('deny', 'Одобрение PR — подпись владельца, агент её не ставит');
  }

  const owner = typeof input.owner === 'string' ? input.owner.toLowerCase() : null;
  const repo = typeof input.repo === 'string' ? input.repo.toLowerCase() : null;
  const foreign =
    (owner !== null && owner !== OWN_REPO.owner) || (repo !== null && repo !== OWN_REPO.repo);
  if (foreign && !isReadOnlyTool(tool)) {
    verdict.add(
      'deny',
      `${tool} в ${String(input.owner)}/${String(input.repo)}: чужой репозиторий`
    );
  }
  return verdict;
}

// ───────────────────────────── запуск как хук ─────────────────────────────

function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** @returns {GuardContext} */
export function liveContext(cwd) {
  return {
    currentBranch: () => git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    upstream: () => git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']),
    changedFiles: (ref) => {
      // ref уходит отдельным аргументом без оболочки, но «--флаг» git прочёл бы как параметр.
      if (!/^[\w./@^~-]+$/.test(ref) || ref.startsWith('-')) return null;
      // В облачной копии origin/main может не быть — тогда сравниваем с локальным main.
      for (const base of [`origin/${PROTECTED_BRANCH}`, PROTECTED_BRANCH]) {
        const out = git(cwd, ['diff', '--name-only', `${base}...${ref}`, '--']);
        if (out !== null) return out.split('\n').filter(Boolean);
      }
      return null;
    },
  };
}

function respond(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: `Сторож команд (.claude/hooks/guard-commands.mjs):\n${reason}`,
      },
    })
  );
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    respond('ask', '❓ Сторож не смог прочитать команду');
    return;
  }
  const toolName = String(input?.tool_name ?? '');
  const toolInput =
    input?.tool_input !== null && typeof input?.tool_input === 'object' ? input.tool_input : {};
  const cwd = typeof input?.cwd === 'string' && input.cwd !== '' ? input.cwd : process.cwd();

  try {
    let verdict;
    if (toolName.startsWith('mcp__')) {
      verdict = evaluateMcp(toolName, toolInput);
    } else {
      const command = String(toolInput.command ?? '');
      if (command.trim() === '') return;
      verdict = evaluate(command, liveContext(cwd));
    }
    if (verdict.decision !== 'none') respond(verdict.decision, verdict.reasons.join('\n'));
  } catch (error) {
    respond('ask', `❓ Сторож упал на этой команде (${String(error)})`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
