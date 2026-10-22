// @vitest-environment jsdom
import { content, lives, textFor } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import { formatFor } from '@ratrace/core/lib/format';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { createGame, quoteLiving, quoteMove, viewOf } from '@ratrace/engine';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { memoryServices, renderGame, spriteRenders } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import { useGame } from '../context';
import { Finance, FinanceOpened, FinanceShell } from './Finance';
import { HealthCoverNote } from './HealthCover';
import { Play } from './Play';

/*
 * The way of life in the finances (the web's Finance.test.tsx: the Lifestyle tab, the city move, what belongs to a city, the note under health cover,
 * the limits of focus), on the phone; and what the phone adds: each control of the tab is drawn again only for itself, and in Russian the choices
 * are laid out to wrap, never cut short.
 */

// Each switch and each row of choices of the kit, counted as it is drawn, by its name: the tab's controls are drawn again only for themselves.
const drawn = vi.hoisted(() => new Map<string, number>());
vi.mock('../../ui/kit', async (original) => {
  const kit = (await original()) as typeof import('../../ui/kit');
  const count = (name: string) => drawn.set(name, (drawn.get(name) ?? 0) + 1);
  return {
    ...kit,
    Toggle: (props: Parameters<typeof kit.Toggle>[0]) => {
      count(`switch ${props.label}`);
      return createElement(kit.Toggle, props);
    },
    Segmented: (props: Parameters<typeof kit.Segmented>[0]) => {
      count(`choice ${props.label}`);
      return createElement(kit.Segmented, props);
    },
  };
});

// The engine's year in another city, counted as it is asked: the sheet of every city asks it once for each city and each round as it stands.
const moves = vi.hoisted(() => ({ count: 0 }));
vi.mock('@ratrace/engine', async (original) => {
  const engine = (await original()) as typeof import('@ratrace/engine');
  return {
    ...engine,
    quoteMove: (...args: Parameters<typeof engine.quoteMove>) => {
      moves.count += 1;
      return engine.quoteMove(...args);
    },
  };
});

afterEach(() => {
  cleanup();
  drawn.clear();
});

/** The round store as it stands, and its actions: an order given without the screen. */
const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}

const fmt = formatFor('en');
const ru = messagesFor('ru');
const { names, text } = textFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/**
 * The way back to every city, by its words: its arrow is a run of its own (a sign the pixel face lacks), and the name jsdom works out of the runs
 * drops the space after it (a screen reader on the phone reads the button's words whole).
 */
const ALL_CITIES = /^←\s?All cities$/;
/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
/** A panel by the name it is given (its title). */
const panel = (name: string) => screen.getByLabelText(name);

/**
 * The texts in `container` whose words are these: each a whole text as the screen sets it (its outer text; a text is set in runs by font, and a
 * sign the reading face lacks, a Russian word, is a run of its own, so its words are not one node).
 */
const texts = (container: HTMLElement, words: string | RegExp): HTMLElement[] =>
  [...container.querySelectorAll<HTMLElement>('[dir="auto"]')].filter((line) => (typeof words === 'string' ? line.textContent === words : words.test(line.textContent ?? '')));
/** The one text in `container` whose words are these. */
function textOf(container: HTMLElement, words: string | RegExp): HTMLElement {
  const found = texts(container, words);
  expect(found.map((line) => line.textContent), String(words)).toHaveLength(1);
  return found[0];
}

/** A life taken to the finances of its current round, without the screen. */
async function inFinance(lifeId: string, { taught = false }: { taught?: boolean } = {}) {
  const services = memoryServices();
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' }, comeback: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  await toFinance(session);
  // A life that is to master money first takes two rounds of a finance course.
  if (taught) {
    for (let round = 0; round < 2; round++) {
      await session.playRound({ orders: [{ type: 'focus', action: 'studyFinance' }] });
      await toFinance(session);
    }
  }
  return { services, session };
}
async function toFinance(session: GameSession) {
  while (session.view().phase === 'cards') await session.answerCard(0);
}
const stateOf = async (services: ReturnType<typeof memoryServices>) => ((await services.store.loadGame()) as SavedGame).state;

