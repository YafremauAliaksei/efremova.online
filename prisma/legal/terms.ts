import type { LegalDocumentSeed } from './types';

/**
 * УСЛОВИЯ КОНСУЛЬТАЦИЙ — ОБРАЗЕЦ.
 *
 * ⚠️ Не юридический текст. Консультация договаривается по почте или в
 * мессенджере — это договор на расстоянии с потребителем. Структура —
 * техническое понимание информации, которую закон о правах потребителя
 * (ст. 12) требует дать до заключения договора: кто, что, цена, как
 * заключается, право отказа и когда оно прекращается, претензии.
 *
 * Записи и оплаты на сайте нет: они появятся в кабинете на поддомене,
 * вместе со своей редакцией условий.
 */

const VERSION = 'terms-2026-09-25-draft';

export const TERMS_DOCUMENTS: LegalDocumentSeed[] = [
  {
    slug: 'terms',
    locale: 'pl',
    version: VERSION,
    title: 'Warunki konsultacji',
    sections: [
      {
        heading: '1. Usługodawca i usługa',
        paragraphs: [
          'Konsultacje prowadzi {{owner.fullName}}, {{owner.professionalTitle}}. Pełne dane — na stronie „Informacje o usługodawcy”.',
          'Konsultacja psychologiczna jest przeznaczona dla osób pełnoletnich i odbywa się w formie wideorozmowy. ⟦ЮРИСТ: forma (online / stacjonarnie) i czy konsultacja jest świadczeniem zdrowotnym⟧',
        ],
      },
      {
        heading: '2. Jak zawierana jest umowa',
        paragraphs: [
          'Termin ustalamy w wiadomości e-mail lub w komunikatorze. Umowa zostaje zawarta, gdy usługodawca potwierdzi termin. Potwierdzenie wysyłamy e-mailem: zawiera termin, formę, cenę i odnośnik do tych warunków.',
        ],
      },
      {
        heading: '3. Cena i płatność',
        paragraphs: [
          'Aktualne ceny są na stronie „Usługi”. Podana cena jest ceną całkowitą. {{owner.vatStatus}}',
          'Sposób i termin płatności: ⟦ЮРИСТ: sposób i termin płatności⟧',
        ],
      },
      {
        heading: '4. Czas trwania',
        paragraphs: ['Czas trwania konsultacji podano przy każdej usłudze na stronie „Usługi”.'],
      },
      {
        heading: '5. Zmiana terminu i odwołanie',
        paragraphs: [
          'Termin można bezpłatnie zmienić lub odwołać ⟦ЮРИСТ: do ilu godzin przed konsultacją⟧. Zasady przy późniejszym odwołaniu: ⟦ЮРИСТ: zasady⟧',
        ],
      },
      {
        heading: '6. Prawo odstąpienia od umowy',
        anchor: 'odstapienie',
        paragraphs: [
          'Możesz odstąpić od umowy zawartej na odległość w ciągu 14 dni od jej zawarcia bez podawania przyczyny — wystarczy wiadomość na adres {{owner.email}}.',
          'Jeżeli konsultacja ma się odbyć przed upływem tych 14 dni, poprosimy o wyraźne żądanie rozpoczęcia usługi. Po jej pełnym wykonaniu prawo odstąpienia wygasa; przy odstąpieniu w trakcie płacisz za część wykonaną do tej chwili.',
          '⟦ЮРИСТ: dołączyć wzór formularza odstąpienia od umowy i potwierdzić przepisy⟧',
        ],
      },
      {
        heading: '7. Poufność',
        paragraphs: [
          'Treść konsultacji jest objęta tajemnicą zawodową. Konsultacje nie są nagrywane. ⟦ЮРИСТ: wyjątki od tajemnicy przewidziane prawem⟧',
        ],
      },
      {
        heading: '8. Czego konsultacja nie zastępuje',
        paragraphs: [
          'Konsultacja online nie jest pomocą w nagłym zagrożeniu. W takiej sytuacji dzwoń pod 112 lub skorzystaj z numerów w części „Pomoc w kryzysie” regulaminu serwisu.',
        ],
      },
      {
        heading: '9. Reklamacje',
        paragraphs: [
          'Reklamacje przyjmujemy na adres {{owner.email}} i odpowiadamy w ciągu 14 dni. Informacje o pozasądowych sposobach rozwiązywania sporów — na stronie „Informacje o usługodawcy”. ⟦ЮРИСТ: termin⟧',
        ],
      },
      {
        heading: '10. Prawo właściwe',
        paragraphs: [
          'Warunki podlegają prawu polskiemu. Konsument zachowuje ochronę bezwzględnie obowiązujących przepisów państwa, w którym ma zwykłe miejsce pobytu.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    locale: 'ru',
    version: VERSION,
    title: 'Условия консультаций',
    sections: [
      {
        heading: '1. Кто и что',
        paragraphs: [
          'Консультации ведёт {{owner.fullName}}, {{owner.professionalTitle}}. Полные данные — на странице «Данные владельца сайта».',
          'Психологическая консультация предназначена для совершеннолетних и проходит по видеосвязи. ⟦ЮРИСТ: форма (онлайн / очно) и является ли консультация медицинской услугой⟧',
          'Это перевод. При расхождении с польской версией действует польская.',
        ],
      },
      {
        heading: '2. Как заключается договор',
        paragraphs: [
          'Время согласуется по почте или в мессенджере. Договор заключён, когда владелец подтверждает время. Подтверждение приходит по почте: в нём время, форма, цена и ссылка на эти условия.',
        ],
      },
      {
        heading: '3. Цена и оплата',
        paragraphs: [
          'Актуальные цены — на странице «Услуги». Указана итоговая цена. {{owner.vatStatus}}',
          'Способ и срок оплаты: ⟦ЮРИСТ: способ и срок оплаты⟧',
        ],
      },
      {
        heading: '4. Длительность',
        paragraphs: ['Длительность указана у каждой услуги на странице «Услуги».'],
      },
      {
        heading: '5. Перенос и отмена',
        paragraphs: [
          'Время можно бесплатно перенести или отменить ⟦ЮРИСТ: не позднее чем за сколько часов⟧. Правила при более поздней отмене: ⟦ЮРИСТ: правила⟧',
        ],
      },
      {
        heading: '6. Право на отказ от договора',
        anchor: 'odstapienie',
        paragraphs: [
          'Вы можете отказаться от договора, заключённого на расстоянии, в течение 14 дней с его заключения без объяснения причин — достаточно письма на {{owner.email}}.',
          'Если консультация должна пройти раньше, чем через 14 дней, мы попросим ваше явное требование начать услугу. После полного оказания услуги право на отказ прекращается; при отказе в процессе вы оплачиваете уже оказанную часть.',
          '⟦ЮРИСТ: приложить образец формы отказа от договора и подтвердить нормы⟧',
        ],
      },
      {
        heading: '7. Конфиденциальность',
        paragraphs: [
          'Содержание консультаций составляет профессиональную тайну. Консультации не записываются. ⟦ЮРИСТ: исключения из тайны, предусмотренные законом⟧',
        ],
      },
      {
        heading: '8. Чего консультация не заменяет',
        paragraphs: [
          'Онлайн-консультация — не экстренная помощь. В экстренной ситуации звоните 112 или по номерам из раздела «Помощь в кризисе» положений о сайте.',
        ],
      },
      {
        heading: '9. Претензии',
        paragraphs: [
          'Претензии принимаются по адресу {{owner.email}}, ответ — в течение 14 дней. О внесудебном разрешении споров — на странице «Данные владельца сайта». ⟦ЮРИСТ: срок⟧',
        ],
      },
      {
        heading: '10. Применимое право',
        paragraphs: [
          'К условиям применяется польское право. Потребитель сохраняет защиту обязательных норм страны своего обычного проживания.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    locale: 'en',
    version: VERSION,
    title: 'Consultation terms',
    sections: [
      {
        heading: '1. Provider and service',
        paragraphs: [
          'Consultations are provided by {{owner.fullName}}, {{owner.professionalTitle}}. Full details are on the “Service provider information” page.',
          'The psychological consultation is intended for adults and takes place by video call. ⟦ЮРИСТ: format (online / in person) and whether a consultation is a health service⟧',
          'This is a translation. If it differs from the Polish version, the Polish version prevails.',
        ],
      },
      {
        heading: '2. How the agreement is made',
        paragraphs: [
          'We arrange the time by e-mail or messenger. The agreement is concluded when the provider confirms the time. The confirmation is sent by e-mail and states the time, format, price and a link to these terms.',
        ],
      },
      {
        heading: '3. Price and payment',
        paragraphs: [
          'Current prices are on the “Services” page. The price shown is the total price. {{owner.vatStatus}}',
          'Payment method and deadline: ⟦ЮРИСТ: payment method and deadline⟧',
        ],
      },
      {
        heading: '4. Duration',
        paragraphs: ['The duration is stated for each service on the “Services” page.'],
      },
      {
        heading: '5. Rescheduling and cancellation',
        paragraphs: [
          'You can reschedule or cancel free of charge ⟦ЮРИСТ: how many hours in advance⟧. Rules for later cancellation: ⟦ЮРИСТ: rules⟧',
        ],
      },
      {
        heading: '6. Right of withdrawal',
        anchor: 'odstapienie',
        paragraphs: [
          'You may withdraw from a distance contract within 14 days of its conclusion without giving a reason — an e-mail to {{owner.email}} is enough.',
          'If the consultation is to take place within those 14 days, we will ask for your express request to start the service. Once the service has been fully performed, the right of withdrawal ends; if you withdraw during the service, you pay for the part already performed.',
          '⟦ЮРИСТ: attach the model withdrawal form and confirm the provisions⟧',
        ],
      },
      {
        heading: '7. Confidentiality',
        paragraphs: [
          'The content of consultations is covered by professional secrecy. Consultations are not recorded. ⟦ЮРИСТ: statutory exceptions to secrecy⟧',
        ],
      },
      {
        heading: '8. What a consultation does not replace',
        paragraphs: [
          'An online consultation is not emergency help. In an emergency, call 112 or use the numbers in the “Help in a crisis” section of the website terms.',
        ],
      },
      {
        heading: '9. Complaints',
        paragraphs: [
          'Complaints can be sent to {{owner.email}}; we reply within 14 days. Out-of-court dispute resolution is described on the “Service provider information” page. ⟦ЮРИСТ: period⟧',
        ],
      },
      {
        heading: '10. Governing law',
        paragraphs: [
          'These terms are governed by Polish law. Consumers keep the protection of the mandatory rules of the country where they habitually reside.',
        ],
      },
    ],
  },
];
