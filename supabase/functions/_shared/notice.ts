// What each notification says, in each language of the game, and where it leads.
//
// Kept apart from the functions that send them, so that it is tested without a server.

export type NoticeLocale = 'en' | 'es' | 'ru';

export interface Notice {
  title: string;
  body: string;
  /** The page a tap opens, on the site the browser was subscribed on. */
  url: string;
  /** Notices of one kind take each other's place: a newer one replaces an older one still unread. */
  tag: string;
}

/**
 * What a notice is about:
 * - `weekly`: a new challenge has begun. With the player's place in last week's, if they played it.
 * - `roomStarted`: the host started the game the player was waiting in.
 * - `yourTurn`: everyone else in the player's game has played the round; the clock is running.
 * - `idle`: a life left halfway, a week ago.
 */
export type NoticeAbout =
  | { kind: 'weekly'; place: number | null; entrants: number | null }
  | { kind: 'roomStarted'; seconds: number }
  | { kind: 'yourTurn'; round: number; rounds: number; secondsLeft: number }
  | { kind: 'idle' };

const langOf = (locale: string): NoticeLocale => (locale === 'es' || locale === 'ru' ? locale : 'en');

/** Seconds as a clock shows them: 1:05. */
export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.round(seconds % 60))).padStart(2, '0')}`;

type Words = (about: never) => { title: string; body: string };

const WORDS: Record<NoticeLocale, { [K in NoticeAbout['kind']]: (about: Extract<NoticeAbout, { kind: K }>) => { title: string; body: string } }> = {
  en: {
    weekly: (a) => ({
      title: 'A new weekly challenge',
      body: a.place !== null && a.entrants !== null ? `You came #${a.place} of ${a.entrants} last week. A new one has begun.` : 'One life, one rule, the same world for everyone. See where you rank this week.',
    }),
    roomStarted: (a) => ({ title: 'Your game has started', body: `Everyone lives the same life now. You have ${clock(a.seconds)} for each round.` }),
    yourTurn: (a) => ({ title: 'They are waiting for you', body: `Everyone else has played round ${a.round} of ${a.rounds}. ${clock(a.secondsLeft)} left.` }),
    idle: () => ({ title: 'Your life is waiting', body: 'You left a life halfway. Pick it up where you left it.' }),
  },
  es: {
    weekly: (a) => ({
      title: 'Nuevo reto semanal',
      body: a.place !== null && a.entrants !== null ? `Quedaste #${a.place} de ${a.entrants} la semana pasada. Ya hay uno nuevo.` : 'Una vida, una regla y el mismo mundo para todos. A ver en qué puesto quedas esta semana.',
    }),
    roomStarted: (a) => ({ title: 'Empieza la partida', body: `Todos vivís ya la misma vida. Tienes ${clock(a.seconds)} por ronda.` }),
    yourTurn: (a) => ({ title: 'Faltas tú', body: `Los demás ya han jugado la ronda ${a.round} de ${a.rounds}. Quedan ${clock(a.secondsLeft)}.` }),
    idle: () => ({ title: 'Tu vida te espera', body: 'Dejaste una vida a medias. Sigue donde la dejaste.' }),
  },
  ru: {
    weekly: (a) => ({
      title: 'Новый недельный вызов',
      body: a.place !== null && a.entrants !== null ? `На прошлой неделе у тебя #${a.place} из ${a.entrants}. Начался новый.` : 'Одна жизнь, одно правило и один мир для всех. Посмотри, каким будет твоё место на этой неделе.',
    }),
    roomStarted: (a) => ({ title: 'Партия началась', body: `Все живут одну и ту же жизнь. На каждый раунд у тебя ${clock(a.seconds)}.` }),
    yourTurn: (a) => ({ title: 'Ждут только тебя', body: `Остальные уже сыграли раунд ${a.round} из ${a.rounds}. Осталось ${clock(a.secondsLeft)}.` }),
    idle: () => ({ title: 'Твоя жизнь ждёт', body: 'Одна из твоих жизней осталась на полпути. Продолжи с того же места.' }),
  },
};

const PAGE: Record<NoticeAbout['kind'], string> = { weekly: 'challenge', roomStarted: 'room', yourTurn: 'room', idle: 'play' };
const TAG: Record<NoticeAbout['kind'], string> = { weekly: 'weekly-challenge', roomStarted: 'room', yourTurn: 'room', idle: 'idle-life' };

/** The notice for a browser that asked for notices in a language; one the game does not have reads in English. */
export function noticeOf(locale: string, about: NoticeAbout): Notice {
  const lang = langOf(locale);
  const words = (WORDS[lang][about.kind] as Words)(about as never);
  return { ...words, url: `/${lang}/${PAGE[about.kind]}`, tag: TAG[about.kind] };
}

/** True where a push service says a subscription is gone for good: the browser unsubscribed, or it expired. */
export const gone = (status: number | undefined): boolean => status === 404 || status === 410;

/** The ISO week a moment falls in, in UTC, as the challenges name weeks: "2026-W42". The game's own `weekOf`, held to it by a test. */
export function isoWeek(ms: number): string {
  const DAY_MS = 86_400_000;
  const day = Math.floor(ms / DAY_MS);
  const weekday = ((day + 3) % 7 + 7) % 7 + 1;
  const thursday = new Date((day - weekday + 4) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}
