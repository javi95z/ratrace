import { setRequestLocale } from 'next-intl/server';
import { Collection } from '@/game/screens/Collection';

export default async function CollectionPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Collection />;
}
