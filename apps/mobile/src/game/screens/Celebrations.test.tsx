// @vitest-environment jsdom
import { badges, rarityOf, RIM_ART, textFor } from '@ratrace/content';
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
const shown = vi.hoisted(() => ({ earned: null as string[] | null, unlocked: [] as string[], over: false }));
vi.mock('../context', async (original) => {
  const real = await original<typeof import('../context')>();
  return {
    ...real,
    // One or the other for the whole of a test.
    useGame: <T,>(select: (state: RoundState & RoundActions) => T): T =>
      shown.earned === null ? real.useGame(select) : select({ earned: shown.earned, unlocked: shown.unlocked, reached: [], lifeId: null, gameId: 'g', view: { finished: shown.over } } as unknown as RoundState & RoundActions),
  };
});

// What the cards hand their boxes is kept, for what a test cannot read off the page (react-native-web draws nothing for `accessible`); and the
// glows' boxes are laid out by the test (onLayout is the phone's to send).
const statuses = vi.hoisted(() => [] as Array<Record<string, unknown>>);
type Layout = (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
const glowBoxes = vi.hoisted(() => [] as Layout[]);
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    View: (props: Record<string, unknown>) => {
      if (props.role === 'status') statuses.push(props);
      if ((props.dataSet as { glow?: string } | undefined)?.glow !== undefined && typeof props.onLayout === 'function') glowBoxes.push(props.onLayout as Layout);
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
  shown.over = false;
  statuses.length = 0;
  glowBoxes.length = 0;
});

/** The badge's name, as the game words it. */
const badgeName = (id: string): string => textFor('en').text.badges[id]?.name ?? id;
const idOf = (rarity: BadgeRarity) => badges.find((badge) => rarityOf(badge.id) === rarity)!.id;
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** The reward sheet on screen: the dialog named by what it gives. */
const rewardSheet = (name: string) => screen.getByRole('heading', { name }).closest('[aria-modal="true"]') as HTMLElement;
const lifeName = (id: string) => textFor('en').text.lives[id].name;

