-- Отзывы (PROJECT_LOG, задача 8): язык, порядок и дата согласия автора.
ALTER TABLE "testimonials" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru',
ADD COLUMN "consentAt" TIMESTAMPTZ,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Отзыв без записанного согласия не показывается: до этой миграции даты
-- согласия не было ни у одного отзыва, поэтому все они скрываются
UPDATE "testimonials" SET "isPublished" = false WHERE "consentAt" IS NULL;

-- Запрет — в базе: ошибка в коде админки не должна показать на сайте
-- отзыв, на который автор не давал согласия (ст. 9 GDPR)
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_published_needs_consent"
  CHECK (NOT "isPublished" OR "consentAt" IS NOT NULL);
