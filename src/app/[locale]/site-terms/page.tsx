import { createLegalPage } from '@/components/LegalPage';

/**
 * Положения о пользовании сайтом (regulamin serwisu) — обязательны для любого
 * сайта, оказывающего услугу по электронным каналам, даже информационного
 * (ст. 8 закона об электронных услугах).
 */

export const dynamic = 'force-dynamic';

const page = createLegalPage({
  slug: 'site-terms',
  path: '/site-terms',
  navKey: 'siteTerms',
  description: {
    pl: 'Zasady korzystania z serwisu informacyjnego.',
    ru: 'Правила пользования информационным сайтом.',
    en: 'Rules for using this informational website.',
  },
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
