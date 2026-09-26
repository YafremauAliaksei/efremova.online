-- ═══════════════════════════════════════════════════════════════════════════
--  Страницы из блоков (docs/13, п.4)
--
--  Было: тексты — строки content_blocks с ключами hero.main, about.main…,
--  а какие блоки на какой странице стоят, решал код.
--  Стало: страницы (pages) и их блоки (page_blocks) в базе; тип блока
--  объявлен в коде, содержимое на трёх языках — в одном JSON блока.
--  Каждое сохранение блока кладёт прежнее содержимое в block_revisions.
--
--  Тексты владельца переносятся из content_blocks, а не создаются заново:
--  ни одна правка, сделанная в админке, не теряется. Порядок и оформление
--  блоков повторяют прежнюю вёрстку главной и страницы «Обо мне».
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "titleI18n" JSONB NOT NULL DEFAULT '{}',
    "descriptionI18n" JSONB NOT NULL DEFAULT '{}',
    "showInHeader" BOOLEAN NOT NULL DEFAULT false,
    "showInFooter" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_blocks" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL DEFAULT '{}',
    "data" JSONB NOT NULL DEFAULT '{}',
    "style" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "page_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_revisions" (
    "id" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "style" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_isPublished_sortOrder_idx" ON "pages"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "page_blocks_pageId_sortOrder_idx" ON "page_blocks"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "block_revisions_blockId_createdAt_idx" ON "block_revisions"("blockId", "createdAt");

-- AddForeignKey
ALTER TABLE "page_blocks" ADD CONSTRAINT "page_blocks_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_revisions" ADD CONSTRAINT "block_revisions_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "page_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Перенос: страницы ───
-- Только если переносить есть что. На чистой базе страниц здесь не
-- появляется: их создаёт сид с демо-текстами (иначе сид увидел бы
-- готовые, но пустые блоки и не стал бы их заполнять).
INSERT INTO "pages" ("id", "slug", "titleI18n", "descriptionI18n", "showInHeader", "showInFooter", "sortOrder", "updatedAt")
SELECT gen_random_uuid(), v.slug, v.title, v.description, true, true, v.sort, CURRENT_TIMESTAMP
FROM (VALUES
    ('home',
     '{"ru": "Главная", "pl": "Strona główna", "en": "Home"}'::jsonb,
     '{}'::jsonb,
     0),
    ('about',
     '{"ru": "Обо мне", "pl": "O mnie", "en": "About me"}'::jsonb,
     '{"ru": "Образование, опыт и подход к работе.", "pl": "Wykształcenie, doświadczenie i podejście do pracy.", "en": "Education, experience and approach."}'::jsonb,
     10)
) AS v(slug, title, description, sort)
WHERE EXISTS (SELECT 1 FROM "content_blocks");

-- ─── Перенос: блоки ───
-- Тексты собираются из content_blocks по ключу: по строке на язык → один
-- JSON вида {"ru": {"title": …, "body": …}, "pl": {…}}. Снятые с публикации
-- строки не переносятся — на сайте их и так не было.
INSERT INTO "page_blocks" ("id", "pageId", "type", "sortOrder", "content", "style", "updatedAt")
SELECT
    gen_random_uuid(),
    p."id",
    b.type,
    b.sort,
    COALESCE(
        (SELECT jsonb_object_agg(c."locale", jsonb_strip_nulls(jsonb_build_object('title', c."title", 'body', c."body")))
           FROM "content_blocks" c
          WHERE c."key" = b.key AND c."isPublished"),
        b.fallback
    ),
    b.style,
    CURRENT_TIMESTAMP
FROM (VALUES
    ('home',  'hero',     'hero.main',     0,  '{}'::jsonb, '{"align": "center"}'::jsonb),
    ('home',  'text',     'about.main',    10, '{}'::jsonb, '{"background": "tinted"}'::jsonb),
    ('home',  'text',     'approach.main', 20, '{}'::jsonb, '{}'::jsonb),
    ('home',  'services', NULL,            30,
        '{"ru": {"title": "Услуги"}, "pl": {"title": "Usługi"}, "en": {"title": "Services"}}'::jsonb,
        '{"background": "tinted"}'::jsonb),
    ('home',  'cta',      'cta.main',      40, '{}'::jsonb, '{"align": "center"}'::jsonb),
    ('about', 'text',     'about.main',    0,  '{}'::jsonb, '{}'::jsonb),
    ('about', 'text',     'approach.main', 10, '{}'::jsonb, '{}'::jsonb)
) AS b(page, type, key, sort, fallback, style)
JOIN "pages" p ON p."slug" = b.page;

-- Кнопка «Услуги и цены» под текстом «Обо мне» — как в прежней вёрстке
INSERT INTO "page_blocks" ("id", "pageId", "type", "sortOrder", "content", "data", "style", "updatedAt")
SELECT gen_random_uuid(), p."id", 'cta', 20,
       '{"ru": {"button": "Услуги и цены"}, "pl": {"button": "Usługi i ceny"}, "en": {"button": "Services and prices"}}',
       '{"link": "services"}',
       '{}',
       CURRENT_TIMESTAMP
  FROM "pages" p WHERE p."slug" = 'about';

-- ─── Старая таблица больше не нужна: всё перенесено выше ───
DROP TABLE "content_blocks";
