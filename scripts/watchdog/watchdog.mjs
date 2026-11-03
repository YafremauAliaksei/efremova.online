#!/usr/bin/env node
/**
 * Сторож сервера — отдельный контейнер рядом с сайтом (docker-compose.yml).
 *
 * Раз в минуту: сайт снаружи (через Cloudflare) и изнутри, диск, память,
 * нагрузка, свежесть бэкапа. При сбое и восстановлении — сообщение во все
 * настроенные каналы (notify.mjs), раз в сутки — сводка, каждый круг —
 * пульс во внешний сервис, который заметит, если умер весь сервер.
 *
 * Зависимостей нет: только Node.js из того же закреплённого образа, что у
 * сайта. Доступа к Docker и к базе у сторожа нет — он смотрит снаружи,
 * как посетитель, и в /proc, как администратор.
 */

import { readFile, stat, statfs, writeFile, rename } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import {
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
import { configuredChannels, heartbeatUrl, sendAll } from './notify.mjs';

const INTERVAL_MS = 60_000;
const STATE_DIR = process.env.WATCHDOG_STATE_DIR ?? '/home/node';
const STATE_FILE = `${STATE_DIR}/state.json`;
const BACKUP_MARK = process.env.WATCHDOG_BACKUP_MARK ?? '/status/last-backup';

const env = process.env;
const thresholds = readThresholds(env);
const server = (env.WATCHDOG_NAME ?? 'сервер').slice(0, 40);
const { channels, problems } = configuredChannels(env);
const heartbeat = heartbeatUrl(env.ALERT_HEARTBEAT_URL);
const publicUrl = siteHealthUrl(env.APP_URL);
const internalUrl = 'http://app:3000/api/health';

/** @returns {Promise<{ status: number, ms: number, challenged: boolean } | { error: string }>} */
async function probe(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'efremova-watchdog' },
    });
    await response.arrayBuffer();
    return {
      status: response.status,
      ms: Date.now() - started,
      challenged: response.headers.has('cf-mitigated'),
    };
  } catch (error) {
    return { error: error instanceof Error && error.name === 'TimeoutError' ? 'таймаут' : 'сеть' };
  }
}

async function runChecks(now) {
  const results = [];
  if (publicUrl !== null) {
    results.push(judgeHttp('public', 'Сайт снаружи', await probe(publicUrl), thresholds.slowMs));
  }
  results.push(judgeHttp('app', 'Приложение', await probe(internalUrl), thresholds.slowMs));

  const disk = await statfs(STATE_DIR).then(diskUsedPercent, () => null);
  results.push(judgeLimit('disk', 'Диск', disk, thresholds.diskPercent, '%'));

  const memory = await readFile('/proc/meminfo', 'utf8').then(memoryUsedPercent, () => null);
  results.push(judgeLimit('memory', 'Память', memory, thresholds.memoryPercent, '%'));

  const load = await readFile('/proc/loadavg', 'utf8').then(loadAverage5, () => null);
  const cpus = availableParallelism();
  results.push(
    judgeLimit('load', `Нагрузка (ядер ${String(cpus)})`, load, cpus * thresholds.loadPerCpu, '')
  );

  if (env.WATCHDOG_BACKUP_CHECK !== 'off') {
    const mark = await stat(BACKUP_MARK).then(
      (s) => s.mtimeMs,
      () => null
    );
    results.push(judgeBackup(mark, now, thresholds.backupMaxHours));
  }
  return results;
}

async function loadState() {
  try {
    const parsed = JSON.parse(await readFile(STATE_FILE, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function saveState(state) {
  // Через временный файл: оборванная запись не портит состояние
  await writeFile(`${STATE_FILE}.tmp`, JSON.stringify(state));
  await rename(`${STATE_FILE}.tmp`, STATE_FILE);
}

async function ping(allOk) {
  if (heartbeat === null) return;
  // Healthchecks.io: /fail — «сторож жив, но есть сбой» — второй путь тревоги
  const url = allOk ? heartbeat : `${heartbeat.replace(/\/$/, '')}/fail`;
  await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    console.error('[watchdog] пульс не отправлен');
  });
}

async function tick() {
  const now = Date.now();
  const state = await loadState();
  const results = await runChecks(now);
  const decision = decide(state.checks ?? {}, results, now);

  const alert = formatAlert(server, decision);
  if (alert !== null) {
    console.log(alert);
    await sendAll(channels, alert);
  }

  let lastSummary = state.lastSummary;
  if (summaryDue(lastSummary, now, thresholds.summaryHourUtc)) {
    await sendAll(
      channels,
      `[${server}] Сводка за сутки\n${results.map((r) => `${r.ok ? '✅' : '❌'} ${r.text}`).join('\n')}`
    );
    lastSummary = now;
  }

  await saveState({ checks: decision.state, lastSummary });
  await ping(results.every((r) => r.ok));
}

/** Адрес проверки снаружи — из APP_URL; без него проверяется только изнутри */
function siteHealthUrl(appUrl) {
  try {
    const url = new URL('/api/health', appUrl);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

async function main() {
  const configured = channels.map((c) => c.name).join(', ') || 'нет';
  console.log(`[watchdog] запущен; каналы: ${configured}`);
  for (const problem of problems) console.error(`[watchdog] ${problem}`);
  if (channels.length === 0)
    console.error('[watchdog] ⚠️ ни одного канала оповещений — сбои увидит только журнал');

  // Сообщение о запуске: владелец видит, что каналы работают, — и узнаёт
  // о перезапуске сервера или сторожа
  const lines = [`[${server}] Сторож запущен`, ...problems.map((p) => `⚠️ ${p}`)];
  await sendAll(channels, lines.join('\n'));

  for (;;) {
    await tick().catch((error) => {
      console.error(
        `[watchdog] круг проверок упал: ${error instanceof Error ? error.message : 'ошибка'}`
      );
    });
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

await main();
