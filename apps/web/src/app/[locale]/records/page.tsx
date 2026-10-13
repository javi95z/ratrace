import { setRequestLocale } from 'next-intl/server';
import { Records } from '@/game/screens/Records';

export default async function RecordsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Records />;
}
