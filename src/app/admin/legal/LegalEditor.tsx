'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { type LegalFormState, publishLegal } from '@/app/admin/legal/actions';

/**
 * Форма новой редакции. Клиентская ради одного: при ошибке текст документа
 * возвращается в поле. Обычная форма с переходом на адрес потеряла бы
 * десятки абзацев из-за одной неверной метки.
 */

const ERRORS: Record<string, string> = {
  title: 'Заголовок — одна строка до 300 знаков.',
  same: 'Текст и отметка юриста не изменились — новая редакция не нужна.',
  empty: 'Текст пустой.',
  tooLong: 'Текст длиннее 100 000 знаков.',
  chars:
    'В тексте есть служебные символы (например, смена направления письма). Вставьте текст заново как обычный.',
  tooManySections: 'Больше 80 разделов.',
  beforeHeading: 'Текст до первого заголовка: документ начинается со строки «## Заголовок».',
  paragraphAfterList:
    'Абзац после списка: на сайте абзацы раздела идут до списка. Перенесите абзац выше или начните новый раздел.',
  emptySection: 'Раздел без текста.',
  duplicateAnchor: 'Этот якорь {#…} уже есть в другом разделе.',
  placeholder: 'Неизвестная метка — такого поля нет в «Данных владельца».',
};

function message(error: NonNullable<LegalFormState['error']>): string {
  const base = ERRORS[error.code] ?? 'Не удалось сохранить.';
  const line = 'line' in error ? ` Строка ${String(error.line)}.` : '';
  const key = 'key' in error ? ` Метка: {{${error.key}}}.` : '';
  return base + line + key;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-60"
    >
      {pending ? 'Публикую…' : 'Опубликовать новую редакцию'}
    </button>
  );
}

export function LegalEditor({
  slug,
  locale,
  title,
  text,
  approved,
}: {
  slug: string;
  locale: string;
  title: string;
  text: string;
  approved: boolean;
}) {
  const [state, action] = useActionState(publishLegal, { attempt: 0, error: null });
  // После отправки React очищает форму; ключ попытки заново рисует поля
  // с тем, что владелец ввёл
  const shown = state.attempt === 0 ? { title, text, approved } : state;

  return (
    <form action={action} key={state.attempt} className="mt-4 space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />
      {state.error !== null && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {message(state.error)}
        </p>
      )}
      <label className="block text-sm font-medium">
        Заголовок
        <input
          name="title"
          defaultValue={shown.title}
          className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal"
        />
      </label>
      <label className="block text-sm font-medium">
        Текст
        <textarea
          name="text"
          defaultValue={shown.text}
          rows={30}
          spellCheck
          className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-mono text-sm font-normal"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approved" defaultChecked={shown.approved} />
        Текст проверен юристом — на сайте без пометки «образец»
      </label>
      <Submit />
    </form>
  );
}
