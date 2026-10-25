-- Валюты, источники курсов и последний курс — в базе, а не в коде
-- (PROJECT_LOG, задача 9b). Какие валюты в редакторе цен, в каком порядке,
-- какая основная и откуда брать курс — меняется в админке, без выкладки.

CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "currencies_code_check" CHECK ("code" ~ '^[A-Z]{3}$')
);

CREATE TABLE "rate_sources" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_snapshots" (
    "source" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "rates" JSONB NOT NULL,
    "rateDate" TEXT NOT NULL,
    "fetchedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_snapshots_pkey" PRIMARY KEY ("source")
);

-- 50 валют: русскоязычный сегмент, вся Европа, Северная Америка и
-- крупные мировые. Только валюты с копейками — на этом держится арифметика
-- цен (isCurrencyCode); динар, лек, крона Исландии и иена — без копеек.
-- Сразу включены злотые, евро, белорусский и российский рубль.
INSERT INTO "currencies" ("code", "isEnabled", "sortOrder") VALUES
  ('PLN', true, 10),
  ('EUR', true, 20),
  ('BYN', true, 30),
  ('RUB', true, 40),
  ('USD', false, 50),
  ('GBP', false, 60),
  ('CHF', false, 70),
  ('UAH', false, 80),
  ('KZT', false, 90),
  ('UZS', false, 100),
  ('KGS', false, 110),
  ('TJS', false, 120),
  ('TMT', false, 130),
  ('AZN', false, 140),
  ('AMD', false, 150),
  ('GEL', false, 160),
  ('MDL', false, 170),
  ('CZK', false, 180),
  ('HUF', false, 190),
  ('RON', false, 200),
  ('BGN', false, 210),
  ('MKD', false, 220),
  ('BAM', false, 230),
  ('NOK', false, 240),
  ('SEK', false, 250),
  ('DKK', false, 260),
  ('TRY', false, 270),
  ('CAD', false, 280),
  ('AUD', false, 290),
  ('NZD', false, 300),
  ('CNY', false, 310),
  ('HKD', false, 320),
  ('SGD', false, 330),
  ('ILS', false, 340),
  ('AED', false, 350),
  ('INR', false, 360),
  ('MNT', false, 370),
  ('THB', false, 380),
  ('IDR', false, 390),
  ('MXN', false, 400),
  ('BRL', false, 410),
  ('ZAR', false, 420),
  ('SAR', false, 430),
  ('QAR', false, 440),
  ('EGP', false, 450),
  ('PHP', false, 460),
  ('MYR', false, 470),
  ('TWD', false, 480),
  ('ARS', false, 490),
  ('KES', false, 500);

-- Источники из кода, в порядке попыток. Выключить или переставить — в админке
INSERT INTO "rate_sources" ("id", "isEnabled", "sortOrder") VALUES
  ('nbp', true, 10),
  ('er-api', true, 20),
  ('floatrates', true, 30);

-- Основная валюта сайта и валюта, от которой считается подсказка курса
INSERT INTO "site_settings" ("key", "value", "updatedAt") VALUES
  ('currency.default', 'PLN', now()),
  ('currency.reference', 'EUR', now())
ON CONFLICT ("key") DO NOTHING;

-- Примерные курсы к евро — чтобы и при первом запуске, до первого запроса
-- к источнику, редактору цен было что показать. Админка подписывает их как
-- примерные; первый же полученный курс их заменяет на экране.
INSERT INTO "rate_snapshots" ("source", "base", "rates", "rateDate", "fetchedAt") VALUES
  ('seed', 'EUR', '{"PLN":4.25,"EUR":1,"USD":1.1,"GBP":0.85,"CHF":0.94,"RUB":95,"BYN":3.6,"UAH":46,"KZT":560,"UZS":14000,"KGS":96,"TJS":11.8,"TMT":3.85,"AZN":1.87,"AMD":430,"GEL":3,"MDL":19.5,"CZK":25,"HUF":400,"RON":5,"BGN":1.96,"MKD":61.5,"BAM":1.96,"NOK":11.7,"SEK":11.2,"DKK":7.46,"TRY":45,"CAD":1.55,"AUD":1.7,"NZD":1.9,"CNY":8,"HKD":8.6,"SGD":1.48,"ILS":4.1,"AED":4.05,"INR":95,"MNT":3900,"THB":37,"IDR":18000,"MXN":21,"BRL":6.2,"ZAR":20.5,"SAR":4.13,"QAR":4,"EGP":54,"PHP":63,"MYR":4.9,"TWD":35,"ARS":1300,"KES":142}', '2026-01-01', '2026-01-01T00:00:00Z');
