import { setRequestLocale } from 'next-intl/server';
import { titleOf } from '@/i18n/titles';
import { Records } from '@/game/screens/Records';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => titleOf(params, 'records');

export default async function RecordsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Records />;
}
