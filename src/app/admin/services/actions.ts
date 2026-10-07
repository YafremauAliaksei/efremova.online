'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth/admin';
import { audit } from '@/lib/audit/log';
import { db } from '@/lib/db';
import { moveId, numbered } from '@/lib/blocks/order';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import {
  parseNewServiceForm,
  parsePriceForm,
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

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/denied');
}

/** Назад в раздел: открытая услуга и итог действия — только известным кодом */
function back(serviceId: string | null, query: string): never {
  const open = serviceId === null ? '' : `open=${serviceId}&`;
  redirect(`/admin/services?${open}${query}`);
}

/** Услуги видны на /services и в блоке «Список услуг» на любой странице */
function refresh(): void {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin/services');
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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

/**
 * Новая цена для региона. Прежняя действующая закрывается этим же моментом,
 * новая с него начинается — одной транзакцией: ни мгновения без цены и ни
 * мгновения с двумя.
 */
export async function setPrice(formData: FormData): Promise<void> {
  await requireAdmin();
  const serviceId = await existingService(formData);
  const parsed = parsePriceForm(formData);
  if (!parsed.ok) back(serviceId, `error=${parsed.field}`);

  const now = new Date();
  const prices = await db.servicePrice.findMany({ where: { serviceId } });
  const plan = planPriceChange(prices, parsed.value, now);
  if (!plan.create) back(serviceId, 'saved=priceSame');

  await db.$transaction([
    db.servicePrice.updateMany({ where: { id: { in: plan.close } }, data: { validTo: now } }),
    db.servicePrice.create({
      data: {
        serviceId,
        region: parsed.value.region,
        currency: parsed.value.currency,
        amountMinor: parsed.value.amountMinor,
        validFrom: now,
      },
    }),
  ]);
  await audit('price.set', serviceId, {
    region: parsed.value.region,
    currency: parsed.value.currency,
    amountMinor: parsed.value.amountMinor,
  });
  refresh();
  back(serviceId, 'saved=price');
}

/** «Убрать» цену региона = закрыть её сегодняшним числом; в истории она остаётся */
export async function closePrice(formData: FormData): Promise<void> {
  await requireAdmin();
  const serviceId = await existingService(formData);
  const priceId = formData.get('priceId');
  if (typeof priceId !== 'string' || !UUID.test(priceId)) back(serviceId, 'error=missing');

  const now = new Date();
  const { count } = await db.servicePrice.updateMany({
    where: { id: priceId, serviceId, OR: [{ validTo: null }, { validTo: { gt: now } }] },
    data: { validTo: now },
  });
  if (count === 0) back(serviceId, 'error=missing');
  await audit('price.close', serviceId, { price: priceId });
  refresh();
  back(serviceId, 'saved=priceClosed');
}
