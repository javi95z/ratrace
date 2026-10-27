// What each notification says, in each language of the game, and where it leads.
//
// Kept apart from the functions that send them, so that it is tested without a server.

import { assetName } from './market.ts';

export type NoticeLocale = 'en' | 'es' | 'ru';

export interface Notice {
  title: string;
  body: string;
  /** The page a tap opens: on the site the browser was subscribed on, or the app's screen (`theratrace://<page>`) on a phone. */
  url: string;
  /** Notices of one kind take each other's place: a newer one replaces an older one still unread. */
  tag: string;
  /**
   * On a phone, the buttons the notice shows (the app registers them under this name, in the game's language: `apps/mobile/src/online/push.ts`),
   * and the link each opens, by its name. None on the web.
   */
  category?: string;
  actions?: Record<string, string>;
}

/**
 * What a notice is about:
 * - `weekly`: a new challenge has begun. With the player's place in last week's, if they played it.
 * - `roomStarted`: the host started the game the player was waiting in.
 * - `yourTurn`: everyone else in the player's game has played the round; the clock is running.
 * - `newRound`: in a game of a round a day, the next round has begun.
 * - `rematch`: someone from a game that is over has opened its rematch.
 * - `idle`: a life left halfway, a week ago.
 * - `loanOffer`: another player of the game offers to lend the player money, or asks to borrow it.
 * - `marketMoved`: something the player holds in their ranked life moved 5% or more in the round they last played.
 *   `percent` is signed, in whole percent; `asset` is the asset's id, named here in the player's language.
 * - `shout`: another player of the game said something, by its number among the game's shouts.
 * - `friendRequest`: another player (`from`, their id) asks to be the player's friend.
 * - `friendAccepted`: a player the player asked said yes.
 * - `roomInvite`: a friend asks the player into the game they are waiting in (`code`, its code).
 */
export type NoticeAbout =
  | { kind: 'weekly'; place: number | null; entrants: number | null }
  | { kind: 'roomStarted'; seconds: number }
  | { kind: 'yourTurn'; round: number; rounds: number; secondsLeft: number }
  | { kind: 'newRound'; round: number; rounds: number; seconds: number }
  | { kind: 'rematch' }
  | { kind: 'idle' }
  | { kind: 'marketMoved'; asset: string; percent: number }
  | { kind: 'loanOffer'; who: string | null; lend: boolean; amount: number; rateBp: number; rounds: number }
  | { kind: 'shout'; who: string | null; n: number }
  | { kind: 'friendRequest'; who: string | null; from?: string }
  | { kind: 'friendAccepted'; who: string | null }
  | { kind: 'roomInvite'; who: string | null; code: string };

/** The six faces a player may shout, which no language changes. The page's own list, held to it by a test. */
export const SHOUT_FACES = ['😂', '😱', '🔥', '💸', '👑', '👋'] as const;

/** The eight phrases a player may shout after the faces, in each language. The page's own, held to them by a test. */
const SHOUT_PHRASES: Record<NoticeLocale, readonly string[]> = {
  en: ['Well played!', 'Coming for you!', 'Lucky you!', 'What a round…', 'To the moon!', "I'm going broke", 'Patience…', 'Hurry up!'],
  es: ['¡Bien jugado!', '¡Voy a por ti!', '¡Qué suerte!', 'Vaya ronda…', '¡A la luna!', 'Me arruino', 'Paciencia…', '¡Date prisa!'],
  ru: ['Хорошо сыграно!', 'Иду за тобой!', 'Везёт же!', 'Ну и раунд…', 'На Луну!', 'Я разоряюсь', 'Терпение…', 'Поторопись!'],
};

/** What a shout says: a face, or a phrase. */
export const shoutText = (n: number, lang: NoticeLocale): string => (n < SHOUT_FACES.length ? SHOUT_FACES[n] : (SHOUT_PHRASES[lang][n - SHOUT_FACES.length] ?? ''));

const langOf = (locale: string | null): NoticeLocale => (locale === 'es' || locale === 'ru' ? locale : 'en');

