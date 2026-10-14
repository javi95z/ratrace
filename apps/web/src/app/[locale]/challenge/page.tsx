import { setRequestLocale } from 'next-intl/server';
import { WeeklyChallenge } from '@/game/screens/Challenge';
import { titleOf } from '@/i18n/titles';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => titleOf(params, 'challenge');

export default async function WeeklyChallengePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <WeeklyChallenge />;
}
