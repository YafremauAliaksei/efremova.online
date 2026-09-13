#!/usr/bin/env node
/**
 * Создаёт .env для локальной разработки, если его ещё нет.
 *
 * Зачем: человек, склонировавший публичный репозиторий, должен получить
 * работающий сайт одной командой, а не искать по документации, какие
 * 40 переменных заполнить. Внешние ключи при этом НЕ нужны: без них сайт
 * работает и честно показывает недоступные способы входа
 * (docs/08-auth-availability-and-privacy.md).
 *
 * Секреты генерируются случайно прямо здесь, поэтому у каждого разработчика
 * они свои и в репозиторий не попадают (.env в .gitignore).
 *
 * Запуск: npm run env:init
 */

import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env');

if (existsSync(ENV_PATH)) {
  console.log('.env уже существует — ничего не меняю.');
  console.log('Чтобы пересоздать: удалите файл и запустите команду снова.');
  process.exit(0);
}

/** hex, а не base64: такие значения безопасно подставлять в строку подключения */
const secret = (bytes = 32) => randomBytes(bytes).toString('hex');

const dbPassword = secret(16);
const redisPassword = secret(16);

const content = `# ═══════════════════════════════════════════════════════════════════
#  ЛОКАЛЬНАЯ РАЗРАБОТКА — создан автоматически ${new Date().toISOString().slice(0, 10)}
#
#  ⚠️ Этот файл в .gitignore и НИКОГДА не попадает в репозиторий.
#  ⚠️ Значения ниже пригодны только для локальной машины.
#     Для сервера секреты генерируются заново.
#
#  Внешние ключи (Google, Telegram, платежи) намеренно оставлены пустыми:
#  сайт обязан работать без них и честно показывать, что метод входа
#  не подключён. Полный список переменных — в .env.example
# ═══════════════════════════════════════════════════════════════════

NODE_ENV=development
APP_ENV=development
APP_URL=http://localhost:3000

# ─── База данных (контейнер из docker-compose.dev.yml) ───
POSTGRES_USER=app
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=efremova
DATABASE_URL=postgresql://app:${dbPassword}@localhost:5432/efremova?schema=public

# ─── Redis ───
REDIS_PASSWORD=${redisPassword}
REDIS_URL=redis://:${redisPassword}@localhost:6379

# ─── Подпись сессий ───
AUTH_SECRET=${secret(32)}
AUTH_URL=http://localhost:3000

# ─── Ключ шифрования медицинских данных ───
# ⚠️ В проде его место — в хранилище секретов, а не в файле на диске.
FIELD_ENCRYPTION_KEY=${secret(32)}
FIELD_ENCRYPTION_KEY_VERSION=v1

# ─── Безопасность ───
HONEYPOT_ENABLED=true
HONEYPOT_BAN_THRESHOLD=100
HONEYPOT_CHALLENGE_THRESHOLD=50

# ─── Способы входа: пусто = «не подключено», и сайт это покажет ───
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
TELEGRAM_BOT_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=

# ─── Прочие интеграции (подключаются в своих спринтах) ───
VIDEO_PROVIDER=google_meet
PAYMENT_PROVIDERS_ENABLED=
CRYPTO_ENABLED=false
DEFAULT_CURRENCY=EUR
`;

// ⚠️ flag: 'wx' — «создай файл, а если он уже существует, упади с ошибкой».
//
// Проверка existsSync выше сама по себе защитой не является: между ней и записью
// проходит время, за которое на месте .env может появиться символическая ссылка —
// и тогда сгенерированные секреты уйдут по ней, в чужой файл. Классическая гонка
// «проверил — сделал» (CodeQL js/file-system-race, находка #1).
//
// Флаг wx делает проверку и создание ОДНОЙ неделимой операцией на уровне ядра:
// промежутка, в который можно вклиниться, больше не существует. existsSync выше
// оставлен ради понятного сообщения в обычном случае, а не ради безопасности.
try {
  writeFileSync(ENV_PATH, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
} catch (error) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  if (code === 'EEXIST') {
    console.error('.env появился, пока скрипт работал. Ничего не перезаписываю.');
    console.error('Проверьте файл вручную: возможно, его создал кто-то ещё.');
    process.exit(1);
  }
  throw error;
}

console.log('✓ Создан .env со случайными локальными секретами');
console.log('  Внешние ключи оставлены пустыми — так и задумано.');
console.log('  Дальше: npm run dev:db && npm run db:migrate && npm run db:seed');
