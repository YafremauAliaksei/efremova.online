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
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env');

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

// ⚠️ ЕДИНСТВЕННАЯ проверка существования .env — вот эта запись, и она же создание.
//
// flag: 'wx' означает «создай файл, а если он уже существует — верни ошибку».
// Проверка и создание происходят ОДНОЙ неделимой операцией на уровне ядра.
//
// Раньше здесь стояла привычная пара: сначала existsSync в начале файла, потом
// запись в конце. Между ними проходило время, за которое на место .env можно
// подложить символическую ссылку — и сгенерированные секреты ушли бы по ней,
// в чужой файл. Классическая гонка «проверил — сделал», CodeQL js/file-system-race.
//
// Отдельный existsSync убран СОВСЕМ, а не оставлен «для удобного сообщения»:
// после появления wx он ничего не защищал, но сохранял в коде форму уязвимости —
// и читающий (человек или анализатор) вынужден был каждый раз разбираться заново.
// Сообщение для обычного случая теперь живёт там, где ему и место: в обработке
// ошибки EEXIST.
try {
  writeFileSync(ENV_PATH, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
} catch (error) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  if (code === 'EEXIST') {
    // Не ошибка: так ведёт себя повторный запуск npm run setup.
    console.log('.env уже существует — ничего не меняю.');
    console.log('Чтобы пересоздать: удалите файл и запустите команду снова.');
    process.exit(0);
  }
  throw error;
}

console.log('✓ Создан .env со случайными локальными секретами');
console.log('  Внешние ключи оставлены пустыми — так и задумано.');
console.log('  Дальше: npm run dev:db && npm run db:migrate && npm run db:seed');
