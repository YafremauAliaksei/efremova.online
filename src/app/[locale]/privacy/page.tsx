import { createLegalPage } from '@/components/LegalPage';

/**
 * Политика конфиденциальности (ст. 13 GDPR).
 *
 *   /pl/privacy           польская версия — основная
 *   /pl/privacy#cookies   сразу к разделу о cookie
 */

export const dynamic = 'force-dynamic';

const page = createLegalPage({
  slug: 'privacy',
  path: '/privacy',
  navKey: 'privacy',
  description: {
    pl: 'Jakie dane przetwarza serwis, w jakim celu, jak długo je przechowuje i jakie prawa Ci przysługują.',
    ru: 'Какие данные обрабатывает сайт, зачем, как долго хранит и какие у вас права.',
    en: 'What data the site processes, why, for how long, and what your rights are.',
  },
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
