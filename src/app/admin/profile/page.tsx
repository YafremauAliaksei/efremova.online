import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { getSiteProfile } from '@/lib/site-profile';
import {
  PROFILE_FIELDS,
  SITE_STATUS_KEY,
  missingRequired,
  validateField,
} from '@/lib/site-profile-fields';

/**
 * Данные владельца и режим сайта (docs/03 п.11.3).
 *
 * Здесь заполняется всё, что подставляется в тексты вместо меток {{owner.*}}:
 * имя, адрес, NIP, профессиональный статус, обработчики данных. Пока хоть
 * одно обязательное поле пусто, сайт нельзя вывести из режима «в разработке» —
 * иначе посетитель увидит «⟦не заполнено⟧» на сайте, который выглядит рабочим.
 */

export const metadata: Metadata = {
  title: 'Данные владельца',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ saved?: string; invalid?: string; blocked?: string }>;
}

export default async function ProfilePage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect('/admin/denied');

  const { values, status } = await getSiteProfile();
  const params = await searchParams;
  const missing = missingRequired(values);
  // В адресе — только ключи; на страницу попадают подписи из списка полей
  const invalid = new Set((params.invalid ?? '').split(','));
  const invalidFields = PROFILE_FIELDS.filter((field) => invalid.has(field.key));

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          ← Тексты сайта
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Данные владельца</h1>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        Подставляются в подвал и правовые документы. Хранятся только в базе и не попадают в
        публичный репозиторий. Пустое поле видно на сайте как «⟦не заполнено⟧».
      </p>

      {params.saved !== undefined && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm"
        >
          Сохранено.
        </p>
      )}
      {invalidFields.length > 0 && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          Не сохранены — неверный формат: {invalidFields.map((field) => field.label).join('; ')}.
        </p>
      )}
      {params.blocked !== undefined && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          Рабочий режим недоступен, пока не заполнены обязательные поля.
        </p>
      )}

      <form action={saveProfile} className="mt-8 space-y-5">
        {PROFILE_FIELDS.map((field) => (
          <label key={field.key} className="block text-sm font-medium">
            {field.label}
            {field.required && <span className="text-red-800"> *</span>}
            <input
              name={field.key}
              defaultValue={values[field.key] ?? ''}
              maxLength={300}
              aria-invalid={invalid.has(field.key) || undefined}
              className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-[var(--color-ink-soft)]">
              <code>{`{{${field.key}}}`}</code>
              {field.hint !== undefined && ` · ${field.hint}`}
            </span>
          </label>
        ))}
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white"
        >
          Сохранить
        </button>
      </form>

      <section className="mt-12 rounded-lg border border-[var(--color-line)] p-5">
        <h2 className="text-lg font-semibold">Режим сайта</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          Сейчас: <strong>{status === 'development' ? 'в разработке' : 'рабочий'}</strong>. В режиме
          разработки на каждой странице плашка «сайт в разработке, услуги не оказываются», а
          правовые документы помечены как образцы.
        </p>
        {status === 'development' && missing.length > 0 && (
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Не заполнено обязательных полей: {missing.length}.
          </p>
        )}
        <form action={setStatus} className="mt-4">
          <input
            type="hidden"
            name="status"
            value={status === 'development' ? 'live' : 'development'}
          />
          <button
            type="submit"
            disabled={status === 'development' && missing.length > 0}
            className="rounded-lg border border-[var(--color-line)] px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {status === 'development' ? 'Перевести в рабочий режим' : 'Вернуть в режим разработки'}
          </button>
        </form>
      </section>
    </main>
  );
}

async function saveProfile(formData: FormData) {
  'use server';
  if (!(await isAdmin())) redirect('/admin/denied');

  const invalid: string[] = [];
  for (const field of PROFILE_FIELDS) {
    const raw = formData.get(field.key);
    if (typeof raw !== 'string') continue;
    const result = validateField(field.key, raw);
    if (!result.ok) {
      invalid.push(field.key);
    } else if (result.value === '') {
      await db.siteSetting.deleteMany({ where: { key: field.key } });
    } else {
      await db.siteSetting.upsert({
        where: { key: field.key },
        create: { key: field.key, value: result.value },
        update: { value: result.value },
      });
    }
  }

  // Данные владельца есть на каждой странице — сбрасывается кэш всего сайта
  revalidatePath('/[locale]', 'layout');
  redirect(
    invalid.length > 0 ? `/admin/profile?invalid=${invalid.join(',')}` : '/admin/profile?saved=1'
  );
}

async function setStatus(formData: FormData) {
  'use server';
  if (!(await isAdmin())) redirect('/admin/denied');

  const next = formData.get('status') === 'live' ? 'live' : 'development';
  if (next === 'live') {
    // Проверка на сервере, а не только disabled у кнопки: форму можно отправить и без неё
    const { values } = await getSiteProfile();
    if (missingRequired(values).length > 0) redirect('/admin/profile?blocked=1');
  }

  await db.siteSetting.upsert({
    where: { key: SITE_STATUS_KEY },
    create: { key: SITE_STATUS_KEY, value: next },
    update: { value: next },
  });
  revalidatePath('/[locale]', 'layout');
  redirect('/admin/profile?saved=1');
}
