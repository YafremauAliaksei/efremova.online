import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { archiveImage, restoreImage, saveLabel, uploadImage } from '@/app/admin/media/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { UploadButton } from '@/components/admin/UploadButton';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { MAX_INPUT_PIXELS, MAX_UPLOAD_BYTES, MEDIA_LABEL_MAX } from '@/lib/media/image';
import { mediaUrl } from '@/lib/media/store';

/**
 * Картинки (задача 7): загрузка, подпись, архив.
 *
 * Загруженный файл пересобирается (src/lib/media/image.ts): на сайт попадают
 * только AVIF и WebP без EXIF — ни координат места съёмки, ни модели телефона.
 * Здесь же видно, сколько места картинки занимают в базе: при 50 МБ решение
 * «картинки в базе» пересматривается (docs/13, п.7.3).
 */

export const metadata: Metadata = {
  title: 'Картинки',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const MB = 1024 * 1024;

const SAVED = {
  uploaded: 'Картинка загружена: пересобрана в AVIF и WebP, данные о съёмке стёрты.',
  duplicate: 'Эта картинка уже была загружена — используется прежняя.',
  label: 'Подпись сохранена.',
  archived: 'Картинка убрана в архив и пропала с сайта. Вернуть можно ниже.',
  restored: 'Картинка возвращена из архива.',
} as const;

const ERRORS = {
  missing: 'Картинка не найдена — обновите страницу.',
  noFile: 'Выберите файл.',
  tooLarge: `Файл больше ${String(MAX_UPLOAD_BYTES / MB)} МБ. Уменьшите его или сохраните с меньшим качеством.`,
  format: 'Принимаются только JPEG, PNG, WebP и AVIF без анимации. SVG не принимается.',
  pixels: `Слишком много пикселей: больше ${String(MAX_INPUT_PIXELS / 1_000_000)} мегапикселей.`,
  broken: 'Файл повреждён или не читается как картинка.',
  label: `Подпись — одна строка до ${String(MEDIA_LABEL_MAX)} знаков.`,
} as const;

function known<T extends Record<string, string>>(table: T, code: string | undefined) {
  return code !== undefined && Object.hasOwn(table, code) ? table[code as keyof T] : null;
}

const INPUT = 'mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal';
const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-[var(--color-paper-alt)]';

interface PageProps {
  searchParams: Promise<{ saved?: string; error?: string }>;
}

export default async function MediaAdminPage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect('/admin/denied');
  const params = await searchParams;

  const assets = await db.mediaAsset.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      width: true,
      height: true,
      archivedAt: true,
      // Превью — самый маленький WebP; байты не читаются, только имя
      variants: {
        where: { format: 'webp' },
        orderBy: { width: 'asc' },
        take: 1,
        select: { hash: true, format: true },
      },
    },
  });
  // Сколько весят все варианты — граница пересмотра хранения в базе
  const [{ total }] = await db.$queryRaw<[{ total: bigint | null }]>`
    SELECT SUM(octet_length(bytes))::bigint AS total FROM media_variants`;
  const totalMb = Number(total ?? 0n) / MB;

  const active = assets.filter((asset) => asset.archivedAt === null);
  const archived = assets.filter((asset) => asset.archivedAt !== null);
  const savedText = known(SAVED, params.saved);
  const errorText = known(ERRORS, params.error);

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          ← Страницы и тексты
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Картинки</h1>
      <AdminNav current="/admin/media" />
      <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
        Файл пересобирается в AVIF и WebP нескольких размеров; данные о съёмке (место, телефон,
        дата) стираются. Занято в базе: {totalMb.toFixed(1)} МБ
        {totalMb > 50 && ' — больше 50 МБ, пора переносить картинки на диск (docs/13, п.7.3)'}.
      </p>

      {savedText !== null && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm"
        >
          {savedText}
        </p>
      )}
      {params.error !== undefined && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {errorText ?? 'Не сохранено — попробуйте ещё раз.'}
        </p>
      )}

      <form
        action={uploadImage}
        className="mt-8 space-y-4 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm"
      >
        <label className="block font-medium">
          Файл: JPEG, PNG, WebP или AVIF, до {MAX_UPLOAD_BYTES / MB} МБ
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            className="mt-1 block w-full font-normal"
          />
        </label>
        <label className="block font-medium">
          Подпись в админке (необязательно)
          <input name="label" maxLength={MEDIA_LABEL_MAX} className={INPUT} />
        </label>
        <UploadButton />
      </form>

      {active.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--color-ink-soft)]">Картинок пока нет.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {active.map((asset) => {
            const preview = asset.variants[0];
            return (
              <li
                key={asset.id}
                className="rounded-lg border border-[var(--color-line)] bg-white p-3 text-sm"
              >
                {preview !== undefined && (
                  // Своя картинка со своего домена; next/image здесь не нужен
                  // eslint-disable-next-line @next/next/no-img-element -- превью в админке, варианты уже пересобраны
                  <img
                    src={mediaUrl(preview)}
                    alt={asset.label}
                    width={asset.width}
                    height={asset.height}
                    className="h-40 w-full rounded object-cover"
                  />
                )}
                <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                  {asset.width} × {asset.height}
                </p>
                <form action={saveLabel} className="mt-2 flex gap-2">
                  <input type="hidden" name="assetId" value={asset.id} />
                  <input
                    name="label"
                    defaultValue={asset.label}
                    maxLength={MEDIA_LABEL_MAX}
                    aria-label="Подпись"
                    placeholder="Подпись"
                    className="w-full rounded border border-[var(--color-line)] px-2 py-1"
                  />
                  <button type="submit" className={SMALL_BUTTON}>
                    Сохранить
                  </button>
                </form>
                <form action={archiveImage} className="mt-2">
                  <input type="hidden" name="assetId" value={asset.id} />
                  <button type="submit" className={SMALL_BUTTON}>
                    В архив
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="mt-10 text-sm">
          <summary className="cursor-pointer font-medium">Архив: {archived.length}</summary>
          <ul className="mt-3 space-y-2">
            {archived.map((asset) => (
              <li key={asset.id} className="flex items-center justify-between gap-3">
                <span>
                  {asset.label === '' ? 'Без подписи' : asset.label} · {asset.width} ×{' '}
                  {asset.height}
                </span>
                <form action={restoreImage}>
                  <input type="hidden" name="assetId" value={asset.id} />
                  <button type="submit" className={SMALL_BUTTON}>
                    Вернуть
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
