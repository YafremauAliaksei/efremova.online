import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, auditLabel, entityTypeOf, type AuditAction } from './actions';
import { type AuditRow, canonicalJson, hashEntry, verifyChain } from './chain';

function chain(count: number): AuditRow[] {
  const rows: AuditRow[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i++) {
    const entry = {
      actorId: 'owner',
      action: 'block.text',
      entityType: 'block',
      entityId: `id-${String(i)}`,
      metadata: { page: 'home', locale: 'ru', n: i },
      createdAt: new Date(Date.UTC(2026, 9, 7, 9, 0, i)),
    };
    const rowHash = hashEntry(entry, prev);
    rows.push({ ...entry, id: String(i), prevHash: prev, rowHash });
    prev = rowHash;
  }
  return rows;
}

function at(rows: AuditRow[], index: number): AuditRow {
  const row = rows[index];
  if (row === undefined) throw new Error(`нет строки ${String(index)}`);
  return row;
}

describe('canonicalJson', () => {
  it('не зависит от порядка ключей — jsonb в Postgres его не хранит', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 'x'], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [1, 'x'] }, b: 1 })
    );
  });

  it('пропускает undefined, как JSON.stringify', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe('verifyChain', () => {
  it('целая цепочка сходится и отдаёт последний хеш', () => {
    const rows = chain(5);
    expect(verifyChain(rows)).toEqual({ ok: true, count: 5, lastHash: rows[4]?.rowHash });
  });

  it('пустой журнал — цел', () => {
    expect(verifyChain([])).toEqual({ ok: true, count: 0, lastHash: null });
  });

  it('правка содержимого записи видна на ней самой', () => {
    const rows = chain(5);
    rows[2] = { ...at(rows, 2), metadata: { page: 'home', locale: 'pl', n: 2 } };
    expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAt: '2' });
  });

  it('правка времени записи видна', () => {
    const rows = chain(3);
    rows[1] = { ...at(rows, 1), createdAt: new Date(Date.UTC(2020, 0, 1)) };
    expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAt: '1' });
  });

  it('удаление записи из середины видно на следующей', () => {
    const rows = chain(5);
    rows.splice(2, 1);
    expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAt: '3' });
  });

  it('пересчёт хеша одной записи не спасает: рвётся связь со следующей', () => {
    const rows = chain(4);
    const forged = { ...at(rows, 1), action: 'page.archive' };
    rows[1] = { ...forged, rowHash: hashEntry(forged, forged.prevHash) };
    expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAt: '2' });
  });

  it('удаление первой записи видно: у новой первой есть prevHash', () => {
    expect(verifyChain(chain(3).slice(1))).toMatchObject({ ok: false, brokenAt: '1' });
  });
});

describe('список действий', () => {
  it('тип записи — часть имени до точки', () => {
    expect(entityTypeOf('price.set')).toBe('price');
    expect(entityTypeOf('session.login')).toBe('session');
  });

  it('у каждого действия есть подпись', () => {
    for (const action of Object.keys(AUDIT_ACTIONS) as AuditAction[]) {
      expect(auditLabel(action)).not.toBe(action);
    }
  });

  it('неизвестное действие показывается как есть, а не прячется', () => {
    expect(auditLabel('toString')).toBe('toString');
    expect(auditLabel('legacy.thing')).toBe('legacy.thing');
  });
});
