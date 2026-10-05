import { describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  generateNonce,
  getBaseSecurityHeaders,
  getPrivateAreaHeaders,
} from './headers';

/**
 * CSP — техническое обещание «браузер посетителя не обращается ни к одному
 * чужому домену» (CLAUDE.md, правило 5; docs/13, п.1.1). Ослаблять её
 * нельзя, и эти тесты — сторож: разрешённый «на минутку» чужой домен,
 * 'unsafe-inline' для скриптов или iframe роняют CI.
 */

/** Политика как словарь: директива → источники */
function parse(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter((tokens) => tokens[0] !== undefined && tokens[0] !== '')
      .map(([name = '', ...sources]) => [name, sources])
  );
}

const NONCE = 'dGVzdC1ub25jZS0xMjM0NQ==';
const prod = parse(buildContentSecurityPolicy(NONCE, false));
const dev = parse(buildContentSecurityPolicy(NONCE, true));

describe('CSP: самодостаточность', () => {
  it('ни в одной директиве нет чужого домена, схемы или звёздочки', () => {
    // Свой домен — только 'self'; data: и blob: — встроенные картинки и воркеры
    const allowed =
      /^('self'|'none'|'nonce-[A-Za-z0-9+/=]+'|'strict-dynamic'|'unsafe-inline'|data:|blob:)$/;
    for (const [directive, sources] of prod) {
      for (const source of sources) expect(source, directive).toMatch(allowed);
    }
  });

  it.each([
    ['default-src', ["'self'"]],
    ['connect-src', ["'self'"]],
    ['font-src', ["'self'"]],
    ['frame-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'self'"]],
  ])('%s — ровно %j', (directive, sources) => {
    expect(prod.get(directive)).toEqual(sources);
  });

  it('картинки — только свои: data: и blob:, без внешних адресов', () => {
    expect(prod.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
  });

  it('http-ресурсы переписываются на https', () => {
    expect(prod.has('upgrade-insecure-requests')).toBe(true);
  });
});

describe('CSP: скрипты', () => {
  it('только со своим nonce и strict-dynamic', () => {
    expect(prod.get('script-src')).toEqual(["'self'", `'nonce-${NONCE}'`, "'strict-dynamic'"]);
  });

  it('в проде ни unsafe-inline, ни unsafe-eval для скриптов', () => {
    expect(prod.get('script-src')).not.toContain("'unsafe-inline'");
    expect(prod.get('script-src')).not.toContain("'unsafe-eval'");
  });

  it('unsafe-eval — только в разработке (горячая перезагрузка Next.js)', () => {
    expect(dev.get('script-src')).toContain("'unsafe-eval'");
  });

  it('стили: unsafe-inline допущен осознанно, внешних нет', () => {
    expect(prod.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
  });
});

describe('nonce', () => {
  it('16 случайных байт в base64, каждый раз новый', () => {
    const nonces = new Set(Array.from({ length: 200 }, generateNonce));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
    }
  });
});

describe('остальные заголовки', () => {
  const base = getBaseSecurityHeaders();

  it('HTTPS на два года, запрет угадывания типа и встраивания', () => {
    expect(base['Strict-Transport-Security']).toMatch(/max-age=63072000/);
    expect(base['X-Content-Type-Options']).toBe('nosniff');
    expect(base['X-Frame-Options']).toBe('DENY');
    expect(base['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('камера, микрофон, геолокация и платежи выключены', () => {
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(base['Permissions-Policy']).toContain(`${feature}=()`);
    }
  });

  it('сервер не называет себя', () => {
    expect(base.Server).toBe('');
    expect(base['X-Powered-By']).toBe('');
  });

  it('закрытая зона: no-store и noindex (CLAUDE.md, правило 4)', () => {
    const closed = getPrivateAreaHeaders();
    expect(closed['Cache-Control']).toMatch(/no-store/);
    expect(closed['Cache-Control']).toMatch(/private/);
    expect(closed['X-Robots-Tag']).toMatch(/noindex/);
  });
});
