import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

/**
 * История цен неизменна, как редакции договора (PROJECT_LOG, задача 9a):
 * правку, удаление и цену задним числом запрещает триггер в базе, а не код
 * приложения. Проверка — прямо в той же базе, что у браузерных тестов:
 * ошибка или взлом приложения не должны переписать прошлое, значит и
 * проверять надо мимо приложения.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

test.afterAll(async () => {
  await db.$disconnect();
});

test('история цен: менять и удалять запрещает база, закрыть датой — можно', async () => {
  // Своя услуга, скрытая с сайта: удалить её после теста не даст тот же триггер
  const service = await db.service.create({
    data: {
      slug: `price-guard-${String(Date.now()).slice(-6)}`,
      titleI18n: { ru: 'Проверка истории цен' },
      durationMinutes: 50,
      isActive: false,
    },
  });
  const price = await db.servicePrice.create({
    data: { serviceId: service.id, currency: 'PLN', amountMinor: 20000 },
  });

  // Сумму, валюту и начало не поменять, строку не удалить
  await expect(
    db.servicePrice.update({ where: { id: price.id }, data: { amountMinor: 1 } })
  ).rejects.toThrow(/историю цен нельзя/);
  await expect(
    db.servicePrice.update({ where: { id: price.id }, data: { currency: 'EUR' } })
  ).rejects.toThrow(/историю цен нельзя/);
  await expect(db.servicePrice.delete({ where: { id: price.id } })).rejects.toThrow(
    /историю цен нельзя/
  );
  await expect(db.service.delete({ where: { id: service.id } })).rejects.toThrow();

  // Задним числом цену не дописать
  await expect(
    db.servicePrice.create({
      data: {
        id: randomUUID(),
        serviceId: service.id,
        currency: 'EUR',
        amountMinor: 5000,
        validFrom: new Date('2020-01-01T00:00:00Z'),
      },
    })
  ).rejects.toThrow(/начинается сейчас/);

  // Закрыть действующую цену датой — ровно то, что делает админка
  const closed = await db.servicePrice.update({
    where: { id: price.id },
    data: { validTo: new Date() },
  });
  expect(closed.validTo).not.toBeNull();

  // Закрытую второй раз не открыть и не передвинуть
  await expect(
    db.servicePrice.update({ where: { id: price.id }, data: { validTo: null } })
  ).rejects.toThrow(/историю цен нельзя/);
  await expect(
    db.servicePrice.update({ where: { id: price.id }, data: { validTo: new Date() } })
  ).rejects.toThrow(/историю цен нельзя/);

  // Новая цена в той же валюте — новой строкой
  await db.servicePrice.create({
    data: { serviceId: service.id, currency: 'PLN', amountMinor: 21000 },
  });
  expect(await db.servicePrice.count({ where: { serviceId: service.id } })).toBe(2);
});
