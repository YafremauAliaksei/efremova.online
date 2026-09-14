import { describe, expect, it } from 'vitest';
import { createThrottle, hourBucket, throttleKey } from './throttle';

/**
 * Тесты ограничителя.
 *
 * Почему они важнее обычных: здесь проверяется поведение ПОД АТАКОЙ —
 * то есть ровно в тот момент, когда проверить руками невозможно.
 * Время подставляется параметром, поэтому «час атаки» проигрывается
 * за доли секунды и без единого сетевого запроса.
 */

const MINUTE = 60_000;

describe('ограничитель записи событий', () => {
  it('первое попадание с адреса записывается и получает задержку', () => {
    const throttle = createThrottle();
    const decision = throttle.register('1.2.3.4|PATH', 0, 3000);

    expect(decision.report).toBe(true);
    expect(decision.count).toBe(1);
    expect(decision.delayMs).toBe(3000);
  });

  it('повторы с того же адреса не пишутся и НЕ задерживаются', () => {
    const throttle = createThrottle();
    throttle.register('1.2.3.4|PATH', 0, 3000);

    // Ключевое: задержка 0. Иначе тысяча запросов удержала бы тысячу соединений
    for (let i = 1; i <= 1000; i += 1) {
      const decision = throttle.register('1.2.3.4|PATH', i, 3000);
      expect(decision.report).toBe(false);
      expect(decision.delayMs).toBe(0);
    }
  });

  it('пропущенные попадания не теряются, а складываются в счётчик', () => {
    const throttle = createThrottle();
    throttle.register('1.2.3.4|PATH', 0, 0);

    for (let i = 1; i <= 99; i += 1) throttle.register('1.2.3.4|PATH', i, 0);

    // Минута прошла — следующая отправка приносит всё накопленное разом
    const decision = throttle.register('1.2.3.4|PATH', MINUTE, 0);
    expect(decision.report).toBe(true);
    expect(decision.count).toBe(100);
  });

  it('разные типы ловушек считаются раздельно', () => {
    const throttle = createThrottle();

    expect(throttle.register('1.2.3.4|PATH', 0, 0).report).toBe(true);
    expect(throttle.register('1.2.3.4|FAKE_API', 0, 0).report).toBe(true);
  });

  it('общий потолок держит распределённую атаку: каждый адрес новый', () => {
    const throttle = createThrottle({ maxReportsPerMinute: 10 });

    let reported = 0;
    // Ботнет на тысячу адресов — предел «на ключ» тут бессилен, каждый новый
    for (let i = 0; i < 1000; i += 1) {
      if (throttle.register(`10.0.0.${String(i)}|PATH`, 0, 0).report) reported += 1;
    }

    expect(reported).toBe(10);
    expect(throttle.droppedThisMinute()).toBe(990);
  });

  it('потолок обнуляется с новой минутой', () => {
    const throttle = createThrottle({ maxReportsPerMinute: 2 });

    throttle.register('a|PATH', 0, 0);
    throttle.register('b|PATH', 0, 0);
    expect(throttle.register('c|PATH', 0, 0).report).toBe(false);

    expect(throttle.register('d|PATH', MINUTE, 0).report).toBe(true);
    expect(throttle.droppedThisMinute()).toBe(0);
  });

  it('число отслеживаемых ключей не растёт без предела', () => {
    const throttle = createThrottle({ maxTrackedKeys: 50, maxReportsPerMinute: 1_000_000 });

    for (let i = 0; i < 10_000; i += 1) {
      throttle.register(`10.0.${String(i)}.1|PATH`, i, 0);
    }

    expect(throttle.size()).toBeLessThanOrEqual(50);
  });

  it('час атаки в 1000 запросов в секунду даёт не больше потолка записей', () => {
    // Главный тест этого файла: проигрываем настоящую атаку
    const throttle = createThrottle({ maxReportsPerMinute: 120 });

    let reported = 0;
    let delayedTotalMs = 0;

    for (let second = 0; second < 3600; second += 1) {
      for (let request = 0; request < 1000; request += 1) {
        const decision = throttle.register('1.2.3.4|PATH', second * 1000, 3000);
        if (decision.report) reported += 1;
        delayedTotalMs += decision.delayMs;
      }
    }

    // 3 600 000 запросов за час
    expect(reported).toBe(60); // одна запись в минуту, а не 3,6 миллиона
    expect(delayedTotalMs).toBe(60 * 3000); // 3 минуты ожидания за час, а не 3000 часов
  });
});

describe('вспомогательные функции', () => {
  it('ключ склеивает адрес и тип ловушки', () => {
    expect(throttleKey('1.2.3.4', 'PATH')).toBe('1.2.3.4|PATH');
  });

  it('граница часа отбрасывает минуты, секунды и миллисекунды', () => {
    const bucket = hourBucket(new Date('2026-09-14T13:47:23.456Z'));
    expect(bucket.toISOString()).toBe('2026-09-14T13:00:00.000Z');
  });

  it('граница часа не меняет исходную дату', () => {
    const original = new Date('2026-09-14T13:47:23.456Z');
    hourBucket(original);
    expect(original.toISOString()).toBe('2026-09-14T13:47:23.456Z');
  });
});
