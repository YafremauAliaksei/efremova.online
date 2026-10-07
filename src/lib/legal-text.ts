import { textField, TITLE_MAX_LENGTH } from '@/lib/content-schema';
import { PROFILE_FIELDS } from '@/lib/site-profile-fields';
import type { LegalSection } from '../../prisma/legal-content';

/**
 * Правовой документ как обычный текст — для правки в админке (задача 10).
 *
 * В базе документ — структура (разделы, абзацы, пункты), а не разметка:
 * так его невозможно превратить в XSS. Владельцу же удобнее одно поле
 * текста. Формат — минимальный и свой, а не Markdown: четыре правила,
 * которые разбираются построчно и однозначно.
 *
 *   ## Заголовок раздела {#anchor}     — новый раздел, якорь необязателен
 *   Абзац. Соседние строки — один абзац
 *                                      — пустая строка разделяет абзацы
 *   - пункт списка
 *
 * Абзацы раздела страница показывает до списка, поэтому абзац после
 * списка — ошибка, а не молчаливая перестановка.
 *
 * Файл без 'server-only': чистые функции, их проверяют тесты.
 */

export const LEGAL_TEXT_MAX_LENGTH = 100_000;
export const LEGAL_SECTIONS_MAX = 80;

const ANCHOR = /\s\{#([a-z0-9-]+)\}$/;
const ITEM = /^-\s+(.+)$/;
const PLACEHOLDER = /\{\{\s*([^}]*?)\s*\}\}/g;
const KNOWN_KEYS = new Set(PROFILE_FIELDS.map((field) => field.key));

export function sectionsToText(sections: readonly LegalSection[]): string {
  return sections
    .map((section) => {
      const heading = `## ${section.heading}${section.anchor === undefined ? '' : ` {#${section.anchor}}`}`;
      const blocks = [heading, ...(section.paragraphs ?? [])];
      if (section.items !== undefined && section.items.length > 0) {
        blocks.push(section.items.map((item) => `- ${item}`).join('\n'));
      }
      return blocks.join('\n\n');
    })
    .join('\n\n');
}

export type LegalTextError =
  | { code: 'empty' }
  | { code: 'tooLong' }
  | { code: 'chars' }
  | { code: 'tooManySections' }
  | { code: 'beforeHeading'; line: number }
  | { code: 'paragraphAfterList'; line: number }
  | { code: 'emptySection'; line: number }
  | { code: 'duplicateAnchor'; line: number }
  | { code: 'placeholder'; line: number; key: string };

export type LegalTextResult =
  { ok: true; sections: LegalSection[] } | { ok: false; error: LegalTextError };

const body = textField(LEGAL_TEXT_MAX_LENGTH, false);

export function parseLegalText(raw: unknown): LegalTextResult {
  if (typeof raw !== 'string') return { ok: false, error: { code: 'empty' } };
  if (raw.length > LEGAL_TEXT_MAX_LENGTH * 2) return { ok: false, error: { code: 'tooLong' } };
  const cleaned = body.safeParse(raw);
  if (!cleaned.success) {
    return {
      ok: false,
      error: { code: raw.length > LEGAL_TEXT_MAX_LENGTH ? 'tooLong' : 'chars' },
    };
  }
  if (cleaned.data === null) return { ok: false, error: { code: 'empty' } };

  const sections: LegalSection[] = [];
  const anchors = new Set<string>();
  let current: { section: LegalSection; line: number } | null = null;
  let paragraph: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length === 0 || current === null) return;
    (current.section.paragraphs ??= []).push(paragraph.join(' '));
    paragraph = [];
  };
  const closeSection = (): LegalTextError | null => {
    closeParagraph();
    if (current === null) return null;
    const { section, line } = current;
    if ((section.paragraphs?.length ?? 0) === 0 && (section.items?.length ?? 0) === 0) {
      return { code: 'emptySection', line };
    }
    sections.push(section);
    return null;
  };

  const lines = cleaned.data.split('\n');
  for (const [index, rawLine] of lines.entries()) {
    const lineNo = index + 1;
    const line = rawLine.trim();

    for (const match of line.matchAll(PLACEHOLDER)) {
      const key = match[1] ?? '';
      if (!KNOWN_KEYS.has(key))
        return { ok: false, error: { code: 'placeholder', line: lineNo, key } };
    }

    const heading = parseHeading(line);
    if (heading !== null) {
      const error = closeSection();
      if (error !== null) return { ok: false, error };
      const anchor = heading.anchor;
      if (anchor !== undefined) {
        if (anchors.has(anchor))
          return { ok: false, error: { code: 'duplicateAnchor', line: lineNo } };
        anchors.add(anchor);
      }
      const title = heading.title;
      current = {
        section: anchor === undefined ? { heading: title } : { heading: title, anchor },
        line: lineNo,
      };
      continue;
    }

    if (line === '') {
      closeParagraph();
      continue;
    }
    if (current === null) return { ok: false, error: { code: 'beforeHeading', line: lineNo } };

    const item = ITEM.exec(line);
    if (item !== null) {
      closeParagraph();
      (current.section.items ??= []).push(item[1] ?? '');
      continue;
    }
    if ((current.section.items?.length ?? 0) > 0) {
      return { ok: false, error: { code: 'paragraphAfterList', line: lineNo } };
    }
    paragraph.push(line);
  }
  const error = closeSection();
  if (error !== null) return { ok: false, error };
  if (sections.length === 0) return { ok: false, error: { code: 'empty' } };
  if (sections.length > LEGAL_SECTIONS_MAX) {
    return { ok: false, error: { code: 'tooManySections' } };
  }
  return { ok: true, sections };
}

/**
 * «## Заголовок {#якорь}» — без одного общего регулярного выражения:
 * ленивый захват перед необязательным хвостом на длинной строке
 * перебирает варианты долго, а строка здесь может быть в 100 000 знаков
 */
function parseHeading(line: string): { title: string; anchor?: string } | null {
  if (!line.startsWith('## ')) return null;
  const rest = line.slice(3).trim();
  if (rest === '') return null;
  const anchor = ANCHOR.exec(rest);
  if (anchor === null) return { title: rest };
  const title = rest.slice(0, anchor.index).trim();
  return title === '' ? null : { title, anchor: anchor[1] ?? '' };
}

export const legalTitle = textField(TITLE_MAX_LENGTH, true);

/**
 * Имя новой редакции: документ и дата публикации (UTC). Вторая редакция
 * за день получает суффикс: версия — часть ключа и показывается под текстом.
 */
export function nextVersion(slug: string, now: Date, taken: ReadonlySet<string>): string {
  const base = `${slug}-${now.toISOString().slice(0, 10)}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${String(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
}
