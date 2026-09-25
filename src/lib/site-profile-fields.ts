import { z } from 'zod';

/**
 * Поля профиля владельца и разбор меток в текстах (docs/03 п.11.3).
 *
 * Тексты для посетителей пишутся заранее, до реальной практики. Вместо имени,
 * адреса или NIP в них стоят метки {{owner.nip}}; значения лежат в базе и
 * правятся в админке. Незаполненная метка не пропадает молча, а видна на
 * странице — так к проверке юристом ни одно обязательное место не потеряется.
 *
 * ⚖️ Набор полей — техническое понимание требований к польскому сайту
 * психолога (ст. 5 закона об электронных услугах, ст. 5 директивы 2000/31/ЕС,
 * закон о профессии психолога), а не юридическая консультация.
 *
 * Файл без обращений к базе: чистые функции, их проверяют тесты.
 */

const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !value.includes('\n'));

/** NIP: 10 цифр, последняя — контрольная (веса 6,5,7,2,3,4,5,6,7, модуль 11). */
export function isValidNip(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  // Строка уже проверена на 10 цифр — код символа минус код «0» и есть цифра
  const digits = Array.from({ length: 10 }, (_, i) => value.charCodeAt(i) - 48);
  const sum = weights.reduce((acc, weight, i) => acc + weight * (digits[i] ?? 0), 0);
  return sum % 11 === digits[9];
}

export interface ProfileField {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
  schema: z.ZodType<string>;
}

export const PROFILE_FIELDS: readonly ProfileField[] = [
  {
    key: 'owner.fullName',
    label: 'Имя и фамилия (или фирма, как в CEIDG)',
    required: true,
    schema: line(200),
  },
  {
    key: 'owner.address',
    label: 'Адрес места ведения деятельности',
    hint: 'Одной строкой: улица, дом, индекс, город, страна',
    required: true,
    schema: line(300),
  },
  {
    key: 'owner.email',
    label: 'E-mail для связи',
    required: true,
    schema: z.string().trim().email(),
  },
  {
    key: 'owner.privacyEmail',
    label: 'E-mail по вопросам персональных данных',
    hint: 'Может совпадать с основным',
    required: true,
    schema: z.string().trim().email(),
  },
  {
    key: 'owner.phone',
    label: 'Телефон',
    required: false,
    schema: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,20}$/),
  },
  {
    key: 'owner.nip',
    label: 'NIP',
    hint: '10 цифр без пробелов и дефисов',
    required: true,
    schema: z.string().trim().refine(isValidNip),
  },
  {
    key: 'owner.regon',
    label: 'REGON',
    required: true,
    schema: z
      .string()
      .trim()
      .regex(/^(\d{9}|\d{14})$/),
  },
  {
    key: 'owner.registry',
    label: 'Реестр, в котором зарегистрирована деятельность',
    hint: 'Например: Centralna Ewidencja i Informacja o Działalności Gospodarczej (CEIDG)',
    required: true,
    schema: line(300),
  },
  {
    key: 'owner.professionalTitle',
    label: 'Профессиональное звание',
    hint: 'Например: psycholog',
    required: true,
    schema: line(200),
  },
  {
    key: 'owner.titleCountry',
    label: 'Государство, где присвоено звание',
    required: true,
    schema: line(100),
  },
  {
    key: 'owner.licenseNumber',
    label: 'Номер права на ведение практики',
    hint: 'Номер в реестре психологов — появится после получения права',
    required: true,
    schema: line(100),
  },
  {
    key: 'owner.professionalBody',
    label: 'Профессиональное самоуправление или организация',
    required: true,
    schema: line(300),
  },
  {
    key: 'owner.ethicsCode',
    label: 'Кодекс профессиональной этики',
    hint: 'Название и, если есть, ссылка',
    required: true,
    schema: line(300),
  },
  {
    key: 'owner.vatStatus',
    label: 'Статус по НДС',
    hint: 'Например: zwolniony z VAT na podstawie art. … ustawy o VAT',
    required: true,
    schema: line(300),
  },
  {
    key: 'service.hosting',
    label: 'Хостинг: компания и страна',
    required: true,
    schema: line(200),
  },
  {
    key: 'service.email',
    label: 'Почтовый сервис: компания и страна',
    required: true,
    schema: line(200),
  },
];

const FIELDS_BY_KEY = new Map(PROFILE_FIELDS.map((field) => [field.key, field]));

export const SITE_STATUS_KEY = 'site.status';
export type SiteStatus = 'development' | 'live';

export function parseSiteStatus(value: string | undefined): SiteStatus {
  // Всё, кроме явного 'live', — разработка: безопасное значение по умолчанию
  return value === 'live' ? 'live' : 'development';
}

export type ProfileValues = Readonly<Record<string, string>>;

/** Обязательные поля, которые ещё не заполнены. Пока список не пуст, сайт не выходит из разработки. */
export function missingRequired(values: ProfileValues): ProfileField[] {
  return PROFILE_FIELDS.filter((field) => field.required && (values[field.key] ?? '') === '');
}

/**
 * Проверка значения из формы: пустое — это «не заполнено», а не ошибка.
 * Неизвестный ключ отклоняется: форма не должна писать в базу что угодно.
 */
export function validateField(
  key: string,
  raw: string
): { ok: true; value: string } | { ok: false } {
  const field = FIELDS_BY_KEY.get(key);
  if (field === undefined) return { ok: false };
  if (raw.trim() === '') return { ok: true, value: '' };
  const result = field.schema.safeParse(raw);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}

export type TextPart =
  | { kind: 'text'; text: string }
  | { kind: 'missing'; key: string }
  | { kind: 'lawyer'; text: string };

const TOKEN = /\{\{\s*([a-z]+\.[A-Za-z]+)\s*\}\}|⟦ЮРИСТ:[^⟧]*⟧/g;

/**
 * Делит текст на части: обычный текст, подставленные значения, незаполненные
 * метки и пометки для юриста. Возвращает части, а не строку: странице нужно
 * выделить «не заполнено» и «ЮРИСТ», а не просто склеить текст.
 */
export function fillPlaceholders(text: string, values: ProfileValues): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  const push = (part: TextPart) => {
    const prev = parts.at(-1);
    if (part.kind === 'text' && prev?.kind === 'text') prev.text += part.text;
    else parts.push(part);
  };

  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) push({ kind: 'text', text: text.slice(last, match.index) });
    const key = match[1];
    if (key === undefined) {
      push({ kind: 'lawyer', text: match[0] });
    } else {
      const value = FIELDS_BY_KEY.has(key) ? (values[key] ?? '') : '';
      push(value === '' ? { kind: 'missing', key } : { kind: 'text', text: value });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) push({ kind: 'text', text: text.slice(last) });
  return parts;
}
