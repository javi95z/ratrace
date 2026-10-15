import { setRequestLocale } from 'next-intl/server';
import { metadataOf } from '@/i18n/metadata';
import { Collection } from '@/game/screens/Collection';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => metadataOf(params, '/collection');

export default async function CollectionPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Collection />;
}
