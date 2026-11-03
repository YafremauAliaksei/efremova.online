import type { LegalDocumentSeed } from './types';

/**
 * ДАННЫЕ ВЛАДЕЛЬЦА (informacje o usługodawcy) — ОБРАЗЕЦ.
 *
 * ⚠️ Не юридический текст. Набор сведений — техническое понимание ст. 5
 * закона об электронных услугах (UŚUDE), ст. 5 директивы 2000/31/ЕС для
 * регулируемой профессии и информации для потребителя о внесудебном
 * разрешении споров. Все значения — метками из профиля владельца.
 */

const VERSION = 'provider-2026-11-03-draft';

export const PROVIDER_DOCUMENTS: LegalDocumentSeed[] = [
  {
    slug: 'provider',
    locale: 'pl',
    version: VERSION,
    title: 'Informacje o usługodawcy',
    sections: [
      {
        heading: '1. Usługodawca',
        items: [
          '{{owner.fullName}}',
          'Adres: {{owner.address}}',
          'NIP: {{owner.nip}} · REGON: {{owner.regon}}',
          'Wpis do rejestru: {{owner.registry}}',
          'E-mail: {{owner.email}}',
        ],
      },
      {
        heading: '2. Wykonywany zawód',
        items: [
          'Tytuł zawodowy: {{owner.professionalTitle}}, nadany w: {{owner.titleCountry}}',
          'Numer prawa wykonywania zawodu: {{owner.licenseNumber}}',
          'Samorząd zawodowy lub organizacja: {{owner.professionalBody}}',
          'Zasady etyki zawodowej: {{owner.ethicsCode}}',
        ],
        paragraphs: [
          'Usługodawca wykonuje zawód psychologa zgodnie z przepisami o zawodzie psychologa i samorządzie zawodowym psychologów oraz z kodeksem etyki zawodowej wskazanym powyżej.',
        ],
      },
      {
        heading: '3. Podatek VAT',
        paragraphs: ['{{owner.vatStatus}}'],
      },
      {
        heading: '4. Pozasądowe rozwiązywanie sporów',
        paragraphs: [
          'Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, m.in. z pomocy miejskiego lub powiatowego rzecznika konsumentów oraz wojewódzkiego inspektora Inspekcji Handlowej. Informacje: prawakonsumenta.uokik.gov.pl.',
          'Unijna platforma ODR została zamknięta w 2025 r., dlatego odnośnik do niej nie jest podawany.',
        ],
      },
    ],
  },
  {
    slug: 'provider',
    locale: 'ru',
    version: VERSION,
    title: 'Данные владельца сайта',
    sections: [
      {
        heading: '1. Кто оказывает услуги',
        items: [
          '{{owner.fullName}}',
          'Адрес: {{owner.address}}',
          'NIP: {{owner.nip}} · REGON: {{owner.regon}}',
          'Запись в реестре: {{owner.registry}}',
          'E-mail: {{owner.email}}',
        ],
        paragraphs: ['Это перевод. При расхождении с польской версией действует польская.'],
      },
      {
        heading: '2. Профессия',
        items: [
          'Профессиональное звание: {{owner.professionalTitle}}, присвоено в: {{owner.titleCountry}}',
          'Номер права на ведение практики: {{owner.licenseNumber}}',
          'Профессиональное самоуправление или организация: {{owner.professionalBody}}',
          'Правила профессиональной этики: {{owner.ethicsCode}}',
        ],
        paragraphs: [
          'Исполнитель работает психологом в соответствии с польским законом о профессии психолога и профессиональном самоуправлении психологов и кодексом профессиональной этики, указанным выше.',
        ],
      },
      {
        heading: '3. Налог на добавленную стоимость',
        paragraphs: ['{{owner.vatStatus}}'],
      },
      {
        heading: '4. Внесудебное разрешение споров',
        paragraphs: [
          'Потребитель может воспользоваться внесудебными способами рассмотрения претензий, в том числе помощью городского или районного уполномоченного по правам потребителей (rzecznik konsumentów) и воеводской Торговой инспекции (Inspekcja Handlowa). Подробности: prawakonsumenta.uokik.gov.pl.',
          'Платформа ODR Европейского союза закрыта в 2025 году, поэтому ссылка на неё не приводится.',
        ],
      },
    ],
  },
  {
    slug: 'provider',
    locale: 'en',
    version: VERSION,
    title: 'Service provider information',
    sections: [
      {
        heading: '1. Service provider',
        items: [
          '{{owner.fullName}}',
          'Address: {{owner.address}}',
          'NIP (tax ID): {{owner.nip}} · REGON: {{owner.regon}}',
          'Registered in: {{owner.registry}}',
          'E-mail: {{owner.email}}',
        ],
        paragraphs: [
          'This is a translation. If it differs from the Polish version, the Polish version prevails.',
        ],
      },
      {
        heading: '2. Profession',
        items: [
          'Professional title: {{owner.professionalTitle}}, granted in: {{owner.titleCountry}}',
          'Licence number: {{owner.licenseNumber}}',
          'Professional body or association: {{owner.professionalBody}}',
          'Professional ethics rules: {{owner.ethicsCode}}',
        ],
        paragraphs: [
          'The provider practises as a psychologist in accordance with the Polish law on the psychologist profession and the professional self-government of psychologists, and with the code of professional ethics indicated above.',
        ],
      },
      {
        heading: '3. VAT',
        paragraphs: ['{{owner.vatStatus}}'],
      },
      {
        heading: '4. Out-of-court dispute resolution',
        paragraphs: [
          'Consumers may use out-of-court complaint and redress procedures, including the help of municipal or district consumer ombudsmen (rzecznik konsumentów) and the regional Trade Inspection (Inspekcja Handlowa). Information: prawakonsumenta.uokik.gov.pl.',
          'The EU ODR platform closed in 2025, so no link to it is given.',
        ],
      },
    ],
  },
];
