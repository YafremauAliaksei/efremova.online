'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminWrite } from '@/lib/admin/guard';
import { audit } from '@/lib/audit/log';
import { moveId, numbered } from '@/lib/blocks/order';
import { db } from '@/lib/db';
import {
  DEFAULT_CURRENCY_KEY,
  REFERENCE_CURRENCY_KEY,
  applyChecked,
  orderRows,
  parseCurrencyCode,
} from '@/lib/services/currency-config';
import { getCurrencySettings, getRateSources } from '@/lib/services/currency-settings';

/**
 * Действия раздела «Валюты и курсы».
 *
 * Как и везде в админке: каждая функция — адрес, на который можно отправить
 * запрос из сети, поэтому каждая сама проверяет сессию и форму. Значения из
 * формы — только коды, которые уже есть в базе или в коде: форма не может
 * завести источник курсов с новым адресом или валюту, которой нет в ISO 4217.
 */

/** Больше валют с копейками в ISO 4217 и не бывает — потолок от опечаток в цикле */
const CURRENCIES_MAX = 200;

function back(query: string): never {
  redirect(`/admin/currencies?${query}`);
}

/** Основная валюта меняет публичные страницы; список — редактор цен */
function refresh(): void {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin', 'layout');
}

/** «EUR:up» → код и направление; код проверяет вызывающий — по базе */
function parseMove(raw: unknown): { key: string; direction: 'up' | 'down' } | null {
  const match = typeof raw === 'string' ? /^([a-z0-9-]{1,32}|[A-Z]{3}):(up|down)$/.exec(raw) : null;
  if (match === null) return null;
  return { key: match[1] ?? '', direction: match[2] === 'up' ? 'up' : 'down' };
}

function checkedValues(formData: FormData, name: string): Set<string> {
  return new Set(formData.getAll(name).filter((value) => typeof value === 'string'));
}

/** Флажки валют: какие в редакторе цен. Основную и опорную выключить нельзя */
export async function saveCurrencies(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const [rows, settings] = await Promise.all([db.currency.findMany(), getCurrencySettings()]);
  const forced = new Set([settings.defaultCurrency, settings.referenceCurrency]);
  const next = applyChecked(rows, (row) => row.code, checkedValues(formData, 'enabled'), forced);
  const changed = next.filter((row) => {
    const before = rows.find((candidate) => candidate.code === row.key);
    return before?.isEnabled !== row.isEnabled || before.sortOrder !== row.sortOrder;
  });
  await db.$transaction(
    changed.map((row) =>
      db.currency.update({
        where: { code: row.key },
        data: { isEnabled: row.isEnabled, sortOrder: row.sortOrder },
      })
    )
  );
  await audit('currency.list', null, {
    enabled: next.filter((row) => row.isEnabled).map((row) => row.key),
  });
  refresh();
  back('saved=list');
}

/**
 * Выше или ниже среди включённых — порядок в редакторе цен и у посетителя.
 * «EUR:up» привязан к кнопке (bind): кнопка стоит внутри формы списка, а
 * значение кнопки в отправку действия не попадает. Привязанное значение
 * приходит от браузера так же, как поле формы, и проверяется так же.
 */
export async function moveCurrency(raw: unknown): Promise<void> {
  await requireAdminWrite();
  const move = parseMove(raw);
  if (move === null) back('error=missing');
  const rows = await db.currency.findMany({ where: { isEnabled: true } });
  const codes = orderRows(rows, (row) => row.code).map((row) => row.code);
  if (!codes.includes(move.key)) back('error=missing');
  await db.$transaction(
    numbered(moveId(codes, move.key, move.direction)).map(({ id, sortOrder }) =>
      db.currency.update({ where: { code: id }, data: { sortOrder: sortOrder + 10 } })
    )
  );
  await audit('currency.list', null, { moved: move.key, direction: move.direction });
  refresh();
  back('saved=moved');
}

/** Новая валюта — сразу включённая и последней в списке */
export async function addCurrency(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const code = parseCurrencyCode(formData.get('code'));
  if (code === null) back('error=code');
  const rows = await db.currency.findMany();
  if (rows.length >= CURRENCIES_MAX && !rows.some((row) => row.code === code)) {
    back('error=code');
  }
  const last = Math.max(0, ...rows.filter((row) => row.isEnabled).map((row) => row.sortOrder));
  await db.currency.upsert({
    where: { code },
    create: { code, isEnabled: true, sortOrder: last + 10 },
    update: { isEnabled: true, sortOrder: last + 10 },
  });
  await audit('currency.add', null, { code });
  refresh();
  back('saved=added');
}

/**
 * Основная валюта (по умолчанию у посетителя, первой в списках) и опорная
 * (от неё подсказка курса). Обе — из списка валют и обе включаются.
 */
export async function saveMainCurrencies(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const main = parseCurrencyCode(formData.get('defaultCurrency'));
  const reference = parseCurrencyCode(formData.get('referenceCurrency'));
  if (main === null || reference === null) back('error=code');
  const known = await db.currency.count({ where: { code: { in: [main, reference] } } });
  if (known !== new Set([main, reference]).size) back('error=code');

  await db.$transaction([
    ...[
      { key: DEFAULT_CURRENCY_KEY, value: main },
      { key: REFERENCE_CURRENCY_KEY, value: reference },
    ].map((setting) =>
      db.siteSetting.upsert({
        where: { key: setting.key },
        create: setting,
        update: { value: setting.value },
      })
    ),
    db.currency.updateMany({
      where: { code: { in: [main, reference] }, isEnabled: false },
      data: { isEnabled: true },
    }),
  ]);
  await audit('currency.main', null, { defaultCurrency: main, referenceCurrency: reference });
  refresh();
  back('saved=main');
}

/** Включённые источники и их порядок; источник — только из кода */
async function writeSources(order: { key: string; isEnabled: boolean; sortOrder: number }[]) {
  await db.$transaction(
    order.map((row) =>
      db.rateSource.upsert({
        where: { id: row.key },
        create: { id: row.key, isEnabled: row.isEnabled, sortOrder: row.sortOrder },
        update: { isEnabled: row.isEnabled, sortOrder: row.sortOrder },
      })
    )
  );
}

export async function saveSources(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const sources = await getRateSources();
  const next = applyChecked(sources, (source) => source.id, checkedValues(formData, 'source'));
  await writeSources(next);
  await audit('rates.sources', null, {
    enabled: next.filter((row) => row.isEnabled).map((row) => row.key),
  });
  refresh();
  back('saved=sources');
}

export async function moveSource(raw: unknown): Promise<void> {
  await requireAdminWrite();
  const move = parseMove(raw);
  if (move === null) back('error=missing');
  const sources = await getRateSources();
  const enabled = sources.filter((source) => source.isEnabled).map((source) => source.id);
  if (!enabled.includes(move.key)) back('error=missing');
  const moved = numbered(moveId(enabled, move.key, move.direction));
  await writeSources(
    moved.map(({ id, sortOrder }) => ({ key: id, isEnabled: true, sortOrder: sortOrder + 10 }))
  );
  await audit('rates.sources', null, { moved: move.key, direction: move.direction });
  refresh();
  back('saved=moved');
}
