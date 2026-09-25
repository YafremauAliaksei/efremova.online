import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import {
  SITE_STATUS_KEY,
  parseSiteStatus,
  type ProfileValues,
  type SiteStatus,
} from '@/lib/site-profile-fields';

export interface SiteProfile {
  values: ProfileValues;
  status: SiteStatus;
}

/**
 * Профиль владельца из базы — один запрос на страницу: макет, подвал и текст
 * документа берут его отсюда, cache() не даёт спрашивать базу трижды.
 *
 * База недоступна — значит, «в разработке» и пустые значения. Плашка и метки
 * «не заполнено» на сайте без базы — правда, а сайт, который из-за сбоя базы
 * перестал предупреждать, что он образец, — нет.
 */
export const getSiteProfile = cache(async (): Promise<SiteProfile> => {
  try {
    const rows = await db.siteSetting.findMany();
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return { values, status: parseSiteStatus(values[SITE_STATUS_KEY]) };
  } catch {
    return { values: {}, status: 'development' };
  }
});
