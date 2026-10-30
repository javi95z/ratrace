import { describe, expect, it, vi } from 'vitest';
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { followAccountLanguage, languageChoices, languageOnSignIn } from './language';
import type { LanguageNote, LastAccount } from './language';

/*
 * The web's cases (apps/web/src/online/language.test.ts), on the phone: the language is set in the game, not put in an address. (The web's file
 * is not run here: it names the web's routing, which the phone's build does not resolve.)
 */

/** An account whose state the test moves along. */
function accountAt(first: AccountState) {
  let state = first;
  const listeners = new Set<() => void>();
  const account = { state: () => state, subscribe: (listener: () => void) => (listeners.add(listener), () => listeners.delete(listener)) } as unknown as Account;
  return { account, become: (next: AccountState) => ((state = next), listeners.forEach((listener) => listener())) };
}

const keeping = (language: string | null) => () => ({ me: async () => ({ nickname: null, friendCode: 'X', avatar: null, language }) }) as unknown as Community;
const noted = (first: string | null = null): LastAccount & { now: string | null } => {
  const last = { now: first, read: () => last.now, write: (id: string) => void (last.now = id) };
  return last;
};

const nothingWaiting = () => false;

/** The device's note of a choice not yet kept with the account. */
const notedChoice = (first: string | null = null): LanguageNote & { now: string | null } => {
  const note = { now: first, read: () => note.now, write: (language: string) => void (note.now = language), clear: () => void (note.now = null) };
  return note;
};

/** The account's side of it: what it was told, and whether it says yes. */
function keeper() {
  const kept: string[] = [];
  const server = { kept, down: false, setLanguage: async (language: string) => (server.down ? false : (kept.push(language), true)) };
  return server;
}

/** A page that tells when a test asks: the connection back, the app in front again. */
function aPage() {
  const told = new Set<() => void>();
  return { onOnline: (listener: () => void) => (told.add(listener), () => void told.delete(listener)), onShown: () => () => undefined, now: () => 0, tell: () => told.forEach((listener) => listener()) };
}

const someone = (userId = 'guest-1'): AccountState => ({ kind: 'guest', userId, notice: null });

describe('the language the player chooses', () => {
  it('is kept with the account once, and the note goes when the server says so', async () => {
    const { account } = accountAt(someone());
    const server = keeper();
    const note = notedChoice();
    const choices = languageChoices(account, () => server as unknown as Community, note);
    choices.choose('es');
    expect(note.now).toBe('es');
    await vi.waitFor(() => expect(note.now).toBeNull());
    expect(server.kept).toEqual(['es']);
  });

  it('with the server out of reach waits on the device, and is sent once when the connection is back', async () => {
    const { account } = accountAt(someone());
    const server = keeper();
    server.down = true;
    const note = notedChoice();
    const page = aPage();
    const choices = languageChoices(account, () => server as unknown as Community, note);
    const stop = choices.keepSending(page);
    choices.choose('es');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(note.now).toBe('es');
    expect(server.kept).toEqual([]);
    server.down = false;
    page.tell();
    page.tell();
    await vi.waitFor(() => expect(note.now).toBeNull());
    expect(server.kept).toEqual(['es']);
    stop();
  });

  it('with nobody signed in waits for someone to be, and goes to them', async () => {
    const { account, become } = accountAt({ kind: 'offline' });
    const server = keeper();
    const note = notedChoice();
    const choices = languageChoices(account, () => server as unknown as Community, note);
    const stop = choices.keepSending(aPage());
    choices.choose('ru');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(server.kept).toEqual([]);
    become(someone());
    await vi.waitFor(() => expect(note.now).toBeNull());
    expect(server.kept).toEqual(['ru']);
    stop();
  });

  it('left noted by another document (the web\'s page change) or another start is sent as it starts, once', async () => {
    const { account } = accountAt(someone());
    const server = keeper();
    const note = notedChoice('es');
    const stop = languageChoices(account, () => server as unknown as Community, note).keepSending(aPage());
    await vi.waitFor(() => expect(note.now).toBeNull());
    expect(server.kept).toEqual(['es']);
    stop();
  });

  it('chosen again while the first is on its way: the last is what the account ends with, and the note is not taken away from it', async () => {
    const { account } = accountAt(someone());
    let answer: (yes: boolean) => void = () => undefined;
    const kept: string[] = [];
    const community = { setLanguage: (language: string) => (kept.push(language), new Promise<boolean>((resolve) => (answer = resolve))) } as unknown as Community;
    const note = notedChoice();
    const choices = languageChoices(account, () => community, note);
    choices.choose('es');
    choices.choose('ru');
    expect(kept).toEqual(['es']);
    answer(true);
    await vi.waitFor(() => expect(kept).toEqual(['es', 'ru']));
    expect(note.now).toBe('ru');
    answer(true);
    await vi.waitFor(() => expect(note.now).toBeNull());
  });

  it('on its way as someone else signs in is sent to them too', async () => {
    const { account, become } = accountAt(someone());
    let answer: (yes: boolean) => void = () => undefined;
    const kept: string[] = [];
    const community = { setLanguage: (language: string) => (kept.push(language), new Promise<boolean>((resolve) => (answer = resolve))) } as unknown as Community;
    const note = notedChoice();
    languageChoices(account, () => community, note).choose('es');
    become({ kind: 'member', userId: 'member-1', email: null });
    answer(true);
    await vi.waitFor(() => expect(kept).toEqual(['es', 'es']));
    expect(note.now).toBe('es');
    answer(true);
    await vi.waitFor(() => expect(note.now).toBeNull());
  });

  it('a note that is no language of the game is dropped, not sent', async () => {
    const { account } = accountAt(someone());
    const server = keeper();
    const note = notedChoice('fr');
    languageChoices(account, () => server as unknown as Community, note).keepSending(aPage())();
    await vi.waitFor(() => expect(note.now).toBeNull());
    expect(server.kept).toEqual([]);
  });

  it('stops listening when told', async () => {
    const { account } = accountAt(someone());
    const server = keeper();
    server.down = true;
    const note = notedChoice('es');
    const page = aPage();
    const stop = languageChoices(account, () => server as unknown as Community, note).keepSending(page);
    await new Promise((resolve) => setTimeout(resolve, 5));
    stop();
    server.down = false;
    page.tell();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(server.kept).toEqual([]);
  });
});

