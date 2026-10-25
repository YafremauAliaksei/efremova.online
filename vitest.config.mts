import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Тесты понимают тот же алиас @/…, что и приложение (tsconfig.json, paths).
 * Без него модули с импортами через @/ (сессия админки, база) нельзя
 * проверить тестом — только относительными путями, которых в них нет.
 */
export default defineConfig({
  // tsconfig держит JSX как есть ("preserve"): его разбирает сборщик Next.js.
  // Тестам отрисовки публичных страниц (src/lib/public) JSX нужно превратить
  // в вызовы React самим — тем же автоматическим способом, что и Next
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
