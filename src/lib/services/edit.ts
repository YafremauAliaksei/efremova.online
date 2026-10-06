import { z } from 'zod';
import { textField } from '../content-schema';
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS, type Locale } from '../i18n';
import { isPageSlug } from '../blocks/pages';

/**
 * Формы раздела «Услуги и цены» в админке и правила для цен.
 *
 * Как и у страниц: поле формы — данные от браузера. Неверное значение
 * отклоняется целиком, а админка говорит, какое поле не так.
 *
 * Деньги — целые числа в минорных единицах (CLAUDE.md, «Стиль»): «250,50» из
 * формы становится 25050 и только так попадает в базу. Дробное число
 * с плавающей точкой не появляется ни на одном шаге.
 *
 * Файл без 'server-only' и без базы: чистые функции, их проверяют тесты.
 */

export const SERVICE_TITLE_MAX = 120;
export const SERVICE_DESCRIPTION_MAX = 1000;
export const DURATION_MIN = 10;
export const DURATION_MAX = 600;
/** Миллион в основной валюте: опечатка с лишними нулями отклоняется, а не публикуется */
export const AMOUNT_MAX_MINOR = 100_000_000;

/**
 * Валюты, в которых можно назначить цену. У всех ровно две цифры после
 * запятой: на этом держится перевод «250,50» ↔ 25050. Валюта без копеек
 * (иена) или с тремя знаками (динар) требует другой арифметики — её здесь нет.
 */
export const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'RUB', 'UAH'] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

/** Цена для всех стран, у которых нет своей */
export const DEFAULT_REGION = 'DEFAULT';

/**
 * Регион — код страны из заголовка CF-IPCountry (две латинские буквы, как
 * в ISO 3166-1) или DEFAULT. Владелец может ввести «pl» — сохраняется «PL».
 */
export function normalizeRegion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase();
  if (value === DEFAULT_REGION) return value;
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

/**
 * Сумма из формы → минорные единицы. Принимает «250», «250,5», «250.50»,
 * «1 250,00»; отклоняет отрицательные, ноль, больше двух знаков после
 * запятой и всё, что не число. Разбор строкой, без parseFloat: 0.1 + 0.2
 * здесь не случается.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  // Пробел — разделитель тысяч; \s в JS включает и неразрывные пробелы
  const value = raw.trim().replace(/\s/g, '');
  const [wholePart = '', fractionPart = '', ...extra] = value.split(/[.,]/);
  if (extra.length > 0 || !/^\d{1,9}$/.test(wholePart) || !/^\d{0,2}$/.test(fractionPart)) {
    return null;
  }
  // «250,» — не сумма: запятая без копеек скорее опечатка, чем «ровно 250»
  if (fractionPart === '' && value !== wholePart) return null;
  const whole = Number(wholePart);
  const fraction = Number(fractionPart.padEnd(2, '0'));
  const minor = whole * 100 + fraction;
  return minor > 0 && minor <= AMOUNT_MAX_MINOR ? minor : null;
}

/**
 * Цена для посетителя: «250 zł», «60,50 €». Копейки показываются, если они
 * есть: итоговую цену нельзя округлять — 60,50 не превращается в «61 €».
 */
export function formatPrice(amountMinor: number, currency: string, locale: Locale): string {
  const whole = amountMinor % 100 === 0;
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amountMinor / 100);
}

export type ServiceFormResult<T> = { ok: true; value: T } | { ok: false; field: string };

const title = textField(SERVICE_TITLE_MAX, true);
const description = textField(SERVICE_DESCRIPTION_MAX, false);

/**
 * Новая услуга: служебное имя (латиницей, не меняется) и русское название.
 * Остальное — в настройках; создаётся скрытой, пока нет цены и перевода.
 */
export function parseNewServiceForm(
  formData: FormData
): ServiceFormResult<{ slug: string; title: string }> {
  const slug = formData.get('slug');
  if (typeof slug !== 'string' || !isPageSlug(slug.trim())) return { ok: false, field: 'slug' };
  const parsed = title.safeParse(formData.get('title') ?? '');
  if (!parsed.success || parsed.data === null) return { ok: false, field: 'title' };
  return { ok: true, value: { slug: slug.trim(), title: parsed.data } };
}

export interface ServiceSettings {
  serviceId: string;
  titleI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  durationMinutes: number;
  isActive: boolean;
}