describe('a reward', () => {
  it('shows a badge earned by a round in a sheet over its result: the medal large, its name, its rarity in the colour of its rim and how it was earned', () => {
    const id = idOf('rare');
    shown.earned = [id];
    renderGame(<Celebrations />, memoryServices());
    const sheet = rewardSheet(badgeName(id));
    expect(within(sheet).getByText('Badge earned')).toBeTruthy();
    expect(within(sheet).getByText('Rare').closest('[style*="color"]')?.getAttribute('style')).toContain(rgb(COLORS['gold-500']));
    expect(within(sheet).getByText(textFor('en').text.badges[id].how)).toBeTruthy();
    // The medal at its large size, in the rim of its rarity.
    const medal = sheet.querySelector('[data-rarity="rare"]') as HTMLElement;
    expect([medal.style.width, medal.style.height]).toEqual(['96px', '96px']);
    expect(medal.querySelector(`[data-sprite="${RIM_ART.rare}"]`)).toBeTruthy();
    // One reward: no count, and no Try it now in the middle of a life.
    expect(within(sheet).queryByText(/of 1/)).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Try it now' })).toBeNull();
  });

  it('leaves no framed box of a badge or a life inline with the result', () => {
    shown.earned = [idOf('common')];
    shown.unlocked = ['rider'];
    renderGame(<Celebrations />, memoryServices());
    expect(screen.queryAllByRole('status')).toEqual([]);
    expect(statuses).toEqual([]);
  });

  it('closes on Accept', async () => {
    shown.earned = [idOf('common')];
    renderGame(<Celebrations />, memoryServices());
    fireEvent.click(within(rewardSheet(badgeName(idOf('common')))).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows several in turn in the same sheet, each with its Accept, counted, then closes', async () => {
    const [rare, common] = [idOf('rare'), idOf('common')];
    shown.earned = [rare, common];
    shown.unlocked = ['rider'];
    renderGame(<Celebrations />, memoryServices());
    expect(within(rewardSheet(badgeName(rare))).getByText('1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(within(rewardSheet(badgeName(common))).getByText('2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    // A life: who lives it, the job, its face, how hard it is in dots.
    const life = screen.getByRole('dialog');
    expect(within(life).getByText('3 of 3')).toBeTruthy();
    expect(within(life).getByText('New life unlocked')).toBeTruthy();
    expect(within(life).getByText(lifeName('rider'))).toBeTruthy();
    expect(life.querySelector('[data-sprite="portrait.rider.22"]')).toBeTruthy();
    expect(within(life).getByLabelText(/^Difficulty: /)).toBeTruthy();
    fireEvent.click(within(life).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('takes a legendary badge in the same sheet, under its own kicker', () => {
    shown.earned = [idOf('legendary')];
    renderGame(<Celebrations />, memoryServices());
    const sheet = rewardSheet(badgeName(idOf('legendary')));
    expect(within(sheet).getByText('Legendary badge')).toBeTruthy();
    expect(sheet.querySelector(`[data-sprite="${RIM_ART.legendary}"]`)).toBeTruthy();
  });

  it('is shown once: the result drawn again after Accept shows none, and one not accepted yet is shown again', async () => {
    shown.earned = [idOf('common'), idOf('rare')];
    renderGame(<Celebrations />, memoryServices());
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    cleanup();
    // Left and come back to mid-summary: only the one not accepted yet.
    renderGame(<Celebrations />, memoryServices());
    // The rarest came first and was accepted: the other is left.
    expect(rewardSheet(badgeName(idOf('common')))).toBeTruthy();
    expect(screen.queryByText('1 of 2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    cleanup();
    renderGame(<Celebrations />, memoryServices());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closed any other way, accepts them all', async () => {
    shown.earned = [idOf('common'), idOf('rare')];
    renderGame(<Celebrations />, memoryServices());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    cleanup();
    renderGame(<Celebrations />, memoryServices());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can be told a reward was accepted already (a scene of the step after its sheet)', () => {
    shown.earned = [idOf('common'), idOf('legendary')];
    renderGame(<Celebrations seen={[idOf('legendary'), idOf('common')]} />, memoryServices());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the lives a life\'s last step opened for its end, where one can begin at once', () => {
    shown.earned = [];
    shown.unlocked = ['rider'];
    shown.over = true;
    renderGame(<Celebrations />, memoryServices());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('speaks Spanish and Russian', () => {
    shown.earned = [idOf('legendary'), idOf('common')];
    renderGame(<Celebrations />, memoryServices(), 'es');
    expect(screen.getByText('Insignia legendaria')).toBeTruthy();
    expect(screen.getByText('1 de 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeTruthy();
    cleanup();
    renderGame(<Celebrations />, memoryServices(), 'ru');
    // A Russian title is set in runs of its fonts, a space apart: the line is whole in the element that holds them all.
    expect(screen.getAllByText((_, element) => element?.textContent === 'Легендарный значок').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'Принять').length).toBeGreaterThan(0);
  });

  it('is nothing at all when the step earned nothing', () => {
    shown.earned = [];
    const { container } = renderGame(<Celebrations />, memoryServices());
    expect(container.textContent).toBe('');
  });

  it('names each rarity in the colour of its rim, and the glows the milestones stand in grow with it', () => {
    expect(RARITY_TONE).toEqual({ common: EXTRA.bronze, uncommon: null, rare: COLORS['gold-500'], legendary: COLORS['teal-300'] });
    expect(RARITY_GLOW).toEqual({ common: '', uncommon: EXTRA.glow.uncommon, rare: EXTRA.glow.rare, legendary: EXTRA.glow.legendary });
  });
});

describe('a screen reader', () => {
  it('on iOS, where a sheet\'s content changing says nothing, is told each reward after the first as it comes', async () => {
    const was = Platform.OS;
    const said = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      shown.earned = [idOf('common')];
      shown.unlocked = ['rider'];
      renderGame(<Celebrations />, memoryServices());
      // The first is the sheet's title, which VoiceOver reads as it opens.
      expect(said).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await waitFor(() => expect(said).toHaveBeenCalledTimes(1));
      expect(said.mock.calls[0][0]).toContain('New life unlocked');
      expect(said.mock.calls[0][0]).toContain(lifeName('rider'));
    } finally {
      said.mockRestore();
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
    // The rim under the badge, on one canvas: the rim the medal's box, the badge its middle.
    const drawn = (root: Element) => [...root.querySelectorAll('[data-sprite]')].map((el) => `${el.getAttribute('data-sprite')} ${el.getAttribute('data-size')}`);
    expect(drawn(medal)).toEqual([`${RIM_ART.uncommon} 96x96`, `badge.${id} 64x64`]);
    cleanup();
    const small = render(<Medal badgeId={id} size="sm" locked />).container.querySelector('[data-rarity="uncommon"]') as HTMLElement;
    expect([small.style.width, small.style.height]).toEqual(['64px', '64px']);
    expect(drawn(small)).toEqual([`${RIM_ART.uncommon} 64x64`, 'badge.locked 42x42']);
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
