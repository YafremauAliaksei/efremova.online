'use client';

/**
 * Ссылка «Настройки приватности» в подвале.
 *
 * ⚖️ GDPR ст. 7 ч. 3: отозвать согласие должно быть так же просто, как его дать.
 * Поэтому ссылка есть на каждой странице и открывает то же окно выбора,
 * а не ведёт в отдельный длинный документ.
 */
export function PrivacySettingsLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new Event('privacy-settings:open'));
      }}
      className="underline underline-offset-4"
    >
      {label}
    </button>
  );
}
