'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth/admin';
import { textField } from '@/lib/content-schema';
import { db } from '@/lib/db';
import { MAX_UPLOAD_BYTES, MEDIA_LABEL_MAX } from '@/lib/media/image';
import { saveUpload } from '@/lib/media/store';

/**
 * Действия раздела «Картинки». Как и везде в админке: каждая функция —
 * адрес, доступный из сети, поэтому сама проверяет сессию и форму.
 * Ничего не удаляется: картинка уходит в архив и возвращается оттуда.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const label = textField(MEDIA_LABEL_MAX, true);

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/denied');
}

function back(query: string): never {
  redirect(`/admin/media?${query}`);
}

function refresh(): void {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin/media');
}

function assetIdFrom(formData: FormData): string {
  const id = formData.get('assetId');
  if (typeof id !== 'string' || !UUID.test(id)) back('error=missing');
  return id;
}

export async function uploadImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) back('error=noFile');
  // Размер — до чтения содержимого
  if (file.size > MAX_UPLOAD_BYTES) back('error=tooLarge');

  const parsedLabel = label.safeParse(formData.get('label') ?? '');
  if (!parsedLabel.success) back('error=label');

  const result = await saveUpload(new Uint8Array(await file.arrayBuffer()), parsedLabel.data ?? '');
  if (!result.ok) back(`error=${result.reason}`);
  refresh();
  back(`saved=${result.duplicate ? 'duplicate' : 'uploaded'}&asset=${result.assetId}`);
}

export async function saveLabel(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = assetIdFrom(formData);
  const parsed = label.safeParse(formData.get('label') ?? '');
  if (!parsed.success) back('error=label');
  await db.mediaAsset.updateMany({ where: { id }, data: { label: parsed.data ?? '' } });
  back('saved=label');
}

/** «Удалить» = в архив: с сайта картинка пропадает, из базы — нет */
export async function archiveImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = assetIdFrom(formData);
  await db.mediaAsset.updateMany({
    where: { id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  refresh();
  back('saved=archived');
}

export async function restoreImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = assetIdFrom(formData);
  await db.mediaAsset.updateMany({ where: { id }, data: { archivedAt: null } });
  refresh();
  back('saved=restored');
}
