import { setRequestLocale } from 'next-intl/server';
import { titleOf } from '@/i18n/titles';
import { Collection } from '@/game/screens/Collection';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => titleOf(params, 'collection');

export default async function CollectionPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Collection />;
}
