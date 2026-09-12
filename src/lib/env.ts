import { z } from 'zod';

/**
 * Единая точка правды о переменных окружения.
 *
 * Зачем это нужно:
 *   1. Опечатка в имени переменной обнаруживается при старте, а не через неделю
 *      в проде в момент, когда клиент пытается оплатить.
 *   2. Отсюда же берётся ответ на вопрос «настроен ли способ входа» —
 *      см. src/lib/auth/providers.ts.
 *
 * ⚠️ Файл только серверный. Импорт из клиентского компонента недопустим:
 *    это утащило бы секреты в браузер. Всё, что должно быть видно браузеру,
 *    начинается с NEXT_PUBLIC_ и лежит в отдельной схеме ниже.
 */

/** Пустая строка в .env — это «не настроено», а не «настроено пустотой» */
const optionalSecret = z
  .string()
  .trim()
  .min(1)
  .optional()
  .catch(undefined)
  .transform((value) => (value === '' ? undefined : value));

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),

  // ─── Авторизация. Всё опционально: без этих значений сайт обязан
  //     работать и честно показывать, что метод входа недоступен. ───
  AUTH_SECRET: optionalSecret,
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  APPLE_CLIENT_ID: optionalSecret,
  APPLE_TEAM_ID: optionalSecret,
  APPLE_KEY_ID: optionalSecret,
  APPLE_PRIVATE_KEY: optionalSecret,
  TELEGRAM_BOT_TOKEN: optionalSecret,
  WHATSAPP_PHONE_NUMBER_ID: optionalSecret,
  WHATSAPP_ACCESS_TOKEN: optionalSecret,

  // ─── Прочее ───
  FIELD_ENCRYPTION_KEY: optionalSecret,
  HONEYPOT_ENABLED: z.string().optional(),
  PENTEST_BYPASS_TOKEN: optionalSecret,
  AUTH_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  AUTH_PROBE_TTL_OK_MS: z.coerce.number().int().positive().default(600_000), // 10 минут
  AUTH_PROBE_TTL_FAIL_MS: z.coerce.number().int().positive().default(60_000), // 1 минута
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached !== null) return cached;

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    // Сообщение намеренно без значений — только имена полей.
    // Логи читают люди, а иногда и сторонние сервисы сбора ошибок.
    const problems = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Некорректная конфигурация окружения. Проверьте переменные: ${problems}`);
  }

  cached = parsed.data;
  return cached;
}

/** Настроен ли набор переменных целиком (все непустые) */
export function hasAll(keys: readonly (keyof ServerEnv)[]): boolean {
  const config = env();
  return keys.every((key) => {
    const value = config[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/** Какие именно переменные из набора отсутствуют — для понятного сообщения */
export function missingKeys(keys: readonly (keyof ServerEnv)[]): string[] {
  const config = env();
  return keys.filter((key) => {
    const value = config[key];
    return !(typeof value === 'string' && value.trim().length > 0);
  });
}
