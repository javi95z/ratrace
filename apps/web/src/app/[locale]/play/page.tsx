import { setRequestLocale } from 'next-intl/server';
import { Play } from '@/game/screens/Play';

export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Play />;
}
