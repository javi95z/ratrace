// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import type { SavedGame } from '@ratrace/core/session/types';
import { quoteSkills, quoteWork, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { settled } from '../../testing/renders';
import { useGame } from '../context';
import { spriteBox } from '../../ui/sprites';
import { bannerSize } from '../../ui/sprites';
import { useShown } from './Hud';
import { Play } from './Play';
import { FocusUses, WorkPanel } from './Work';
import { Sheet } from '../../ui/overlay';

/*
 * The work panel of the profile (the web's Work.test.tsx). The web shows it beside the game on a wide screen; the phone's profile (Task 17) holds
 * it as the web's does, given the life as it stands (`useShown`): drawn here the same way, on the game open on the device.
 */

afterEach(cleanup);

const fmt = formatFor('en');
const norm = (words: string) => words.replace(/\s+/g, ' ').trim();
/** Whether something in `container` says these words (its words whole, however they are set in runs by font). */
const has = (container: HTMLElement, words: string | RegExp): boolean =>
  [...container.querySelectorAll<HTMLElement>('*')].some((element) => (typeof words === 'string' ? norm(element.textContent ?? '') === words : words.test(norm(element.textContent ?? ''))));
/**
 * Tells everything in `container` that asks for its layout that it is `width` wide, as the phone would after laying it out: react-native-web hands
 * `onLayout` to a ResizeObserver, which jsdom lacks, and keeps the handler on the node (the kit's tests do the same).
 */
function layOut(container: HTMLElement, width: number) {
  const asking = [...container.querySelectorAll('*')].map((node) => (node as unknown as { __reactLayoutHandler?: (event: unknown) => void }).__reactLayoutHandler).filter((handler) => handler !== undefined);
  expect(asking.length).toBeGreaterThan(0);
  act(() => {
    for (const handler of asking) handler({ nativeEvent: { layout: { x: 0, y: 0, width, height: 120 } } });
  });
}
/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

/** The work panel of the life on the device, as the profile holds it: given the life as it stands, once the game is open on it. */
function Profiled() {
  const playing = useGame((s) => s.view !== null);
  return playing ? <Shown /> : null;
}
function Shown() {
  const shown = useShown();
  return (
    <>
      <WorkPanel shown={shown} />
      <FocusOpener shown={shown} />
    </>
  );
}

/** The sheet of focus as the HUD's Focus figure opens it (the work panel no longer has a line for it): the uses, at what they are worth. */
function FocusOpener({ shown }: { shown: GameView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" aria-label="Open focus" onPress={() => setOpen(true)} />
      {open ? (
        <Sheet open onClose={() => setOpen(false)} title="Focus" closeLabel="Close">
          <FocusUses work={quoteWork(content, shown)} skills={quoteSkills(content, shown)} />
        </Sheet>
      ) : null}
    </>
  );
}
const openFocus = () => fireEvent.click(screen.getByRole('button', { name: 'Open focus' }));

/** A nurse at the news of her first round. */
async function nurse() {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  const work = quoteWork(content, viewOf(((await services.store.loadGame()) as SavedGame).state));
  renderGame(<Profiled />, services);
  const panel = await screen.findByLabelText('Work');
  return { services, session, work, panel };
}

describe('the work panel of the profile', () => {
  it('shows the job, what it pays, and how far the next one is and what it would pay', async () => {
    const { work, panel } = await nurse();
    const [here, next] = work.ladder;
    expect(has(panel, 'Nurse')).toBe(true);
    expect(has(panel, 'Healthcare')).toBe(true);
    expect(has(panel, `${fmt.money(work.payAnnual)}/yr`)).toBe(true);
    // The bar runs from the experience the job asked for to the experience the next one asks for.
    const bar = within(panel).getByRole('progressbar', { name: 'Progress towards Senior nurse' });
    expect(bar.getAttribute('aria-valuenow')).toBe(String(Math.round(((work.skill - here.minSkill) * 100) / (next.minSkill - here.minSkill))));
    expect(has(panel, `Career skill ${work.skill}/${next.minSkill}`)).toBe(true);
    expect(has(panel, `${fmt.money(next.payAnnual)}/yr`)).toBe(true);
    expect(has(panel, `Next: Senior nurse · ${fmt.money(next.payAnnual)}/yr`)).toBe(true);
    expect(next.payAnnual).toBeGreaterThan(here.payAnnual);
    // The other line is named for what it is, not for the career it could be mistaken for; the round's focus is the HUD's, not the panel's.
    expect(has(panel, 'Finance')).toBe(true);
    expect(has(panel, 'Focus this round')).toBe(false);
    // Her ward as it looks from the first rung, as wide as the panel (drawn once its width is known), and the sign of her trade beside her title.
    expect(panel.querySelector('[data-sprite="work.healthcare.0"]')).toBeNull();
    layOut(panel, 354);
    const ward = panel.querySelector<HTMLElement>('[data-sprite="work.healthcare.0"]');
    expect(ward?.getAttribute('data-size')).toBe(`354x${bannerSize(354, spriteBox('work.healthcare.0', 1, 1, { w: 288, h: 120 })).h}`);
    expect(panel.querySelector('[data-sprite="icon.career_healthcare"]')).not.toBeNull();
    // Every line is tall enough for a thumb.
    for (const button of within(panel).getAllByRole('button')) expect(Number.parseFloat(button.style.minHeight), button.textContent ?? '').toBe(44);
  });

  it('opens the whole ladder: every job with its pay, its status and the experience it asks for', async () => {
    const { work, panel } = await nurse();
    fireEvent.click(within(panel).getByRole('button', { name: /^Nurse/ }));
    const sheet = sheetTitled('Your career');
    const rungs = within(sheet).getAllByRole('listitem');
    expect(rungs).toHaveLength(work.ladder.length);
    // The rung she is on is the step she is on; the list is drawn the other way up, the top of the ladder at the top.
    expect(rungs.map((li) => li.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    expect(getComputedStyle(rungs[0].parentElement as HTMLElement).flexDirection).toBe('column-reverse');
    expect(has(rungs[0], 'Your job')).toBe(true);
    work.ladder.forEach((rung, i) => {
      expect(has(rungs[i], `${fmt.money(rung.payAnnual)}/yr`)).toBe(true);
      if (rung.status > 0) expect(has(rungs[i], `Status +${rung.status}`)).toBe(true);
      if (i > 0) expect(has(rungs[i], `Career skill ${rung.minSkill} · ${rung.minSkill - work.skill} to go`)).toBe(true);
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'What is this?' }));
    expect(has(sheetTitled('Your career'), /^A career in Healthcare\. Each round worked gives \+1 career skill, and studying \+1 more\./)).toBe(true);
    expect(has(sheetTitled('Your career'), 'Pay in Madrid today, with the raises and cuts you already carry.')).toBe(true);
  });

  it('opens what each level of Finance lets the player buy, and how the next is reached', async () => {
    const { panel } = await nurse();
    fireEvent.click(within(panel).getByRole('button', { name: /^Finance/ }));
    const sheet = sheetTitled('Finance');
    const levels = within(sheet).getAllByRole('listitem');
    expect(levels.map((li) => li.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    // The levels still to reach are faded.
    expect(levels.map((li) => li.style.opacity)).toEqual(['', '0.7', '0.7', '0.7']);
    // The last level opens no market: it opens the broker's money, and no course gives it.
    expect(has(levels[3], 'No new market: what changes is whose money you buy with.')).toBe(true);
    expect(has(levels[content.debt.marginMinFinanceSkill], 'And buying with money borrowed from the broker.')).toBe(true);
    // The counts are the game's own: what each level adds to what can be bought.
    const at = (level: number) => content.assets.filter((asset) => (asset.minFinanceSkill ?? 0) === level).length;
    // With no Finance every fund, bond and share is open already; the first level adds gold.
    expect(at(0)).toBe(18);
    expect(has(levels[0], `Index funds, bonds and shares: ${at(0)} to choose from, from day one.`)).toBe(true);
    expect(has(levels[1], `Gold: ${at(1)} more.`)).toBe(true);
    expect(has(levels[2], `Cryptocurrencies: ${at(2)} more.`)).toBe(true);
    expect(has(levels[content.life.rentOutMinFinanceSkill], 'And letting property out.')).toBe(true);
    expect(has(sheet, /^Each round with money invested gives \+1\./)).toBe(true);
    // Measured like every other skill: the level, and the points into it.
    expect(within(sheet).getByRole('progressbar', { name: 'Towards level 1' })).toBeTruthy();
    expect(has(sheet, 'Level 0 · 0/3')).toBe(true);
  });

  it('lists every skill with how far along it is, and opens what each level gives and how it is learnt', async () => {
    const { panel } = await nurse();
    const skills = within(panel).getByRole('region', { name: 'Skills' });
    for (const name of ['Finance', 'Negotiation', 'Languages', 'Network', 'Management', 'Health']) expect(has(skills, name), name).toBe(true);
    // Every skill, money sense too, is told the same way: its level and the points into it, and its level in squares.
    expect([...skills.querySelectorAll('[dir="auto"]')].filter((line) => line.textContent === 'Level 0 · 0/3')).toHaveLength(6);
    expect(skills.querySelectorAll('[data-testid="pip-off"]')).toHaveLength(18);
    fireEvent.click(within(skills).getByRole('button', { name: /^Health/ }));
    const sheet = sheetTitled('Health');
    expect(within(sheet).getByRole('progressbar', { name: 'Towards level 1' })).toBeTruthy();
    // Each level counted in full: a fifth off the premium a level, an injury healed by training from the second, and focus at the top.
    expect(has(sheet, 'Health insurance −60% · injuries without physio · +1 focus a round')).toBe(true);
    expect(has(sheet, 'Exercise: +3 a round, 1 focus.')).toBe(true);
    // A nurse lives it at work.
    expect(has(sheet, 'You already practise it: +1 a round.')).toBe(true);
  });

  it('opens what focus is spent on, each use at what it is worth to this player', async () => {
    const { work, panel } = await nurse();
    openFocus();
    const sheet = sheetTitled('Focus');
    expect(has(sheet, `+${work.overtimePct}% pay this round.`)).toBe(true);
    expect(has(sheet, `+${work.studySkill} career skill, on top of what working gives · ${work.rungStudy.left} of ${work.rungStudy.max} left at this rung`)).toBe(true);
    expect(has(sheet, `${work.jobHuntChancePct}% chance of a ${work.jobHuntRaisePct}% raise for good.`)).toBe(true);
    // At the news, nothing can be ordered: each use is a line, and the sheet says where focus is spent.
    expect(within(sheet).queryByRole('switch')).toBeNull();
    expect(has(sheet, /^You choose its uses once the round.s cards are answered/)).toBe(true);
    fireEvent.click(within(sheet).getByRole('button', { name: 'What is this?' }));
    expect(has(sheetTitled('Focus'), /^Moving city takes 1 focus/)).toBe(true);
  });

  it('counts what the player owns: a laptop teaches more, a watch helps the hunt, a long trip rests', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' } } });
    const session = await services.sessions.start('heir');
    while (session.view().phase === 'cards') await session.answerCard(0);
    const before = quoteWork(content, session.view());
    await session.playRound({ orders: ['tech_laptop', 'watch_omega', 'travel_safari'].map((itemId) => ({ type: 'buyItem' as const, itemId })) });
    const work = quoteWork(content, session.view());
    expect(work.studySkill).toBe(before.studySkill + 1);
    expect(work.jobHuntChancePct).toBe(before.jobHuntChancePct + 4);
    expect(work.focus).toEqual({ left: before.focus.total + 1, total: before.focus.total + 1, bonus: 1, lost: 0 });

    renderGame(<Profiled />, services);
    const panel = await screen.findByLabelText('Work');
    openFocus();
    const sheet = sheetTitled('Focus');
    expect(has(sheet, `${work.jobHuntChancePct}% chance of a ${work.jobHuntRaisePct}% raise for good.`)).toBe(true);
    // The parts of what focus is, joined by one space each, as the web's page sets them: none left over where one says nothing.
    expect(has(sheet, /1 is from the rest your last trip gave you\.$/)).toBe(true);
    expect([...sheet.querySelectorAll('[dir="auto"]')].some((line) => /^Focus is your time.*gave you\.$/.test(line.textContent ?? '') && !/ {2}/.test(line.textContent ?? ''))).toBe(true);
  });

  it('says what sets a career apart: time left over, pay that follows the economy, an audience that does not last', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const base = ((await services.store.loadGame()) as SavedGame).state;
    const traitsOf = async (career: string, change: (state: SavedGame['state']) => void = () => {}) => {
      const state = structuredClone(base);
      state.player.life.career = { id: career, level: 0 };
      change(state);
      renderGame(
        <>
          <WorkPanel shown={viewOf(state)} />
          <FocusOpener shown={viewOf(state)} />
        </>,
        services,
      );
      const panel = await screen.findByLabelText('Work');
      // What the focus is made of, as its sheet says it.
      openFocus();
      const sub = sheetTitled('Focus').textContent ?? '';
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await settled();
      fireEvent.click(within(panel).getAllByRole('button')[0]);
      const list = within(sheetTitled('Your career')).queryByRole('list', { name: 'What sets this career apart' });
      const lines = list ? within(list).getAllByRole('listitem').map((li) => li.textContent) : [];
      cleanup();
      return { lines, sub };
    };

    expect((await traitsOf('healthcare')).lines).toEqual([]);
    const teacher = await traitsOf('education', (state) => {
      state.player.life.focusBonus = 1;
    });
    expect(teacher.lines).toEqual(['It leaves time over: +1 focus every round.']);
    expect(teacher.sub).toContain('1 comes from your job, which leaves time over.');

    const swing = content.careers.find((career) => career.id === 'sales')?.cyclePct?.[base.timeline[0].regime] ?? 0;
    expect((await traitsOf('sales')).lines).toEqual([
      swing > 0 ? `Your pay follows the economy: this round you earn ${swing}% more.` : swing < 0 ? `Your pay follows the economy: this round you earn ${-swing}% less.` : 'Your pay follows the economy: up in good times, down in bad. This round, neither.',
    ]);

    expect((await traitsOf('influencer')).lines).toEqual(['It is a trade for the young: from the age of 34 you earn 12% less each round, down to 70% less.']);
    const fading = await traitsOf('influencer', (state) => {
      state.round = 7;
    });
    expect(fading.lines).toEqual(['Your audience is growing up: this round you earn 24% less, and it will fall to 70%.']);
  });

  it('says so plainly when there is no job', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const state = structuredClone(((await services.store.loadGame()) as SavedGame).state);
    // Retired early, as a card can leave her: no career, and so no ladder to show.
    state.player.life.career = null;
    renderGame(
      <>
        <WorkPanel shown={viewOf(state)} />
        <FocusOpener shown={viewOf(state)} />
      </>,
      services,
    );
    const panel = await screen.findByLabelText('Work');
    expect(has(panel, 'No job')).toBe(true);
    expect(within(panel).queryByRole('progressbar')).toBeNull();
    // No workplace, and no sign of a trade.
    expect(panel.querySelector('[data-sprite^="work."]')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: /^No job/ }));
    expect(has(sheetTitled('Your career'), /^You have no job on a career ladder\./)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await settled();
    openFocus();
    expect(has(sheetTitled('Focus'), /^Without a job there is no overtime/)).toBe(true);
  });

  it('says from when the player may retire, and then lets them, as an order, saying what it gives', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    // Living to 56 in work: every card answered without leaving the job.
    const keepJob: Record<string, number> = { career_restructuring: 1 };
    const toFinance = async () => {
      while (session.view().phase === 'cards') await session.answerCard(keepJob[session.view().hand[session.view().answered]] ?? 0);
    };
    await toFinance();
    const young = renderGame(<Profiled />, services);
    fireEvent.click(within(await screen.findByLabelText('Work')).getByRole('button', { name: /^Nurse/ }));
    const early = sheetTitled('Your career');
    expect(has(early, /^You can retire from 56\. You leave work for good: no more salary\./)).toBe(true);
    expect(within(early).queryByRole('switch', { name: /Retire this round/ })).toBeNull();
    young.unmount();
    cleanup();

    while (session.view().round < content.life.retireFromRound) {
      await session.playRound({ orders: [] });
      await toFinance();
    }
    expect(session.view().player.life.career).not.toBeNull();
    renderGame(<Profiled />, services);
    const panel = await screen.findByLabelText('Work');
    // The first line of the panel is the job, whatever rung the years have brought her to.
    fireEvent.click(within(panel).getAllByRole('button')[0]);
    const sheet = sheetTitled('Your career');
    const toggle = within(sheet).getByRole('switch', { name: /Retire this round/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(has(sheet, `You leave work for good: no more salary. While you take up no career, +${content.life.retiredFocus} focus every round and ${content.life.retiredStatus} status.`)).toBe(true);
    fireEvent.click(toggle);
    await settled();
    expect(within(sheetTitled('Your career')).getByRole('switch', { name: /Retire this round/ }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('focus from the HUD', () => {
  // The round's focus is the HUD's own figure, beside the cash, the flow and the status: its sheet, in Play.
  it('is spent from the sheet of focus as from the Lifestyle tab, while the finances are open', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(<Play />, services);
    await screen.findByRole('tablist');
    fireEvent.click(screen.getAllByRole('button', { name: /^\d+\/\d+, Focus/ })[0]);
    const sheet = sheetTitled('Focus');
    expect(has(sheet, 'Tap to choose. It takes effect when the round is played.')).toBe(true);
    // Three ways to work, five to learn, and a rest.
    expect(within(sheet).getAllByRole('switch')).toHaveLength(9);
    fireEvent.click(within(sheet).getByRole('switch', { name: /^Exercise/ }));
    await settled();
    expect(within(sheetTitled('Focus')).getByRole('switch', { name: /^Exercise/ }).getAttribute('aria-checked')).toBe('true');
    expect(has(sheetTitled('Focus'), '2/3')).toBe(true);
  });
});
