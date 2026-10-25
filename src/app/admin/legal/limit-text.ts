import { STORAGE_LIMITS } from '@/lib/admin/limits';

/**
 * Отдельный модуль, а не константа в LegalEditor: значение, импортированное
 * из файла 'use client' в серверную страницу, приходит ссылкой на клиентский
 * модуль, а не строкой.
 */
export const LEGAL_LIMIT_TEXT = `За сутки у этого документа уже ${String(STORAGE_LIMITS.legalPerDocPerDay)} новых редакций — следующую можно сохранить позже. Редакции не удаляются, поэтому их число ограничено.`;
