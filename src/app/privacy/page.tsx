import { createLegalPage } from '@/components/LegalPage';

/**
 * Политика конфиденциальности (ст. 13 GDPR).
 *
 *   /privacy?lang=pl           польская версия — основная
 *   /privacy?lang=pl#cookies   сразу к разделу о cookie
 */

export const dynamic = 'force-dynamic';

const page = createLegalPage({
  slug: 'privacy',
  basePath: '/privacy',
  fallbackTitle: 'Polityka prywatności',
  description:
    'Jakie dane przetwarza serwis, w jakim celu, jak długo je przechowuje i jakie prawa Ci przysługują.',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
