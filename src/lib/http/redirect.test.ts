import { describe, expect, it } from 'vitest';
import { isSafeRedirectPath, relativeRedirect, siteUrl } from './redirect';

describe('переброс на свой путь', () => {
  it('Location — ровно тот путь, без домена сервера', () => {
    const response = relativeRedirect('/ru/about?x=1', 307, { 'Cache-Control': 'no-store' });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/ru/about?x=1');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each([['//evil.example'], ['/\\evil.example'], ['https://evil.example'], ['evil'], ['']])(
    '%j — чужой адрес не отправляется',
    (path) => {
      expect(isSafeRedirectPath(path)).toBe(false);
      expect(() => relativeRedirect(path)).toThrow();
    }
  );

  it('заголовок Location нельзя подменить через дополнительные заголовки', () => {
    const response = relativeRedirect('/admin', 303, { Location: 'https://evil.example' });
    expect(response.headers.get('location')).toBe('/admin');
  });
});

describe('адрес переброса из middleware', () => {
  const server = 'http://localhost:3000';

  it('домен — из APP_URL, а не от имени сервера', () => {
    expect(siteUrl('/ru/about?x=1', 'https://efremova.online', server).href).toBe(
      'https://efremova.online/ru/about?x=1'
    );
  });

  it('путь в APP_URL не мешает: берётся только домен', () => {
    expect(siteUrl('/pl', 'https://efremova.online/something', server).href).toBe(
      'https://efremova.online/pl'
    );
  });

  it.each([[undefined], [''], ['не адрес']])('APP_URL = %j → адрес сервера', (appUrl) => {
    expect(siteUrl('/ru', appUrl, server).href).toBe('http://localhost:3000/ru');
  });

  it.each([['//evil.example'], ['/\\evil.example'], ['https://evil.example']])(
    '%j — чужой адрес не строится',
    (path) => {
      expect(() => siteUrl(path, 'https://efremova.online', server)).toThrow();
    }
  );
});
