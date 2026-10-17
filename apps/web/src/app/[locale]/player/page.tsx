import { setRequestLocale } from 'next-intl/server';
import { metadataOf } from '@/i18n/metadata';
import { PlayerProfile } from '@/game/screens/PlayerProfile';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => metadataOf(params, '/player');

export default async function PlayerPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PlayerProfile />;
}
