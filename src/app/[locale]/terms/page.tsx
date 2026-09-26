import { createLegalPage } from '@/components/LegalPage';

/**
 * Условия консультаций: информация для потребителя перед удалённым договором
 * (закон о правах потребителя, ст. 12).
 */

export const dynamic = 'force-dynamic';

const page = createLegalPage({
  slug: 'terms',
  path: '/terms',
  navKey: 'terms',
  description: {
    pl: 'Jak umówić konsultację, ile kosztuje, jak ją odwołać i jak złożyć reklamację.',
    ru: 'Как записаться на консультацию, сколько она стоит, как её отменить и подать жалобу.',
    en: 'How to book a session, what it costs, how to cancel it and how to file a complaint.',
  },
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
