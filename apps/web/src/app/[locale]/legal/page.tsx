import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { metadataOf } from '@/i18n/metadata';
import { LEGAL_EMAIL, LEGAL_NAME } from '@/lib/site';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) => metadataOf(params, '/legal');

/** Privacy and the legal notice: plain words, reached only from the foot of the front page. */
export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });
  const common = await getTranslations({ locale, namespace: 'common' });
  const sections = [
    [t('noticeTitle'), t('noticeBody')],
    [t('dataTitle'), t('dataBody')],
    [t('whyTitle'), t('whyBody')],
    [t('whoTitle'), t('whoBody')],
    [t('deviceTitle'), t('deviceBody')],
    [t('rightsTitle'), t('rightsBody')],
  ] as const;

  return (
    <main className="mx-auto flex min-h-safe w-full max-w-2xl flex-col gap-4 px-3 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
          ←
        </Link>
        <h1 className="pixel text-[22px] text-gold-500">{t('title')}</h1>
      </div>
      {sections.map(([title, body], at) => (
        <section key={title}>
          <h2 className="pixel text-[16px] text-cream">{title}</h2>
          <p className="mt-1 text-[14px] leading-snug text-ink-200">{body}</p>
          {at === 0 && (LEGAL_NAME || LEGAL_EMAIL) ? (
            <p className="mt-1 text-[14px] leading-snug text-ink-200">
              {LEGAL_NAME ? t('owner', { name: LEGAL_NAME }) : null} {LEGAL_EMAIL ? t('contact', { email: LEGAL_EMAIL }) : null}
            </p>
          ) : null}
        </section>
      ))}
      <p className="text-[12px] text-ink-300">{t('updated')}</p>
    </main>
  );
}
