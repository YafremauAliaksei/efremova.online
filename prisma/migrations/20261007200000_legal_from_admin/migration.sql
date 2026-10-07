-- Редакции правовых документов из админки (PROJECT_LOG, задача 10):
-- отметка нужна сиду, чтобы не затирать текст владельца образцом из кода
ALTER TABLE "legal_documents" ADD COLUMN "fromAdmin" BOOLEAN NOT NULL DEFAULT false;
