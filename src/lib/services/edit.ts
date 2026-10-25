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
 * Валюта цены — любой код ISO 4217, который знает Intl, с двумя знаками после
 * запятой: на этом держится перевод «250,50» ↔ 25050. Валюта без копеек
 * (иена) или с тремя знаками (динар) требует другой арифметики — её здесь нет.
 * Список не закрытый: владелец добавляет любую валюту (PROJECT_LOG, задача 9a).
 */
export function isCurrencyCode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) return false;
  if (!Intl.supportedValuesOf('currency').includes(value)) return false;
  const format = new Intl.NumberFormat('en', { style: 'currency', currency: value });
  return format.resolvedOptions().maximumFractionDigits === 2;
}

/**
 * Порядок валют в переключателе: как в админке (preferred — основная, затем
 * включённые по порядку), валюты вне списка — после, по алфавиту.
 */
export function orderCurrencies(
  currencies: Iterable<string>,
  preferred: readonly string[]
): string[] {
  const rank = (code: string) => {
    const index = preferred.indexOf(code);
    return index === -1 ? preferred.length : index;
  };
  return [...new Set(currencies)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Валюта, выбранная посетителем в адресе (?currency=EUR). Значение приходит
 * снаружи: принимается только валюта, в которой у услуг есть цена, всё
 * остальное — основная валюта сайта. В разметку и ключ кэша попадает код
 * из списка, а не то, что прислали.
 */
export function visitorCurrency(
  raw: unknown,
  available: readonly string[],
  fallback: string
): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return available.includes(code) ? code : fallback;
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

/** Цена для Schema.org (Offer.price): точка и два знака — 25050 → «250.50», без округления */
export function schemaPrice(amountMinor: number): string {
  return `${String(Math.trunc(amountMinor / 100))}.${String(amountMinor % 100).padStart(2, '0')}`;
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
  const serviceId = z.uuid().safeParse(formData.get('serviceId'));
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
  currency: string;
  amountMinor: number;
}

/** Сколько валют одна форма может поменять за раз: больше в списке не бывает */
export const PRICES_PER_FORM_MAX = 200;

/**
 * Форма редактора цен: поле amount_EUR — новая цена в евро. Пустое поле —
 * цена не меняется. Поле с неверной суммой отклоняет всю форму: половина
 * новых цен без другой половины — не то, что владелец собирался сохранить.
 */
export function parsePricesForm(
  formData: FormData
): ServiceFormResult<Pick<PriceInput, 'currency' | 'amountMinor'>[]> {
  const result: Pick<PriceInput, 'currency' | 'amountMinor'>[] = [];
  for (const [name, raw] of formData.entries()) {
    const match = /^amount_([A-Z]{3})$/.exec(name);
    if (match === null || (typeof raw === 'string' && raw.trim() === '')) continue;
    const currency = match[1] ?? '';
    if (!isCurrencyCode(currency)) return { ok: false, field: 'currency' };
    const amountMinor = parseAmount(raw);
    if (amountMinor === null) return { ok: false, field: `amount_${currency}` };
    if (result.some((price) => price.currency === currency)) continue;
    result.push({ currency, amountMinor });
    if (result.length > PRICES_PER_FORM_MAX) return { ok: false, field: 'currency' };
  }
  return { ok: true, value: result };
}

export interface StoredPrice {
  id: string;
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
 * Что сделать с ценами при новой цене в валюте.
 *
 * Цена не правится на месте: прежняя закрывается (validTo = сейчас), новая
 * начинается с этого момента. Так остаётся история — какую цену видел
 * посетитель в какой день; при споре важна она, а не сегодняшняя. Правку на
 * месте к тому же запрещает база. Та же сумма — ничего не меняется.
 */
export function planPriceChange(
  prices: readonly StoredPrice[],
  next: Pick<PriceInput, 'currency' | 'amountMinor'>,
  now: Date
): { close: string[]; create: boolean } {
  const current = prices.filter(
    (price) => price.currency === next.currency && isPriceCurrent(price, now)
  );
  const [only, ...rest] = current;
  if (only !== undefined && rest.length === 0 && only.amountMinor === next.amountMinor) {
    return { close: [], create: false };
  }
  return { close: current.map((price) => price.id), create: true };
}

/**
 * Действующая цена в каждой валюте; из нескольких действующих в одной
 * валюте — начавшаяся последней.
 */
export function currentPrices<T extends Pick<StoredPrice, 'currency' | 'validFrom' | 'validTo'>>(
  prices: readonly T[],
  now: Date
): Map<string, T> {
  const result = new Map<string, T>();
  for (const price of prices) {
    if (!isPriceCurrent(price, now)) continue;
    const known = result.get(price.currency);
    if (known === undefined || known.validFrom < price.validFrom) {
      result.set(price.currency, price);
    }
  }
  return result;
}

export interface PricePeriod {
  currency: string;
  amountMinor: number;
  validFrom: Date;
  /** null — действует до сих пор */
  validTo: Date | null;
}

/**
 * Архив цен услуги: по валютам, от новых к старым. Цена, которая ещё не
 * началась, в архив не попадает — её посетитель ещё не видел.
 */
export function priceHistory(
  prices: readonly PricePeriod[],
  now: Date,
  preferred: readonly string[]
): { currency: string; periods: PricePeriod[] }[] {
  const byCurrency = new Map<string, PricePeriod[]>();
  for (const price of prices) {
    if (price.validFrom > now) continue;
    const list = byCurrency.get(price.currency) ?? [];
    list.push(price);
    byCurrency.set(price.currency, list);
  }
  return orderCurrencies(byCurrency.keys(), preferred).map((currency) => ({
    currency,
    periods: (byCurrency.get(currency) ?? []).sort(
      (a, b) => b.validFrom.getTime() - a.validFrom.getTime()
    ),
  }));
}
