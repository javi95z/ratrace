import { describe, expect, it } from 'vitest';
import { byPlayer, deliverExpo, deliverTo, EXPO_BATCH, EXPO_SEND, isApp } from '../../../supabase/functions/_shared/push.ts';
import type { AppDevice, Device, Senders, WebDevice } from '../../../supabase/functions/_shared/push.ts';
import { noticeOf } from '../../../supabase/functions/_shared/notice.ts';
import type { NoticeAbout } from '../../../supabase/functions/_shared/notice.ts';

const browser = (user: string, n = 1, locale = 'es'): WebDevice => ({ endpoint: `https://push.example/${user}/${n}`, p256dh: `p-${n}`, auth: `a-${n}`, locale, user_id: user });
const phone = (user: string, n = 1, locale: string | null = 'es'): AppDevice => ({ token: `ExponentPushToken[${user}-${n}]`, locale, user_id: user });

interface Ticket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Senders that remember what they were asked, a push service that answers as told, and Expo answering each message with a ticket. */
function fakes(options: { web?: boolean; webFails?: (endpoint: string) => number | null; tickets?: (to: string) => Ticket; expoStatus?: number; expoThrows?: boolean } = {}) {
  const web: Array<{ subscription: unknown; payload: string; options: unknown }> = [];
  const posts: Array<{ url: string; headers: Record<string, string>; messages: Array<Record<string, unknown>> }> = [];
  const forgotten: Device[] = [];
  const senders: Senders = {
    web:
      options.web === false
        ? null
        : async (subscription, payload, opts) => {
            web.push({ subscription, payload, options: opts });
            const status = options.webFails?.(subscription.endpoint) ?? null;
            if (status !== null) throw Object.assign(new Error('push service said no'), { statusCode: status });
          },
    post: async (url, init) => {
      if (options.expoThrows) throw new Error('offline');
      const messages = JSON.parse(init.body) as Array<Record<string, unknown>>;
      posts.push({ url, headers: init.headers, messages });
      const status = options.expoStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => (status === 200 ? { data: messages.map((m) => options.tickets?.(m.to as string) ?? { status: 'ok', id: `t-${m.to as string}` }) } : { errors: [{ code: 'INTERNAL_SERVER_ERROR', message: 'down' }] }),
      };
    },
    forget: async (row) => {
      forgotten.push(row);
    },
  };
  return { senders, web, posts, forgotten };
}

const weekly: NoticeAbout = { kind: 'weekly', place: null, entrants: null };

