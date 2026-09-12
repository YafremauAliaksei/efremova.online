import 'server-only';
import { PrismaClient } from '@prisma/client';

/**
 * Единственный экземпляр клиента базы данных.
 *
 * Зачем глобальная переменная: в режиме разработки Next.js перезагружает
 * модули при каждом изменении файла. Без этой защиты за час работы
 * накопились бы сотни подключений, и PostgreSQL отказал бы в новых.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // В проде пишем только ошибки: запросы могут содержать персональные данные
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
