import { setRequestLocale } from 'next-intl/server';
import { WeeklyChallenge } from '@/game/screens/Challenge';
import { metadataOf } from '@/i18n/metadata';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => metadataOf(params, '/challenge');

export default async function WeeklyChallengePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <WeeklyChallenge />;
}
