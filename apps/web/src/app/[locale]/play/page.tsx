import { setRequestLocale } from 'next-intl/server';
import { metadataOf } from '@/i18n/metadata';
import { Play } from '@/game/screens/Play';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => metadataOf(params, '/play');

export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Play />;
}
