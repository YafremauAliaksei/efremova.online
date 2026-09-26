import type { LegalDocumentSeed } from './types';

/**
 * ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ сайта-визитки — ОБРАЗЕЦ.
 *
 * ⚠️ Не юридический текст. Структура следует ст. 13 GDPR и карте данных
 * (docs/03 п.11.2): каждое место, куда попадают данные посетителя, названо
 * здесь с целью, основанием и сроком. Данные владельца — метками {{owner.*}},
 * вопросы юристу — пометками ⟦ЮРИСТ: …⟧. До начала практики текст проверяет
 * юрист (docs/03 п.11.3).
 *
 * Описано только то, что есть в коде сейчас: сайт без форм, аккаунтов,
 * аналитики и рекламы. Кабинет, запись и оплата — на отдельном поддомене,
 * у них будет своя политика.
 *
 * Польская версия — основная; русская и английская — переводы.
 */

const VERSION = 'privacy-2026-09-26-draft';

export const PRIVACY_DOCUMENTS: LegalDocumentSeed[] = [
  // ═══════════════════════ POLITYKA PRYWATNOŚCI (PL) ═══════════════════════
  {
    slug: 'privacy',
    locale: 'pl',
    version: VERSION,
    title: 'Polityka prywatności',
    sections: [
      {
        heading: '1. Administrator danych',
        paragraphs: [
          'Administratorem Twoich danych osobowych jest {{owner.fullName}}, {{owner.address}}, NIP {{owner.nip}}.',
          'W sprawach ochrony danych osobowych możesz pisać na adres {{owner.privacyEmail}}.',
          'Administrator nie wyznaczył inspektora ochrony danych. ⟦ЮРИСТ: potwierdzić, że art. 37 RODO nie wymaga wyznaczenia IOD⟧',
        ],
      },
      {
        heading: '2. Czego dotyczy ta polityka',
        paragraphs: [
          'Polityka dotyczy serwisu informacyjnego pod tym adresem. Serwis nie ma kont użytkowników, formularzy, analityki ani reklam. Czcionki, obrazy i skrypty pochodzą wyłącznie z tej domeny — Twoja przeglądarka nie łączy się z żadnym innym serwisem, dopóki sam(a) nie klikniesz odnośnika do komunikatora lub poczty.',
        ],
      },
      {
        heading: '3. Jakie dane przetwarzamy, w jakim celu i jak długo',
        items: [
          'Dane techniczne przy każdym wejściu na stronę — adres IP, data i godzina, adres podstrony, typ przeglądarki, strona odsyłająca, kraj ustalony przez sieć CDN. Cel: działanie i bezpieczeństwo serwisu, diagnostyka błędów. Podstawa: prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO). Okres: 14 dni w dziennikach serwera.',
          'Dziennik bezpieczeństwa — adres IP, typ przeglądarki i adres żądania, gdy żądanie wygląda na próbę ataku lub skanowania. Cel: ochrona serwisu. Podstawa: prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO). Okres: 60 dni; czasowa blokada adresu — do 60 dni od ostatniego zdarzenia.',
          'Kontakt z nami — dane, które sam(a) podasz w wiadomości e-mail, SMS lub w komunikatorze, oraz treść wiadomości. Cel: odpowiedź na zapytanie i ustalenie terminu konsultacji. Podstawa: działania przed zawarciem umowy na Twoje żądanie (art. 6 ust. 1 lit. b RODO), w pozostałym zakresie prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO). Okres: do zakończenia sprawy, a następnie ⟦ЮРИСТ: okres przechowywania korespondencji⟧.',
          'Kopie zapasowe — zaszyfrowane kopie bazy danych serwisu. Cel: odtworzenie serwisu po awarii. Podstawa: prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO). Okres: 30 dni. Dlatego dane z dziennika bezpieczeństwa mogą pozostawać w kopiach do 90 dni.',
        ],
        paragraphs: [
          'Prosimy nie przesyłać w pierwszej wiadomości informacji o swoim zdrowiu. Do ustalenia terminu wystarczą imię, preferowany termin i forma kontaktu.',
        ],
      },
      {
        heading: '4. Odbiorcy danych',
        items: [
          'Dostawca serwera: {{service.hosting}} — przechowuje serwis i dzienniki na podstawie umowy powierzenia przetwarzania danych.',
          'Cloudflare, Inc. (USA) — sieć dostarczania treści i ochrona przed atakami; przez jej serwery przechodzi ruch do serwisu. Działa na podstawie umowy powierzenia przetwarzania danych.',
          'Dostawca poczty: {{service.email}} — gdy piszesz do nas e-mail.',
          'Komunikatory (np. WhatsApp — Meta Platforms, Telegram, Viber) — gdy wybierzesz kontakt przez komunikator, jego dostawca przetwarza dane jako odrębny administrator, na własnych zasadach.',
          'Organy publiczne — wyłącznie wtedy, gdy wymaga tego prawo.',
        ],
      },
      {
        heading: '5. Przekazywanie danych poza Europejski Obszar Gospodarczy',
        paragraphs: [
          'Cloudflare, Inc. ma siedzibę w USA. Przekazanie odbywa się na podstawie decyzji Komisji Europejskiej z 10 lipca 2023 r. w sprawie ram ochrony danych UE–USA (Data Privacy Framework) oraz standardowych klauzul umownych. ⟦ЮРИСТ: potwierdzić certyfikację DPF Cloudflare na dzień publikacji⟧',
          'Dostawcy komunikatorów mogą przekazywać dane poza EOG na zasadach opisanych w swoich politykach prywatności.',
        ],
      },
      {
        heading: '6. Pliki cookie',
        anchor: 'cookies',
        paragraphs: [
          'Serwis nie używa plików cookie analitycznych, reklamowych ani śledzących. Używa wyłącznie plików niezbędnych technicznie, na które zgoda nie jest wymagana (art. 5 ust. 3 dyrektywy 2002/58/WE). ⟦ЮРИСТ: wskazać właściwy przepis Prawa komunikacji elektronicznej⟧',
        ],
        items: [
          '__cf_bm — Cloudflare; odróżnia ruch ludzi od automatów. Ważność: 30 minut.',
          'cf_clearance — Cloudflare; zapamiętuje przejście kontroli bezpieczeństwa, jeśli była wymagana. Ważność: ⟦ЮРИСТ: czas zgodny z ustawieniami Cloudflare⟧.',
          'lang — serwis; zapamiętuje wersję językową wybraną przełącznikiem języka. Zapisywany tylko po kliknięciu przełącznika. Ważność: 1 rok. ⟦ЮРИСТ: potwierdzić, że plik zapamiętujący wybór języka nie wymaga zgody⟧',
          '__Host-admin-session — tylko w panelu administratora; odwiedzający serwis go nie otrzymują. Ważność: 30 minut.',
        ],
      },
      {
        heading: '7. Twoje prawa',
        paragraphs: [
          'Masz prawo dostępu do swoich danych (art. 15 RODO), ich sprostowania (art. 16), usunięcia (art. 17), ograniczenia przetwarzania (art. 18) oraz przenoszenia danych przetwarzanych na podstawie umowy (art. 20).',
          'Masz prawo w każdej chwili wnieść sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie (art. 21 RODO). Wtedy przestaniemy przetwarzać dane, chyba że wykażemy ważne, prawnie uzasadnione podstawy przeważające nad Twoimi interesami.',
          'Odpowiadamy bez zbędnej zwłoki, najpóźniej w ciągu miesiąca. Napisz: {{owner.privacyEmail}}.',
          'Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.',
        ],
      },
      {
        heading: '8. Czy musisz podać dane',
        paragraphs: [
          'Podanie danych jest dobrowolne. Bez danych technicznych nie da się jednak wyświetlić strony, a bez danych kontaktowych nie możemy odpowiedzieć na wiadomość.',
        ],
      },
      {
        heading: '9. Zautomatyzowane decyzje',
        paragraphs: [
          'Nie podejmujemy decyzji wywołujących wobec Ciebie skutki prawne w sposób zautomatyzowany ani nie profilujemy (art. 22 RODO). Automatyczna czasowa blokada dotyczy adresu IP, z którego przychodzą próby ataku, a nie osoby. Jeśli blokada dotknęła Cię omyłkowo, napisz: {{owner.email}}.',
        ],
      },
      {
        heading: '10. Bezpieczeństwo',
        paragraphs: [
          'Połączenie z serwisem jest szyfrowane (TLS). Kopie zapasowe są szyfrowane. Serwis nie pobiera zasobów z innych domen. Dostęp do panelu administratora wymaga jednorazowego odnośnika ważnego 15 minut.',
        ],
      },
      {
        heading: '11. Zmiany polityki',
        paragraphs: [
          'Numer wersji i datę aktualizacji widzisz na górze strony. Poprzednie wersje są archiwizowane.',
        ],
      },
    ],
  },

  // ═══════════════════════ ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ (RU) ═══════════════════════
  {
    slug: 'privacy',
    locale: 'ru',
    version: VERSION,
    title: 'Политика конфиденциальности',
    sections: [
      {
        heading: '1. Кто обрабатывает данные',
        paragraphs: [
          'Администратор ваших персональных данных — {{owner.fullName}}, {{owner.address}}, NIP {{owner.nip}}.',
          'По вопросам персональных данных пишите на {{owner.privacyEmail}}.',
          'Инспектор по защите данных не назначен. ⟦ЮРИСТ: подтвердить, что ст. 37 GDPR не требует его назначения⟧',
          'Это перевод. При расхождении с польской версией действует польская.',
        ],
      },
      {
        heading: '2. О чём эта политика',
        paragraphs: [
          'Политика касается информационного сайта по этому адресу. На сайте нет учётных записей, форм, аналитики и рекламы. Шрифты, изображения и скрипты загружаются только с этого домена: ваш браузер не обращается ни к одному другому сервису, пока вы сами не перейдёте по ссылке на мессенджер или почту.',
        ],
      },
      {
        heading: '3. Какие данные, зачем и как долго',
        items: [
          'Технические данные при каждом посещении — IP-адрес, дата и время, адрес страницы, тип браузера, страница, с которой вы пришли, страна по данным сети доставки контента. Цель: работа и безопасность сайта, диагностика ошибок. Основание: законный интерес (ст. 6(1)(f) GDPR). Срок: 14 дней в журналах сервера.',
          'Журнал безопасности — IP-адрес, тип браузера и адрес запроса, если запрос похож на попытку атаки или сканирования. Цель: защита сайта. Основание: законный интерес (ст. 6(1)(f) GDPR). Срок: 60 дней; временная блокировка адреса — до 60 дней с последнего события.',
          'Обращение к нам — данные, которые вы сами сообщите в письме, SMS или мессенджере, и текст сообщения. Цель: ответ на обращение и согласование времени консультации. Основание: действия до заключения договора по вашему запросу (ст. 6(1)(b) GDPR), в остальном — законный интерес (ст. 6(1)(f)). Срок: до завершения вопроса, затем ⟦ЮРИСТ: срок хранения переписки⟧.',
          'Резервные копии — зашифрованные копии базы данных сайта. Цель: восстановление после сбоя. Основание: законный интерес (ст. 6(1)(f) GDPR). Срок: 30 дней. Поэтому данные журнала безопасности могут оставаться в копиях до 90 дней.',
        ],
        paragraphs: [
          'Пожалуйста, не пишите в первом сообщении о своём здоровье. Чтобы договориться о встрече, достаточно имени, удобного времени и способа связи.',
        ],
      },
      {
        heading: '4. Кто получает данные',
        items: [
          'Хостинг: {{service.hosting}} — хранит сайт и журналы по договору поручения обработки данных.',
          'Cloudflare, Inc. (США) — сеть доставки контента и защита от атак; через её серверы проходит трафик сайта. Работает по договору поручения обработки данных.',
          'Почтовый сервис: {{service.email}} — если вы пишете нам письмо.',
          'Мессенджеры (например, WhatsApp — Meta Platforms, Telegram, Viber) — если вы выбрали связь через мессенджер, его владелец обрабатывает данные как самостоятельный администратор по своим правилам.',
          'Государственные органы — только когда этого требует закон.',
        ],
      },
      {
        heading: '5. Передача данных за пределы Европейской экономической зоны',
        paragraphs: [
          'Cloudflare, Inc. находится в США. Передача основана на решении Европейской комиссии от 10 июля 2023 года о рамках защиты данных ЕС–США (Data Privacy Framework) и стандартных договорных условиях. ⟦ЮРИСТ: подтвердить сертификацию DPF у Cloudflare на дату публикации⟧',
          'Владельцы мессенджеров могут передавать данные за пределы ЕЭЗ по правилам своих политик конфиденциальности.',
        ],
      },
      {
        heading: '6. Файлы cookie',
        anchor: 'cookies',
        paragraphs: [
          'Сайт не использует cookie аналитики, рекламы или слежения. Используются только технически необходимые cookie, на которые согласие не требуется (ст. 5(3) директивы 2002/58/ЕС). ⟦ЮРИСТ: указать норму польского закона об электронной связи⟧',
        ],
        items: [
          '__cf_bm — Cloudflare; отличает людей от автоматических программ. Срок: 30 минут.',
          'cf_clearance — Cloudflare; запоминает, что проверка безопасности пройдена, если она потребовалась. Срок: ⟦ЮРИСТ: срок по настройкам Cloudflare⟧.',
          'lang — сайт; запоминает язык, выбранный переключателем языка. Записывается только после щелчка по переключателю. Срок: 1 год. ⟦ЮРИСТ: подтвердить, что cookie с выбором языка не требует согласия⟧',
          '__Host-admin-session — только в панели администратора; посетители сайта её не получают. Срок: 30 минут.',
        ],
      },
      {
        heading: '7. Ваши права',
        paragraphs: [
          'Вы вправе получить доступ к своим данным (ст. 15 GDPR), исправить их (ст. 16), удалить (ст. 17), ограничить обработку (ст. 18) и получить данные, обрабатываемые на основании договора, для передачи другому (ст. 20).',
          'Вы вправе в любой момент возразить против обработки на основании законного интереса (ст. 21 GDPR). Тогда обработка прекращается, если мы не докажем важные законные основания, которые перевешивают ваши интересы.',
          'Мы отвечаем без неоправданной задержки, не позднее чем через месяц. Пишите: {{owner.privacyEmail}}.',
          'Вы вправе подать жалобу Председателю Управления по защите персональных данных (Prezes UODO), ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.',
        ],
      },
      {
        heading: '8. Обязательно ли сообщать данные',
        paragraphs: [
          'Нет, это добровольно. Но без технических данных страницу невозможно показать, а без контактных — ответить на сообщение.',
        ],
      },
      {
        heading: '9. Автоматические решения',
        paragraphs: [
          'Мы не принимаем автоматических решений, имеющих для вас юридические последствия, и не составляем профилей (ст. 22 GDPR). Автоматическая временная блокировка касается IP-адреса, с которого идут попытки атаки, а не человека. Если блокировка задела вас по ошибке, напишите: {{owner.email}}.',
        ],
      },
      {
        heading: '10. Безопасность',
        paragraphs: [
          'Соединение с сайтом шифруется (TLS). Резервные копии зашифрованы. Сайт не загружает ресурсы с других доменов. Вход в панель администратора — только по одноразовой ссылке, действующей 15 минут.',
        ],
      },
      {
        heading: '11. Изменения политики',
        paragraphs: [
          'Номер версии и дата обновления указаны вверху страницы. Прежние версии хранятся в архиве.',
        ],
      },
    ],
  },

  // ═══════════════════════ PRIVACY POLICY (EN) ═══════════════════════
  {
    slug: 'privacy',
    locale: 'en',
    version: VERSION,
    title: 'Privacy policy',
    sections: [
      {
        heading: '1. Controller',
        paragraphs: [
          'The controller of your personal data is {{owner.fullName}}, {{owner.address}}, NIP (tax ID) {{owner.nip}}.',
          'For data protection matters, write to {{owner.privacyEmail}}.',
          'No data protection officer has been appointed. ⟦ЮРИСТ: confirm that Art. 37 GDPR does not require one⟧',
          'This is a translation. If it differs from the Polish version, the Polish version prevails.',
        ],
      },
      {
        heading: '2. Scope',
        paragraphs: [
          'This policy covers the informational website at this address. The site has no user accounts, forms, analytics or advertising. Fonts, images and scripts are served only from this domain: your browser contacts no other service unless you follow a link to a messenger or e-mail yourself.',
        ],
      },
      {
        heading: '3. What we process, why, and for how long',
        items: [
          'Technical data on every visit — IP address, date and time, page address, browser type, referring page, country as determined by the content delivery network. Purpose: operating and securing the site, diagnosing errors. Legal basis: legitimate interest (Art. 6(1)(f) GDPR). Retention: 14 days in server logs.',
          'Security log — IP address, browser type and request address when a request looks like an attack or a scan. Purpose: protecting the site. Legal basis: legitimate interest (Art. 6(1)(f) GDPR). Retention: 60 days; a temporary address block lasts up to 60 days from the last event.',
          'Contacting us — the data you provide by e-mail, text message or messenger, and the content of your message. Purpose: replying and arranging a consultation. Legal basis: steps taken at your request before entering into a contract (Art. 6(1)(b) GDPR), otherwise legitimate interest (Art. 6(1)(f)). Retention: until the matter is closed, then ⟦ЮРИСТ: correspondence retention period⟧.',
          'Backups — encrypted copies of the site database. Purpose: restoring the site after a failure. Legal basis: legitimate interest (Art. 6(1)(f) GDPR). Retention: 30 days. Security log data may therefore remain in backups for up to 90 days.',
        ],
        paragraphs: [
          'Please do not include information about your health in your first message. Your name, a preferred time and a way to reach you are enough to arrange a meeting.',
        ],
      },
      {
        heading: '4. Recipients',
        items: [
          'Hosting provider: {{service.hosting}} — stores the site and its logs under a data processing agreement.',
          'Cloudflare, Inc. (USA) — content delivery network and attack protection; traffic to the site passes through its servers. Acts under a data processing agreement.',
          'E-mail provider: {{service.email}} — when you write to us by e-mail.',
          'Messengers (e.g. WhatsApp — Meta Platforms, Telegram, Viber) — if you choose to contact us via a messenger, its provider processes the data as a separate controller under its own terms.',
          'Public authorities — only where required by law.',
        ],
      },
      {
        heading: '5. Transfers outside the European Economic Area',
        paragraphs: [
          'Cloudflare, Inc. is based in the USA. Transfers rely on the European Commission decision of 10 July 2023 on the EU–US Data Privacy Framework and on standard contractual clauses. ⟦ЮРИСТ: confirm Cloudflare DPF certification on the publication date⟧',
          'Messenger providers may transfer data outside the EEA under their own privacy policies.',
        ],
      },
      {
        heading: '6. Cookies',
        anchor: 'cookies',
        paragraphs: [
          'The site uses no analytics, advertising or tracking cookies. It uses only strictly necessary cookies, which do not require consent (Art. 5(3) of Directive 2002/58/EC). ⟦ЮРИСТ: cite the applicable provision of Polish electronic communications law⟧',
        ],
        items: [
          '__cf_bm — Cloudflare; distinguishes people from bots. Lifetime: 30 minutes.',
          'cf_clearance — Cloudflare; remembers that a security check was passed, if one was required. Lifetime: ⟦ЮРИСТ: as configured in Cloudflare⟧.',
          'lang — this site; remembers the language chosen with the language switcher. Set only after clicking the switcher. Lifetime: 1 year. ⟦ЮРИСТ: confirm that a cookie storing the language choice needs no consent⟧',
          '__Host-admin-session — administrator panel only; site visitors never receive it. Lifetime: 30 minutes.',
        ],
      },
      {
        heading: '7. Your rights',
        paragraphs: [
          'You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and portability of data processed under a contract (Art. 20).',
          'You may object at any time to processing based on legitimate interest (Art. 21 GDPR). Processing then stops unless we demonstrate compelling legitimate grounds that override your interests.',
          'We reply without undue delay and within one month at the latest. Write to {{owner.privacyEmail}}.',
          'You have the right to lodge a complaint with the President of the Personal Data Protection Office (Prezes UODO), ul. Stawki 2, 00-193 Warszawa, Poland, uodo.gov.pl.',
        ],
      },
      {
        heading: '8. Is providing data required',
        paragraphs: [
          'No, it is voluntary. However, the page cannot be displayed without technical data, and we cannot reply without contact details.',
        ],
      },
      {
        heading: '9. Automated decisions',
        paragraphs: [
          'We do not make automated decisions with legal effects concerning you and do not profile you (Art. 22 GDPR). The automatic temporary block applies to an IP address sending attack attempts, not to a person. If you were blocked by mistake, write to {{owner.email}}.',
        ],
      },
      {
        heading: '10. Security',
        paragraphs: [
          'Connections to the site are encrypted (TLS). Backups are encrypted. The site loads no resources from other domains. The administrator panel is reachable only through a one-time link valid for 15 minutes.',
        ],
      },
      {
        heading: '11. Changes',
        paragraphs: [
          'The version number and update date are shown at the top of the page. Previous versions are archived.',
        ],
      },
    ],
  },
];
