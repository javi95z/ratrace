import { setRequestLocale } from 'next-intl/server';
import { NewLife } from '@/game/screens/NewLife';

export default async function NewLifePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <NewLife />;
}