describe('a notice to the browsers and the phones of players', () => {
  it('sends a player with a browser and a phone one of each: the page on the site, the screen in the app', async () => {
    const { senders, web, posts } = fakes();
    expect(await deliverTo([browser('u1'), phone('u1')], () => weekly, 86_400, 'normal', senders)).toEqual({ sent: 2, removed: 0 });
    expect(web).toHaveLength(1);
    expect(JSON.parse(web[0].payload)).toMatchObject({ url: '/es/challenge', tag: 'weekly-challenge' });
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe(EXPO_SEND);
    expect(posts[0].messages).toEqual([
      {
        to: 'ExponentPushToken[u1-1]',
        title: 'Nuevo reto semanal',
        body: noticeOf('es', weekly).body,
        data: { url: 'theratrace://challenge', tag: 'weekly-challenge' },
        ttl: 86_400,
        priority: 'default',
        sound: 'default',
      },
    ]);
    expect(posts[0].headers).toEqual({ accept: 'application/json', 'accept-encoding': 'gzip, deflate', 'content-type': 'application/json' });
  });

  it('forgets a phone Expo says is no longer registered, as a browser the push service says is gone', async () => {
    const { senders, forgotten } = fakes({
      tickets: (to) => (to.includes('dead') ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } } : to.includes('busy') ? { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } } : { status: 'ok', id: 'x' }),
      webFails: (endpoint) => (endpoint.endsWith('/gone') ? 410 : endpoint.endsWith('/down') ? 500 : null),
    });
    const dead = phone('dead');
    const busy = phone('busy');
    const gone = { ...browser('u2'), endpoint: 'https://push.example/gone' };
    const down = { ...browser('u2'), endpoint: 'https://push.example/down' };
    expect(await deliverTo([phone('u1'), dead, busy, gone, down], () => weekly, 60, 'high', senders)).toEqual({ sent: 1, removed: 2 });
    expect(forgotten).toEqual(expect.arrayContaining([dead, gone]));
    expect(forgotten).toHaveLength(2);
  });

  it('sends phones in batches of a hundred, and forgets the right one of a later batch', async () => {
    const many = Array.from({ length: 250 }, (_, i) => phone('p', i));
    const { senders, posts, forgotten } = fakes({ tickets: (to) => (to === 'ExponentPushToken[p-150]' ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' }) });
    expect(EXPO_BATCH).toBe(100);
    expect(await deliverExpo(many, (row) => noticeOf(row.locale, { kind: 'idle' }, 'app'), 86_400, 'normal', senders)).toEqual({ sent: 249, removed: 1 });
    expect(posts.map((p) => p.messages.length)).toEqual([100, 100, 50]);
    expect(forgotten).toEqual([many[150]]);
  });

  it('forgets no phone when Expo cannot be reached or fails, and still tells the browsers', async () => {
    for (const trouble of [{ expoThrows: true }, { expoStatus: 500 }]) {
      const { senders, web, forgotten } = fakes(trouble);
      expect(await deliverTo([browser('u1'), phone('u1')], () => weekly, 60, 'normal', senders)).toEqual({ sent: 1, removed: 0 });
      expect(web).toHaveLength(1);
      expect(forgotten).toEqual([]);
    }
  });

  it('still tells the phones where the game has no keys for browsers', async () => {
    const { senders, posts } = fakes({ web: false });
    expect(await deliverTo([browser('u1'), phone('u1')], () => weekly, 60, 'normal', senders)).toEqual({ sent: 1, removed: 0 });
    expect(posts).toHaveLength(1);
  });

  it('sends with the access token of the game, where it has one', async () => {
    const { senders, posts } = fakes();
    await deliverTo([phone('u1')], () => weekly, 60, 'high', { ...senders, expoToken: 'secret' });
    expect(posts[0].headers.authorization).toBe('Bearer secret');
    expect(posts[0].messages[0].priority).toBe('high');
  });

  it('tells a player with only a phone of the weekly challenge, a life left halfway and their market, each on its screen', async () => {
    const abouts: NoticeAbout[] = [weekly, { kind: 'idle' }, { kind: 'marketMoved', asset: 'bitcoin', percent: 12 }];
    const urls: unknown[] = [];
    for (const about of abouts) {
      const { senders, posts } = fakes();
      expect(await deliverTo([phone('u1', 1, 'en')], () => about, 86_400, 'normal', senders)).toEqual({ sent: 1, removed: 0 });
      urls.push((posts[0].messages[0].data as { url: string }).url);
    }
    expect(urls).toEqual(['theratrace://challenge', 'theratrace://play', 'theratrace://play']);
  });

  it('reads a phone with no language in English', async () => {
    const { senders, posts } = fakes();
    await deliverTo([phone('u1', 1, null)], () => ({ kind: 'idle' }), 60, 'normal', senders);
    expect(posts[0].messages[0].title).toBe('Your life is waiting');
  });

  it('puts a player\'s browsers and phones together, so that the day\'s one notice is claimed once for both', () => {
    const rows: Device[] = [browser('u1', 1), browser('u1', 2), { ...phone('u1'), endpoint: null, p256dh: null, auth: null } as Device, phone('u2')];
    const players = byPlayer(rows);
    expect([...players.keys()]).toEqual(['u1', 'u2']);
    expect(players.get('u1')?.map(isApp)).toEqual([false, false, true]);
  });
});

/** Every notice as a browser was sent it before phones could be told, byte for byte. */
const ABOUTS: NoticeAbout[] = [
  { kind: 'weekly', place: 3, entrants: 41 },
  { kind: 'weekly', place: null, entrants: null },
  { kind: 'roomStarted', seconds: 90 },
  { kind: 'yourTurn', round: 6, rounds: 20, secondsLeft: 72 },
  { kind: 'newRound', round: 6, rounds: 20, seconds: 86_400 },
  { kind: 'rematch' },
  { kind: 'idle' },
  { kind: 'marketMoved', asset: 'bitcoin', percent: -12 },
  { kind: 'loanOffer', who: 'Ana', lend: true, amount: 1_000_000, rateBp: 750, rounds: 3 },
  { kind: 'shout', who: null, n: 13 },
  { kind: 'friendRequest', who: 'Ana' },
  { kind: 'friendAccepted', who: null },
];
const BEFORE = [
  "{\"title\":\"A new weekly challenge\",\"body\":\"You came #3 of 41 last week. A new one has begun.\",\"url\":\"/en/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"A new weekly challenge\",\"body\":\"One life, one rule, the same world for everyone. See where you rank this week.\",\"url\":\"/en/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Your game has started\",\"body\":\"Everyone lives the same life now. You have 1:30 for each round.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"They are waiting for you\",\"body\":\"Everyone else has played round 6 of 20. 1:12 left.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"Round 6 of 20\",\"body\":\"A new round of your game has begun. You have 24 h to play it.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"Rematch!\",\"body\":\"Someone from your last game wants another. Join them from the game.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"Your life is waiting\",\"body\":\"You left a life halfway. Pick it up where you left it.\",\"url\":\"/en/play\",\"tag\":\"idle-life\"}",
  "{\"title\":\"Your market moved\",\"body\":\"Your Bitcoin fell 12% in your last round. Come and see where you stand.\",\"url\":\"/en/play\",\"tag\":\"market-moved\"}",
  "{\"title\":\"Ana offers you a loan\",\"body\":\"$10,000 at 7.5% over 3 rounds. Answer before the round turns.\",\"url\":\"/en/room\",\"tag\":\"room-loan\"}",
  "{\"title\":\"A rival says:\",\"body\":\"Hurry up!\",\"url\":\"/en/room\",\"tag\":\"room-shout\"}",
  "{\"title\":\"A friend request\",\"body\":\"Ana wants to be your friend. Say yes to see each other's lives among your friends.\",\"url\":\"/en/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"You have a new friend\",\"body\":\"A player said yes. Now you see each other's lives among your friends.\",\"url\":\"/en/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Nuevo reto semanal\",\"body\":\"Quedaste #3 de 41 la semana pasada. Ya hay uno nuevo.\",\"url\":\"/es/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Nuevo reto semanal\",\"body\":\"Una vida, una regla y el mismo mundo para todos. A ver en qué puesto quedas esta semana.\",\"url\":\"/es/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Empieza la partida\",\"body\":\"Todos vivís ya la misma vida. Tienes 1:30 por ronda.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"Faltas tú\",\"body\":\"Los demás ya han jugado la ronda 6 de 20. Quedan 1:12.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"Ronda 6 de 20\",\"body\":\"Empieza una ronda nueva de tu partida. Tienes 24 h para jugarla.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"¡Revancha!\",\"body\":\"Alguien de tu última partida quiere otra. Únete desde la partida.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"Tu vida te espera\",\"body\":\"Dejaste una vida a medias. Sigue donde la dejaste.\",\"url\":\"/es/play\",\"tag\":\"idle-life\"}",
  "{\"title\":\"Tu mercado se ha movido\",\"body\":\"Tu Bitcoin ha bajado un 12% en tu última ronda. Pasa a ver cómo estás.\",\"url\":\"/es/play\",\"tag\":\"market-moved\"}",
  "{\"title\":\"Ana te ofrece un préstamo\",\"body\":\"10.000 $ al 7.5% en 3 rondas. Responde antes de que acabe la ronda.\",\"url\":\"/es/room\",\"tag\":\"room-loan\"}",
  "{\"title\":\"Un rival dice:\",\"body\":\"¡Date prisa!\",\"url\":\"/es/room\",\"tag\":\"room-shout\"}",
  "{\"title\":\"Solicitud de amistad\",\"body\":\"Ana quiere ser tu amigo. Acéptala y veréis vuestras vidas entre amigos.\",\"url\":\"/es/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Tienes un amigo nuevo\",\"body\":\"Un jugador ha aceptado. Ya veis vuestras vidas entre amigos.\",\"url\":\"/es/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Новый недельный вызов\",\"body\":\"На прошлой неделе у тебя #3 из 41. Начался новый.\",\"url\":\"/ru/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Новый недельный вызов\",\"body\":\"Одна жизнь, одно правило и один мир для всех. Посмотри, каким будет твоё место на этой неделе.\",\"url\":\"/ru/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Партия началась\",\"body\":\"Все живут одну и ту же жизнь. На каждый раунд у тебя 1:30.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Ждут только тебя\",\"body\":\"Остальные уже сыграли раунд 6 из 20. Осталось 1:12.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Раунд 6 из 20\",\"body\":\"В твоей партии начался новый раунд. На него у тебя 24 ч.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Реванш!\",\"body\":\"Кто-то из твоей последней партии хочет ещё одну. Присоединяйся из партии.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Твоя жизнь ждёт\",\"body\":\"Одна из твоих жизней осталась на полпути. Продолжи с того же места.\",\"url\":\"/ru/play\",\"tag\":\"idle-life\"}",
  "{\"title\":\"Твой рынок сдвинулся\",\"body\":\"Bitcoin: −12% за твой последний раунд. Загляни, посмотри, как дела.\",\"url\":\"/ru/play\",\"tag\":\"market-moved\"}",
  "{\"title\":\"Ana предлагает тебе заём\",\"body\":\"10 000 $ под 7.5% на 3 раунда. Ответь до конца раунда.\",\"url\":\"/ru/room\",\"tag\":\"room-loan\"}",
  "{\"title\":\"Соперник говорит:\",\"body\":\"Поторопись!\",\"url\":\"/ru/room\",\"tag\":\"room-shout\"}",
  "{\"title\":\"Заявка в друзья\",\"body\":\"Ana хочет дружить. Прими заявку, и вы будете видеть жизни друг друга среди друзей.\",\"url\":\"/ru/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Новый друг\",\"body\":\"Игрок принимает заявку. Теперь вы видите жизни друг друга среди друзей.\",\"url\":\"/ru/rankings#friends\",\"tag\":\"friends\"}",
];

describe('what a browser is sent', () => {
  it('is what it was before phones, byte for byte, with the same options and keys', async () => {
    const sent: string[] = [];
    let index = 0;
    for (const locale of ['en', 'es', 'ru']) {
      for (const about of ABOUTS) {
        const { senders, web, posts } = fakes();
        const row = { ...browser('u1', index, locale), token: null };
        expect(await deliverTo([row], () => about, 3_600, 'high', senders)).toEqual({ sent: 1, removed: 0 });
        expect(posts).toEqual([]);
        expect(web[0].subscription).toEqual({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });
        expect(web[0].options).toEqual({ TTL: 3_600, urgency: 'high' });
        sent.push(web[0].payload);
        index += 1;
      }
    }
    expect(sent).toEqual(BEFORE);
  });
});