/** Play, on the Lifestyle tab of the finances. */
async function onLifestyle(services: ReturnType<typeof memoryServices>, locale: 'en' | 'ru' = 'en') {
  renderGame(<Play />, services, locale);
  fireEvent.click(await screen.findByRole('tab', { name: (locale === 'en' ? messagesFor('en') : ru).finance.tabs.lifestyle }));
  // The panels under the first screen come once the first are on it (ui/drawnFirst.ts): the way of living is one of them.
  await screen.findByRole('radiogroup', { name: (locale === 'en' ? messagesFor('en') : ru).finance.lifestyle.tier }, { timeout: 15_000 });
  return screen.getByRole('tabpanel', { name: (locale === 'en' ? messagesFor('en') : ru).finance.tabs.lifestyle });
}

describe('the lifestyle tab', () => {
  it('draws a picture on every choice: how to work, how to live, where, and each insurance', async () => {
    const { services } = await inFinance('nurse');
    await onLifestyle(services);
    const pictured = (control: HTMLElement) => control.querySelector('[data-sprite]') !== null;
    for (const group of ['How you live', 'Where you live']) {
      for (const choice of within(screen.getByRole('radiogroup', { name: group })).getAllByRole('radio')) expect(pictured(choice), `${group}: ${choice.textContent}`).toBe(true);
    }
    const switches = screen.getAllByRole('switch');
    // Four uses of focus at work, five to learn, a rest (the nurse has no family yet), three insurances.
    expect(switches).toHaveLength(4 + 5 + 1 + 3);
    for (const one of switches) expect(pictured(one), one.textContent ?? '').toBe(true);
  });

  it('is on the phone: a tab of the finances, after the debts', async () => {
    const { services } = await inFinance('heir');
    renderGame(<Play />, services);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toContain('Lifestyle');
    expect(tabs.map((tab) => tab.textContent).indexOf('Lifestyle')).toBe(tabs.map((tab) => tab.textContent).indexOf('Debt') + 1);
  });
});

