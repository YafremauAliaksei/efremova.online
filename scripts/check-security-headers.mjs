#!/usr/bin/env node
/**
 * Проверка заголовков безопасности.
 *
 * Зачем отдельный скрипт, если есть ZAP: ZAP даёт много ложных срабатываний,
 * поэтому он у нас не блокирует сборку. А вот пропавший CSP или HSTS —
 * это стопроцентная дыра без вариантов трактовки. Такую проверку можно
 * и нужно делать блокирующей.
 *
 * Запуск:  node scripts/check-security-headers.mjs https://efremova.online
 */

const target = process.argv[2] ?? 'http://localhost:3000';

/** @type {{ name: string, required: boolean, check: (v: string | null) => string | null }[]} */
const RULES = [
  {
    name: 'content-security-policy',
    required: true,
    check: (v) => {
      if (v === null) return 'заголовок отсутствует';
      if (!v.includes("frame-ancestors 'none'")) return "нет frame-ancestors 'none' (clickjacking)";
      if (!v.includes("object-src 'none'")) return "нет object-src 'none'";
      if (!v.includes("base-uri 'none'")) return "нет base-uri 'none'";
      if (v.includes('script-src') && v.includes("'unsafe-inline'") && !v.includes('nonce-')) {
        return "script-src содержит 'unsafe-inline' без nonce — защита от XSS не работает";
      }
      if (!v.includes('nonce-')) return 'нет nonce в script-src';
      return null;
    },
  },
  {
    name: 'strict-transport-security',
    required: true,
    check: (v) => {
      if (v === null) return 'заголовок отсутствует';
      const match = /max-age=(\d+)/.exec(v);
      const maxAge = match?.[1] !== undefined ? Number(match[1]) : 0;
      if (maxAge < 31536000) return `max-age=${String(maxAge)}, требуется минимум 31536000 (1 год)`;
      if (!v.includes('includeSubDomains')) return 'нет includeSubDomains';
      return null;
    },
  },
  {
    name: 'x-content-type-options',
    required: true,
    check: (v) => (v === 'nosniff' ? null : `ожидалось "nosniff", получено "${String(v)}"`),
  },
  {
    name: 'x-frame-options',
    required: true,
    check: (v) => (v === 'DENY' ? null : `ожидалось "DENY", получено "${String(v)}"`),
  },
  {
    name: 'referrer-policy',
    required: true,
    check: (v) =>
      v !== null && ['strict-origin-when-cross-origin', 'no-referrer'].includes(v)
        ? null
        : `небезопасное значение "${String(v)}"`,
  },
  {
    name: 'permissions-policy',
    required: true,
    check: (v) => {
      if (v === null) return 'заголовок отсутствует';
      for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
        if (!v.includes(`${feature}=()`)) return `${feature} не отключён явно`;
      }
      return null;
    },
  },
  {
    name: 'cross-origin-opener-policy',
    required: true,
    check: (v) => (v === 'same-origin' ? null : `ожидалось "same-origin", получено "${String(v)}"`),
  },
  {
    name: 'x-powered-by',
    required: false,
    check: (v) => (v === null ? null : `заголовок раскрывает стек: "${v}" — должен быть удалён`),
  },
];

/**
 * Закрытая зона не должна кэшироваться и индексироваться.
 *
 * ⚠️ ИСТОРИЯ ЭТОЙ ФУНКЦИИ — ПОУЧИТЕЛЬНАЯ.
 *
 * Раньше здесь проверялся /cabinet. После того как кабинет вырезали, такого
 * адреса не стало, и Next.js начал отдавать на него обычную страницу 404.
 * А страница 404 в Next.js по умолчанию несёт Cache-Control: no-store —
 * и проверка продолжила проходить, НИЧЕГО НЕ ПРОВЕРЯЯ. Зелёная галочка
 * утверждала, что закрытая зона защищена, хотя проверяла отсутствие страницы.
 *
 * Отсюда правило: проверка обязана падать, если проверяемого больше нет.
 * Ниже статус ответа проверяется явно — 404 теперь считается провалом.
 */
async function checkPrivateArea(baseUrl) {
  const path = '/admin';
  const response = await fetch(new URL(path, baseUrl), { redirect: 'manual' });
  const problems = [];

  // Без cookie middleware обязан увести на /admin/denied. Ответ 404 означает,
  // что маршрут исчез, а проверка смотрит в пустоту.
  if (response.status === 404) {
    problems.push(`${path}: адрес не существует (404) — проверять нечего, почините проверку`);
    return problems;
  }

  const cacheControl = response.headers.get('cache-control');
  if (cacheControl === null || !cacheControl.includes('no-store')) {
    problems.push(`${path}: Cache-Control="${String(cacheControl)}" — обязателен no-store`);
  }

  const robots = response.headers.get('x-robots-tag');
  if (robots === null || !robots.includes('noindex')) {
    problems.push(`${path}: нет X-Robots-Tag: noindex — страница может попасть в Google`);
  }

  return problems;
}

async function main() {
  console.log(`\n🔍 Проверка заголовков безопасности: ${target}\n`);

  let response;
  try {
    response = await fetch(target, { redirect: 'manual' });
  } catch (error) {
    console.error(`❌ Не удалось подключиться: ${String(error)}`);
    process.exit(1);
  }

  const failures = [];
  const warnings = [];

  for (const rule of RULES) {
    const value = response.headers.get(rule.name);
    const problem = rule.check(value);

    if (problem === null) {
      console.log(`  ✅ ${rule.name}`);
    } else if (rule.required) {
      console.log(`  ❌ ${rule.name} — ${problem}`);
      failures.push(`${rule.name}: ${problem}`);
    } else {
      console.log(`  ⚠️  ${rule.name} — ${problem}`);
      warnings.push(`${rule.name}: ${problem}`);
    }
  }

  console.log('\n🔒 Проверка личного кабинета\n');
  const privateProblems = await checkPrivateArea(target);
  if (privateProblems.length === 0) {
    console.log('  ✅ Кэширование и индексация закрыты');
  } else {
    for (const problem of privateProblems) {
      console.log(`  ❌ ${problem}`);
      failures.push(problem);
    }
  }

  console.log('\n' + '─'.repeat(60));
  if (failures.length > 0) {
    console.log(`❌ ПРОВАЛЕНО: ${String(failures.length)} критических проблем`);
    console.log('   Подробности: docs/03-security-policy.md, п.5\n');
    process.exit(1);
  }

  console.log(
    `✅ ПРОЙДЕНО${warnings.length > 0 ? ` (предупреждений: ${String(warnings.length)})` : ''}\n`
  );
}

await main();
