/**
 * Структура правового документа для наполнения базы.
 *
 * Текст хранится структурой, а не HTML: его невозможно превратить в вектор
 * XSS и не нужен парсер разметки. Данные владельца — метками {{owner.*}},
 * места для юриста — пометками ⟦ЮРИСТ: …⟧ (docs/03 п.11.3).
 */

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  /** Якорь для прямой ссылки вида /privacy?lang=pl#cookies */
  anchor?: string;
}

export interface LegalDocumentSeed {
  slug: 'privacy' | 'terms' | 'provider' | 'site-terms';
  locale: 'pl' | 'ru' | 'en';
  version: string;
  title: string;
  sections: LegalSection[];
}
