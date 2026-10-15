import { setRequestLocale } from 'next-intl/server';
import { metadataOf } from '@/i18n/metadata';
import { Records } from '@/game/screens/Records';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => metadataOf(params, '/records');

export default async function RecordsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Records />;
}