describe('the language of an account', () => {
  it('is brought to the game by a sign-in, not by an ordinary start, as on the web', () => {
    const cases = [
      { before: 'guest-1', now: 'member-1', kept: 'es', showing: 'en' },
      // The same player, kept with Google, or simply opening the game again.
      { before: 'member-1', now: 'member-1', kept: 'es', showing: 'en' },
      // A device that never noted anyone cannot tell a sign-in from a start.
      { before: null, now: 'member-1', kept: 'es', showing: 'en' },
      // Already in it, or a language the game does not speak.
      { before: 'guest-1', now: 'member-1', kept: 'en', showing: 'en' },
      { before: 'guest-1', now: 'member-1', kept: 'fr', showing: 'en' },
      { before: 'guest-1', now: 'member-1', kept: null, showing: 'en' },
    ];
    expect(cases.map(languageOnSignIn)).toEqual(['es', null, null, null, null, null]);
  });

  it('changes the game\'s language when a guest of this phone signs in to an account kept in another', async () => {
    const { account, become } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const go = vi.fn();
    const last = noted();
    followAccountLanguage(account, keeping('es'), 'en', last, go, nothingWaiting);
    expect(last.now).toBe('guest-1');
    expect(go).not.toHaveBeenCalled();
    become({ kind: 'member', userId: 'member-1', email: null });
    await vi.waitFor(() => expect(go).toHaveBeenCalledWith('es'));
    expect(last.now).toBe('member-1');
  });

  it('leaves the language alone for a member who was already signed in here, and once stopped', async () => {
    const { account } = accountAt({ kind: 'member', userId: 'member-1', email: null });
    const go = vi.fn();
    followAccountLanguage(account, keeping('es'), 'en', noted('member-1'), go, nothingWaiting);
    const other = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const stop = followAccountLanguage(other.account, keeping('es'), 'en', noted(), go, nothingWaiting);
    other.become({ kind: 'member', userId: 'member-2', email: null });
    stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(go).not.toHaveBeenCalled();
  });

  it('stays where it is for an account whose language nobody chose', async () => {
    const { account, become } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const go = vi.fn();
    followAccountLanguage(account, keeping(null), 'en', noted(), go, nothingWaiting);
    become({ kind: 'member', userId: 'member-1', email: null });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(go).not.toHaveBeenCalled();
  });

  it('gives way to a choice still waiting on the device, which wins over the account\'s', async () => {
    const { account, become } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const me = vi.fn(async () => ({ nickname: null, friendCode: 'X', avatar: null, language: 'es' }));
    const go = vi.fn();
    const last = noted();
    followAccountLanguage(account, () => ({ me }) as unknown as Community, 'ru', last, go, () => true);
    become({ kind: 'member', userId: 'member-1', email: null });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(go).not.toHaveBeenCalled();
    expect(last.now).toBe('member-1');
  });

  it('gives way to a choice made while the account was still answering', async () => {
    const { account, become } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    let answer: (me: unknown) => void = () => undefined;
    const go = vi.fn();
    let waiting = false;
    followAccountLanguage(account, () => ({ me: () => new Promise((resolve) => (answer = resolve)) }) as unknown as Community, 'en', noted(), go, () => waiting);
    become({ kind: 'member', userId: 'member-1', email: null });
    waiting = true;
    answer({ nickname: null, friendCode: 'X', avatar: null, language: 'es' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(go).not.toHaveBeenCalled();
  });
});
