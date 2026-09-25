import { createLegalPage } from '@/components/LegalPage';

/**
 * Данные владельца сайта: кто оказывает услуги, как связаться, профессиональный
 * статус (ст. 5 закона об электронных услугах, ст. 5 директивы 2000/31/ЕС).
 */

export const dynamic = 'force-dynamic';

const page = createLegalPage({
  slug: 'provider',
  basePath: '/provider',
  fallbackTitle: 'Informacje o usługodawcy',
  description: 'Dane usługodawcy, kontakt i informacje o wykonywanym zawodzie.',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
