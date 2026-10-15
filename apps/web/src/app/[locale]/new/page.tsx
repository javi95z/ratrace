import { setRequestLocale } from 'next-intl/server';
import { metadataOf } from '@/i18n/metadata';
import { NewLife } from '@/game/screens/NewLife';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => metadataOf(params, '/new');

export default async function NewLifePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <NewLife />;
}
