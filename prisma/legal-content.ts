/**
 * ЧЕРНОВИКИ правовых документов для наполнения базы.
 *
 * ⚠️ ЭТО НЕ ГОТОВЫЕ ЮРИДИЧЕСКИЕ ТЕКСТЫ.
 * Структура соответствует требованиям GDPR (ст. 13–14) и польского
 * законодательства о защите прав потребителей, но содержание обязан
 * проверить юрист. Каждая редакция помечена isDraft: true — на сайте
 * поверх неё показывается предупреждение.
 *
 * ⚖️ Польский язык — основной: владелец ведёт деятельность в Польше,
 * и документы для потребителя должны быть доступны на польском.
 * Русский — дополнительный, для аудитории.
 *
 * Текст хранится структурой, а не HTML: его невозможно превратить
 * в вектор XSS и не нужен парсер разметки.
 */

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  /** Якорь для прямой ссылки вида /privacy?lang=pl#auth */
  anchor?: string;
}

export interface LegalDocumentSeed {
  slug: 'privacy' | 'terms';
  locale: 'pl' | 'ru';
  version: string;
  title: string;
  sections: LegalSection[];
}

const PRIVACY_VERSION = 'privacy-2026-09-14';
const TERMS_VERSION = 'terms-2026-09-13';

export const LEGAL_DOCUMENTS: LegalDocumentSeed[] = [
  // ═══════════════════════ POLITYKA PRYWATNOŚCI (PL) ═══════════════════════
  {
    slug: 'privacy',
    locale: 'pl',
    version: PRIVACY_VERSION,
    title: 'Polityka prywatności',
    sections: [
      {
        heading: '1. Administrator danych',
        paragraphs: [
          'Administratorem danych osobowych jest właściciel serwisu. Pełne dane identyfikacyjne, adres oraz kontakt w sprawach ochrony danych zostaną wskazane przed uruchomieniem serwisu.',
        ],
      },
      {
        heading: '2. Jakie dane przetwarzamy',
        items: [
          'Dane logowania: adres e-mail lub identyfikator w komunikatorze — wyłącznie po to, aby umożliwić dostęp do panelu klienta.',
          'Dane rezerwacji: data, godzina i rodzaj konsultacji.',
          'Dane dotyczące zdrowia: informacje przekazane w ankiecie i podczas konsultacji. Zgodnie z art. 9 RODO jest to szczególna kategoria danych, przetwarzana wyłącznie na podstawie wyraźnej zgody.',
          'Dane płatnicze: kwota, waluta i status płatności. Numery kart nie trafiają do serwisu — obsługuje je operator płatności.',
          'Dane techniczne: adres IP oraz informacje o urządzeniu, wykorzystywane do ochrony przed atakami.',
        ],
      },
      {
        heading: '3. Podstawa prawna i cel',
        items: [
          'Wykonanie umowy (art. 6 ust. 1 lit. b RODO) — rezerwacja i realizacja konsultacji.',
          'Wyraźna zgoda (art. 9 ust. 2 lit. a RODO) — przetwarzanie danych dotyczących zdrowia.',
          'Obowiązek prawny (art. 6 ust. 1 lit. c RODO) — dokumentacja księgowa.',
          'Prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO) — bezpieczeństwo serwisu.',
        ],
      },
      {
        heading: '4. Jak chronimy dane',
        items: [
          'Połączenie jest szyfrowane (TLS 1.3).',
          'Notatki z konsultacji są szyfrowane algorytmem AES-256 osobno od reszty bazy. Klucz przechowywany jest poza bazą danych.',
          'Serwery znajdują się na terenie Unii Europejskiej; dane nie opuszczają UE.',
          'Każdy dostęp do notatek jest odnotowywany w niezmiennym dzienniku.',
          'Nie przechowujemy haseł: logowanie odbywa się kodem jednorazowym lub przez Google/Apple.',
        ],
      },
      {
        heading: '5. Logowanie bez hasła a przekazywanie danych',
        anchor: 'auth',
        paragraphs: [
          'Dopóki nie naciśniesz przycisku logowania, Twoja przeglądarka nie łączy się z Google, Apple ani z żadnym innym serwisem zewnętrznym. Dostępność metod logowania sprawdza nasz serwer z własnego adresu. Czcionki i obrazy również pochodzą z naszej domeny.',
          'Jeżeli wybierzesz logowanie przez Google lub Apple, dostawca ten pozna Twój adres IP oraz fakt logowania do tego serwisu — przy logowaniu kontem zewnętrznym nie da się tego uniknąć. Treść konsultacji, notatki i rezerwacje nie są przekazywane nikomu.',
          'Jeśli takie przekazanie jest dla Ciebie niepożądane, skorzystaj z logowania kodem jednorazowym w komunikatorze.',
        ],
      },
      {
        heading: '6. Okres przechowywania',
        paragraphs: [
          'Dzienniki bezpieczeństwa — w tym adresy IP zarejestrowane przy próbach skanowania serwisu — przechowujemy przez 60 dni, po czym są automatycznie usuwane. Podstawą jest prawnie uzasadniony interes: ochrona serwisu przed atakami (art. 6 ust. 1 lit. f RODO).',
          'Pozostałe okresy zostaną wskazane po weryfikacji prawnej. Orientacyjnie: dokumentacja konsultacji — przez okres wymagany przepisami, dokumenty księgowe — 5 lat.',
        ],
      },
      {
        heading: '7. Twoje prawa',
        paragraphs: [
          'Przysługuje Ci prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia oraz wycofania zgody w dowolnym momencie. Realizacja żądania następuje w ciągu 30 dni.',
          'Masz również prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa.',
        ],
      },
      {
        heading: '8. Pliki cookie',
        anchor: 'cookies',
        paragraphs: [
          'Serwis korzysta wyłącznie z plików cookie niezbędnych technicznie — bez nich logowanie do panelu nie jest możliwe. Nie stosujemy plików reklamowych ani śledzących.',
          'Zgodę na cookie inne niż niezbędne możesz wyrazić lub wycofać w każdej chwili w oknie ustawień prywatności.',
        ],
      },
    ],
  },

  // ═══════════════════════ ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ (RU) ═══════════════════════
  {
    slug: 'privacy',
    locale: 'ru',
    version: PRIVACY_VERSION,
    title: 'Политика конфиденциальности',
    sections: [
      {
        heading: '1. Кто обрабатывает данные',
        paragraphs: [
          'Администратором персональных данных является владелец сайта. Полные реквизиты, адрес и контакт по вопросам защиты данных будут указаны до запуска сайта.',
        ],
      },
      {
        heading: '2. Какие данные собираются',
        items: [
          'Учётные данные: адрес электронной почты или идентификатор в мессенджере — только чтобы вы могли войти в кабинет.',
          'Данные о записи: дата, время и тип консультации.',
          'Данные о здоровье: то, что вы сообщаете в анкете и во время консультаций. По ст. 9 GDPR это особая категория данных, обрабатывается только с вашего явного согласия.',
          'Платёжные данные: сумма, валюта и статус оплаты. Номера карт на сайт не попадают — их обрабатывает платёжная система.',
          'Технические данные: IP-адрес и сведения об устройстве — для защиты от атак.',
        ],
      },
      {
        heading: '3. Правовое основание и цель',
        items: [
          'Исполнение договора (ст. 6.1.b GDPR) — запись и проведение консультации.',
          'Явное согласие (ст. 9.2.a GDPR) — обработка данных о здоровье.',
          'Требование закона (ст. 6.1.c GDPR) — бухгалтерская документация.',
          'Законный интерес (ст. 6.1.f GDPR) — безопасность сайта.',
        ],
      },
      {
        heading: '4. Как данные защищены',
        items: [
          'Соединение шифруется (TLS 1.3).',
          'Записи о консультациях шифруются алгоритмом AES-256 отдельно от остальной базы. Ключ хранится вне базы данных.',
          'Серверы расположены в Европейском союзе, данные не покидают ЕС.',
          'Каждое обращение к записям фиксируется в неизменяемом журнале.',
          'Паролей не существует: вход по одноразовому коду или через Google/Apple.',
        ],
      },
      {
        heading: '5. Вход без пароля и передача данных',
        anchor: 'auth',
        paragraphs: [
          'Пока вы не нажали кнопку входа, ваш браузер не обращается ни к Google, ни к Apple, ни к какому-либо другому внешнему сервису: доступность способов входа проверяет наш сервер со своего адреса. Шрифты и изображения тоже раздаются с нашего домена.',
          'Если вы выбираете вход через Google или Apple, этот сервис узнает ваш IP-адрес и факт входа именно на этот сайт — при входе через внешний аккаунт избежать этого невозможно. Содержание консультаций, записи и заметки не передаются никому.',
          'Если такая передача для вас нежелательна, используйте вход по одноразовому коду в мессенджере.',
        ],
      },
      {
        heading: '6. Сколько данные хранятся',
        paragraphs: [
          'Журналы безопасности — включая IP-адреса, записанные при попытках сканирования сайта, — хранятся 60 дней, после чего удаляются автоматически. Основание: законный интерес — защита сайта от атак (ст. 6 ч. 1 п. f GDPR).',
          'Остальные сроки будут указаны после юридической проверки. Ориентир: документация консультаций — в течение срока, установленного законом; бухгалтерские документы — 5 лет.',
        ],
      },
      {
        heading: '7. Ваши права',
        paragraphs: [
          'Вы вправе получить копию своих данных, исправить их, удалить, ограничить обработку, перенести к другому поставщику услуг и отозвать согласие в любой момент. Запрос выполняется в течение 30 дней.',
          'Вы также вправе подать жалобу в надзорный орган: Prezes Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa.',
        ],
      },
      {
        heading: '8. Файлы cookie',
        anchor: 'cookies',
        paragraphs: [
          'Сайт использует только технически необходимые cookie — без них невозможно войти в кабинет. Рекламных и отслеживающих файлов нет.',
          'Согласие на cookie сверх необходимых можно дать или отозвать в любой момент в окне настроек приватности.',
        ],
      },
    ],
  },

  // ═══════════════════════ REGULAMIN (PL) ═══════════════════════
  {
    slug: 'terms',
    locale: 'pl',
    version: TERMS_VERSION,
    title: 'Regulamin świadczenia usług',
    sections: [
      {
        heading: '1. Przedmiot',
        paragraphs: [
          'Usługodawca świadczy usługi konsultacji psychologicznych w formie wideorozmowy. Dokonując rezerwacji, akceptujesz warunki niniejszego regulaminu.',
        ],
      },
      {
        heading: '2. Czego konsultacja nie zastępuje',
        paragraphs: [
          'Konsultacja psychologiczna nie jest świadczeniem zdrowotnym i nie zastępuje wizyty u lekarza, diagnozy ani leczenia farmakologicznego. Usługa nie jest przeznaczona do sytuacji nagłych.',
          'W razie zagrożenia życia lub zdrowia należy skontaktować się z numerem alarmowym 112.',
        ],
      },
      {
        heading: '3. Rezerwacja, zmiana terminu i odwołanie',
        items: [
          'Rezerwacja odbywa się przez panel klienta na wolny termin w grafiku.',
          'Zmiana terminu lub odwołanie bez utraty opłaty są możliwe nie później niż 24 godziny przed rozpoczęciem konsultacji.',
          'W przypadku spóźnienia konsultacja kończy się w pierwotnie zaplanowanym czasie.',
          'Jeżeli konsultacja nie odbyła się z przyczyn leżących po stronie usługodawcy, termin zostaje przeniesiony lub opłata zwrócona w całości.',
        ],
      },
      {
        heading: '4. Prawo odstąpienia od umowy',
        paragraphs: [
          'Konsumentowi przysługuje prawo odstąpienia od umowy zawartej na odległość w terminie 14 dni. Jeżeli konsultacja ma się odbyć przed upływem tego terminu, wymagana jest wyraźna zgoda na rozpoczęcie świadczenia — wówczas prawo odstąpienia wygasa z chwilą wykonania usługi.',
        ],
      },
      {
        heading: '5. Płatność',
        paragraphs: [
          'Ceny podane są na stronie „Usługi” i zależą od regionu. Płatność następuje przed rozpoczęciem konsultacji. Numery kart płatniczych nie przechodzą przez serwis.',
        ],
      },
      {
        heading: '6. Poufność',
        paragraphs: [
          'Wszystko, co omawiane jest podczas konsultacji, jest poufne. Wyjątki wynikają z przepisów prawa i standardów zawodowych, przede wszystkim w sytuacji bezpośredniego zagrożenia życia.',
        ],
      },
      {
        heading: '7. Reklamacje',
        paragraphs: [
          'Reklamację można złożyć na adres kontaktowy wskazany w serwisie. Odpowiedź następuje w terminie 14 dni. Konsument może również skorzystać z pozasądowych sposobów rozpatrywania reklamacji.',
        ],
      },
    ],
  },

  // ═══════════════════════ ПУБЛИЧНАЯ ОФЕРТА (RU) ═══════════════════════
  {
    slug: 'terms',
    locale: 'ru',
    version: TERMS_VERSION,
    title: 'Условия оказания услуг',
    sections: [
      {
        heading: '1. Предмет',
        paragraphs: [
          'Исполнитель оказывает услуги психологического консультирования в формате видеосвязи. Записываясь на консультацию, вы принимаете условия настоящего документа.',
        ],
      },
      {
        heading: '2. Что консультация не заменяет',
        paragraphs: [
          'Психологическое консультирование не является медицинской помощью и не заменяет обращения к врачу, постановки диагноза или назначения лекарств. Услуга не предназначена для экстренных ситуаций.',
          'При угрозе жизни или здоровью обратитесь в службу экстренной помощи: 112.',
        ],
      },
      {
        heading: '3. Запись, перенос и отмена',
        items: [
          'Запись производится через личный кабинет на свободное время в расписании.',
          'Перенести или отменить консультацию без потери оплаты можно не позднее чем за 24 часа до её начала.',
          'При опоздании консультация завершается в изначально запланированное время.',
          'Если консультация не состоялась по причине, зависящей от исполнителя, она переносится или оплата возвращается полностью.',
        ],
      },
      {
        heading: '4. Право на отказ от договора',
        paragraphs: [
          'Потребитель вправе отказаться от договора, заключённого дистанционно, в течение 14 дней. Если консультация должна состояться до истечения этого срока, требуется явное согласие на начало оказания услуги — в этом случае право на отказ прекращается с момента её оказания.',
        ],
      },
      {
        heading: '5. Оплата',
        paragraphs: [
          'Стоимость указана на странице «Услуги» и зависит от региона. Оплата производится до начала консультации. Номера банковских карт через сайт не проходят.',
        ],
      },
      {
        heading: '6. Конфиденциальность',
        paragraphs: [
          'Всё, что обсуждается на консультации, конфиденциально. Исключения предусмотрены законом и профессиональными стандартами — прежде всего ситуации непосредственной угрозы жизни.',
        ],
      },
      {
        heading: '7. Претензии',
        paragraphs: [
          'Претензию можно направить по контактному адресу, указанному на сайте. Ответ предоставляется в течение 14 дней.',
        ],
      },
    ],
  },
];
