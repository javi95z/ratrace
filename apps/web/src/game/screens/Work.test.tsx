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
    expect(within(panel).getByText(`Career skill ${work.skill}/${next.minSkill}`)).toBeTruthy();
    expect(within(panel).getByText(`${fmt.money(next.payAnnual)}/yr`)).toBeTruthy();
    expect(next.payAnnual).toBeGreaterThan(here.payAnnual);
    // The two other lines are named for what they are, not for the career they could be mistaken for.
    expect(within(panel).getByText('Finance')).toBeTruthy();
    expect(within(panel).getByText('Focus this round')).toBeTruthy();
    expect(within(panel).getByText(`${work.focus.left}/${work.focus.total}`)).toBeTruthy();
    // Her ward as it looks from the first rung, and the sign of her trade beside her title.
    const pictures = [...panel.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '');
    expect(pictures.some((src) => src.includes('work.healthcare.0'))).toBe(true);
    expect(pictures.some((src) => src.includes('icon.career_healthcare'))).toBe(true);
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

  it('opens what each level of Finance lets the player buy, and how the next is reached', async () => {
    const { user, panel } = await nurse();
    await user.click(within(panel).getByRole('button', { name: /^Finance/ }));
    const sheet = screen.getByRole('dialog', { name: 'Finance' });
    const levels = within(sheet).getAllByRole('listitem');
    expect(levels.map((li) => li.getAttribute('aria-current'))).toEqual(['true', null, null, null]);
    // The last level opens no market: it opens the broker's money, and no course gives it.
    expect(within(levels[3]).getByText('No new market: what changes is whose money you buy with.')).toBeTruthy();
    expect(within(levels[content.debt.marginMinFinanceSkill]).getByText('And buying with money borrowed from the broker.')).toBeTruthy();
    // The counts are the game's own: what each level adds to what can be bought.
    const at = (level: number) => content.assets.filter((asset) => (asset.minFinanceSkill ?? 0) === level).length;
    // With no Finance every fund, bond and share is open already; the first level adds gold.
    expect(at(0)).toBe(16);
    expect(within(levels[0]).getByText(`Index funds, bonds and shares: ${at(0)} to choose from, from day one.`)).toBeTruthy();
    expect(within(levels[1]).getByText(`Gold: ${at(1)} more.`)).toBeTruthy();
    expect(within(levels[2]).getByText(`Cryptocurrencies: ${at(2)} more.`)).toBeTruthy();
    expect(within(levels[content.life.rentOutMinFinanceSkill]).getByText('And letting property out.')).toBeTruthy();
    expect(within(sheet).getByText(/^Each round with money invested gives \+1\./)).toBeTruthy();
    // Measured like every other skill: the level, and the points into it.
    expect(within(sheet).getByRole('progressbar', { name: 'Towards level 1' })).toBeTruthy();
    expect(within(sheet).getByText('Level 0 · 0/3')).toBeTruthy();
  });

  it('lists every skill with how far along it is, and opens what each level gives and how it is learnt', async () => {
    const { panel, user } = await nurse();
    const skills = within(panel).getByRole('region', { name: 'Skills' });
    for (const name of ['Finance', 'Negotiation', 'Languages', 'Network', 'Management', 'Health']) expect(within(skills).getByText(name)).toBeTruthy();
    // Every skill, money sense too, is told the same way: its level and the points into it.
    expect(within(skills).getAllByText('Level 0 · 0/3')).toHaveLength(6);
    await user.click(within(skills).getByText('Health'));
    const sheet = screen.getByRole('dialog', { name: 'Health' });
    expect(within(sheet).getByRole('progressbar', { name: 'Towards level 1' })).toBeTruthy();
    // Each level counted in full: a fifth off the premium a level, an injury healed by training from the second, and focus at the top.
    expect(within(sheet).getByText('Health insurance −60% · injuries without physio · +1 focus a round')).toBeTruthy();
    expect(within(sheet).getByText('Exercise: +3 a round, 1 focus.')).toBeTruthy();
    // A nurse lives it at work.
    expect(within(sheet).getByText('You already practise it: +1 a round.')).toBeTruthy();
  });

  it('opens what focus is spent on, each use at what it is worth to this player', async () => {
    const { work, user, panel } = await nurse();
    await user.click(within(panel).getByRole('button', { name: /^Focus this round/ }));
    const sheet = screen.getByRole('dialog', { name: 'Focus' });
    expect(within(sheet).getByText(`+${work.overtimePct}% pay this round.`)).toBeTruthy();
    expect(within(sheet).getByText(`+${work.studySkill} career skill, on top of what working gives · ${work.rungStudy.left} of ${work.rungStudy.max} left at this rung`)).toBeTruthy();
    expect(within(sheet).getByText(`${work.jobHuntChancePct}% chance of a ${work.jobHuntRaisePct}% raise for good.`)).toBeTruthy();
    expect(within(sheet).getByText(/^Moving city takes 1 focus/)).toBeTruthy();
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
    expect(work.focus).toEqual({ left: before.focus.total + 1, total: before.focus.total + 1, bonus: 1, lost: 0 });

    const user = userEvent.setup();
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    const panel = screen.getByRole('region', { name: 'Work' });
    expect(within(panel).getByText('+1 from the rest your trip gave you')).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: /^Focus this round/ }));
    const sheet = screen.getByRole('dialog', { name: 'Focus' });
    expect(within(sheet).getByText(`${work.jobHuntChancePct}% chance of a ${work.jobHuntRaisePct}% raise for good.`)).toBeTruthy();
    expect(within(sheet).getByText(/1 is from the rest your last trip gave you\.$/)).toBeTruthy();
  });

  it('says what sets a career apart: time left over, pay that follows the economy, an audience that does not last', async () => {
    setWidth('desk');
    const services = memoryServices();
    await services.sessions.start('nurse');
    const base = ((await services.store.loadGame()) as SavedGame).state;
    const user = userEvent.setup();
    const traitsOf = async (career: string, change: (state: SavedGame['state']) => void = () => {}) => {
      const state = structuredClone(base);
      state.player.life.career = { id: career, level: 0 };
      change(state);
      renderGame(<WorkPanel shown={viewOf(state)} />, services);
      const panel = await screen.findByRole('region', { name: 'Work' });
      const sub = within(panel).getByText('Focus this round').parentElement?.textContent ?? '';
      await user.click(within(panel).getAllByRole('button')[0]);
      const list = within(screen.getByRole('dialog', { name: 'Your career' })).queryByRole('list', { name: 'What sets this career apart' });
      const lines = list ? within(list).getAllByRole('listitem').map((li) => li.textContent) : [];
      cleanup();
      return { lines, sub };
    };

    expect((await traitsOf('healthcare')).lines).toEqual([]);
    const teacher = await traitsOf('education', (state) => {
      state.player.life.focusBonus = 1;
    });
    expect(teacher.lines).toEqual(['It leaves time over: +1 focus every round.']);
    expect(teacher.sub).toContain('+1 because your job leaves time over');

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

  it('says from when the player may retire, and then lets them, as an order, saying what it gives', async () => {
    setWidth('desk');
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    // Living to 56 in work: every card answered without leaving the job.
    const keepJob: Record<string, number> = { career_restructuring: 1 };
    const toFinance = async () => {
      while (session.view().phase === 'cards') await session.answerCard(keepJob[session.view().hand[session.view().answered]] ?? 0);
    };
    await toFinance();
    const user = userEvent.setup();
    const young = renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    await user.click(within(screen.getByRole('region', { name: 'Work' })).getByRole('button', { name: /^Nurse/ }));
    const early = screen.getByRole('dialog', { name: 'Your career' });
    expect(within(early).getByText(/^You can retire from 56\. You leave work for good: no more salary\./)).toBeTruthy();
    expect(within(early).queryByRole('switch', { name: /Retire this round/ })).toBeNull();
    young.unmount();
    cleanup();

    while (session.view().round < content.life.retireFromRound) {
      await session.playRound({ orders: [] });
      await toFinance();
    }
    expect(session.view().player.life.career).not.toBeNull();
    renderGame(<Play />, services);
    await screen.findAllByRole('heading', { name: 'News' });
    const panel = screen.getByRole('region', { name: 'Work' });
    // The first line of the panel is the job, whatever rung the years have brought her to.
    await user.click(within(panel).getAllByRole('button')[0]);
    const sheet = screen.getByRole('dialog', { name: 'Your career' });
    const toggle = within(sheet).getByRole('switch', { name: /Retire this round/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(within(sheet).getByText(`You leave work for good: no more salary. While you take up no career, +${content.life.retiredFocus} focus every round and ${content.life.retiredStatus} status.`)).toBeTruthy();
    await user.click(toggle);
    expect(within(screen.getByRole('dialog', { name: 'Your career' })).getByRole('switch', { name: /Retire this round/ }).getAttribute('aria-checked')).toBe('true');
  });
});
