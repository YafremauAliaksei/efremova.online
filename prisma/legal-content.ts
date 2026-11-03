/**
 * Правовые документы сайта-визитки для наполнения базы — ОБРАЗЦЫ.
 *
 * ⚠️ ЭТО НЕ ГОТОВЫЕ ЮРИДИЧЕСКИЕ ТЕКСТЫ. Они написаны как настоящие (по
 * просьбе владельца — показать, как сайт будет выглядеть в работе), но
 * каждая редакция попадает в базу черновиком, и на сайте поверх неё —
 * плашка «образец». Данные владельца — метками {{owner.*}} (docs/03 п.11.3).
 * Итоговые тексты появятся после консультации юриста — через админку.
 *
 * ⚖️ Польский язык — основной: владелец ведёт деятельность в Польше,
 * документы для потребителя должны быть на польском, и подписывается
 * только польская версия. Русский и английский — переводы для понимания.
 *
 * Каждый документ — в своём файле в prisma/legal/.
 */

import { PRIVACY_DOCUMENTS } from './legal/privacy';
import { PROVIDER_DOCUMENTS } from './legal/provider';
import { SITE_TERMS_DOCUMENTS } from './legal/site-terms';
import { TERMS_DOCUMENTS } from './legal/terms';
import type { LegalDocumentSeed, LegalSection } from './legal/types';

export type { LegalDocumentSeed, LegalSection } from './legal/types';

/**
 * Последний раздел каждого документа: какая версия обязательна. Добавляется
 * здесь, а не в каждом файле, — новый документ без него не получится
 */
const LANGUAGE_SECTION: Record<LegalDocumentSeed['locale'], LegalSection> = {
  pl: {
    heading: 'Wersje językowe',
    anchor: 'language',
    paragraphs: [
      'Dokument sporządzono w języku polskim i tylko wersja polska jest wiążąca. Tłumaczenia na inne języki mają wyłącznie charakter informacyjny.',
    ],
  },
  ru: {
    heading: 'Языковые версии',
    anchor: 'language',
    paragraphs: [
      'Документ составлен на польском языке, и обязательной является только польская версия. Перевод предназначен для понимания: при расхождении в толковании приоритет имеет польская версия.',
    ],
  },
  en: {
    heading: 'Language versions',
    anchor: 'language',
    paragraphs: [
      'This document was drawn up in Polish and only the Polish version is binding. Translations are for information only: in case of any discrepancy in interpretation, the Polish version prevails.',
    ],
  },
};

export const LEGAL_DOCUMENTS: LegalDocumentSeed[] = [
  ...PRIVACY_DOCUMENTS,
  ...TERMS_DOCUMENTS,
  ...PROVIDER_DOCUMENTS,
  ...SITE_TERMS_DOCUMENTS,
].map((doc) => ({ ...doc, sections: [...doc.sections, LANGUAGE_SECTION[doc.locale]] }));
