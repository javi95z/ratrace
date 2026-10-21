// @vitest-environment jsdom
import { badges, BADGE_RARITY, rarityOf, RIM_ART, textFor } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile } from '@ratrace/core/session/types';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { COLORS, EXTRA } from '../../ui/theme';

// As the web's test: what the step on screen earned is the game's to say, so the test says it. `shown.earned` null is the real game.
const shown = vi.hoisted(() => ({ earned: null as string[] | null, unlocked: [] as string[] }));
vi.mock('../context', async (original) => {
  const real = await original<typeof import('../context')>();
  return {
    ...real,
    // One or the other for the whole of a test.
    useGame: <T,>(select: (state: RoundState & RoundActions) => T): T =>
      shown.earned === null ? real.useGame(select) : select({ earned: shown.earned, unlocked: shown.unlocked } as unknown as RoundState & RoundActions),
  };
});

// What the cards hand their boxes is kept, for what a test cannot read off the page (react-native-web draws nothing for `accessible`).
const statuses = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    View: (props: Record<string, unknown>) => {
      if (props.role === 'status') statuses.push(props);
      return <rn.View {...props} />;
    },
  };
});

const { AccessibilityInfo, Platform } = await import('react-native');
const { Celebrations } = await import('./Celebrations');
const { Medal } = await import('./Medal');
const { RARITY_GLOW, RARITY_TONE } = await import('./rarityStyle');
const { useGame } = await import('../context');

afterEach(() => {
  cleanup();
  shown.earned = null;
  shown.unlocked = [];
});

/** The badge's name, as the game words it. */
const badgeName = (id: string): string => textFor('en').text.badges[id]?.name ?? id;
const idOf = (rarity: BadgeRarity) => badges.find((badge) => rarityOf(badge.id) === rarity)!.id;
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
/** The strips a frame is drawn with, by colour: the outline of a box is four of one colour. */
const strips = (box: Element, colour: string) => [...box.querySelectorAll<HTMLElement>(':scope > div')].filter((d) => d.style.position === 'absolute' && d.style.backgroundColor === rgb(colour));

