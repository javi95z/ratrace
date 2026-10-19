import { readFileSync } from 'node:fs';
import { weekOf } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { clock, isoWeek, noticeOf, SHOUT_FACES, shoutText, span } from '../../../supabase/functions/_shared/notice.ts';

describe('what a notice says', () => {
  it('names the week as the game does, every day of a few years', () => {
    for (let day = Date.UTC(2025, 11, 20); day < Date.UTC(2028, 0, 10); day += 86_400_000) expect(isoWeek(day)).toBe(weekOf(day));
  });

  it('tells the place of last week with the new challenge, or only the new one to who did not play', () => {
    expect(noticeOf('es', { kind: 'weekly', place: 3, entrants: 41 })).toEqual({ title: 'Nuevo reto semanal', body: 'Quedaste #3 de 41 la semana pasada. Ya hay uno nuevo.', url: '/es/challenge', tag: 'weekly-challenge' });
    expect(noticeOf('en', { kind: 'weekly', place: null, entrants: null }).body).toContain('See where you rank this week');
  });

  it('leads a game\'s notices to the game, and a life left halfway to the game in play', () => {
    expect(noticeOf('es', { kind: 'yourTurn', round: 6, rounds: 20, secondsLeft: 72 })).toEqual({ title: 'Faltas tú', body: 'Los demás ya han jugado la ronda 6 de 20. Quedan 1:12.', url: '/es/room', tag: 'room' });
    expect(noticeOf('ru', { kind: 'roomStarted', seconds: 90 }).url).toBe('/ru/room');
    expect(noticeOf('en', { kind: 'idle' })).toMatchObject({ url: '/en/play', tag: 'idle-life' });
    expect(noticeOf('es', { kind: 'rematch' })).toMatchObject({ title: '¡Revancha!', url: '/es/room', tag: 'room' });
  });

  it('reads in English for a language the game does not have, and shows seconds as a clock does', () => {
    expect(noticeOf('fr', { kind: 'idle' }).title).toBe('Your life is waiting');
    expect([clock(5), clock(90), clock(300)]).toEqual(['0:05', '1:30', '5:00']);
    expect([span(90, 'es'), span(86_400, 'es'), span(18_720, 'ru')]).toEqual(['1:30', '24 h', '5 ч 12 мин']);
    expect(noticeOf('es', { kind: 'newRound', round: 6, rounds: 20, seconds: 86_400 })).toMatchObject({ title: 'Ronda 6 de 20', body: 'Empieza una ronda nueva de tu partida. Tienes 24 h para jugarla.', url: '/es/room' });
  });

  it('says a shout as the player who sent it, in the words of the page', () => {
    expect(noticeOf('es', { kind: 'shout', who: 'Ana', n: 13 })).toEqual({ title: 'Ana dice:', body: '¡Date prisa!', url: '/es/room', tag: 'room-shout' });
    expect(noticeOf('en', { kind: 'shout', who: null, n: 2 })).toMatchObject({ title: 'A rival says:', body: '🔥' });
    for (const lang of ['en', 'es', 'ru'] as const) {
      const page = JSON.parse(readFileSync(new URL(`../../../packages/i18n/messages/${lang}.json`, import.meta.url), 'utf8')) as { room: Record<string, string> };
      for (let i = 0; i < 8; i++) expect(shoutText(SHOUT_FACES.length + i, lang), `${lang} shout${i}`).toBe(page.room[`shout${i}`]);
    }
  });
});
