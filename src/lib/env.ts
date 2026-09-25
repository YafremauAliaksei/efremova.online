import { z } from 'zod';

/**
 * Единая точка правды о переменных окружения.
 *
 * Зачем это нужно: опечатка в имени переменной обнаруживается при старте,
 * а не через неделю в проде в момент, когда что-то перестало работать.
 *
 * ⚠️ Файл только серверный. Импорт из клиентского компонента недопустим:
 *    это утащило бы секреты в браузер. Всё, что должно быть видно браузеру,
 *    начинается с NEXT_PUBLIC_ и описывается отдельно.
 *
 * ── ПОЧЕМУ СПИСОК ТАКОЙ КОРОТКИЙ ──────────────────────────────────────────
 *
 * Основной домен — это сайт-визитка. Он не ходит ни в один внешний сервис:
 * ни OAuth, ни платежей, ни аналитики, ни очередей. Переменных окружения
 * ровно столько, сколько нужно, чтобы поднять сайт и подписать сессию
 * администратора. Каждая лишняя строка здесь — это ключ, который можно
 * потерять, и дверь, которую нужно сторожить.
 *
 * Ключи для входа через Google, Apple и Telegram вернутся вместе с личным
 * кабинетом — на отдельном поддомене, в отдельном окружении
 * (docs/13-site-architecture.md, раздел 10).
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

  /**
   * Подписывает сессию администратора и служит солью для хеша IP в квитанции
   * о согласии. Без него админка не работает, сайт — работает.
   */
  AUTH_SECRET: optionalSecret,

  /** 'false' выключает ловушки — нужно только при отладке */
  HONEYPOT_ENABLED: z.string().optional(),
  /** Чтобы легальный пентест по договору не спотыкался о ловушки */
  PENTEST_BYPASS_TOKEN: optionalSecret,
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
