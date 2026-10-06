import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Тесты понимают тот же алиас @/…, что и приложение (tsconfig.json, paths).
 * Без него модули с импортами через @/ (сессия админки, база) нельзя
 * проверить тестом — только относительными путями, которых в них нет.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
