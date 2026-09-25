/**
 * Правовые документы сайта-визитки для наполнения базы — ОБРАЗЦЫ.
 *
 * ⚠️ ЭТО НЕ ГОТОВЫЕ ЮРИДИЧЕСКИЕ ТЕКСТЫ. Данные владельца в них — метками
 * {{owner.*}}, вопросы юристу — пометками ⟦ЮРИСТ: …⟧ (docs/03 п.11.3).
 * Каждая редакция попадает в базу как черновик, и на сайте поверх неё
 * показывается предупреждение.
 *
 * ⚖️ Польский язык — основной: владелец ведёт деятельность в Польше,
 * и документы для потребителя должны быть доступны на польском.
 * Русский и английский — переводы.
 *
 * Каждый документ — в своём файле в prisma/legal/.
 */

import { PRIVACY_DOCUMENTS } from './legal/privacy';
import { PROVIDER_DOCUMENTS } from './legal/provider';
import { SITE_TERMS_DOCUMENTS } from './legal/site-terms';
import { TERMS_DOCUMENTS } from './legal/terms';
import type { LegalDocumentSeed } from './legal/types';

export type { LegalDocumentSeed, LegalSection } from './legal/types';

export const LEGAL_DOCUMENTS: LegalDocumentSeed[] = [
  ...PRIVACY_DOCUMENTS,
  ...TERMS_DOCUMENTS,
  ...PROVIDER_DOCUMENTS,
  ...SITE_TERMS_DOCUMENTS,
];
