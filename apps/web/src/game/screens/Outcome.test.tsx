// @vitest-environment jsdom
import { content, textFor } from '@ratrace/content';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

beforeEach(() => setWidth('phone'));
afterEach(cleanup);

const { text } = textFor('en');

/** Answers the first card of a life with the option given, and returns the card and the screen of its result. */
async function answer(lifeId: string, pick: (options: number) => number) {
  const services = memoryServices();
  const session = await services.sessions.start(lifeId);
  const def = content.cards.find((card) => card.id === session.view().hand[0])!;
  const index = pick(def.options.length);
  const user = userEvent.setup();
  renderGame(<Play />, services);
  await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
  await user.click(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[index]);
  await screen.findByRole('heading', { name: 'What happened' });
  return { def, index, user, written: text.cards[def.id] };
}

describe('what a card did', () => {
  for (const lifeId of ['nurse', 'engineer', 'civil_servant']) {
    it(`shows the card again, the choice, what followed and what changed (${lifeId})`, async () => {
      const { def, index, written } = await answer(lifeId, () => 0);
      const card = screen.getByRole('article');
      expect(within(card).getByRole('heading', { name: written.title })).toBeTruthy();
      // The picture of the card is there again, not only its name.
      expect(card.querySelector('img, [data-sprite-missing]')).not.toBeNull();
      expect(within(card).getByText(`You chose: ${written.options[index].label}`)).toBeTruthy();

      const dice = (def.options[index].outcomes ?? []).length > 0;
      if (dice) {
        // One of the lines the dice could give, and how likely it was.
        const said = written.options[index].outcomes.filter((line) => within(card).queryByText(line) !== null);
        expect(said).toHaveLength(1);
        expect(within(card).getByText('chance of this being what came up')).toBeTruthy();
        expect(within(card).getByText(/^\d+(\.\d+)? %$/)).toBeTruthy();
      } else {
        expect(within(card).getByText(written.options[index].after ?? 'no line')).toBeTruthy();
        expect(within(card).queryByText('chance of this being what came up')).toBeNull();
      }
      expect(screen.getByRole('region', { name: 'What changes' })).toBeTruthy();
    });
  }

  it('says that nothing changes when nothing does, instead of showing an empty box', async () => {
    // The first option of a card is the one that costs and buys nothing: often it changes nothing at all.
    const { def } = await answer('nurse', () => 0);
    const first = def.options[0];
    const plain = Object.keys(first.effects ?? {}).length === 0 && (first.outcomes ?? []).length === 0;
    const changes = screen.getByRole('region', { name: 'What changes' });
    if (plain) expect(within(changes).getByText('Nothing changes')).toBeTruthy();
    else expect(changes.textContent?.length ?? 0).toBeGreaterThan('What changes'.length);
  });

  it('does not go back over the options that were not taken', async () => {
    await answer('engineer', () => 0);
    expect(screen.queryByRole('button', { name: /did not choose/ })).toBeNull();
  });
});

describe('a card a server answers slowly', () => {
  it('turns the card with the choice made while the dice roll, then shows what came up', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    // The life on screen played as a server plays it: every answer held until the test lets it go.
    let release = () => {};
    const resume = services.sessions.resume.bind(services.sessions);
    services.sessions.resume = async () => {
      const found = await resume();
      const session = found.session;
      if (!session) return found;
      const answer = session.answerCard.bind(session);
      const served = Object.assign(Object.create(session) as typeof session, {
        served: true,
        answerCard: async (option: number) => {
          await new Promise<void>((resolve) => (release = resolve));
          return answer(option);
        },
      });
      return { ...found, session: served };
    };
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    const choices = within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button');
    await user.click(choices[0]);
    // At once: the option taken, pressed.
    expect(choices[0].getAttribute('aria-pressed')).toBe('true');
    // A moment later: the card turned, its choice made, waiting for the server.
    await screen.findByRole('heading', { name: 'What happened' });
    const card = screen.getByRole('article');
    expect(within(card).getByText(/^You chose: /)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'What changes' })).toBeNull();
    expect((screen.getByRole('button', { name: /^(Next card|To your finances)/ }) as HTMLButtonElement).disabled).toBe(true);
    release();
    await screen.findByRole('region', { name: 'What changes' });
    expect((screen.getByRole('button', { name: /^(Next card|To your finances)/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
