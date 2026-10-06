/**
 * Контакты владельца: как из значений профиля получаются ссылки «в один клик».
 *
 * Значения лежат в профиле владельца (site_settings, docs/03 п.11.2) и
 * правятся в админке; здесь — только проверка формата и сборка адреса.
 * Адрес ссылки собирается кодом из проверенного значения, а не берётся
 * из базы целиком: в href не попадёт ни `javascript:`, ни чужой домен,
 * даже если в базу записали что угодно.
 *
 * Ссылка — переход по щелчку посетителя, а не загрузка: браузер не обращается
 * к мессенджеру, пока человек сам не нажал (docs/13, п.1.1). Политика
 * конфиденциальности это уже описывает: мессенджер — самостоятельный
 * администратор данных.
 *
 * Файл без 'server-only' и без базы: чистые функции, их проверяют тесты.
 */

/** Имя пользователя Telegram: 5–32 знака, латиница, цифры, «_», начинается с буквы */
const TELEGRAM_USERNAME = /^[A-Za-z][A-Za-z0-9_]{3,30}[A-Za-z0-9]$/;

/**
 * Имя в Telegram из того, что вставил владелец: «name», «@name»,
 * «t.me/name», «https://t.me/name». null — не похоже на имя пользователя.
 */
export function normalizeTelegram(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?(t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
  if (!TELEGRAM_USERNAME.test(value) || value.includes('__')) return null;
  return value;
}

/**
 * Номер в международном формате E.164: «+», код страны, до 15 цифр.
 * Пробелы, скобки и дефисы допускаются при вводе и убираются; «00» в начале
 * заменяется на «+». Без кода страны — null: WhatsApp и Viber без него
 * не найдут человека, а угадывать страну за владельца нельзя.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s()-]/g, '');
  const value = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  return /^\+[1-9]\d{6,14}$/.test(value) ? value : null;
}

/** Почта для ссылки: одна строка, без пробелов и знаков, ломающих mailto */
function normalizeEmail(raw: string): string | null {
  const value = raw.trim();
  return /^[^\s@?&#/\\"<>]+@[^\s@?&#/\\"<>]+\.[^\s@?&#/\\"<>]+$/.test(value) ? value : null;
}

export const CONTACT_KINDS = ['telegram', 'whatsapp', 'viber', 'email', 'phone'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

/** Ключ профиля для каждого способа связи. Почта и телефон — общие с подвалом и документами. */
export const CONTACT_KEYS: Record<ContactKind, string> = {
  telegram: 'contact.telegram',
  whatsapp: 'contact.whatsapp',
  viber: 'contact.viber',
  email: 'owner.email',
  phone: 'owner.phone',
};

export interface ContactLink {
  kind: ContactKind;
  href: string;
  /** Что показать рядом с названием: @имя, номер или адрес */
  shown: string;
}

function linkFor(kind: ContactKind, raw: string): ContactLink | null {
  switch (kind) {
    case 'telegram': {
      const name = normalizeTelegram(raw);
      return name === null ? null : { kind, href: `https://t.me/${name}`, shown: `@${name}` };
    }
    case 'whatsapp': {
      const phone = normalizePhone(raw);
      // wa.me принимает номер без «+»
      return phone === null
        ? null
        : { kind, href: `https://wa.me/${phone.slice(1)}`, shown: phone };
    }
    case 'viber': {
      const phone = normalizePhone(raw);
      // У Viber нет веб-адреса для чата — открывается приложение; «+» кодируется
      return phone === null
        ? null
        : { kind, href: `viber://chat?number=%2B${phone.slice(1)}`, shown: phone };
    }
    case 'email': {
      const email = normalizeEmail(raw);
      return email === null ? null : { kind, href: `mailto:${email}`, shown: email };
    }
    case 'phone': {
      const phone = normalizePhone(raw);
      return phone === null ? null : { kind, href: `tel:${phone}`, shown: phone };
    }
  }
}

/**
 * Ссылки на заполненные способы связи в постоянном порядке: мессенджеры,
 * затем почта и телефон. Пустое или испорченное значение пропускается —
 * лучше на одну кнопку меньше, чем кнопка, ведущая в никуда.
 */
export function contactLinks(values: Readonly<Record<string, string>>): ContactLink[] {
  const links: ContactLink[] = [];
  for (const kind of CONTACT_KINDS) {
    const raw = values[CONTACT_KEYS[kind]] ?? '';
    if (raw.trim() === '') continue;
    const link = linkFor(kind, raw);
    if (link !== null) links.push(link);
  }
  return links;
}
