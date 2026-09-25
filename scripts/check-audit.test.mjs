/**
 * Тесты сверки npm audit с принятыми рисками.
 *
 * Главный случай — цепочка из настоящего отчёта: @lhci/cli идёт в отчёте
 * раньше своего источника extract-zip. Прежняя проверка шла по алфавиту
 * и считала @lhci/cli неучтённой уязвимостью, хотя риск принят.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { classify } from './check-audit.mjs';

const ACCEPTED = [
  { id: 'GHSA-aaaa', package: 'extract-zip' },
  { id: 'GHSA-bbbb', package: 'extract-zip' },
];

const advisory = (id) => ({ url: `https://github.com/advisories/${id}` });

describe('принятые риски и их следствия', () => {
  it('цепочка принимается целиком, даже если следствие стоит в отчёте раньше источника', () => {
    const result = classify(
      {
        '@lhci/cli': { severity: 'high', via: ['@lhci/utils', 'lighthouse'] },
        '@lhci/utils': { severity: 'high', via: ['lighthouse'] },
        '@puppeteer/browsers': { severity: 'high', via: ['extract-zip'] },
        'extract-zip': { severity: 'high', via: [advisory('GHSA-aaaa'), advisory('GHSA-bbbb')] },
        lighthouse: { severity: 'high', via: ['puppeteer-core'] },
        'puppeteer-core': { severity: 'high', via: ['@puppeteer/browsers'] },
      },
      ACCEPTED
    );
    expect(result.blocking).toEqual([]);
    expect(result.skipped).toHaveLength(6);
  });

  it('следствие с одним непринятым источником блокирует', () => {
    const result = classify(
      {
        app: { severity: 'high', via: ['extract-zip', 'evil-lib'] },
        'evil-lib': { severity: 'critical', via: [advisory('GHSA-zzzz')] },
        'extract-zip': { severity: 'high', via: [advisory('GHSA-aaaa')] },
      },
      ACCEPTED
    );
    expect(result.blocking).toEqual([
      'app (high): см. npm audit',
      'evil-lib (critical): GHSA-zzzz',
    ]);
  });

  it('пакет с одной принятой и одной новой advisory блокирует', () => {
    const result = classify(
      { 'extract-zip': { severity: 'high', via: [advisory('GHSA-aaaa'), advisory('GHSA-new')] } },
      ACCEPTED
    );
    expect(result.blocking).toEqual(['extract-zip (high): GHSA-aaaa, GHSA-new']);
  });

  it('находки ниже high не рассматриваются', () => {
    const result = classify(
      { 'some-lib': { severity: 'moderate', via: [advisory('GHSA-mmmm')] } },
      ACCEPTED
    );
    expect(result).toEqual({ blocking: [], skipped: [] });
  });

  it('следствие без источников и без advisory не принимается по умолчанию', () => {
    expect(classify({ odd: { severity: 'high', via: [] } }, ACCEPTED).blocking).toEqual([
      'odd (high): см. npm audit',
    ]);
  });

  it('взаимная ссылка без принятого источника не зацикливается и блокирует', () => {
    const result = classify(
      {
        a: { severity: 'high', via: ['b'] },
        b: { severity: 'high', via: ['a'] },
      },
      ACCEPTED
    );
    expect(result.blocking).toHaveLength(2);
  });
});

describe('переопределения в package.json', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

  it('postcss переопределён той же версией, что стоит в devDependencies', () => {
    // Ссылку "$postcss" npm 10 не разрешает, поэтому версия записана дважды
    // и может разойтись. Разошлась — поправить обе строки вместе
    expect(pkg.overrides.postcss).toBe(pkg.devDependencies.postcss);
  });
});
