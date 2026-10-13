import { setRequestLocale } from 'next-intl/server';
import { titleOf } from '@/i18n/titles';
import { Rankings } from '@/game/screens/Rankings';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => titleOf(params, 'rankings');

export default async function RankingsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Rankings />;
}
