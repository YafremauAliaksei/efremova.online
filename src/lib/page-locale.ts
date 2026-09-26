import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n';

/** Параметры страницы под /[locale]/… */
export interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/**
 * Язык страницы из адреса. Список языков уже ограничен макетом
 * (dynamicParams = false), проверка здесь — чтобы тип стал Locale,
 * а не string, и чтобы страница не полагалась на чужую проверку.
 */
export async function pageLocale(params: LocaleParams['params']): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
