// ESLint 9 — «плоский» конфиг.
//
// Задача этого файла: сделать опасный код физически невозможным.
// Правила ниже — не вкусовщина, каждое закрывает конкретный класс уязвимостей,
// описанных в docs/03-security-policy.md.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'infra/**',
      '*.config.mjs',
      // Файл создаётся самим Next.js при сборке, править его нельзя
      'next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      security,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...security.configs.recommended.rules,

      // Правило detect-object-injection выключено сознательно.
      // Оно срабатывает на ЛЮБОЙ обращение вида obj[key] с переменным ключом —
      // то есть на десятки безобидных мест. Реальную проблему (обращение
      // к прототипу) у нас закрывают TypeScript со включённым
      // noUncheckedIndexedAccess и строгие типы ключей.
      // Шумное правило, которое все отключают комментариями, хуже,
      // чем выключенное осознанно и с объяснением.
      'security/detect-object-injection': 'off',

      // ─────────────────────────────────────────────────────────────
      // БЕЗОПАСНОСТЬ — нарушение блокирует сборку
      // ─────────────────────────────────────────────────────────────

      // Прямая вставка HTML = дверь для XSS. Нужен HTML из Markdown —
      // только через санитайзер в src/lib/security/sanitize.ts
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'dangerouslySetInnerHTML запрещён (XSS). HTML из Markdown — только через sanitizeHtml().',
        },
        {
          selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
          message:
            'Math.random предсказуем. Для OTP, токенов и nonce используйте crypto.randomInt / randomBytes.',
        },
      ],

      // eval и его родственники: выполнение произвольной строки как кода
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // Утечка персональных данных в логи. Разрешены warn и error —
      // они идут в структурированный логгер с фильтрацией полей.
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Обязательная обработка промисов: «повисшая» ошибка платежа —
      // это деньги, потерянные без следа в логах.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // any выключает всю проверку типов — главный источник багов в рантайме
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Неиспользуемые переменные часто = забытая логика. Префикс _ разрешён.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Строгое сравнение: '0' == 0 → true, это источник дыр в проверках прав
      eqeqeq: ['error', 'always'],

      // ─────────────────────────────────────────────────────────────
      // ПРОИЗВОДИТЕЛЬНОСТЬ — защита баллов Lighthouse (.lighthouserc.json)
      // ─────────────────────────────────────────────────────────────
      '@next/next/no-img-element': 'error', // только next/image: AVIF/WebP + размеры
      '@next/next/no-sync-scripts': 'error', // блокирует отрисовку
      '@next/next/no-page-custom-font': 'error', // шрифты только локально

      // ─────────────────────────────────────────────────────────────
      // ЗАПРЕТЫ НА УРОВНЕ ИМПОРТОВ
      // ─────────────────────────────────────────────────────────────
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'crypto',
              importNames: ['createCipher', 'createDecipher'],
              message: 'Устарело и небезопасно. Используйте createCipheriv (AES-256-GCM).',
            },
          ],
          patterns: [
            {
              group: ['**/prisma/client-raw*'],
              message: 'Сырой SQL запрещён. Используйте Prisma API — она параметризует запросы.',
            },
          ],
        },
      ],
    },
  },

  // Скрипты, сторож команд агента и тесты — утилиты командной строки.
  // Они не входят в tsconfig приложения, поэтому типизированные правила
  // для них отключаются: иначе ESLint не находит для них проект.
  {
    files: ['scripts/**/*.mjs', '.claude/hooks/**/*.mjs', '**/*.test.ts', '**/*.test.tsx'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      // Глобальные объекты Node.js: без этого линтер считает console и process
      // необъявленными переменными
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // Сид базы — консольная утилита, вывод в консоль для неё нормален
  {
    files: ['prisma/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Prettier идёт последним и выключает конфликтующие стилевые правила
  prettier
);
