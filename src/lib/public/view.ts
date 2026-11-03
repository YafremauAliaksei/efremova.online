import type { ReactNode } from 'react';
import type { PageMeta } from '@/lib/public/meta';

/** Публичная страница до отрисовки: что сказать в <head> и что показать */
export interface PublicView {
  meta: PageMeta;
  body: ReactNode;
  /** Код ответа, если не 200: «такой редакции нет» — 404 со своим текстом */
  status?: 404;
}

/**
 * Вместо страницы — переброс на свой адрес: документ без ?ver= ведёт на
 * действующую редакцию. Ответ не кэшируется — действующая меняется
 */
export interface PublicRedirect {
  redirect: string;
}
