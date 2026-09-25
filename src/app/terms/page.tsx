import { createLegalPage } from '@/components/LegalPage';

/**
 * Условия консультаций: информация для потребителя перед удалённым договором
 * (закон о правах потребителя, ст. 12).
 */

export const dynamic = 'force-dynamic';

const page = createLegalPage({
  slug: 'terms',
  basePath: '/terms',
  fallbackTitle: 'Warunki konsultacji',
  description: 'Jak umówić konsultację, ile kosztuje, jak ją odwołać i jak złożyć reklamację.',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
