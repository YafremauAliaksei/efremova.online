# ═══════════════════════════════════════════════════════════════════════════
#  Многоэтапная сборка образа.
#
#  Смысл «многоэтапности»: инструменты сборки (компилятор, dev-зависимости)
#  нужны только во время сборки. В финальный образ они не попадают.
#  Результат: ~180 МБ вместо ~1,2 ГБ и в разы меньше поверхность атаки —
#  нечего эксплуатировать, если внутри нет ни компилятора, ни shell-утилит.
# ═══════════════════════════════════════════════════════════════════════════

# ─── Этап 1: зависимости ───
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# npm ci вместо npm install: ставит ТОЧНО те версии, что в lock-файле.
# Это защита от подмены версии зависимости между сборками.
RUN npm ci --ignore-scripts && npx prisma generate

# ─── Этап 2: сборка ───
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ─── Этап 3: то, что реально поедет на сервер ───
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# dumb-init корректно обрабатывает сигнал остановки: контейнер завершается
# штатно, а не обрывается посреди транзакции.
# Ставится ДО переключения пользователя — потом прав на установку уже не будет.
RUN apk add --no-cache dumb-init

# Приложение работает от непривилегированного пользователя.
# Если его всё же взломают — прав root внутри контейнера не будет.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Копируем только то, что нужно для запуска (output: 'standalone')
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
