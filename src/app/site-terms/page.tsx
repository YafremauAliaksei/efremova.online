import { createLegalPage } from '@/components/LegalPage';

/**
 * Положения о пользовании сайтом (regulamin serwisu) — обязательны для любого
 * сайта, оказывающего услугу по электронным каналам, даже информационного
 * (ст. 8 закона об электронных услугах).
 */

export const dynamic = 'force-dynamic';

const page = createLegalPage({
  slug: 'site-terms',
  basePath: '/site-terms',
  fallbackTitle: 'Regulamin serwisu',
  description: 'Zasady korzystania z serwisu informacyjnego.',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
