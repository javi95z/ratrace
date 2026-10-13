import { setRequestLocale } from 'next-intl/server';
import { titleOf } from '@/i18n/titles';
import { Play } from '@/game/screens/Play';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => titleOf(params, 'play');

export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Play />;
}
