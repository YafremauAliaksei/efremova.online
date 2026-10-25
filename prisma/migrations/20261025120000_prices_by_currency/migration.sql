-- Цены по валютам вместо цен по стране посетителя (PROJECT_LOG, задача 9a).
--
-- Публичная страница одна на всех и лежит в общем кэше Cloudflare (docs/14):
-- страна посетителя её не меняет. Теперь у услуги одна действующая цена на
-- каждую валюту, посетитель выбирает валюту сам.
--
-- 1. Цены стран становятся ценами своих валют. Сайт ещё не запущен, цены
--    стран — образцы из сида; ни одна строка истории не теряется, кроме
--    точных дублей (та же услуга, валюта и начало действия).
DELETE FROM "service_prices" p
USING (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "serviceId", "currency", "validFrom"
           ORDER BY ("region" = 'DEFAULT') DESC, "id"
         ) AS n
  FROM "service_prices"
) d
WHERE p."id" = d."id" AND d.n > 1;

-- 2. В одной валюте действует одна цена: более ранняя закрывается началом
--    следующей — так же, как это делает админка при новой цене.
WITH ordered AS (
  SELECT "id",
         LEAD("validFrom") OVER (
           PARTITION BY "serviceId", "currency" ORDER BY "validFrom", "id"
         ) AS next_from
  FROM "service_prices"
)
UPDATE "service_prices" p
SET "validTo" = o.next_from
FROM ordered o
WHERE p."id" = o."id"
  AND o.next_from IS NOT NULL
  AND (p."validTo" IS NULL OR p."validTo" > o.next_from);

DROP INDEX "service_prices_region_currency_idx";
DROP INDEX "service_prices_serviceId_region_currency_validFrom_key";
ALTER TABLE "service_prices" DROP COLUMN "region";
CREATE UNIQUE INDEX "service_prices_serviceId_currency_validFrom_key"
  ON "service_prices"("serviceId", "currency", "validFrom");

-- 3. История цен публична и неизменна, как редакции договора: при споре
--    важна цена, которую человек видел тогда (docs/03 п.7). Запрет — в базе,
--    а не в коде: ошибка или взлом приложения не перепишут прошлое.
--
--    Разрешено ровно одно изменение — закрыть действующую цену датой
--    (validTo из пустого в момент не раньше начала). Так админка заменяет
--    цену новой и убирает валюту. Сумма, валюта, начало — не меняются никогда.
--    Новая цена начинается не в прошлом: задним числом историю не дописать.
CREATE FUNCTION service_prices_history_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."validFrom" < now() - interval '5 minutes' OR NEW."validTo" IS NOT NULL THEN
      RAISE EXCEPTION 'service_prices: новая цена начинается сейчас и без даты окончания';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD."validTo" IS NULL
     AND NEW."validTo" IS NOT NULL
     AND NEW."validTo" >= OLD."validFrom"
     AND NEW."id" = OLD."id"
     AND NEW."serviceId" = OLD."serviceId"
     AND NEW."currency" = OLD."currency"
     AND NEW."amountMinor" = OLD."amountMinor"
     AND NEW."validFrom" = OLD."validFrom" THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'service_prices: историю цен нельзя менять или удалять (%) — новая цена закрывает прежнюю датой', TG_OP;
END;
$$;

CREATE TRIGGER service_prices_history_only
  BEFORE INSERT OR UPDATE OR DELETE ON "service_prices"
  FOR EACH ROW EXECUTE FUNCTION service_prices_history_only();

CREATE TRIGGER service_prices_no_truncate
  BEFORE TRUNCATE ON "service_prices"
  FOR EACH STATEMENT EXECUTE FUNCTION service_prices_history_only();
