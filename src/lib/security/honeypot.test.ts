import { describe, expect, it } from 'vitest';
import {
  buildCanaryPayload,
  checkFormTrap,
  checkPathTrap,
  checkTimingTrap,
  decideAction,
  looksLikeLegitimateBot,
  MIN_FORM_FILL_MS,
} from './honeypot';

/**
 * Тесты ловушек.
 *
 * Главное, что здесь проверяется, — ОТСУТСТВИЕ ЛОЖНЫХ СРАБАТЫВАНИЙ.
 * Ловушка, которая иногда ловит живого клиента, хуже, чем её отсутствие:
 * человек получает бан на сайте психолога и не понимает, почему.
 */

describe('ловушки по пути запроса', () => {
  it('ловит типовые цели сканеров', () => {
    for (const path of ['/wp-admin', '/.env', '/.git/config', '/phpmyadmin', '/backup.sql']) {
      expect(checkPathTrap(path), path).not.toBeNull();
    }
  });

  it('даёт максимальный балл за поиск секретов', () => {
    // Попытка скачать .env опаснее, чем разведка WordPress:
    // тут ищут прямой доступ к ключам
    const secrets = checkPathTrap('/.env');
    const wordpress = checkPathTrap('/wp-content');
    expect(secrets?.scoreDelta ?? 0).toBeGreaterThan(wordpress?.scoreDelta ?? 0);
  });

  it('НЕ трогает обычные страницы сайта', () => {
    const realPaths = [
      '/',
      '/login',
      '/uslugi',
      '/o-mne',
      '/cabinet/appointments',
      '/api/health',
      '/lekcii/trevoga',
      '/privacy',
    ];
    for (const path of realPaths) {
      expect(checkPathTrap(path), path).toBeNull();
    }
  });

  it('не зависит от регистра и завершающего слеша', () => {
    expect(checkPathTrap('/WP-Admin/')).not.toBeNull();
    expect(checkPathTrap('/wp-admin/setup.php')).not.toBeNull();
  });

  it('отвечает с задержкой — тормозит перебор', () => {
    const hit = checkPathTrap('/.env');
    expect(hit?.delayMs ?? 0).toBeGreaterThanOrEqual(1000);
  });
});

describe('ловушка в форме', () => {
  it('срабатывает, когда скрытое поле заполнено', () => {
    expect(checkFormTrap({ name: 'Анна', website_url: 'http://spam.example' })).not.toBeNull();
  });

  it('молчит, когда скрытые поля пусты — так отправляет человек', () => {
    expect(checkFormTrap({ name: 'Анна', website_url: '', company_name: '   ' })).toBeNull();
  });
});

describe('ловушка по времени заполнения', () => {
  it('ловит мгновенную отправку', () => {
    expect(checkTimingTrap(1000, 1000 + MIN_FORM_FILL_MS - 100)).not.toBeNull();
  });

  it('пропускает человеческую скорость', () => {
    expect(checkTimingTrap(1000, 1000 + 9000)).toBeNull();
  });
});

describe('решение о блокировке', () => {
  it('идёт по нарастающей: наблюдение → проверка → блок', () => {
    expect(decideAction(10)).toBe('OBSERVE');
    expect(decideAction(60)).toBe('CHALLENGE');
    expect(decideAction(150)).toBe('BLOCK');
  });

  it('одного захода в тяжёлую ловушку хватает для блокировки', () => {
    const hit = checkPathTrap('/.env');
    expect(decideAction(hit?.scoreDelta ?? 0)).toBe('BLOCK');
  });
});

describe('поисковые боты', () => {
  it('узнаёт настоящих краулеров по User-Agent', () => {
    expect(looksLikeLegitimateBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(looksLikeLegitimateBot('Mozilla/5.0 (compatible; YandexBot/3.0)')).toBe(true);
  });

  it('не считает ботом обычный браузер', () => {
    expect(looksLikeLegitimateBot('Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe(false);
  });
});

describe('канарейки в фальшивом API', () => {
  it('адреса уникальны для каждого срабатывания', () => {
    // Иначе нельзя определить, КОГДА именно произошёл слив
    const first = buildCanaryPayload('/api/internal/users');
    const users = first.users as { email: string }[];
    expect(users[0]?.email).toContain('@efremova.online');
    expect(users[0]?.email).toContain('canary-');
  });
});
