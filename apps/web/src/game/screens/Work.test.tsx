// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { quoteWork, viewOf } from '@ratrace/engine';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatFor } from '@/lib/format';
import type { SavedGame } from '@/session/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';
import { WorkPanel } from './Work';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

afterEach(cleanup);

const fmt = formatFor('en');

/** A nurse at the news of her first round, on a wide screen where the profile stands beside the game. */
async function nurse() {
  setWidth('desk');
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  const work = quoteWork(content, viewOf(((await services.store.loadGame()) as SavedGame).state));
  const user = userEvent.setup();
  renderGame(<Play />, services);
  await screen.findAllByRole('heading', { name: 'News' });
  return { services, session, work, user, panel: screen.getByRole('region', { name: 'Work' }) };
}

describe('the work panel of the profile', () => {
  it('shows the job, what it pays, and how far the next one is and what it would pay', async () => {
    const { work, panel } = await nurse();
    const [here, next] = work.ladder;
    expect(within(panel).getByText('Nurse')).toBeTruthy();
    expect(within(panel).getByText('Healthcare')).toBeTruthy();
    expect(within(panel).getByText(`${fmt.money(work.payAnnual)}/yr`)).toBeTruthy();
    // The bar runs from the experience the job asked for to the experience the next one asks for.
    const bar = within(panel).getByRole('progressbar', { name: 'Progress towards Senior nurse' });
    expect(bar.getAttribute('aria-valuenow')).toBe(String(Math.round(((work.skill - here.minSkill) * 100) / (next.minSkill - here.minSkill))));
    expect(within(panel).getByText(`Career skill ${work.skill} of ${next.minSkill}`)).toBeTruthy();
    expect(within(panel).getByText(`${fmt.money(next.payAnnual)}/yr`)).toBeTruthy();
    expect(next.payAnnual).toBeGreaterThan(here.payAnnual);
    // The two other lines are named for what they are, not for the career they could be mistaken for.
    expect(within(panel).getByText('Money sense')).toBeTruthy();
    expect(within(panel).getByText('Focus this round')).toBeTruthy();
    expect(within(panel).getByText(`${work.focus.left}/${work.focus.total}`)).toBeTruthy();
    // Every line is tall enough for a thumb.
    for (const button of within(panel).getAllByRole('button')) expect(button.className).toContain('min-h-11');
  });

  it('opens the whole ladder: every job with its pay, its status and the experience it asks for', async () => {
    const { work, user, panel } = await nurse();
    await user.click(within(panel).getByRole('button', { name: /^Nurse/ }));
    const sheet = screen.getByRole('dialog', { name: 'Your career' });
    const rungs = within(sheet).getAllByRole('listitem');
    expect(rungs).toHaveLength(work.ladder.length);
    expect(rungs.map((li) => li.getAttribute('aria-current'))).toEqual(['step', null, null, null]);
    expect(within(rungs[0]).getByText('Your job')).toBeTruthy();
    work.ladder.forEach((rung, i) => {
      expect(within(rungs[i]).getByText(`${fmt.money(rung.payAnnual)}/yr`)).toBeTruthy();
      if (rung.status > 0) expect(within(rungs[i]).getByText(`Status +${rung.status}`)).toBeTruthy();
      if (i > 0) expect(within(rungs[i]).getByText(`Career skill ${rung.minSkill} · ${rung.minSkill - work.skill} to go`)).toBeTruthy();
    });
    expect(within(sheet).getByText(/^A career in Healthcare\. Each round worked gives \+1 career skill, and studying \+1 more\./)).toBeTruthy();
    expect(within(sheet).getByText('Pay in Madrid today, with the raises and cuts you already carry.')).toBeTruthy();
  });

  it('opens what each level of money sense lets the player buy, and how the next is reached', async () => {
    const { user, panel } = await nurse();
    await user.click(within(panel).getByRole('button', { name: /^Money sense/ }));
    const sheet = screen.getByRole('dialog', { name: 'Money sense' });
    const levels = within(sheet).getAllByRole('listitem');
    expect(levels.map((li) => li.getAttribute('aria-current'))).toEqual(['true', null, null]);
    // The counts are the game's own: what each level adds to what can be bought.
    const at = (level: number) => content.assets.filter((asset) => (asset.minFinanceSkill ?? 0) === level).length;
    expect(within(levels[0]).getByText(new RegExp(`^Index funds: ${at(0)} to choose from`))).toBeTruthy();
    expect(within(levels[1]).getByText(`Bonds, single stocks and gold: ${at(1)} more.`)).toBeTruthy();
    expect(within(levels[2]).getByText(`Cryptocurrencies: ${at(2)} more.`)).toBeTruthy();
    expect(within(levels[content.life.rentOutMinFinanceSkill]).getByText('And letting property out.')).toBeTruthy();
    expect(within(sheet).getByText(new RegExp(`after ${content.life.financeExperienceRounds * content.yearsPerRound} years with money invested`))).toBeTruthy();
  });

  it('opens what focus is spent on, each use at what it is worth to this player', async () => {
    const { work, user, panel } = await nurse();
    await user.click(within(panel).getByRole('button', { name: /^Focus this round/ }));
    const sheet = screen.getByRole('dialog', { name: 'Focus' });
    expect(within(sheet).getByText(`+${work.overtimePct}% pay this round.`)).toBeTruthy();
    expect(within(sheet).getByText(`+${work.studySkill} career skill, on top of what working gives.`)).toBeTruthy();
    expect(within(sheet).getByText(`${work.jobHuntChancePct}% chance of a ${work.jobHuntRaisePct}% raise for good.`)).toBeTruthy();
    expect(within(sheet).getByText(/^Moving city takes 1 focus/)).toBeTruthy();
    // She owns nothing that changes these figures, so nothing says she does.
    expect(within(sheet).queryByText('What you own is already counted in these figures.')).toBeNull();
  });

  it('counts what the player owns: a laptop teaches more, a watch helps the hunt, a long trip rests', async () => {
    setWidth('desk');
    const services = memoryServices();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' } } });
    const session = await services.sessions.start('heir');
    while (session.view().phase === 'cards') await session.answerCard(0);
    const before = quoteWork(content, session.view());
    await session.playRound({ orders: ['tech_laptop', 'watch_omega', 'travel_safari'].map((itemId) => ({ type: 'buyItem' as const, itemId })) });
    const work = quoteWork(content, session.view());
    expect(work.studySkill).toBe(before.studySkill + 1);
    expect(work.jobHuntChancePct).toBe(before.jobHuntChancePct + 4);
    expect(work.focus).toEqual({ left: before.focus.total + 1, total: before.focus.total + 1, bonus: 1 });

    const user = userEvent.setup();
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    const panel = screen.getByRole('region', { name: 'Work' });
    expect(within(panel).getByText('+1 from the rest your trip gave you')).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: /^Focus this round/ }));
    const sheet = screen.getByRole('dialog', { name: 'Focus' });
    expect(within(sheet).getByText(`${work.jobHuntChancePct}% chance of a ${work.jobHuntRaisePct}% raise for good.`)).toBeTruthy();
    expect(within(sheet).getByText('What you own is already counted in these figures.')).toBeTruthy();
    expect(within(sheet).getByText(/1 from the rest your last trip gave you\.$/)).toBeTruthy();
  });

  it('says so plainly when there is no job', async () => {
    setWidth('desk');
    const services = memoryServices();
    await services.sessions.start('nurse');
    const state = structuredClone(((await services.store.loadGame()) as SavedGame).state);
    // Retired early, as a card can leave her: no career, and so no ladder to show.
    state.player.life.career = null;
    const user = userEvent.setup();
    renderGame(<WorkPanel shown={viewOf(state)} />, services);
    const panel = await screen.findByRole('region', { name: 'Work' });
    expect(within(panel).getByText('No job')).toBeTruthy();
    expect(within(panel).queryByRole('progressbar')).toBeNull();
    await user.click(within(panel).getByRole('button', { name: /^No job/ }));
    expect(within(screen.getByRole('dialog', { name: 'Your career' })).getByText(/^You have no job on a career ladder\./)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(within(panel).getByRole('button', { name: /^Focus this round/ }));
    expect(within(screen.getByRole('dialog', { name: 'Focus' })).getByText(/^Without a job there is no overtime/)).toBeTruthy();
  });
});
