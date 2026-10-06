'use client';

import { useFormStatus } from 'react-dom';

/**
 * Кнопка загрузки, которая видна как занятая. Пересборка большого фото
 * в AVIF и WebP занимает до полуминуты; без отклика владелец нажал бы
 * второй раз и решил, что админка зависла.
 */
export function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Загружаю…' : 'Загрузить'}
      </button>
      {pending && (
        <p role="status" className="text-xs text-[var(--color-ink-soft)]">
          Картинка пересобирается в нескольких размерах — большое фото может занять до минуты.
        </p>
      )}
    </>
  );
}
