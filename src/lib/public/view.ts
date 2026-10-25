import type { ReactNode } from 'react';
import type { PageMeta } from '@/lib/public/meta';

/** Публичная страница до отрисовки: что сказать в <head> и что показать */
export interface PublicView {
  meta: PageMeta;
  body: ReactNode;
}
