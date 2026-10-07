'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit } from '@/lib/audit/log';
import { isAdmin } from '@/lib/auth/admin';
import { moveId, numbered } from '@/lib/blocks/order';
import { db } from '@/lib/db';
import { parseTestimonialForm } from '@/lib/testimonials/edit';

/**
 * Действия раздела «Отзывы» (задача 8).
 *
 * ⚠️ Как везде в админке: каждая функция — адрес, доступный из сети, и сама
 * проверяет сессию и форму.
 *
 * Отзыв — данные о здоровье (docs/13 п.8). Поэтому здесь, в отличие от
 * остальной админки, есть настоящее удаление: при отзыве согласия строка
 * стирается целиком, без архива и истории правок. В журнал действий
 * попадает только номер отзыва — ни псевдонима, ни текста.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/denied');
}

function back(open: string | null, query: string): never {
  redirect(`/admin/testimonials?${open === null ? '' : `open=${open}&`}${query}`);
}

/** Отзывы видны в блоке на любой странице и на /testimonials */
function refresh(): void {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin/testimonials');
}

async function existing(formData: FormData) {
  const id = formData.get('testimonialId');
  const row =
    typeof id === 'string' && UUID.test(id)
      ? await db.testimonial.findUnique({
          where: { id },
          select: { id: true, isPublished: true, consentAt: true },
        })
      : null;
  if (row === null) back(null, 'error=missing');
  return row;
}

async function idsInOrder(): Promise<string[]> {
  const rows = await db.testimonial.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** Новый отзыв — скрытый и в конце: показать — отдельным шагом */
export async function createTestimonial(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = parseTestimonialForm(formData, new Date());
  if (!parsed.ok) back(null, `new=1&error=${parsed.field}`);

  const count = await db.testimonial.count();
  const created = await db.testimonial.create({
    data: { ...parsed.value, isPublished: false, sortOrder: count * 10 },
    select: { id: true },
  });
  await audit('testimonial.create', created.id);
  refresh();
  back(created.id, 'saved=created');
}

export async function saveTestimonial(formData: FormData): Promise<void> {
  await requireAdmin();
  const row = await existing(formData);
  const parsed = parseTestimonialForm(formData, new Date());
  if (!parsed.ok) back(row.id, `error=${parsed.field}`);

  // Стёрли дату согласия у показанного отзыва — он скрывается, а не остаётся
  // на сайте без основания (ограничение в базе всё равно не дало бы)
  const hide = row.isPublished && parsed.value.consentAt === null;
  await db.testimonial.update({
    where: { id: row.id },
    data: { ...parsed.value, ...(hide ? { isPublished: false } : {}) },
  });
  await audit('testimonial.save', row.id, { hidden: hide });
  refresh();
  back(row.id, hide ? 'saved=hiddenNoConsent' : 'saved=saved');
}

export async function toggleTestimonial(formData: FormData): Promise<void> {
  await requireAdmin();
  const row = await existing(formData);
  if (!row.isPublished && row.consentAt === null) back(row.id, 'error=noConsent');
  await db.testimonial.update({
    where: { id: row.id },
    data: { isPublished: !row.isPublished },
  });
  await audit(row.isPublished ? 'testimonial.hide' : 'testimonial.show', row.id);
  refresh();
  back(row.id, `saved=${row.isPublished ? 'hidden' : 'shown'}`);
}

export async function moveTestimonial(formData: FormData): Promise<void> {
  await requireAdmin();
  const row = await existing(formData);
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';
  await db.$transaction(
    numbered(moveId(await idsInOrder(), row.id, direction)).map(({ id, sortOrder }) =>
      db.testimonial.update({ where: { id }, data: { sortOrder } })
    )
  );
  await audit('testimonial.move', row.id, { direction });
  refresh();
  back(row.id, 'saved=moved');
}

/**
 * Согласие отозвано — отзыв удаляется сразу и целиком. Подтверждение —
 * отдельной галочкой: кнопку рядом с «Сохранить» легко нажать случайно,
 * а вернуть удалённое нечем.
 */
export async function withdrawTestimonial(formData: FormData): Promise<void> {
  await requireAdmin();
  const row = await existing(formData);
  if (formData.get('confirm') !== 'on') back(row.id, 'error=confirm');
  await db.testimonial.delete({ where: { id: row.id } });
  await audit('testimonial.withdraw', row.id);
  refresh();
  back(null, 'saved=withdrawn');
}