/** Seconds as a clock shows them: 1:05. */
export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.round(seconds % 60))).padStart(2, '0')}`;

const HOURS: Record<NoticeLocale, [string, string]> = { en: ['h', 'min'], es: ['h', 'min'], ru: ['ч', 'мин'] };

/** A span of time as a person says it: a clock under an hour, hours and minutes above. */
export function span(seconds: number, lang: NoticeLocale): string {
  if (seconds < 3_600) return clock(seconds);
  const [h, min] = HOURS[lang];
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return minutes === 0 ? `${hours} ${h}` : `${hours} ${h} ${minutes} ${min}`;
}

/** Whole dollars from cents, written as each language writes money: $10,000, 10.000 $, 10 000 $. */
export function money(cents: number, lang: NoticeLocale): string {
  const digits = String(Math.round(Math.abs(cents) / 100));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : lang === 'es' ? '.' : ' ');
  return lang === 'en' ? `$${grouped}` : `${grouped} $`;
}
/** What a market notice calls the asset: its name in the language, or its id for one the notice has no name for. */
const named = (about: { asset: string }, lang: NoticeLocale): string => assetName(about.asset, lang) ?? about.asset;
const pct = (bp: number) => `${bp / 100}%`;

type Words = (about: never) => { title: string; body: string };

const WORDS: Record<NoticeLocale, { [K in NoticeAbout['kind']]: (about: Extract<NoticeAbout, { kind: K }>) => { title: string; body: string } }> = {
  en: {
    weekly: (a) => ({
      title: 'A new weekly challenge',
      body: a.place !== null && a.entrants !== null ? `You came #${a.place} of ${a.entrants} last week. A new one has begun.` : 'One life, one rule, the same world for everyone. See where you rank this week.',
    }),
    roomStarted: (a) => ({ title: 'Your game has started', body: `Everyone lives the same life now. You have ${span(a.seconds, 'en')} for each round.` }),
    yourTurn: (a) => ({ title: 'They are waiting for you', body: `Everyone else has played round ${a.round} of ${a.rounds}. ${span(a.secondsLeft, 'en')} left.` }),
    newRound: (a) => ({ title: `Round ${a.round} of ${a.rounds}`, body: `A new round of your game has begun. You have ${span(a.seconds, 'en')} to play it.` }),
    rematch: () => ({ title: 'Rematch!', body: 'Someone from your last game wants another. Join them from the game.' }),
    idle: () => ({ title: 'Your life is waiting', body: 'You left a life halfway. Pick it up where you left it.' }),
    marketMoved: (a) => ({ title: 'Your market moved', body: `Your ${named(a, 'en')} ${a.percent > 0 ? 'rose' : 'fell'} ${Math.abs(a.percent)}% in your last round. Come and see where you stand.` }),
    loanOffer: (a) => ({
      title: a.lend ? `${a.who ?? 'A rival'} offers you a loan` : `${a.who ?? 'A rival'} asks you for a loan`,
      body: `${money(a.amount, 'en')} at ${pct(a.rateBp)} over ${a.rounds} ${a.rounds === 1 ? 'round' : 'rounds'}. Answer before the round turns.`,
    }),
    shout: (a) => ({ title: `${a.who ?? 'A rival'} says:`, body: shoutText(a.n, 'en') }),
    friendRequest: (a) => ({ title: 'A friend request', body: `${a.who ?? 'A player'} wants to be your friend. Say yes to see each other's lives among your friends.` }),
    friendAccepted: (a) => ({ title: 'You have a new friend', body: `${a.who ?? 'A player'} said yes. Now you see each other's lives among your friends.` }),
    roomInvite: (a) => ({ title: `${a.who ?? 'A friend'} invites you to a game`, body: 'Everyone lives the same life, in the same world. Join before it starts.' }),
  },
  es: {
    weekly: (a) => ({
      title: 'Nuevo reto semanal',
      body: a.place !== null && a.entrants !== null ? `Quedaste #${a.place} de ${a.entrants} la semana pasada. Ya hay uno nuevo.` : 'Una vida, una regla y el mismo mundo para todos. A ver en qué puesto quedas esta semana.',
    }),
    roomStarted: (a) => ({ title: 'Empieza la partida', body: `Todos vivís ya la misma vida. Tienes ${span(a.seconds, 'es')} por ronda.` }),
    yourTurn: (a) => ({ title: 'Faltas tú', body: `Los demás ya han jugado la ronda ${a.round} de ${a.rounds}. Quedan ${span(a.secondsLeft, 'es')}.` }),
    newRound: (a) => ({ title: `Ronda ${a.round} de ${a.rounds}`, body: `Empieza una ronda nueva de tu partida. Tienes ${span(a.seconds, 'es')} para jugarla.` }),
    rematch: () => ({ title: '¡Revancha!', body: 'Alguien de tu última partida quiere otra. Únete desde la partida.' }),
    idle: () => ({ title: 'Tu vida te espera', body: 'Dejaste una vida a medias. Sigue donde la dejaste.' }),
    marketMoved: (a) => ({ title: 'Tu mercado se ha movido', body: `Tu ${named(a, 'es')} ha ${a.percent > 0 ? 'subido' : 'bajado'} un ${Math.abs(a.percent)}% en tu última ronda. Pasa a ver cómo estás.` }),
    loanOffer: (a) => ({
      title: a.lend ? `${a.who ?? 'Un rival'} te ofrece un préstamo` : `${a.who ?? 'Un rival'} te pide un préstamo`,
      body: `${money(a.amount, 'es')} al ${pct(a.rateBp)} en ${a.rounds} ${a.rounds === 1 ? 'ronda' : 'rondas'}. Responde antes de que acabe la ronda.`,
    }),
    shout: (a) => ({ title: `${a.who ?? 'Un rival'} dice:`, body: shoutText(a.n, 'es') }),
    friendRequest: (a) => ({ title: 'Solicitud de amistad', body: `${a.who ?? 'Un jugador'} quiere ser tu amigo. Acéptala y veréis vuestras vidas entre amigos.` }),
    friendAccepted: (a) => ({ title: 'Tienes un amigo nuevo', body: `${a.who ?? 'Un jugador'} ha aceptado. Ya veis vuestras vidas entre amigos.` }),
    roomInvite: (a) => ({ title: `${a.who ?? 'Un amigo'} te invita a una partida`, body: 'Todos vivís la misma vida, en el mismo mundo. Únete antes de que empiece.' }),
  },
  ru: {
    weekly: (a) => ({
      title: 'Новый недельный вызов',
      body: a.place !== null && a.entrants !== null ? `На прошлой неделе у тебя #${a.place} из ${a.entrants}. Начался новый.` : 'Одна жизнь, одно правило и один мир для всех. Посмотри, каким будет твоё место на этой неделе.',
    }),
    roomStarted: (a) => ({ title: 'Партия началась', body: `Все живут одну и ту же жизнь. На каждый раунд у тебя ${span(a.seconds, 'ru')}.` }),
    yourTurn: (a) => ({ title: 'Ждут только тебя', body: `Остальные уже сыграли раунд ${a.round} из ${a.rounds}. Осталось ${span(a.secondsLeft, 'ru')}.` }),
    newRound: (a) => ({ title: `Раунд ${a.round} из ${a.rounds}`, body: `В твоей партии начался новый раунд. На него у тебя ${span(a.seconds, 'ru')}.` }),
    rematch: () => ({ title: 'Реванш!', body: 'Кто-то из твоей последней партии хочет ещё одну. Присоединяйся из партии.' }),
    idle: () => ({ title: 'Твоя жизнь ждёт', body: 'Одна из твоих жизней осталась на полпути. Продолжи с того же места.' }),
    marketMoved: (a) => ({ title: 'Твой рынок сдвинулся', body: `${named(a, 'ru')}: ${a.percent > 0 ? '+' : '−'}${Math.abs(a.percent)}% за твой последний раунд. Загляни, посмотри, как дела.` }),
    loanOffer: (a) => ({
      title: a.lend ? `${a.who ?? 'Соперник'} предлагает тебе заём` : `${a.who ?? 'Соперник'} просит у тебя в долг`,
      body: `${money(a.amount, 'ru')} под ${pct(a.rateBp)} на ${a.rounds} ${a.rounds === 1 ? 'раунд' : a.rounds < 5 ? 'раунда' : 'раундов'}. Ответь до конца раунда.`,
    }),
    shout: (a) => ({ title: `${a.who ?? 'Соперник'} говорит:`, body: shoutText(a.n, 'ru') }),
    friendRequest: (a) => ({ title: 'Заявка в друзья', body: `${a.who ?? 'Игрок'} хочет дружить. Прими заявку, и вы будете видеть жизни друг друга среди друзей.` }),
    friendAccepted: (a) => ({ title: 'Новый друг', body: `${a.who ?? 'Игрок'} принимает заявку. Теперь вы видите жизни друг друга среди друзей.` }),
    roomInvite: (a) => ({ title: `${a.who ?? 'Друг'} зовёт тебя в партию`, body: 'Все живут одну и ту же жизнь в одном мире. Присоединяйся, пока партия не началась.' }),
  },
};

