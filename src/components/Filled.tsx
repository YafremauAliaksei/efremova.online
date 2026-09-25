import { fillPlaceholders, type ProfileValues } from '@/lib/site-profile-fields';

/**
 * Текст с подставленными данными владельца (docs/03 п.11.3).
 *
 * Незаполненная метка и пометка для юриста выделяются, а не прячутся:
 * пока сайт — образец, любое «здесь ещё ничего нет» должно быть видно
 * и владельцу, и посетителю.
 */
export function Filled({ text, values }: { text: string; values: ProfileValues }) {
  return (
    <>
      {fillPlaceholders(text, values).map((part, index) => {
        if (part.kind === 'text') return part.text;
        const key = `${String(index)}-${part.kind}`;
        return part.kind === 'missing' ? (
          <mark key={key} className="rounded bg-amber-100 px-1 text-amber-900">
            ⟦не заполнено: {part.key}⟧
          </mark>
        ) : (
          <mark key={key} className="rounded bg-sky-100 px-1 text-sky-900">
            {part.text}
          </mark>
        );
      })}
    </>
  );
}
