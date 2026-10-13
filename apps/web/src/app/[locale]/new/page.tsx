import { setRequestLocale } from 'next-intl/server';
import { titleOf } from '@/i18n/titles';
import { NewLife } from '@/game/screens/NewLife';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => titleOf(params, 'new');

export default async function NewLifePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <NewLife />;
}
