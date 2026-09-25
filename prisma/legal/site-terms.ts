import type { LegalDocumentSeed } from './types';

/**
 * ПОЛОЖЕНИЯ О ПОЛЬЗОВАНИИ САЙТОМ (regulamin serwisu) — ОБРАЗЕЦ.
 *
 * ⚠️ Не юридический текст. Структура — техническое понимание ст. 6 и 8
 * закона об электронных услугах (UŚUDE): вид и объём услуги, технические
 * требования, заключение и расторжение договора, запрет противоправного
 * содержания, особые угрозы, претензии. Отдельно — помощь в кризисе:
 * сайт психолога может открыть человек, которому нужна помощь сейчас.
 *
 * Условия самих консультаций — отдельный документ (slug 'terms').
 */

const VERSION = 'site-terms-2026-09-25-draft';

export const SITE_TERMS_DOCUMENTS: LegalDocumentSeed[] = [
  {
    slug: 'site-terms',
    locale: 'pl',
    version: VERSION,
    title: 'Regulamin serwisu',
    sections: [
      {
        heading: '1. Postanowienia ogólne',
        paragraphs: [
          'Regulamin określa zasady korzystania z serwisu informacyjnego pod tym adresem (art. 8 ustawy o świadczeniu usług drogą elektroniczną). Usługodawcą jest {{owner.fullName}}; pełne dane — na stronie „Informacje o usługodawcy”.',
        ],
      },
      {
        heading: '2. Usługa',
        paragraphs: [
          'Serwis nieodpłatnie udostępnia informacje o działalności usługodawcy i dane kontaktowe. Nie ma kont użytkowników ani formularzy. Umowy o konsultacje reguluje odrębny dokument „Warunki konsultacji”.',
        ],
      },
      {
        heading: '3. Wymagania techniczne',
        paragraphs: [
          'Wystarczy urządzenie z dostępem do internetu i aktualna przeglądarka obsługująca szyfrowane połączenia TLS. Do czytania treści nie jest potrzebny JavaScript.',
        ],
      },
      {
        heading: '4. Zawarcie i rozwiązanie umowy',
        paragraphs: [
          'Umowa o korzystanie z serwisu zostaje zawarta z chwilą otwarcia strony i rozwiązana z chwilą jej opuszczenia. Nie wymaga rejestracji ani podawania danych.',
        ],
      },
      {
        heading: '5. Zakazane działania',
        paragraphs: [
          'Serwis nie umożliwia publikowania treści przez odwiedzających. Zabronione jest podejmowanie działań zakłócających jego działanie, w tym prób włamania i automatycznego skanowania.',
        ],
      },
      {
        heading: '6. Szczególne zagrożenia',
        items: [
          'Podszywanie się pod serwis (phishing) — sprawdzaj adres strony i kłódkę w pasku przeglądarki. Serwis nigdy nie prosi o hasła ani o płatność.',
          'Złośliwe oprogramowanie — korzystaj z aktualnej przeglądarki i systemu.',
          'Publiczne sieci Wi-Fi — połączenie z serwisem jest szyfrowane, ale wiadomości wysyłane komunikatorem lub e-mailem podlegają zabezpieczeniom ich dostawców.',
        ],
      },
      {
        heading: '7. Charakter treści',
        paragraphs: [
          'Treści w serwisie mają charakter ogólny. Nie stanowią porady psychologicznej, medycznej ani prawnej i nie zastępują konsultacji.',
        ],
      },
      {
        heading: '8. Pomoc w kryzysie',
        anchor: 'kryzys',
        items: [
          'Zagrożenie życia lub zdrowia: 112.',
          'Centrum Wsparcia dla Osób Dorosłych w Kryzysie Psychicznym: 800 70 2222 (całodobowo).',
          'Kryzysowy Telefon Zaufania dla dorosłych: 116 123.',
          'Telefon Zaufania dla Dzieci i Młodzieży: 116 111.',
        ],
        paragraphs: [
          'Serwis i kontakt z usługodawcą nie służą do udzielania pomocy w nagłych sytuacjach. ⟦ЮРИСТ: сверить номера и часы работы на дату публикации⟧',
        ],
      },
      {
        heading: '9. Reklamacje',
        paragraphs: [
          'Uwagi i reklamacje dotyczące działania serwisu można zgłaszać na adres {{owner.email}}. Odpowiadamy w ciągu 14 dni. ⟦ЮРИСТ: termin rozpatrzenia⟧',
        ],
      },
      {
        heading: '10. Prawo właściwe i zmiany regulaminu',
        paragraphs: [
          'Regulamin podlega prawu polskiemu. Konsument zachowuje ochronę przyznaną mu przez bezwzględnie obowiązujące przepisy państwa, w którym ma zwykłe miejsce pobytu.',
          'Numer wersji i datę aktualizacji widać na górze strony. Poprzednie wersje są archiwizowane.',
        ],
      },
    ],
  },
  {
    slug: 'site-terms',
    locale: 'ru',
    version: VERSION,
    title: 'Положения о пользовании сайтом',
    sections: [
      {
        heading: '1. Общие положения',
        paragraphs: [
          'Положения определяют правила пользования информационным сайтом по этому адресу (ст. 8 польского закона об оказании услуг электронным путём). Услуги оказывает {{owner.fullName}}; полные данные — на странице «Данные владельца сайта».',
          'Это перевод. При расхождении с польской версией действует польская.',
        ],
      },
      {
        heading: '2. Услуга',
        paragraphs: [
          'Сайт бесплатно предоставляет информацию о деятельности владельца и контакты. Учётных записей и форм нет. Договоры о консультациях регулирует отдельный документ «Условия консультаций».',
        ],
      },
      {
        heading: '3. Технические требования',
        paragraphs: [
          'Достаточно устройства с доступом в интернет и современного браузера с поддержкой шифрованных соединений TLS. Для чтения текстов JavaScript не нужен.',
        ],
      },
      {
        heading: '4. Заключение и прекращение договора',
        paragraphs: [
          'Договор о пользовании сайтом заключается, когда вы открываете страницу, и прекращается, когда вы её покидаете. Регистрация и передача данных не нужны.',
        ],
      },
      {
        heading: '5. Запрещённые действия',
        paragraphs: [
          'Посетители не могут публиковать на сайте свои материалы. Запрещены действия, мешающие работе сайта, в том числе попытки взлома и автоматическое сканирование.',
        ],
      },
      {
        heading: '6. Особые угрозы',
        items: [
          'Подделка сайта (фишинг) — проверяйте адрес и значок замка в браузере. Сайт никогда не просит пароли или оплату.',
          'Вредоносные программы — пользуйтесь обновлённым браузером и системой.',
          'Общественный Wi-Fi — соединение с сайтом зашифровано, но сообщения в мессенджерах и по почте защищены средствами их владельцев.',
        ],
      },
      {
        heading: '7. Характер материалов',
        paragraphs: [
          'Материалы сайта носят общий характер. Они не являются психологической, медицинской или юридической консультацией и не заменяют её.',
        ],
      },
      {
        heading: '8. Помощь в кризисе',
        anchor: 'kryzys',
        items: [
          'Угроза жизни или здоровью: 112.',
          'Centrum Wsparcia dla Osób Dorosłych w Kryzysie Psychicznym: 800 70 2222 (круглосуточно).',
          'Kryzysowy Telefon Zaufania — для взрослых: 116 123.',
          'Telefon Zaufania dla Dzieci i Młodzieży — для детей и подростков: 116 111.',
        ],
        paragraphs: [
          'Сайт и связь с владельцем не предназначены для экстренной помощи. ⟦ЮРИСТ: сверить номера и часы работы на дату публикации⟧',
        ],
      },
      {
        heading: '9. Претензии',
        paragraphs: [
          'Замечания и претензии к работе сайта принимаются по адресу {{owner.email}}. Ответ — в течение 14 дней. ⟦ЮРИСТ: срок рассмотрения⟧',
        ],
      },
      {
        heading: '10. Применимое право и изменения',
        paragraphs: [
          'К положениям применяется польское право. Потребитель сохраняет защиту, которую ему дают обязательные нормы страны его обычного проживания.',
          'Номер версии и дата обновления указаны вверху страницы. Прежние версии хранятся в архиве.',
        ],
      },
    ],
  },
  {
    slug: 'site-terms',
    locale: 'en',
    version: VERSION,
    title: 'Website terms of use',
    sections: [
      {
        heading: '1. General',
        paragraphs: [
          'These terms govern the use of the informational website at this address (Art. 8 of the Polish Act on Providing Services by Electronic Means). The service provider is {{owner.fullName}}; full details are on the “Service provider information” page.',
          'This is a translation. If it differs from the Polish version, the Polish version prevails.',
        ],
      },
      {
        heading: '2. The service',
        paragraphs: [
          'The website provides, free of charge, information about the provider and contact details. It has no user accounts or forms. Consultation agreements are governed by a separate document, “Consultation terms”.',
        ],
      },
      {
        heading: '3. Technical requirements',
        paragraphs: [
          'A device with internet access and an up-to-date browser supporting encrypted TLS connections is enough. JavaScript is not required to read the content.',
        ],
      },
      {
        heading: '4. Conclusion and termination',
        paragraphs: [
          'The agreement to use the website is concluded when you open a page and ends when you leave. No registration or personal data is required.',
        ],
      },
      {
        heading: '5. Prohibited actions',
        paragraphs: [
          'Visitors cannot publish content on the website. Actions that disrupt its operation, including intrusion attempts and automated scanning, are prohibited.',
        ],
      },
      {
        heading: '6. Specific risks',
        items: [
          'Impersonation (phishing) — check the address and the padlock in your browser. The website never asks for passwords or payments.',
          'Malware — keep your browser and system up to date.',
          'Public Wi-Fi — the connection to the website is encrypted, but messages sent by messenger or e-mail are protected by their providers.',
        ],
      },
      {
        heading: '7. Nature of the content',
        paragraphs: [
          'The content is general in nature. It is not psychological, medical or legal advice and does not replace a consultation.',
        ],
      },
      {
        heading: '8. Help in a crisis',
        anchor: 'kryzys',
        items: [
          'Danger to life or health: 112.',
          'Support Centre for Adults in Mental Crisis (Centrum Wsparcia): 800 70 2222 (24/7).',
          'Crisis helpline for adults (Kryzysowy Telefon Zaufania): 116 123.',
          'Helpline for children and young people: 116 111.',
        ],
        paragraphs: [
          'The website and contact with the provider are not intended for emergency help. ⟦ЮРИСТ: verify the numbers and hours on the publication date⟧',
        ],
      },
      {
        heading: '9. Complaints',
        paragraphs: [
          'Comments and complaints about the website can be sent to {{owner.email}}. We reply within 14 days. ⟦ЮРИСТ: complaint handling period⟧',
        ],
      },
      {
        heading: '10. Governing law and changes',
        paragraphs: [
          'These terms are governed by Polish law. Consumers keep the protection of the mandatory rules of the country where they habitually reside.',
          'The version number and update date are shown at the top of the page. Previous versions are archived.',
        ],
      },
    ],
  },
];
