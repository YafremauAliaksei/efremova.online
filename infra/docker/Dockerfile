# syntax=docker/dockerfile:1.7
# ═══════════════════════════════════════════════════════════════════════════
#  СБОРКА ОБРАЗА
#
#  ── КАК ЧИТАТЬ ЭТОТ ФАЙЛ ─────────────────────────────────────────────────
#  Docker собирает образ слоями. Каждая строка RUN/COPY — отдельный слой.
#  При повторной сборке Docker переиспользует слой, если НИЧЕГО из того,
#  что в него входит, не изменилось. Но если один слой изменился, все
#  последующие пересобираются заново.
#
#  Отсюда главное правило: СНАЧАЛА ТО, ЧТО МЕНЯЕТСЯ РЕДКО.
#
#      package.json (меняется раз в месяц)  ─► слой с зависимостями
#      исходный код (меняется каждый час)   ─► слой со сборкой
#
#  Если поменять порядок и скопировать код до установки зависимостей,
#  то правка одной буквы в тексте заставит заново скачивать сотни мегабайт.
#  Именно так выглядит «пересборка на гигабайты».
#
#  ── ДВА ДОПОЛНИТЕЛЬНЫХ ПРИЁМА ────────────────────────────────────────────
#  1. Кэш npm (--mount=type=cache). Скачанные пакеты остаются на диске
#     между сборками и НЕ попадают в образ. Даже когда package.json
#     изменился, npm берёт файлы из кэша, а не из сети.
#  2. Многоэтапность. Инструменты сборки остаются в промежуточных этапах,
#     в финальный образ переезжает только результат.
# ═══════════════════════════════════════════════════════════════════════════

# ─── Этап 1: зависимости ───
# Меняется только когда меняется package-lock.json
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Копируются ТОЛЬКО файлы зависимостей — не весь проект.
# Правка страницы сайта этот слой не затрагивает.
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Начиная с Prisma 7 путь к схеме и настройки миграций живут здесь, а не
# в package.json. Без этого файла `prisma generate` ниже работает на настройках
# по умолчанию — то есть случайно, а не потому что мы так решили.
COPY prisma.config.ts ./

# npm ci вместо npm install: ставит ТОЧНО те версии, что в lock-файле.
# Кэш npm живёт вне образа и переживает пересборки.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts && npx prisma generate

# ─── Этап 2: сборка приложения ───
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
# Здесь код копируется целиком — но это последний слой, и ниже него
# ничего тяжёлого нет. Что именно НЕ копируется, задано в .dockerignore.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ─── Этап 3: то, что реально поедет на сервер ───
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ⚠️ ВАЖНО ДЛЯ БЕЗОПАСНОСТИ: убираем из рабочего образа то, что ему не нужно.
#
# 1. apk upgrade — свежие системные библиотеки (openssl и прочее).
#    Базовый образ обновляется не каждый день, а уязвимости выходят чаще.
# 2. Удаление npm. Приложению он не нужен: зависимости уже установлены.
#    А внутри npm живут десятки его собственных библиотек, в которых
#    регулярно находят уязвимости — и сканер справедливо на них ругается.
#    Заодно это лишает возможного взломщика установщика пакетов внутри
#    контейнера. Проверено: убирает 11 находок Trivy из 13.
RUN apk upgrade --no-cache \
 && apk add --no-cache dumb-init \
 && rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Копируется только результат сборки (output: 'standalone'):
# Next.js сам отбирает нужные файлы зависимостей, остальное остаётся
# в промежуточном этапе и в образ не попадает.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

# dumb-init корректно обрабатывает сигнал остановки: контейнер завершается
# штатно, а не обрывается посреди транзакции
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