describe('moving to another city', () => {
  const moveSheet = () => sheetTitled('Move to another city');
  const openCity = (cityId: string) => {
    fireEvent.click(within(moveSheet()).getByRole('button', { name: new RegExp(`^${names.cities[cityId]}`) }));
    return screen.getByRole('region', { name: names.cities[cityId] });
  };
  /** What a line of the year says after its label: the figure here, and there, as the web's `parentElement.textContent` reads it. */
  const line = (card: HTMLElement, label: string) => {
    let row: HTMLElement | null = textOf(card, label);
    while (row && row.textContent === label) row = row.parentElement;
    return (row?.textContent ?? '').replace(label, '');
  };

  it('lists every city on a row, where the year leaves the most first, the city lived in at the top', async () => {
    const { services } = await inFinance('nurse');
    const view = viewOf(await stateOf(services));
    await onLifestyle(services);
    fireEvent.click(button('Move to another city'));
    const rows = within(moveSheet()).getAllByRole('listitem');
    expect(rows).toHaveLength(content.cities.length);
    expect(textOf(rows[0], 'Madrid')).toBeTruthy();
    expect(textOf(rows[0], 'You live here')).toBeTruthy();
    // The city lived in is lit in gold; what a city pays a trade above the usual is in its numbers, not on its row.
    expect(texts(rows[0], /more/)).toEqual([]);
    expect(rows.slice(1).map((row) => row.textContent)).toEqual(
      [...content.cities.filter((city) => city.id !== 'madrid')]
        .sort((a, b) => quoteMove(content, view, b.id).there.leftAnnual - quoteMove(content, view, a.id).there.leftAnnual)
        .map((city) => expect.stringContaining(names.cities[city.id])),
    );
    // Each row is a city's crest beside its name, and what the year leaves there: green where it is more than here.
    for (const [i, row] of rows.entries()) expect(row.querySelector('[data-sprite^="crest."]'), String(i)).not.toBeNull();
  });

  it('opens a city with its year beside this one, its figures folded away, and the move', async () => {
    const { services } = await inFinance('nurse');
    const view = viewOf(await stateOf(services));
    await onLifestyle(services);
    fireEvent.click(button('Move to another city'));

    const madrid = openCity('madrid');
    const here = quoteMove(content, view, 'london').here;
    expect(textOf(madrid, fmt.money(here.leftAnnual))).toBeTruthy();
    expect(within(madrid).queryByRole('button', { name: 'Move here' })).toBeNull();
    fireEvent.click(within(madrid).getByRole('button', { name: ALL_CITIES }));

    for (const city of content.cities.filter((x) => x.id !== 'madrid')) {
      const quote = quoteMove(content, view, city.id);
      const card = openCity(city.id);
      expect(line(card, 'Left over a year'), city.id).toBe(`${fmt.compact(quote.here.leftAnnual)}→${fmt.compact(quote.there.leftAnnual)}`);
      expect(texts(card, 'Your pay')).toEqual([]);
      const figures = within(card).getByRole('button', { name: 'See the figures' });
      expect(figures.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(figures);
      expect(within(card).getByRole('button', { name: 'Hide the figures' }).getAttribute('aria-expanded')).toBe('true');
      expect(line(card, 'Your pay'), city.id).toBe(`${fmt.compact(quote.here.payAnnual)}→${fmt.compact(quote.there.payAnnual)}`);
      expect(line(card, 'Income tax'), city.id).toBe(`${fmt.compact(quote.here.taxAnnual)}→${fmt.compact(quote.there.taxAnnual)}`);
      expect(textOf(card, `Status +${city.prestige}`)).toBeTruthy();
      // What the move costs, and how far it goes: the further, the dearer.
      expect(textOf(card, `Moving costs ${fmt.money(quote.cost)} and 1 focus: it is ${fmt.number(city.distanceKm?.madrid ?? 0)} km away`)).toBeTruthy();
      // A nurse on the first rung, alone: nothing more to lose by going.
      expect(texts(card, /^You arrive as/)).toEqual([]);
      expect(within(card).getByRole('button', { name: 'Move here' })).toBeTruthy();
      fireEvent.click(within(card).getByRole('button', { name: ALL_CITIES }));
    }
  });

  it('says what going of one\'s own accord would cost someone with a rung to lose', async () => {
    // The comeback starts two rungs up a career.
    const { services } = await inFinance('comeback');
    const view = viewOf(await stateOf(services));
    const job = view.player.life.career;
    if (!job || job.level < 1) throw new Error('the comeback starts above the first rung');
    const elsewhere = content.cities.find((city) => city.id !== view.player.cityId);
    if (!elsewhere) throw new Error('there is another city');
    const quote = quoteMove(content, view, elsewhere.id);
    expect(quote.rungsLost).toBe(1);

    await onLifestyle(services);
    fireEvent.click(button('Move to another city'));
    const card = openCity(elsewhere.id);
    expect(textOf(card, `You arrive as ${text.careers[job.id].levels[job.level - 1]}: a rung down, until your next promotion.`)).toBeTruthy();
    // The pay shown there is the pay of the rung below, in that city.
    fireEvent.click(within(card).getByRole('button', { name: 'See the figures' }));
    expect(line(card, 'Your pay').endsWith(`→${fmt.compact(quote.there.payAnnual)}`)).toBe(true);
    expect(quote.there.level).toBe(job.level - 1);
  });

  it('is ordered from a city, listed among the round\'s orders, and can be taken back there or from the tab', async () => {
    const { services } = await inFinance('heir');
    await onLifestyle(services);
    fireEvent.click(button('Move to another city'));
    // The first city on the list after the one lived in.
    fireEvent.click(within(within(moveSheet()).getAllByRole('listitem')[1]).getByRole('button'));
    fireEvent.click(within(screen.getByRole('region', { name: /./ })).getByRole('button', { name: 'Move here' }));
    await settled();
    expect(screen.queryByRole('heading', { name: 'Move to another city' })).toBeNull();

    fireEvent.click(button('1 order'));
    const orders = sheetTitled("This round's orders");
    expect(within(orders).getAllByRole('listitem')).toHaveLength(1);
    expect(texts(orders, /^Move to /)).toHaveLength(1);
    fireEvent.click(within(orders).getByRole('button', { name: /^Remove: Move to / }));
    expect(texts(sheetTitled("This round's orders"), /^Nothing yet/)).toHaveLength(1);
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));
    await settled();

    // Ordered again, it is taken back from the tab: the tab says where the player moves, and staying after all leaves no order.
    fireEvent.click(button('Move to another city'));
    fireEvent.click(within(within(moveSheet()).getAllByRole('listitem')[1]).getByRole('button'));
    const city = screen.getByRole('region', { name: /./ }).getAttribute('aria-label') ?? '';
    expect(Object.values(names.cities)).toContain(city);
    fireEvent.click(within(screen.getByRole('region', { name: city })).getByRole('button', { name: 'Move here' }));
    await settled();
    expect(screen.queryByRole('heading', { name: 'Move to another city' })).toBeNull();
    const tab = screen.getByRole('tabpanel', { name: 'Lifestyle' });
    expect(textOf(tab, `You move to ${city} when this round is played.`)).toBeTruthy();
    expect(within(tab).queryByRole('button', { name: 'Move to another city' })).toBeNull();
    expect(button('1 order')).toBeTruthy();
    fireEvent.click(within(tab).getByRole('button', { name: 'Stay after all' }));
    await settled();
    expect(texts(tab, /^You move to /)).toEqual([]);
    expect(within(tab).getByRole('button', { name: 'Move to another city' })).toBeTruthy();
    expect(button('No orders')).toBeTruthy();
  });

  it('is open from the start where a scene says so (the phone\'s initial state): the sheet of every city, not a tap', async () => {
    const { services } = await inFinance('nurse');
    renderGame(
      <FinanceOpened value={{ tab: 'lifestyle', sheet: 'move' }}>
        <Play />
      </FinanceOpened>,
      services,
    );
    expect(await screen.findByRole('heading', { name: 'Move to another city' })).toBeTruthy();
    expect(within(sheetTitled('Move to another city')).getAllByRole('listitem')).toHaveLength(content.cities.length);
  });
});

