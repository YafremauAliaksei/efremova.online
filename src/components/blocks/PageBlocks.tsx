import Link from 'next/link';
import { ServiceList } from '@/components/ServiceList';
import { Picture } from '@/components/blocks/Picture';
import { getServices } from '@/lib/content';
import { pagePath } from '@/lib/blocks/pages';
import type { BlockStyle, RenderableBlock } from '@/lib/blocks/registry';
import { langIfDifferent, localizedPath, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { getPageImages } from '@/lib/media/store';

/**
 * Отрисовка блоков страницы.
 *
 * Оформление — ровно эти классы: значение из базы выбирает строку таблицы,
 * а не попадает в стили (docs/13, п.4.2). Текст выводится как текст:
 * абзацы — по пустой строке, перевод строки внутри абзаца сохраняется.
 * dangerouslySetInnerHTML здесь нет и не будет.
 */

const WIDTH: Record<BlockStyle['width'], string> = {
  narrow: 'max-w-2xl',
  wide: 'max-w-3xl',
  full: 'max-w-5xl',
};
const ALIGN: Record<BlockStyle['align'], string> = { left: '', center: 'text-center' };
const BACKGROUND: Record<BlockStyle['background'], string> = {
  base: '',
  tinted: 'bg-[var(--color-paper-alt)]',
};

const BUTTON_CLASS =
  'inline-block rounded-lg bg-[var(--color-accent)] px-8 py-4 font-medium text-white transition-colors hover:bg-[#3d594d]';

function Paragraphs({ text, className }: { text: string; className: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, index) => (
        // Порядок абзацев в тексте и есть их идентичность: ключ по номеру
        <p key={index} className={`whitespace-pre-line ${className}`}>
          {paragraph}
        </p>
      ))}
    </>
  );
}

/** Первый блок страницы несёт h1 — на странице ровно один главный заголовок */
function Heading({ first, large, text }: { first: boolean; large: boolean; text: string }) {
  const Tag = first ? 'h1' : 'h2';
  const size = large ? 'text-4xl text-balance sm:text-5xl' : 'text-3xl';
  return <Tag className={`${size} font-semibold`}>{text}</Tag>;
}

function BlockSection({
  block,
  locale,
  children,
}: {
  block: RenderableBlock;
  locale: Locale;
  children: React.ReactNode;
}) {
  const { width, align, background } = block.style;
  const padding = block.type === 'hero' ? 'py-24' : 'py-20';
  return (
    <section lang={langIfDifferent(block.textLocale, locale)} className={BACKGROUND[background]}>
      <div className={`mx-auto ${WIDTH[width]} px-6 ${padding} ${ALIGN[align]}`}>{children}</div>
    </section>
  );
}

export async function PageBlocks({
  blocks,
  locale,
  region,
}: {
  blocks: RenderableBlock[];
  locale: Locale;
  region: string;
}) {
  // Услуги спрашиваются у базы, только если на странице есть их блок
  const services = blocks.some((block) => block.type === 'services')
    ? await getServices(region, locale)
    : [];
  // Фото блоков — одним запросом на страницу, без байтов
  const images = await getPageImages(
    blocks.flatMap((block) =>
      block.type === 'image' && typeof block.data.image === 'string' ? [block.data.image] : []
    )
  );

  return (
    <>
      {blocks.map((block, index) => {
        const first = index === 0;
        const { title, body, button } = block.texts;
        let inner: React.ReactNode = null;

        switch (block.type) {
          case 'hero':
            inner = (
              <>
                {title !== null && title !== undefined && (
                  <Heading first={first} large text={title} />
                )}
                {body !== null && body !== undefined && (
                  <Paragraphs
                    text={body}
                    className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-ink-soft)]"
                  />
                )}
              </>
            );
            break;
          case 'text':
            inner = (
              <>
                {title !== null && title !== undefined && (
                  <Heading first={first} large={false} text={title} />
                )}
                {body !== null && body !== undefined && (
                  <Paragraphs
                    text={body}
                    className="mt-6 leading-relaxed text-[var(--color-ink-soft)]"
                  />
                )}
              </>
            );
            break;
          case 'cta': {
            const link = typeof block.data.link === 'string' ? block.data.link : null;
            inner = (
              <>
                {title !== null && title !== undefined && (
                  <Heading first={first} large={false} text={title} />
                )}
                {body !== null && body !== undefined && (
                  <Paragraphs text={body} className="mt-4 text-[var(--color-ink-soft)]" />
                )}
                {link !== null && button !== null && button !== undefined && (
                  <div className={title === null && body === null ? '' : 'mt-8'}>
                    <Link href={localizedPath(locale, pagePath(link))} className={BUTTON_CLASS}>
                      {button}
                    </Link>
                  </div>
                )}
              </>
            );
            break;
          }
          case 'image': {
            const image =
              typeof block.data.image === 'string' ? images.get(block.data.image) : undefined;
            const text = (
              <div>
                {title !== null && title !== undefined && (
                  <Heading first={first} large={false} text={title} />
                )}
                {body !== null && body !== undefined && (
                  <Paragraphs
                    text={body}
                    className="mt-6 leading-relaxed text-[var(--color-ink-soft)]"
                  />
                )}
              </div>
            );
            inner =
              image === undefined ? (
                text
              ) : (
                <div className="grid items-center gap-10 md:grid-cols-2">
                  {text}
                  {/* На телефоне фото над текстом; на широком экране — сбоку */}
                  <div
                    className={
                      block.data.side === 'left' ? 'order-first' : 'order-first md:order-last'
                    }
                  >
                    <Picture
                      image={image}
                      alt={block.texts.alt ?? ''}
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                </div>
              );
            break;
          }
          case 'services':
            inner = (
              <>
                <Heading
                  first={first}
                  large={false}
                  text={title ?? messages(locale).nav.services}
                />
                <ServiceList
                  services={services}
                  locale={locale}
                  headingLevel={first ? 'h2' : 'h3'}
                />
              </>
            );
            break;
        }

        return (
          <BlockSection key={block.id} block={block} locale={locale}>
            {inner}
          </BlockSection>
        );
      })}
    </>
  );
}
