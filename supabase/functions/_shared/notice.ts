// What the weekly notification says, in each language of the game, and where it leads.
//
// Kept apart from the function that sends it, so that it is tested without a server.

export type NoticeLocale = 'en' | 'es' | 'ru';

export interface Notice {
  title: string;
  body: string;
  /** The page a tap opens, on the site the browser was subscribed on. */
  url: string;
  /** One notice a week is enough: a newer one takes the place of an older one still unread. */
  tag: string;
}

const WORDS: Record<NoticeLocale, { title: string; body: string }> = {
  en: { title: 'A new weekly challenge', body: 'One life, one rule, the same world for everyone. See where you rank this week.' },
  es: { title: 'Nuevo reto semanal', body: 'Una vida, una regla y el mismo mundo para todos. A ver en qué puesto quedas esta semana.' },
  ru: { title: 'Новый недельный вызов', body: 'Одна жизнь, одно правило и один мир для всех. Посмотри, каким будет твоё место на этой неделе.' },
};

/** The notice for a browser that asked for it in a language; one the game does not have reads in English. */
export function noticeOf(locale: string): Notice {
  const lang: NoticeLocale = locale === 'es' || locale === 'ru' ? locale : 'en';
  return { ...WORDS[lang], url: `/${lang}/challenge`, tag: 'weekly-challenge' };
}

/** True where a push service says a subscription is gone for good: the browser unsubscribed, or it expired. */
export const gone = (status: number | undefined): boolean => status === 404 || status === 410;