describe('a badge earned', () => {
  it('shows its rarity, in its rim and its colour', () => {
    shown.earned = [idOf('rare'), idOf('common')];
    renderGame(<Celebrations />, memoryServices());
    const [rare, common] = screen.getAllByRole('status');
    expect(within(rare).getByText('Rare')).toBeTruthy();
    expect(within(common).getByText('Common')).toBeTruthy();
    expect(rare.querySelector('[data-rarity="rare"]')).toBeTruthy();
    expect(common.querySelector('[data-rarity="common"]')).toBeTruthy();
    // The rim of its rarity, round the badge itself.
    expect(rare.querySelector(`[data-sprite="${RIM_ART.rare}"]`)).toBeTruthy();
    expect(rare.querySelector(`[data-sprite="badge.${idOf('rare')}"]`)).toBeTruthy();
    // Its rarity is named in the colour of its rim.
    expect(within(rare).getByText('Rare').closest('[style*="color"]')?.getAttribute('style')).toContain(rgb(COLORS['gold-500']));
    expect(within(common).getByText('Common').closest('[style*="color"]')?.getAttribute('style')).toContain(rgb(EXTRA.bronze));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks for a glow that grows with the rarity, as the web does; the web\'s gold frame is drawn over it, so neither draws it', () => {
    // What the web asks for: none for bronze, then a rim of light that grows (rarityStyle.ts).
    expect(RARITY_GLOW).toEqual({ common: '', uncommon: EXTRA.glow.uncommon, rare: EXTRA.glow.rare, legendary: EXTRA.glow.legendary });
    const blur = (rarity: BadgeRarity) => Number(/0 0 (\d+)px/.exec(RARITY_GLOW[rarity])?.[1] ?? 0);
    expect([blur('common'), blur('uncommon'), blur('rare'), blur('legendary')]).toEqual([0, 6, 12, 20]);
    // The web's card is `frame frame-gold ... shadow-[…]`: both are box-shadows of one layer, and `frame` comes later in the stylesheet, so the
    // card is drawn with its gold frame and no glow. The phone's card is that frame: four gold-900 strips, and nothing blurred.
    shown.earned = [idOf('legendary')];
    renderGame(<Celebrations />, memoryServices());
    const card = screen.getAllByRole('status')[0].firstElementChild as HTMLElement;
    const frame = card.querySelector(':scope > div') as HTMLElement;
    expect(frame.style.backgroundColor).toBe(rgb(COLORS['night-700']));
    expect(strips(frame, COLORS['gold-900'])).toHaveLength(4);
    expect(card.outerHTML).not.toMatch(/shadow|blur/i);
  });

  it('names each rarity in the colour of its rim: bronze, the line\'s own (the web\'s ink-100 is no colour of its palette), gold and the gem\'s green', () => {
    expect(RARITY_TONE).toEqual({ common: EXTRA.bronze, uncommon: null, rare: COLORS['gold-500'], legendary: COLORS['teal-300'] });
  });

  it('takes the whole screen for a legendary one, until the player moves on, in any language', async () => {
    shown.earned = [idOf('legendary')];
    renderGame(<Celebrations />, memoryServices());
    const card = screen.getByRole('heading', { name: badgeName(idOf('legendary')) }).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(card).getByText('Legendary badge')).toBeTruthy();
    expect(card.querySelector(`[data-sprite="${RIM_ART.legendary}"]`)).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('Legendary badge')).toBeNull();
    // The small card stays with the step's result.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('shows each legendary one in turn, and none again once it has been seen', async () => {
    const [first, second] = Object.keys(BADGE_RARITY).filter((id) => rarityOf(id) === 'legendary');
    shown.earned = [first, second];
    renderGame(<Celebrations />, memoryServices());
    expect(screen.getByRole('heading', { name: badgeName(first) })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: badgeName(second) })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.queryByText('Legendary badge')).toBeNull());
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('can be told a legendary one was taken in already (a scene of the step after its sheet): no sheet for it, its small card all the same', () => {
    shown.earned = [idOf('common'), idOf('legendary')];
    renderGame(<Celebrations seen={[idOf('legendary')]} />, memoryServices());
    expect(screen.queryByText('Legendary badge')).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('speaks Spanish and Russian', () => {
    shown.earned = [idOf('legendary')];
    renderGame(<Celebrations />, memoryServices(), 'es');
    expect(screen.getByText('Insignia legendaria')).toBeTruthy();
    cleanup();
    renderGame(<Celebrations />, memoryServices(), 'ru');
    // A Russian title is set in runs of its fonts, a space apart: the line is whole in the element that holds them all.
    expect(screen.getAllByText((_, element) => element?.textContent === 'Легендарный значок').length).toBeGreaterThan(0);
  });

  it('is nothing at all when the step earned nothing', () => {
    shown.earned = [];
    const { container } = renderGame(<Celebrations />, memoryServices());
    expect(container.textContent).toBe('');
  });
});

describe('lives unlocked', () => {
  it('are told together, each with its face and what it is good at', () => {
    shown.earned = [];
    shown.unlocked = ['rider'];
    renderGame(<Celebrations />, memoryServices());
    const card = screen.getByRole('status');
    expect(within(card).getByText('New life unlocked')).toBeTruthy();
    expect(card.querySelector('[data-sprite="icon.star"]')).toBeTruthy();
    expect(card.querySelector('[data-sprite="portrait.rider.22"]')).toBeTruthy();
    cleanup();
    shown.unlocked = ['rider', 'heir'];
    renderGame(<Celebrations />, memoryServices());
    const both = screen.getByRole('status');
    expect(within(both).getByText('2 new lives unlocked')).toBeTruthy();
    expect(both.querySelectorAll('[data-sprite^="portrait."]')).toHaveLength(2);
  });
});