/**
 * Настройки услуги: название и описание на каждом языке, длительность,
 * показ на сайте. Русское название обязательно; пустые переводы не хранятся,
 * и сайт показывает русское.
 */
export function parseServiceForm(formData: FormData): ServiceFormResult<ServiceSettings> {
  const serviceId = z.string().uuid().safeParse(formData.get('serviceId'));
  if (!serviceId.success) return { ok: false, field: 'serviceId' };

  const titleI18n: Record<string, string> = {};
  const descriptionI18n: Record<string, string> = {};
  for (const locale of LOCALES) {
    const t = title.safeParse(formData.get(`title_${locale}`) ?? '');
    if (!t.success) return { ok: false, field: `title_${locale}` };
    if (t.data !== null) titleI18n[locale] = t.data;

    const d = description.safeParse(formData.get(`description_${locale}`) ?? '');
    if (!d.success) return { ok: false, field: `description_${locale}` };
    if (d.data !== null) descriptionI18n[locale] = d.data;
  }
  if (titleI18n[DEFAULT_LOCALE] === undefined) {
    return { ok: false, field: `title_${DEFAULT_LOCALE}` };
  }

  const duration = z.coerce
    .number()
    .int()
    .min(DURATION_MIN)
    .max(DURATION_MAX)
    .safeParse(formData.get('durationMinutes'));
  if (!duration.success) return { ok: false, field: 'durationMinutes' };

  return {
    ok: true,
    value: {
      serviceId: serviceId.data,
      titleI18n,
      descriptionI18n,
      durationMinutes: duration.data,
      isActive: formData.get('isActive') === 'on',
    },
  };
}

export interface PriceInput {
  serviceId: string;
  region: string;
  currency: Currency;
  amountMinor: number;
}

/** Цена для региона: регион, валюта и сумма */
export function parsePriceForm(formData: FormData): ServiceFormResult<PriceInput> {
  const serviceId = z.string().uuid().safeParse(formData.get('serviceId'));
  if (!serviceId.success) return { ok: false, field: 'serviceId' };
  const region = normalizeRegion(formData.get('region'));
  if (region === null) return { ok: false, field: 'region' };
  const currency = formData.get('currency');
  if (!isCurrency(currency)) return { ok: false, field: 'currency' };
  const amountMinor = parseAmount(formData.get('amount'));
  if (amountMinor === null) return { ok: false, field: 'amount' };
  return { ok: true, value: { serviceId: serviceId.data, region, currency, amountMinor } };
}

export interface StoredPrice {
  id: string;
  region: string;
  currency: string;
  amountMinor: number;
  validFrom: Date;
  validTo: Date | null;
}

/** Действует ли цена в этот момент: началась и ещё не закончилась */
export function isPriceCurrent(price: Pick<StoredPrice, 'validFrom' | 'validTo'>, now: Date) {
  return price.validFrom <= now && (price.validTo === null || price.validTo > now);
}

/**
 * Что сделать с ценами при новой цене для региона.
 *
 * Цена не правится на месте: прежняя закрывается (validTo = сейчас), новая
 * начинается с этого момента. Так остаётся история — какую цену видел
 * посетитель в какой день; при споре важна она, а не сегодняшняя.
 * Та же сумма в той же валюте — ничего не меняется.
 */
export function planPriceChange(
  prices: readonly StoredPrice[],
  next: Pick<PriceInput, 'region' | 'currency' | 'amountMinor'>,
  now: Date
): { close: string[]; create: boolean } {
  const current = prices.filter(
    (price) => price.region === next.region && isPriceCurrent(price, now)
  );
  const [only, ...rest] = current;
  if (
    only !== undefined &&
    rest.length === 0 &&
    only.currency === next.currency &&
    only.amountMinor === next.amountMinor
  ) {
    return { close: [], create: false };
  }
  return { close: current.map((price) => price.id), create: true };
}

/**
 * Цена для посетителя из региона: своя страны, иначе общая; из нескольких
 * действующих — начавшаяся последней. Нет ни той, ни другой — null
 * («по запросу»).
 */
export function pickPrice<T extends Pick<StoredPrice, 'region' | 'validFrom' | 'validTo'>>(
  prices: readonly T[],
  region: string,
  now: Date
): T | null {
  const current = prices
    .filter((price) => isPriceCurrent(price, now))
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  return (
    current.find((price) => price.region === region) ??
    current.find((price) => price.region === DEFAULT_REGION) ??
    null
  );
}
