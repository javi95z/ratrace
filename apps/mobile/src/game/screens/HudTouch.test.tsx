// @vitest-environment jsdom
import type { GameView } from '@ratrace/engine';
import type { GameSession } from '@ratrace/core/session/types';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUCH } from '../../ui/theme';

/*
 * The touch targets of what the Hud adds that a thumb presses (the constraint: at least 44 points), read from what each pressable is given:
 * its own box, padding and all (the kit's `reach`: no `hitSlop`, which React Native never looks for past a parent's edge). jsdom lays nothing out,
 * so the sizes are the ones the pieces are drawn at.
 */
type PressProps = ComponentProps<typeof import('react-native').Pressable>;
const pressed = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    Pressable: (props: PressProps) => {
      pressed.push(props as Record<string, unknown>);
      return <rn.Pressable {...props} />;
    },
  };
});

const { memoryServices, renderGame } = await import('../../testing/render');
const { HudScene } = await import('../../testing/hudScene');
const { CrisisBar, CRISIS_STRIP } = await import('./Crisis');
const { JAIL_TAG } = await import('./Hud');

beforeEach(() => {
  pressed.length = 0;
});
afterEach(cleanup);

/** The last props a pressable named `testID` was given. */
const last = (testID: string) => [...pressed].reverse().find((props) => props.testID === testID) as (PressProps & { hitSlop?: { top?: number; bottom?: number; left?: number; right?: number } }) | undefined;

describe('what the Hud adds that is pressed is a target of 44 points or more', () => {
  it('the tag of someone in prison: a strip 19 high, reaching up over the lines above it and down to the foot of its column', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    const view = (): GameView => {
      const now = real.view();
      return { ...now, player: { ...now.player, life: { ...now.player.life, jailRounds: 2 } } };
    };
    const session: GameSession = { gameId: real.gameId, lifeId: real.lifeId, view, history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session });
    renderGame(<HudScene />, services);
    await screen.findByRole('button', { name: /^In prison/ });
    const tag = last('jail-tag');
    expect(tag).toBeTruthy();
    // No reach past its box (React Native looks for no touch past a parent's edge): its box itself is the 44, padding and all.
    expect(tag!.hitSlop).toBeUndefined();
    const box = tag!.style as { paddingTop: number; paddingBottom: number; marginTop: number; marginBottom: number };
    // The tag is the kit's: 12 × 1.25 in 2 of padding above and below.
    expect(JAIL_TAG.height).toBe(19);
    expect(JAIL_TAG.height + box.paddingTop + box.paddingBottom).toBeGreaterThanOrEqual(TOUCH);
    // A touch is not taken past the column it stands in: its box ends at the column's foot, the line's own room under it.
    expect(box.marginBottom).toBe(0);
    // Above it, it reaches over the lines that are always there (the age, 26 high, and the round's line, 4 under it), which are not pressed.
    expect(box.paddingTop).toBeLessThanOrEqual(26 + 4 + 13 * 1.45);
    // And it is as wide as its words, which are wider than a thumb in every language the game speaks.
    expect(tag!.style).toMatchObject({ alignSelf: 'flex-start' });
  });

  it('the strip of a crisis under the figures: 42.8 high, reaching a point past it above and below', async () => {
    renderGame(<CrisisBar crisis={{ id: 'crash', year: 2, of: 3 }} compact />, memoryServices());
    await screen.findByRole('button', { name: /Great Crash/ });
    const strip = last('crisis-strip');
    expect(strip!.hitSlop).toBeUndefined();
    const box = strip!.style as { paddingTop: number; paddingBottom: number; marginTop: number; marginBottom: number };
    expect(CRISIS_STRIP.compact).toBeCloseTo(42.8, 5);
    expect(CRISIS_STRIP.compact + box.paddingTop + box.paddingBottom).toBeGreaterThanOrEqual(TOUCH);
    // Taking no room, and reaching no further than the page's gap of 8 either side (the figures above, the stage below).
    expect([box.marginTop, box.marginBottom]).toEqual([-box.paddingTop, -box.paddingBottom]);
    expect(Math.max(box.paddingTop, box.paddingBottom)).toBeLessThanOrEqual(8);
  });

  it('every other pressable of the Hud stands at least 44 high on its own (the squares, the figures, the way out, the portrait, the link of a sheet)', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<HudScene onProfile={() => {}} />, services);
    await screen.findByRole('button', { name: 'Open settings' });
    for (const name of ['Open settings', /Cash/, /Flow/, /Status/, /Rat race escape/]) {
      const button = screen.getByRole('button', { name });
      const box = [button, ...button.querySelectorAll<HTMLElement>('*')].find((el) => el.style.minHeight !== '' || el.style.height !== '');
      const tall = Number.parseFloat(box?.style.minHeight || box?.style.height || '0');
      expect(tall, String(name)).toBeGreaterThanOrEqual(TOUCH);
    }
    // The portrait opens the profile: 80 square.
    const portrait = screen.getByRole('button', { name: 'Open your profile' });
    expect(portrait.querySelector<HTMLElement>('[data-frame]')?.style.height).toBe('80px');
    // The link that says what a figure means, in its sheet: 44 high, as wide as its words.
    fireEvent.click(screen.getByRole('button', { name: /Cash/ }));
    const link = await screen.findByRole('button', { name: 'What is this?' });
    expect(Number.parseFloat(link.style.minHeight)).toBeGreaterThanOrEqual(TOUCH);
  });
});