describe('a screen reader', () => {
  /** What was announced, and how: queued after what is being said (the stage that opened), where the phone can queue. */
  function listening() {
    const queued = vi.fn();
    const said = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    Object.assign(AccessibilityInfo, { announceForAccessibilityWithOptions: queued });
    return {
      queued,
      said,
      restore: () => {
        said.mockRestore();
        delete (AccessibilityInfo as { announceForAccessibilityWithOptions?: unknown }).announceForAccessibilityWithOptions;
      },
    };
  }

  it('reads each card as one thing, and on iOS, where a live region says nothing, is told what the step earned once it is on screen, after the stage it rose in', async () => {
    const was = Platform.OS;
    const ears = listening();
    statuses.length = 0;
    try {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      const id = idOf('common');
      shown.earned = [id];
      shown.unlocked = ['rider'];
      renderGame(<Celebrations />, memoryServices());
      // Each card is one element to VoiceOver, the lives as the badge, and a polite live region to TalkBack.
      expect(statuses.length).toBeGreaterThanOrEqual(2);
      for (const status of statuses) expect(status).toMatchObject({ accessible: true, accessibilityLiveRegion: 'polite' });
      // Not at once: what the stage says as it opens comes first, and these wait behind it.
      expect(ears.queued).not.toHaveBeenCalled();
      await waitFor(() => expect(ears.queued).toHaveBeenCalledTimes(2));
      const [badge, lives] = ears.queued.mock.calls;
      expect(badge[0]).toContain(badgeName(id));
      expect(badge[0]).toContain('Badge earned');
      expect(badge[1]).toEqual({ queue: true });
      expect(lives[0]).toContain('New life unlocked');
      expect(lives[0]).toContain(textFor('en').text.lives.rider.name);
      expect(lives[1]).toEqual({ queue: true });
      cleanup();
      // TalkBack hears the live regions: nothing is said over them.
      ears.queued.mockClear();
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      renderGame(<Celebrations />, memoryServices());
      await act(async () => new Promise((done) => setTimeout(done, 20)));
      expect(ears.queued).not.toHaveBeenCalled();
      expect(ears.said).not.toHaveBeenCalled();
    } finally {
      ears.restore();
      Object.defineProperty(Platform, 'OS', { value: was, configurable: true });
    }
  });
});

describe('a medal', () => {
  it('is the badge in the rim of its rarity, 96 round 64, or 64 round 42 when small; a badge not earned is the lock in the same rim', () => {
    const id = idOf('uncommon');
    const { container } = render(<Medal badgeId={id} />);
    const medal = container.querySelector('[data-rarity="uncommon"]') as HTMLElement;
    expect([medal.style.width, medal.style.height]).toEqual(['96px', '96px']);
    expect(medal.querySelector(`[data-sprite="${RIM_ART.uncommon}"]`)).toBeTruthy();
    const badge = medal.querySelector(`[data-sprite="badge.${id}"]`)?.parentElement as HTMLElement;
    expect([badge.style.width, badge.style.height]).toEqual(['64px', '64px']);
    cleanup();
    const small = render(<Medal badgeId={id} size="sm" locked />).container.querySelector('[data-rarity="uncommon"]') as HTMLElement;
    expect([small.style.width, small.style.height]).toEqual(['64px', '64px']);
    expect(small.querySelector('[data-sprite="badge.locked"]')?.parentElement?.style.width).toBe('42px');
    expect(small.querySelector(`[data-sprite="badge.${id}"]`)).toBeNull();
  });
});

describe('drawing it again', () => {
  it('is only for what it shows: a change of the round that earns nothing new does not draw it again', async () => {
    const store = new MemoryStore();
    await store.saveProfile({ ...newProfile(), settings: { sound: false, reducedMotion: true } });
    const services = memoryServices(store);
    await services.sessions.start('nurse');
    const renders: Renders = { count: 0 };
    const probe: { state: (RoundState & RoundActions) | null } = { state: null };
    function Probe() {
      probe.state = useGame((s) => s);
      return null;
    }
    renderGame(
      <>
        <Probe />
        <Counted into={renders}>
          <Celebrations />
        </Counted>
      </>,
      services,
    );
    await waitFor(() => expect(probe.state?.status).toBe('playing'));
    // The news, then the cards: each step sets the badges of the moment again (none), which is nothing new to draw.
    await settled(() => probe.state?.leaveNews());
    const before = renders.count;
    await settled(() => probe.state?.pick(0));
    await settled(() => probe.state?.afterCard());
    expect(probe.state?.stage).toBe('cards');
    expect(renders.count).toBe(before);
    await act(async () => undefined);
  });
});