/** The page each notice opens: the friends are on the games with others' page, beside the ways to play with them. */
const PAGE: Record<Exclude<NoticeAbout['kind'], 'roomInvite'>, string> = { weekly: 'challenge', roomStarted: 'room', yourTurn: 'room', newRound: 'room', rematch: 'room', idle: 'play', marketMoved: 'play', loanOffer: 'room', shout: 'room', friendRequest: 'room', friendAccepted: 'room' };
const TAG: Record<NoticeAbout['kind'], string> = { weekly: 'weekly-challenge', roomStarted: 'room', yourTurn: 'room', newRound: 'room', rematch: 'room', idle: 'idle-life', marketMoved: 'market-moved', loanOffer: 'room-loan', shout: 'room-shout', friendRequest: 'friends', friendAccepted: 'friends', roomInvite: 'room-invite' };

/** The page a notice opens, after the language or the app's scheme: an invitation opens the game it names, by its code. */
const pageOf = (about: NoticeAbout): string => (about.kind === 'roomInvite' ? `room?code=${about.code}` : PAGE[about.kind]);

/** Where a tap on a phone's notice leads: the app's own links. */
export const APP_LINK = 'theratrace://';

/**
 * The notice for a browser, or a phone with the app (`on: 'app'`), that asked for notices in a
 * language; one the game does not have, or none, reads in English. The words are the same on both:
 * a browser is led to the page on the site in its language, a phone to the screen in the app (`theratrace://room` for the friends).
 */