describe('what belongs to a city', () => {
  // (Its shelf in the shop, and the line in a thing's sheet that says it stays behind, are the shop's: FinanceShop.test.)
  it('is named before a move that would end it, and only for the cities that would', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'member_season_seat' }] });
    await toFinance(session);
    expect((await stateOf(services)).player.life.items.map((owned) => owned.itemId)).toEqual(['member_season_seat']);
    await onLifestyle(services);
    fireEvent.click(button('Move to another city'));
    // A warning in each city that is not Madrid.
    for (const city of content.cities.filter((x) => x.id !== 'madrid')) {
      fireEvent.click(within(sheetTitled('Move to another city')).getByRole('button', { name: new RegExp(`^${names.cities[city.id]}`) }));
      const card = screen.getByRole('region', { name: names.cities[city.id] });
      expect(textOf(card, 'Moving ends: Bernabéu season seat.')).toBeTruthy();
      fireEvent.click(within(card).getByRole('button', { name: ALL_CITIES }));
    }
  });
});

describe('how the player lives, in the lifestyle tab', () => {
  it('says what each way of living does to status, the frugal one taking it away', async () => {
    const { services } = await inFinance('nurse');
    const tab = await onLifestyle(services);
    expect(textOf(tab, 'Status: Frugal −2 · Normal 0 · Comfortable +3 · Lavish +8 · From 26, living frugally costs 4 status.')).toBeTruthy();
  });

  it('says that cover renews by itself, that health cover costs more taken out later, and the age a cover held was priced at', async () => {
    const { services } = await inFinance('nurse');
    const tab = await onLifestyle(services);
    expect(textOf(tab, 'Every cover renews by itself each round until you end it.')).toBeTruthy();
    expect(textOf(tab, 'Health cover taken out from 32 costs more.')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: /^Health insurance/ }));
    await settled();
    // Ordered this round, it is priced at the age of this round.
    expect(textOf(screen.getByRole('tabpanel', { name: 'Lifestyle' }), 'Health cover priced at the age you took it out: 22.')).toBeTruthy();
  });

  it('orders a way of living, and takes the order back when the one the life had is chosen again', async () => {
    const { services } = await inFinance('nurse');
    await onLifestyle(services);
    const tiers = () => within(screen.getByRole('radiogroup', { name: 'How you live' })).getAllByRole('radio');
    expect(tiers().map((tier) => tier.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    fireEvent.click(tiers()[2]);
    await settled();
    expect(tiers().map((tier) => tier.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true', 'false']);
    expect(button('1 order')).toBeTruthy();
    fireEvent.click(tiers()[1]);
    await settled();
    expect(button('No orders')).toBeTruthy();
  });
});

describe('the note under health cover', () => {
  const living = (health: { since: number | null; dearerFrom: { fromRound: number; pct: number } | null; refused: boolean }) =>
    ({ ...quoteLiving(content, viewOf(createGame({ content, start: lives[0].start }, 'note'))), health });

  it('says no insurer will take on someone who has been seriously ill, before anything else', async () => {
    const { container } = renderGame(<HealthCoverNote living={living({ since: null, dearerFrom: { fromRound: 5, pct: 130 }, refused: true })} />, memoryServices());
    expect(textOf(container, 'No insurer will cover your health: you have already had a serious illness.')).toBeTruthy();
    expect(texts(container, /costs more/)).toEqual([]);
    // The risk is drawn beside what is not held: the sign of a health risk.
    expect(container.querySelector('[data-sprite="icon.health_risk"]')).not.toBeNull();
  });

  it('says nothing of a dearer age once no dearer step is left', async () => {
    const { container } = renderGame(<HealthCoverNote living={living({ since: null, dearerFrom: null, refused: false })} />, memoryServices());
    expect(textOf(container, 'Every cover renews by itself each round until you end it.')).toBeTruthy();
    expect(texts(container, /costs more|priced at/)).toEqual([]);
  });
});

describe('the limits of focus', () => {
  it('names a mastered skill on one line instead of a switch, and says what overtime round after round costs', async () => {
    const { services, session } = await inFinance('nurse', { taught: true });
    // Two more courses, and a fifth masters money sense; overtime that round makes the next one the second in a row.
    for (let round = 0; round < 2; round++) {
      await session.playRound({ orders: [{ type: 'focus', action: 'studyFinance' }] });
      await toFinance(session);
    }
    await session.playRound({ orders: [{ type: 'focus', action: 'studyFinance' }, { type: 'focus', action: 'overtime' }] });
    await toFinance(session);
    expect((await stateOf(services)).player.life.financeSkill).toBe(3);
    await onLifestyle(services);

    const learn = panel('Learn');
    expect(within(learn).queryByRole('switch', { name: /Take a finance course/ })).toBeNull();
    expect(textOf(learn, '✓ Mastered: Take a finance course.')).toBeTruthy();
    expect(within(learn).getAllByRole('switch')).toHaveLength(4);

    const overtime = screen.getByRole('switch', { name: /Work night shifts/ });
    expect(texts(overtime, /· −1 health$/)).toHaveLength(1);
  });
});

describe('the lifestyle tab, drawn again', () => {
  /** How many times each switch and row of choices has been drawn so far. */
  const counts = () => new Map(drawn);
  /** What was drawn again since `before`: the names of the controls, each once. */
  const since = (before: Map<string, number>) => [...drawn].filter(([name, n]) => n !== (before.get(name) ?? 0)).map(([name]) => name);

  it('draws again only the control that changed: a use of focus, a way of living, a cover, each leaves every other as it is', async () => {
    const { services } = await inFinance('nurse');
    await onLifestyle(services);
    await settled();
    // Every control of the tab is there: four rows of choices (how to work, how to live, where) and the switches.
    expect([...drawn.keys()].filter((name) => name.startsWith('choice ')).sort()).toEqual(['choice How you live', 'choice How you work', 'choice Where you live']);

    // A course: its switch is drawn again, and nothing else (the focus left goes from 3 to 2, which closes no other).
    let before = counts();
    fireEvent.click(screen.getByRole('switch', { name: /^Take a finance course/ }));
    await settled();
    expect(screen.getByRole('switch', { name: /^Take a finance course/ }).getAttribute('aria-checked')).toBe('true');
    expect(since(before)).toEqual(['switch Take a finance course']);

    // A way of living: its row of choices, and the row of homes, whose rents it changes (a room and a flat cost more for a better way of living:
    // what each costs a year is on its choice); no switch.
    before = counts();
    const rents = within(screen.getByRole('radiogroup', { name: 'Where you live' })).getAllByRole('radio').map((rent) => rent.textContent);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'How you live' })).getAllByRole('radio')[2]);
    await settled();
    expect(within(screen.getByRole('radiogroup', { name: 'Where you live' })).getAllByRole('radio').map((rent) => rent.textContent)).not.toEqual(rents);
    expect(since(before).sort()).toEqual(['choice How you live', 'choice Where you live']);

    // A cover: its switch, and nothing else.
    before = counts();
    fireEvent.click(screen.getByRole('switch', { name: /^Home insurance/ }));
    await settled();
    expect(since(before)).toEqual(['switch Home insurance']);

    // The basket opened and closed, which the tab does not draw: nothing.
    before = counts();
    fireEvent.click(button('3 orders'));
    await settled();
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));
    await settled();
    expect(since(before)).toEqual([]);
  });

  it('does not draw the tab itself again for an order the round refuses, and draws it again for one it takes', async () => {
    const { services } = await inFinance('nurse');
    // The tab's panel alone, counted: its row of tabs and the toasts are Play's, and a refusal is the toast's to say.
    const renders = { count: 0 };
    function AtFinance({ children }: { children: ReactNode }) {
      return useGame((s) => s.stage === 'finance' && s.view !== null && s.preview !== null) ? children : null;
    }
    renderGame(
      <FinanceOpened value={{ tab: 'lifestyle' }}>
        <FinanceShell>
          <AtFinance>
            <Counted into={renders}>
              <Finance />
            </Counted>
          </AtFinance>
        </FinanceShell>
        <Probe />
      </FinanceOpened>,
      services,
    );
    await screen.findByRole('tabpanel', { name: 'Lifestyle' });
    // Every panel in (the ones under the first screen come once the first are on it, a drawing of its own: ui/drawnFirst.ts).
    await screen.findByRole('radiogroup', { name: 'How you live' }, { timeout: 15_000 });
    await settled();
    const before = renders.count;
    expect(before).toBeGreaterThan(0);

    // An order refused (more of a fund than is held): the round as it stands is the same, and the tab is not drawn again.
    await settled(() => void probe.state!.addOrder({ type: 'sell', assetId: 'sp500', amount: 100_000 }));
    expect(probe.state!.refusal).not.toBeNull();
    expect(probe.state!.orders).toEqual([]);
    expect(renders.count).toBe(before);
    await settled(() => probe.state!.clearRefusal());
    expect(renders.count).toBe(before);

    // A course ordered: the tab shows it, so it is drawn again.
    await settled(() => void probe.state!.setOrder((order) => order.type === 'focus' && order.action === 'studyFinance', { type: 'focus', action: 'studyFinance' }));
    expect(probe.state!.orders).toHaveLength(1);
    expect(renders.count).toBeGreaterThan(before);
  });

  it('works out the year in every city once for the round as it stands, and draws no city\'s row again for an order that leaves its figures as they are', async () => {
    const { services } = await inFinance('nurse');
    renderGame(
      <FinanceOpened value={{ tab: 'lifestyle', sheet: 'move' }}>
        <Play />
        <Probe />
      </FinanceOpened>,
      services,
    );
    await screen.findByRole('heading', { name: 'Move to another city' });
    await settled();
    const crests = () => content.cities.map((city) => spriteRenders.get(`crest.${city.id}`) ?? 0);
    const rows = crests();
    expect(rows.every((n) => n > 0)).toBe(true);
    const asked = moves.count;

    // An order refused: the round as it stands is the same, so nothing is worked out or drawn again.
    await settled(() => void probe.state!.addOrder({ type: 'sell', assetId: 'sp500', amount: 100_000 }));
    expect(probe.state!.refusal).not.toBeNull();
    expect(moves.count).toBe(asked);
    expect(crests()).toEqual(rows);

    // A use of focus ordered: the round as it stands is new, so every city's year is worked out again, once each; no city's year changes, so no row is drawn again.
    await settled(() => void probe.state!.setOrder((order) => order.type === 'focus' && order.action === 'studyFinance', { type: 'focus', action: 'studyFinance' }));
    expect(probe.state!.orders).toHaveLength(1);
    expect(moves.count - asked).toBe(content.cities.length);
    expect(crests()).toEqual(rows);
  });
});

