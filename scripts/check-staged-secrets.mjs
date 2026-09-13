#!/usr/bin/env node
/**
 * Проверка перед коммитом: не уезжает ли в репозиторий что-то секретное.
 *
 * Почему не Gitleaks: это Go-утилита, её нужно ставить отдельно, и на Windows
 * это лишний барьер. Здесь — то же самое на Node.js, работает сразу.
 * Gitleaks при этом остаётся в CI как вторая, независимая линия (docs/06, п.4).
 *
 * Запускается автоматически из .githooks/pre-commit после `npm run hooks:install`.
 */

import { execSync } from 'node:child_process';
import { closeSync, fstatSync, openSync, readFileSync } from 'node:fs';

/** Файлы, которых в репозитории быть не должно ни при каких обстоятельствах */
const FORBIDDEN_PATHS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[\w.-]+$/,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /(^|\/)id_rsa(\.pub)?$/,
  /(^|\/)terraform\.tfvars$/,
  /\.tfstate(\.backup)?$/,
  /\.(sql|dump)$/i,
  /(^|\/)service-account.*\.json$/i,
];

/**
 * Исключения из списка выше — по точному пути, а не по расширению.
 *
 * Миграции Prisma это .sql, но они не данные, а описание структуры базы,
 * и обязаны быть в репозитории: без них на сервере поднимется пустая база.
 * Правило «никаких .sql», написанное против дампов, едва не увело их из git
 * молча — поэтому исключение прописано явно и узко: только файл migration.sql
 * внутри prisma/migrations. Проверка СОДЕРЖИМОГО к ним по-прежнему применяется.
 */
const ALLOWED_PATHS = [/^prisma\/migrations\/[^/]+\/migration\.sql$/];

/**
 * Шаблоны секретов в содержимом файлов.
 * Списки намеренно узкие: цель — ноль ложных срабатываний, иначе
 * проверку начнут обходить через --no-verify, и толку от неё не будет.
 */
const SECRET_PATTERNS = [
  { name: 'Приватный ключ', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Секретный ключ Stripe', re: /\bsk_live_[0-9a-zA-Z]{20,}/ },
  { name: 'Ключ AWS', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Токен Telegram-бота', re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { name: 'Ключ Google API', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Токен GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Ключ OpenAI', re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'Строка подключения к БД с паролем', re: /postgres(ql)?:\/\/[^:\s]+:[^@\s]{8,}@/ },
  {
    name: 'Заполненный секрет в .env',
    re: /^[A-Z_]*(SECRET|TOKEN|PASSWORD|KEY)[A-Z_]*=(?!CHANGE_ME|\s*$)\S{16,}/m,
  },
];

/**
 * Где секретоподобные строки допустимы: заглушки, тестовые значения, документация.
 *
 * ⚠️ Список намеренно УЗКИЙ. Первая версия содержала /example/i — и пропустила
 * настоящий по виду ключ `AKIAIOSFODNN7EXAMPLE`, потому что в нём есть слово
 * EXAMPLE. Широкое исключение в проверке безопасности опаснее, чем её отсутствие:
 * оно создаёт ложное чувство защищённости.
 */
const ALLOWED_CONTEXT = [
  /CHANGE_ME/,
  /ci_only/,
  /availability-probe/,
  /not-a-real/,
  /@example\.(com|org|net)/,
  /\bexample\.(com|org|net)\b/,
  /placeholder/i,
  // Канонический пример ключа из документации самой AWS. Это не учётные
  // данные: такого ключа не существует, он опубликован ими как образец.
  // Разрешена ровно эта строка, а не всё, где встречается слово EXAMPLE.
  /\bAKIAIOSFODNN7EXAMPLE\b/,
];

/**
 * Подстановка переменной — не секрет.
 *
 * `postgresql://app:${dbPassword}@localhost` по форме неотличима от настоящей
 * строки подключения, но пароля в ней нет: он подставится во время выполнения.
 * Проверяем именно СОВПАВШИЙ фрагмент, а не всю строку, — иначе достаточно
 * было бы дописать `${}` в конец строки с настоящим ключом, чтобы обойти проверку.
 */
const TEMPLATE_PLACEHOLDER = /\$\{|\$\(|<[A-Z_]+>/;

const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (staged.length === 0) {
  process.exit(0);
}

const problems = [];

for (const file of staged) {
  // 1. Запрещённые файлы — по имени, без чтения содержимого
  const isAllowedPath = ALLOWED_PATHS.some((pattern) => pattern.test(file));
  const forbidden = isAllowedPath
    ? undefined
    : FORBIDDEN_PATHS.find((pattern) => pattern.test(file));
  if (forbidden !== undefined) {
    problems.push(`${file}\n     такие файлы никогда не коммитятся (секреты, ключи, дампы)`);
    continue;
  }

  // 2. Содержимое — только текстовые файлы разумного размера
  // Открываем файл ОДИН раз и спрашиваем размер у полученного дескриптора,
  // а не у имени. Прежний вариант (statSync по имени, потом readFileSync по имени)
  // обращался к диску дважды, и между обращениями файл можно было подменить —
  // например, ссылкой на другой файл (CodeQL js/file-system-race, находка #2).
  // Дескриптор указывает на конкретный файл, открытый в конкретный момент,
  // и подмена имени на него уже не влияет.
  let content;
  try {
    const fd = openSync(file, 'r');
    try {
      if (fstatSync(fd).size > 2_000_000) continue;
      content = readFileSync(fd, 'utf8');
    } finally {
      closeSync(fd);
    }
  } catch {
    continue; // бинарный файл или уже удалён
  }

  for (const pattern of SECRET_PATTERNS) {
    const match = pattern.re.exec(content);
    if (match === null) continue;

    // Совпал шаблон подстановки, а не значение: секрета в файле нет
    if (TEMPLATE_PLACEHOLDER.test(match[0])) continue;

    // Строка, в которой нашли — проверяем, не пример ли это
    const line = content.slice(0, match.index).split('\n').length;
    const lineText = content.split('\n')[line - 1] ?? '';
    if (ALLOWED_CONTEXT.some((allowed) => allowed.test(lineText))) continue;

    problems.push(`${file}:${String(line)}\n     похоже на секрет: ${pattern.name}`);
  }
}

if (problems.length > 0) {
  console.error('\n✖ Коммит остановлен: найдено то, что не должно попасть в репозиторий\n');
  for (const problem of problems) {
    console.error(`  • ${problem}`);
  }
  console.error(`
  Что делать:
    1. Уберите файл из коммита:  git restore --staged <файл>
    2. Секреты — только в .env (он в .gitignore)
    3. Если это ЛОЖНОЕ срабатывание и строка безопасна —
       добавьте её шаблон в ALLOWED_CONTEXT в этом скрипте

  ⚠️ Если секрет уже попадал в git раньше — его НЕДОСТАТОЧНО удалить.
     Ключ нужно отозвать и выпустить заново (docs/06-public-repo-strategy.md, п.5)
`);
  process.exit(1);
}

console.log('✓ Секретов в коммите не найдено');