export function noticeOf(locale: string | null, about: NoticeAbout, on: 'web' | 'app' = 'web'): Notice {
  const lang = langOf(locale);
  const words = (WORDS[lang][about.kind] as Words)(about as never);
  const notice: Notice = { ...words, url: on === 'app' ? `${APP_LINK}${pageOf(about)}` : `/${lang}/${pageOf(about)}`, tag: TAG[about.kind] };
  return on === 'app' ? { ...notice, ...buttonsOf(about) } : notice;
}

/** The names a phone knows the notices' buttons by: a friend request's Accept and Decline, an invitation's Join. */
export const FRIEND_REQUEST = 'friend-request';
export const ROOM_INVITE = 'room-invite';

/**
 * The buttons of a notice on a phone, and what each opens: a friend request is answered from its notice (the friends, on the games with others'
 * page, answering it, `theratrace://room?accept=<id>`), an invitation joined (`theratrace://room?code=<code>`). Nothing for the rest, nor for a
 * request that does not say who asked.
 */
function buttonsOf(about: NoticeAbout): Pick<Notice, 'category' | 'actions'> {
  if (about.kind === 'roomInvite') return { category: ROOM_INVITE, actions: { join: `${APP_LINK}room?code=${about.code}` } };
  if (about.kind !== 'friendRequest' || about.from === undefined) return {};
  const answer = (how: 'accept' | 'decline') => `${APP_LINK}room?${how}=${about.from}`;
  return { category: FRIEND_REQUEST, actions: { accept: answer('accept'), decline: answer('decline') } };
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
