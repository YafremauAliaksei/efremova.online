/**
 * Версия Node — одно значение на всех (PROJECT_LOG, T.3): .nvmrc.
 *
 * CI читает его сам (setup-node, node-version-file), а образ Docker и поле
 * engines прочитать его не могут — там номер записан ещё раз. Тест следит,
 * чтобы копии не разъехались: иначе сайт снова собирался бы одной версией
 * в CI, другой в образе и третьей на машине разработчика.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const major = read('.nvmrc').trim();

describe('версия Node — одна', () => {
  it('.nvmrc — номер мажорной версии', () => {
    expect(major).toMatch(/^\d+$/);
  });

  it('образ Docker — та же версия, закреплённая по хешу', () => {
    const froms = [...read('infra/docker/Dockerfile').matchAll(/^FROM node:(\S+)/gm)];
    expect(froms.length).toBeGreaterThan(0);
    for (const [, image] of froms) expect(image.startsWith(`${major}-alpine@sha256:`)).toBe(true);
  });

  it('engines и @types/node — та же версия', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.engines.node).toBe(`>=${major}.0.0`);
    expect(pkg.devDependencies['@types/node'].startsWith(`^${major}.`)).toBe(true);
  });

  it('CI берёт версию из .nvmrc, а не пишет свою', () => {
    const workflows = read('.github/workflows/ci-security.yml');
    expect(workflows).not.toMatch(/node-version:/);
    expect(workflows).toMatch(/node-version-file: \.nvmrc/);
  });
});
