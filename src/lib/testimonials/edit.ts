import { z } from 'zod';
import { textField } from '@/lib/content-schema';
import { isLocale, type Locale } from '@/lib/i18n';

/**
 * Проверка формы отзыва в админке (задача 8).
 *
 * Файл без 'server-only': чистые функции, их проверяют тесты.
 */

export const ALIAS_MAX = 80;
export const TESTIMONIAL_MAX = 2_000;

/** Раньше этой даты согласий быть не может: сайта ещё не было */
const EARLIEST_CONSENT = Date.UTC(2020, 0, 1);

const alias = textField(ALIAS_MAX, true);
const body = textField(TESTIMONIAL_MAX, false);

export interface TestimonialInput {
  authorAlias: string;
  body: string;
  locale: Locale;
  consentAt: Date | null;
}

export type TestimonialField = 'alias' | 'body' | 'locale' | 'consent';

export type ParseResult =
  { ok: true; value: TestimonialInput } | { ok: false; field: TestimonialField };

/**
 * Дата согласия из поля type="date": день, без времени, в UTC. Будущая
 * дата — ошибка: согласие, которого ещё нет, не основание для публикации.
 */
export function parseConsentDate(raw: unknown, now: Date): Date | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .safeParse(raw);
  if (!parsed.success) return undefined;
  const date = new Date(`${parsed.data}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== parsed.data) {
    return undefined;
  }
  if (date.getTime() < EARLIEST_CONSENT || date.getTime() > now.getTime()) return undefined;
  return date;
}

export function parseTestimonialForm(formData: FormData, now: Date): ParseResult {
  const parsedAlias = alias.safeParse(formData.get('alias') ?? '');
  if (!parsedAlias.success || parsedAlias.data === null) return { ok: false, field: 'alias' };
  const parsedBody = body.safeParse(formData.get('body') ?? '');
  if (!parsedBody.success || parsedBody.data === null) return { ok: false, field: 'body' };
  const locale = formData.get('locale');
  if (!isLocale(locale)) return { ok: false, field: 'locale' };
  const consentAt = parseConsentDate(formData.get('consentAt'), now);
  if (consentAt === undefined) return { ok: false, field: 'consent' };
  return {
    ok: true,
    value: { authorAlias: parsedAlias.data, body: parsedBody.data, locale, consentAt },
  };
}
