-- Журнал действий админки — только дописывается (PROJECT_LOG, задача 13).
--
-- Схема Prisma триггеров не описывает, поэтому они живут только здесь.
-- Запрет — в базе, а не в коде: ошибка или взлом приложения не должны
-- давать стереть следы. Правка, удаление и очистка таблицы падают с ошибкой.

CREATE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs: записи журнала нельзя менять или удалять (%)', TG_OP;
END;
$$;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
