import { describe, expect, it } from 'vitest';
import {
  REMIND_EVERY_MS,
  decide,
  diskUsedPercent,
  formatAlert,
  judgeBackup,
  judgeHttp,
  judgeLimit,
  loadAverage5,
  memoryUsedPercent,
  readThresholds,
  summaryDue,
} from './checks.mjs';

describe('измерения', () => {
  it('память из /proc/meminfo', () => {
    const text = 'MemTotal:        8000000 kB\nMemFree:  100 kB\nMemAvailable:    2000000 kB\n';
    expect(memoryUsedPercent(text)).toBe(75);
    expect(memoryUsedPercent('мусор')).toBeNull();
  });

  it('нагрузка за 5 минут из /proc/loadavg', () => {
    expect(loadAverage5('0.50 1.25 2.00 1/300 4242\n')).toBe(1.25);
    expect(loadAverage5('')).toBeNull();
  });

  it('диск по statfs', () => {
    expect(diskUsedPercent({ blocks: 1000, bavail: 100 })).toBe(90);
    expect(diskUsedPercent({ blocks: 0, bavail: 0 })).toBeNull();
  });

  it('испорченный порог не выключает проверку', () => {
    const t = readThresholds({ WATCHDOG_DISK_PERCENT: 'сто', WATCHDOG_MEMORY_PERCENT: '500' });
    expect(t.diskPercent).toBe(85);
    expect(t.memoryPercent).toBe(90);
  });
});

describe('оценка проверок', () => {
  it('адрес: нет ответа, ошибка, медленно, ок, проверка Cloudflare', () => {
    expect(judgeHttp('a', 'Сайт', { error: 'таймаут' }, 5000).ok).toBe(false);
    expect(judgeHttp('a', 'Сайт', { status: 502, ms: 10, challenged: false }, 5000).ok).toBe(false);
    expect(
      judgeHttp('a', 'Сайт', { status: 200, ms: 9000, challenged: false }, 5000).text
    ).toContain('медленно');
    expect(judgeHttp('a', 'Сайт', { status: 200, ms: 90, challenged: false }, 5000).ok).toBe(true);
    expect(judgeHttp('a', 'Сайт', { status: 403, ms: 90, challenged: true }, 5000).ok).toBe(true);
  });

  it('порог и неизмеримое значение', () => {
    expect(judgeLimit('disk', 'Диск', 91, 85, '%').ok).toBe(false);
    expect(judgeLimit('disk', 'Диск', 40, 85, '%').ok).toBe(true);
    expect(judgeLimit('disk', 'Диск', null, 85, '%').ok).toBe(false);
  });

  it('бэкап: свежий, старый, ни одного', () => {
    const now = Date.UTC(2026, 10, 3, 12);
    expect(judgeBackup(now - 3 * 3_600_000, now, 26).ok).toBe(true);
    expect(judgeBackup(now - 30 * 3_600_000, now, 26).ok).toBe(false);
    expect(judgeBackup(null, now, 26).ok).toBe(false);
  });
});

describe('кому и что сообщить', () => {
  const ok = { id: 'disk', ok: true, text: 'Диск: 40%' };
  const bad = { id: 'disk', ok: false, text: 'Диск: 91%' };

  it('первый круг: о сбое — да, о норме — нет', () => {
    expect(decide({}, [bad], 0).failed).toEqual(['Диск: 91%']);
    expect(formatAlert('ноутбук', decide({}, [ok], 0))).toBeNull();
  });

  it('сбой держится — молчим до напоминания', () => {
    const first = decide({}, [bad], 0);
    expect(decide(first.state, [bad], 60_000).reminders).toEqual([]);
    expect(decide(first.state, [bad], REMIND_EVERY_MS).reminders).toEqual(['Диск: 91%']);
  });

  it('восстановление сообщается', () => {
    const first = decide({}, [bad], 0);
    const second = decide(first.state, [ok], 60_000);
    expect(second.recovered).toEqual(['Диск: 40%']);
    expect(formatAlert('ноутбук', second)).toContain('Восстановлено');
  });
});

describe('сводка', () => {
  it('раз в сутки в заданный час UTC', () => {
    const at7 = Date.UTC(2026, 10, 3, 7, 5);
    expect(summaryDue(undefined, at7, 7)).toBe(true);
    expect(summaryDue(at7, at7 + 60_000, 7)).toBe(false);
    expect(summaryDue(at7 - 86_400_000, at7, 7)).toBe(true);
    expect(summaryDue(undefined, Date.UTC(2026, 10, 3, 8), 7)).toBe(false);
  });
});