describe('the lifestyle tab in Russian, its structure (what wraps and what is cut; widths are the batch pass\'s)', () => {
  /** Whether a text is cut to a line or a few with an ellipsis (`numberOfLines`), by the element that holds it or any up to `top`. */
  function cutShort(words: HTMLElement, top: HTMLElement): boolean {
    for (let at: HTMLElement | null = words; at && at !== top.parentElement; at = at.parentElement) if (/r-textOverflow-|r-WebkitLineClamp/.test(at.className)) return true;
    return false;
  }

  it('wraps the long words of every choice (how to work, how to live, where), each choice a share of its row and never cut short', async () => {
    // The engineer's trade works from home: three ways to work.
    const { services } = await inFinance('engineer');
    const tab = await onLifestyle(services, 'ru');
    const groups = [ru.finance.lifestyle.mode, ru.finance.lifestyle.tier, ru.finance.lifestyle.home].map((name) => within(tab).getByRole('radiogroup', { name }));
    const radios = groups.flatMap((group) => within(group).getAllByRole('radio'));
    expect(radios.length).toBeGreaterThanOrEqual(2 + 4 + 2);
    for (const radio of radios) {
      expect(radio.style.minWidth, radio.textContent ?? '').toBe('0px');
      for (const words of texts(radio, /./)) expect(cutShort(words, radio), words.textContent ?? '').toBe(false);
    }
    // The ways of living two to a row (the web's `grid-cols-2`): two rows of two.
    const tiers = within(groups[1]).getAllByRole('radio');
    expect(tiers[0].parentElement).toBe(tiers[1].parentElement);
    expect(tiers[2].parentElement).toBe(tiers[3].parentElement);
    expect(tiers[0].parentElement).not.toBe(tiers[2].parentElement);
    // What each way of living does to status wraps under them as well.
    const status = texts(tab, new RegExp(`^${ru.finance.lifestyle.tierStatus}`));
    expect(status.length).toBeGreaterThanOrEqual(1);
    for (const words of status) expect(cutShort(words, tab)).toBe(false);
  });
});
