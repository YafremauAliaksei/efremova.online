/**
 * Что записывается в журнал действий админки — закрытый список.
 *
 * В журнал попадает факт действия и его адрес (какой блок, какая услуга),
 * а не содержимое: ни текстов, ни данных владельца. Поле «Данные владельца»
 * записывается именем поля, без значения — иначе журнал, который нельзя
 * чистить, навсегда хранил бы адрес или телефон, давно сменённый на сайте.
 */
export const AUDIT_ACTIONS = {
  'session.login': 'Вход в админку',
  'session.logout': 'Выход из админки',

  'block.text': 'Текст блока',
  'block.settings': 'Оформление блока',
  'block.add': 'Новый блок',
  'block.move': 'Блок перемещён',
  'block.show': 'Блок показан',
  'block.hide': 'Блок скрыт',
  'block.archive': 'Блок в архив',
  'block.restore': 'Блок из архива',
  'block.revert': 'Блок: возврат версии',

  'page.create': 'Новая страница',
  'page.settings': 'Настройки страницы',
  'page.move': 'Страница перемещена',
  'page.archive': 'Страница в архив',
  'page.restore': 'Страница из архива',

  'service.create': 'Новая услуга',
  'service.settings': 'Настройки услуги',
  'service.move': 'Услуга перемещена',
  'price.set': 'Новая цена',
  'price.close': 'Цена закрыта',

  'media.upload': 'Картинка загружена',
  'media.label': 'Подпись картинки',
  'media.archive': 'Картинка в архив',
  'media.restore': 'Картинка из архива',

  'profile.save': 'Данные владельца',
  'site.status': 'Режим сайта',
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** Над чем совершено действие — и тип записи в журнале */
export function entityTypeOf(action: AuditAction): string {
  return action.slice(0, action.indexOf('.'));
}

export function auditLabel(action: string): string {
  return Object.hasOwn(AUDIT_ACTIONS, action) ? AUDIT_ACTIONS[action as AuditAction] : action;
}
