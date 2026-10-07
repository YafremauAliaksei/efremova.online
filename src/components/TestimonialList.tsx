import { langIfDifferent, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import type { PublicTestimonial } from '@/lib/testimonials/public';

/**
 * Отзывы — один список для блока на главной и для страницы отзывов.
 * Отзыв не переводится: он показывается на языке автора с верным lang,
 * чтобы скринридер прочитал его с правильным произношением.
 */
export function TestimonialList({
  testimonials,
  locale,
}: {
  testimonials: PublicTestimonial[];
  locale: Locale;
}) {
  if (testimonials.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
        {messages(locale).testimonials.empty}
      </p>
    );
  }

  return (
    <ul className="mt-8 space-y-4">
      {testimonials.map((item) => (
        <li key={item.id} lang={langIfDifferent(item.locale, locale)}>
          <figure
            data-testimonial
            className="rounded-lg border border-[var(--color-line)] bg-white p-6"
          >
            <blockquote className="text-[var(--color-ink-soft)]">
              {item.body.split(/\n{2,}/).map((paragraph, index) => (
                // Порядок абзацев и есть их идентичность: ключ по номеру
                <p key={index} className="mt-3 whitespace-pre-line first:mt-0">
                  {paragraph}
                </p>
              ))}
            </blockquote>
            <figcaption className="mt-4 text-sm font-medium">— {item.authorAlias}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
