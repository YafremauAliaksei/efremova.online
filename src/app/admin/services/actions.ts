'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminWrite } from '@/lib/admin/guard';
import { audit } from '@/lib/audit/log';
import { db } from '@/lib/db';
import { moveId, numbered } from '@/lib/blocks/order';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import {
  parseNewServiceForm,
  parsePricesForm,
  parseServiceForm,
  planPriceChange,
} from '@/lib/services/edit';

/**
 * Действия раздела «Услуги и цены».
 *
 * ⚠️ Как и в actions.ts конструктора страниц: каждая функция — адрес, на
 * который можно отправить запрос из сети. Поэтому каждая сама проверяет
 * сессию администратора и сама проверяет форму.
 *
 * Ничего не удаляется. Услуга скрывается с сайта, а не стирается; цена не
 * правится на месте — прежняя закрывается датой, новая начинается с этого
 * момента. История цен нужна при споре: важна цена, которую человек видел
 * тогда, а не сегодняшняя.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Назад в раздел: открытая услуга и итог действия — только известным кодом */
function back(serviceId: string | null, query: string): never {
  const open = serviceId === null ? '' : `open=${serviceId}&`;
  redirect(`/admin/services?${open}${query}`);
}

/** Услуги видны на /services и в блоке «Список услуг» на любой странице */
function refresh(serviceId?: string): void {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin/services');
  if (serviceId !== undefined) revalidatePath(`/admin/services/${serviceId}/prices`);
}

async function existingService(formData: FormData): Promise<string> {
  const id = formData.get('serviceId');
  const service =
    typeof id === 'string' && UUID.test(id)
      ? await db.service.findUnique({ where: { id }, select: { id: true } })
      : null;
  if (service === null) back(null, 'error=missing');
  return service.id;
}

async function serviceIdsInOrder(): Promise<string[]> {
  const services = await db.service.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return services.map((service) => service.id);
}

/** Новая услуга — скрытая и в конце списка: сначала цена и переводы, потом показ */
export async function createService(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const parsed = parseNewServiceForm(formData);
  if (!parsed.ok) back(null, `newservice=1&error=${parsed.field}`);

  const taken = await db.service.findUnique({
    where: { slug: parsed.value.slug },
    select: { id: true },
  });
  if (taken !== null) back(null, 'newservice=1&error=slugTaken');

  const ids = await serviceIdsInOrder();
  const created = await db.service.create({
    data: {
      slug: parsed.value.slug,
      titleI18n: { [DEFAULT_LOCALE]: parsed.value.title },
      durationMinutes: 50,
      isActive: false,
      sortOrder: ids.length * 10,
    },
    select: { id: true },
  });
  await audit('service.create', created.id, { service: parsed.value.slug });
  refresh();
  back(created.id, 'saved=created');
}

export async function saveService(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const serviceId = await existingService(formData);
  const parsed = parseServiceForm(formData);
  if (!parsed.ok) back(serviceId, `error=${parsed.field}`);

  const { titleI18n, descriptionI18n, durationMinutes, isActive } = parsed.value;
  await db.service.update({
    where: { id: serviceId },
    data: { titleI18n, descriptionI18n, durationMinutes, isActive },
  });
  await audit('service.settings', serviceId, { active: isActive });
  refresh();
  back(serviceId, 'saved=settings');
}

/** Порядок услуг — порядок на сайте */
export async function moveService(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const serviceId = await existingService(formData);
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';
  const ids = moveId(await serviceIdsInOrder(), serviceId, direction);
  await db.$transaction(
    numbered(ids).map(({ id, sortOrder }) =>
      db.service.update({ where: { id }, data: { sortOrder } })
    )
  );
  await audit('service.move', serviceId, { direction });
  refresh();
  back(serviceId, 'saved=moved');
}

/** Назад в редактор цен услуги: итог действия — только известным кодом */
function backToPrices(serviceId: string, query: string): never {
  redirect(`/admin/services/${serviceId}/prices?${query}`);
}

/**
 * Новые цены сразу в нескольких валютах — форма редактора цен. Пустое поле —
 * цена в этой валюте не меняется. Прежняя действующая цена закрывается этим
 * же моментом, новая с него начинается — одной транзакцией на все валюты:
 * ни мгновения без цены и ни мгновения с двумя.
 */
export async function setPrices(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const serviceId = await existingService(formData);
  const parsed = parsePricesForm(formData);
  if (!parsed.ok) backToPrices(serviceId, `error=${parsed.field}`);

  const now = new Date();
  const prices = await db.servicePrice.findMany({ where: { serviceId } });
  const changes = parsed.value
    .map((next) => ({ next, plan: planPriceChange(prices, next, now) }))
    .filter(({ plan }) => plan.create);
  if (changes.length === 0) backToPrices(serviceId, 'saved=priceSame');

  await db.$transaction([
    db.servicePrice.updateMany({
      where: { id: { in: changes.flatMap(({ plan }) => plan.close) } },
      data: { validTo: now },
    }),
    db.servicePrice.createMany({
      data: changes.map(({ next }) => ({
        serviceId,
        currency: next.currency,
        amountMinor: next.amountMinor,
        validFrom: now,
      })),
    }),
  ]);
  for (const { next } of changes) {
    await audit('price.set', serviceId, {
      currency: next.currency,
      amountMinor: next.amountMinor,
    });
  }
  refresh(serviceId);
  backToPrices(serviceId, 'saved=price');
}

/**
 * «Убрать» цену в валюте = закрыть её сегодняшним числом; в истории она
 * остаётся. Закрыть можно только действующую: закрытую база менять не даст
 */
export async function closePrice(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const serviceId = await existingService(formData);
  const priceId = formData.get('priceId');
  if (typeof priceId !== 'string' || !UUID.test(priceId)) backToPrices(serviceId, 'error=missing');

  const now = new Date();
  const { count } = await db.servicePrice.updateMany({
    where: { id: priceId, serviceId, validTo: null },
    data: { validTo: now },
  });
  if (count === 0) backToPrices(serviceId, 'error=missing');
  await audit('price.close', serviceId, { price: priceId });
  refresh(serviceId);
  backToPrices(serviceId, 'saved=priceClosed');
}
