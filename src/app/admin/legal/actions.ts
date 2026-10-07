'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { canonicalJson } from '@/lib/audit/chain';
import { audit } from '@/lib/audit/log';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { LEGAL_SLUGS, type LegalSlug } from '@/lib/legal';
import { type LegalTextError, legalTitle, nextVersion, parseLegalText } from '@/lib/legal-text';

/**
 * Действия раздела «Правовые документы» (задача 10).
 *
 * ⚠️ Как везде в админке: каждая функция — адрес, доступный из сети, и сама
 * проверяет сессию и форму.
 *
 * Опубликованная редакция не правится никогда: любое сохранение — новая
 * редакция, прежняя остаётся в истории. При споре важен текст, который
 * человек видел тогда, а не сегодняшний (docs/03 п.7).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isLegalSlug(value: unknown): value is LegalSlug {
  return typeof value === 'string' && (LEGAL_SLUGS as readonly string[]).includes(value);
}

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/denied');
}

/** Состояние формы: при ошибке введённый текст возвращается, а не теряется */
export interface LegalFormState {
  attempt: number;
  error: LegalTextError | { code: 'title' } | { code: 'same' } | null;
  title?: string;
  text?: string;
  approved?: boolean;
}

/** Новая редакция документа на одном языке */
export async function publishLegal(
  previous: LegalFormState,
  formData: FormData
): Promise<LegalFormState> {
  await requireAdmin();
  const slug = formData.get('slug');
  const locale = formData.get('locale');
  if (!isLegalSlug(slug) || !isLocale(locale)) redirect('/admin/legal?error=missing');

  const rawTitle = formData.get('title');
  const rawText = formData.get('text');
  const approved = formData.get('approved') === 'on';
  const kept = {
    attempt: previous.attempt + 1,
    title: typeof rawTitle === 'string' ? rawTitle : '',
    text: typeof rawText === 'string' ? rawText : '',
    approved,
  };

  const title = legalTitle.safeParse(rawTitle ?? '');
  if (!title.success || title.data === null) return { ...kept, error: { code: 'title' } };
  const parsed = parseLegalText(rawText);
  if (!parsed.ok) return { ...kept, error: parsed.error };

  const existing = await db.legalDocument.findMany({
    where: { slug, locale },
    select: { version: true, title: true, sections: true, isDraft: true, isCurrent: true },
  });
  const current = existing.find((doc) => doc.isCurrent);
  // Та же редакция ещё раз — не новая редакция: история не засоряется копиями
  if (
    current?.title === title.data &&
    current.isDraft === !approved &&
    // jsonb хранит ключи в своём порядке — сравнение без учёта порядка
    canonicalJson(current.sections) === canonicalJson(parsed.sections)
  ) {
    return { ...kept, error: { code: 'same' } };
  }

  const version = nextVersion(slug, new Date(), new Set(existing.map((doc) => doc.version)));
  await createRevision({
    slug,
    locale,
    version,
    title: title.data,
    sections: parsed.sections as unknown as Prisma.InputJsonValue,
    isDraft: !approved,
  });
  await audit('legal.publish', null, { document: slug, locale, version, approved });
  refresh();
  redirect(`/admin/legal?doc=${slug}&lang=${locale}&saved=published`);
}

/**
 * Вернуть прежнюю редакцию = опубликовать её текст новой редакцией.
 * Флаг «действующая» назад не переключается: история остаётся прямой,
 * и по ней видно, что и когда было на сайте.
 */
export async function restoreLegal(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('documentId');
  const old =
    typeof id === 'string' && UUID.test(id)
      ? await db.legalDocument.findFirst({ where: { id, isCurrent: false } })
      : null;
  if (old === null || !isLegalSlug(old.slug)) redirect('/admin/legal?error=missing');

  const taken = await db.legalDocument.findMany({
    where: { slug: old.slug, locale: old.locale },
    select: { version: true },
  });
  const version = nextVersion(old.slug, new Date(), new Set(taken.map((doc) => doc.version)));
  await createRevision({
    slug: old.slug,
    locale: old.locale,
    version,
    title: old.title,
    sections: old.sections ?? [],
    isDraft: old.isDraft,
  });
  await audit('legal.restore', null, {
    document: old.slug,
    locale: old.locale,
    version,
    from: old.version,
  });
  refresh();
  redirect(`/admin/legal?doc=${old.slug}&lang=${old.locale}&saved=restored`);
}

/** Прежняя действующая перестаёт ею быть, новая становится — одной транзакцией */
async function createRevision(data: {
  slug: string;
  locale: string;
  version: string;
  title: string;
  sections: Prisma.InputJsonValue;
  isDraft: boolean;
}): Promise<void> {
  await db.$transaction([
    db.legalDocument.updateMany({
      where: { slug: data.slug, locale: data.locale, isCurrent: true },
      data: { isCurrent: false },
    }),
    db.legalDocument.create({ data: { ...data, isCurrent: true, fromAdmin: true } }),
  ]);
}

function refresh(): void {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin/legal');
}
