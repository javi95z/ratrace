// @vitest-environment jsdom
import { badges, content, rarityOf } from '@ratrace/content';
import { newProfile } from '@ratrace/core/session/types';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { COLORS, grey } from '../../ui/theme';
import { paintOf } from '../../ui/testing/paint';
import { useGame } from '../context';
import { memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { breakpointOf, Collection, columnsAt } from './Collection';

afterEach(cleanup);

/** A colour as jsdom gives a style's back: `rgb(r, g, b)`. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;
/** The colour a text is drawn in: its words are runs of one text, which holds the colour. */
const colourOf = (words: HTMLElement) => (words.parentElement as HTMLElement).style.color;
/** The tile a text stands in: the line of the list that holds it. */
const tileOf = (text: HTMLElement) => text.closest('[role="listitem"]') as HTMLElement;
/** The pictures of a tile, in order: the sprites it draws. */
const pictures = (tile: HTMLElement) => [...tile.querySelectorAll('[data-sprite]')].map((sprite) => sprite.getAttribute('data-sprite') ?? '');
/** What the phone tells a view once it has laid it out: react-native-web keeps the handler on the node, and calling it is what its observer does after it measures. */
type Laid = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void };
/**
 * The page: one list, whose rows are the tab's tiles and whose header is the title, the tabs and the tab's head. It is the first box laid out (the
 * list's own scroll). The web's panel of the tab is not named on the phone: no prop of a list puts a role on the box of its rows alone.
 */
const pageOf = (): Laid => Array.from(document.querySelectorAll<Laid>('*')).find((node) => typeof node.__reactLayoutHandler === 'function')!;
/** The page once the tab named is the one open. */
async function opened(tab: string): Promise<Laid> {
  await waitFor(() => expect(screen.getByRole('tab', { name: tab }).getAttribute('aria-selected')).toBe('true'));
  return pageOf();
}

describe('the collection', () => {
  it('shows every thing in the game, as a silhouette until it has been owned', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), gallery: ['watch_casio', 'car_seat_ibiza'] });
    renderGame(<Collection />, services);

    // The badges come first; the things are the second tab.
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Badges', 'Things']);
    fireEvent.click(screen.getByRole('tab', { name: 'Things' }));
    expect(await screen.findByText(`2 of ${content.items.length} owned`)).toBeTruthy();
    const things = await opened('Things');
    // The head scrolls with the page, as the web's does: the title and the tabs are the list's header.
    expect(things.contains(screen.getByRole('tablist'))).toBe(true);
    expect(things.contains(screen.getByRole('heading', { name: 'Collection' }))).toBe(true);
    expect(within(things).getAllByRole('listitem')).toHaveLength(content.items.length);
    // Owned: drawn. Its name is the text beside it, said once, so the picture needs none of its own.
    const casio = tileOf(within(things).getByText('Casio F-91W'));
    expect(pictures(casio)).toEqual(['item.watch_casio']);
    expect(casio.querySelector('[data-silhouette]')).toBeNull();
    expect(within(casio).queryByText('Not owned yet')).toBeNull();
    expect(pictures(tileOf(within(things).getByText('SEAT Ibiza')))).toEqual(['car.seat_ibiza']);
    // Not owned: a shadow and no name. What it is, the player finds out by owning it.
    expect(within(things).queryByText('Rolex Submariner')).toBeNull();
    const hidden = within(things).getAllByText('Not owned yet');
    expect(hidden).toHaveLength(content.items.length - 2);
    for (const label of hidden) {
      // Said to a screen reader, never drawn: the kit's words for one only, clipped to a point and out of the flow.
      let box = label;
      while (box.parentElement && box.style.width !== '1px') box = box.parentElement;
      expect([box.style.position, box.style.width, box.style.height, box.style.overflowX, box.style.overflowY]).toEqual(['absolute', '1px', '1px', 'hidden', 'hidden']);
      const tile = tileOf(label);
      expect(tile.querySelector('[data-silhouette]')).not.toBeNull();
      expect(tile.textContent).toBe('Not owned yet');
    }
    // Grouped as the shop groups them.
    for (const group of ['Cars and bikes', 'Pets', 'Watches', 'Tech', 'Fashion', 'Travel', 'Memberships']) expect(within(things).getByRole('heading', { name: group })).toBeTruthy();
  });

  it('lays the things two to a row, each row as tall as its tallest, a short last row leaving its other place empty', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), gallery: ['watch_casio'] });
    renderGame(<Collection tab="items" />, services);
    const things = await opened('Things');
    const casio = tileOf(await within(things).findByText('Casio F-91W'));
    const row = casio.parentElement as HTMLElement;
    expect(row.style.flexDirection).toBe('row');
    expect(row.style.gap).toBe('8px');
    expect(row.children).toHaveLength(2);
    // Every row has two places, whatever the number of things in its group.
    const ladders = new Set(content.items.map((item) => item.ladder));
    const rows = new Set(within(things).getAllByRole('listitem').map((tile) => tile.parentElement));
    expect(rows.size).toBe([...ladders].reduce((sum, ladder) => sum + Math.ceil(content.items.filter((item) => item.ladder === ladder).length / 2), 0));
    for (const line of rows) expect(line?.children).toHaveLength(2);
  });

  it('shows every badge, tells how it is earned only of those earned, and never says when', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: Date.UTC(2026, 9, 13, 12), gameId: 'g' }, bankrupt: { at: Date.UTC(2026, 0, 2, 12), gameId: 'g' } } });
    renderGame(<Collection />, services);

    expect((await screen.findByRole('tab', { name: 'Badges' })).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText(`2 of ${badges.length} earned`)).toBeTruthy();
    const panel = pageOf();
    expect(within(panel).getAllByRole('listitem')).toHaveLength(badges.length);
    for (const group of ['Wealth', 'Escape', 'Investing', 'Status', 'Life', 'Misfortune']) expect(within(panel).getByRole('heading', { name: group })).toBeTruthy();

    const earned = tileOf(within(panel).getByText('Millionaire'));
    expect(within(earned).queryByText(/2026/)).toBeNull();
    expect(within(earned).getByText(/Be worth a million/)).toBeTruthy();
    // Set in the rim of its rarity: a millionaire is common, and in bronze.
    expect(pictures(earned)).toEqual(['rim.bronze', 'badge.millionaire']);
    expect(within(earned).getByText('Common')).toBeTruthy();
    expect(earned.querySelector('[data-grey]')).toBeNull();

    const waiting = tileOf(within(panel).getByText('Ten million'));
    expect(within(waiting).getByText('Not earned yet')).toBeTruthy();
    // How to earn it is not told until it has been earned: the name is the clue.
    expect(within(waiting).queryByText(/Be worth ten million/)).toBeNull();
    // Its rarity is seen before it is won: ten million is rare, in gold, with the lock inside.
    expect(pictures(waiting)).toEqual(['rim.gold', 'badge.locked']);
    expect(within(waiting).getByText('Rare')).toBeTruthy();
  });

  it('draws a badge not yet earned as the web\'s `grayscale` card draws it: its pictures, its frame, its ground and its words in grey', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: 1, gameId: 'g' } } });
    renderGame(<Collection />, services);
    const panel = await opened('Badges');
    await screen.findByText(`1 of ${badges.length} earned`);
    const waiting = tileOf(within(panel).getByText('Ten million'));
    expect([...waiting.querySelectorAll('[data-sprite]')].map((sprite) => sprite.getAttribute('data-grey'))).toEqual(['true', 'true']);
    // The card: its ground night-700 and its frame night-900, greyed.
    const card = waiting.firstElementChild as HTMLElement;
    expect(card.style.backgroundColor).toBe(rgb(grey(COLORS['night-700'])));
    const strips = (Array.from(card.children) as HTMLElement[]).filter((kid) => kid.style.position === 'absolute');
    expect(strips.length).toBeGreaterThan(0);
    for (const strip of strips) expect(paintOf(strip)).toBe(rgb(grey(COLORS['night-900'])));
    // Its words: the name in ink-200, its rarity in its gold, how it is earned not told, in grey.
    expect(colourOf(within(waiting).getByText('Ten million'))).toBe(rgb(grey(COLORS['ink-200'])));
    expect(colourOf(within(waiting).getByText('Rare'))).toBe(rgb(grey(COLORS['gold-500'])));
    expect(colourOf(within(waiting).getByText('Not earned yet'))).toBe(rgb(grey(COLORS['ink-300'])));
    // Earned, in its own colours on a gold frame.
    const earned = tileOf(within(panel).getByText('Millionaire'));
    expect((earned.firstElementChild as HTMLElement).style.backgroundColor).toBe(rgb(COLORS['night-600']));
    expect(colourOf(within(earned).getByText('Millionaire'))).toBe(rgb(COLORS.cream));
  });

  it('shows one rarity at a time, each saying how many of it are won', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: 1, gameId: 'g' }, ten_million: { at: 1, gameId: 'g' } } });
    renderGame(<Collection />, services);
    expect((await screen.findByRole('tab', { name: 'Badges' })).getAttribute('aria-selected')).toBe('true');
    await screen.findByText(`2 of ${badges.length} earned`);
    const panel = pageOf();
    const of = (rarity: string) => badges.filter((badge) => rarityOf(badge.id) === rarity);
    const rare = within(panel).getByRole('radio', { name: /^Rare/ });
    expect(rare.textContent).toBe(`Rare1/${of('rare').length}`);
    fireEvent.click(rare);
    expect(within(panel).getAllByRole('listitem')).toHaveLength(of('rare').length);
    expect(within(panel).getByText('Ten million')).toBeTruthy();
    expect(within(panel).queryByText('Millionaire')).toBeNull();
    fireEvent.click(within(panel).getByRole('radio', { name: /^All/ }));
    expect(within(panel).getAllByRole('listitem')).toHaveLength(badges.length);
  });

  it('names each rarity without any count of lives or players, and hides judged badges until won', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: 1, gameId: 'g' } } });
    renderGame(<Collection />, services);
    expect((await screen.findByRole('tab', { name: 'Badges' })).getAttribute('aria-selected')).toBe('true');
    await screen.findByText(`1 of ${badges.length} earned`);
    const panel = pageOf();
    expect(panel.textContent).not.toMatch(/in 100 lives/);
    expect(panel.textContent).not.toMatch(/% of players|players have/i);
    // A judged badge, not yet won: its name is not told, only the group it belongs to.
    expect(within(panel).queryByText('Swiss banker')).toBeNull();
    const secrets = [...panel.querySelectorAll('[data-secret]')];
    expect(secrets.length).toBeGreaterThan(0);
    expect(within(secrets[0] as HTMLElement).getByText('???')).toBeTruthy();
    expect(within(secrets[0] as HTMLElement).getByText(/Something to do with: /)).toBeTruthy();
    // A measured badge is still named while locked.
    expect(within(panel).getByText('Ten million')).toBeTruthy();
  });

  it('starts empty for someone new, and leads back home', async () => {
    renderGame(<Collection />, memoryServices());
    fireEvent.click(await screen.findByRole('tab', { name: 'Things' }));
    expect(await screen.findByText(`0 of ${content.items.length} owned`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Collection' })).toBeTruthy();
    expect(screen.getByText('Everything you have ever owned, in any life, and every badge you have earned.')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('shows all the rarities again when the badges are shown again: the choice of one is the badges\' tab\'s own', async () => {
    renderGame(<Collection />, memoryServices());
    const panel = await opened('Badges');
    fireEvent.click(within(panel).getByRole('radio', { name: /^Legendary/ }));
    // The tab already open, pressed again, is as it was.
    fireEvent.click(screen.getByRole('tab', { name: 'Badges' }));
    expect(screen.getByRole('radio', { name: /^Legendary/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Things' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Badges' }));
    expect(screen.getByRole('radio', { name: /^All/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(pageOf()).getAllByRole('listitem')).toHaveLength(badges.length);
  });

  it('speaks Spanish', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: Date.UTC(2026, 9, 13, 12), gameId: 'g' } } });
    renderGame(<Collection />, services, 'es');
    expect((await screen.findByRole('tab', { name: 'Insignias' })).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('Primer millón')).toBeTruthy();
    expect(screen.queryByText(/2026/)).toBeNull();
  });
});

describe('the columns, as the web\'s container queries lay them out', () => {
  it('are three rarities to a row, five from 460 wide; two things, four from 560; one badge, two from 560', () => {
    expect(columnsAt(378)).toEqual({ rarities: 3, things: 2, badges: 1 });
    expect(columnsAt(424)).toEqual({ rarities: 3, things: 2, badges: 1 });
    expect(columnsAt(460)).toEqual({ rarities: 5, things: 2, badges: 1 });
    expect(columnsAt(560)).toEqual({ rarities: 5, things: 4, badges: 2 });
    // All a page keeps of its width is the last of these it reaches, which says the same columns.
    expect([0, 378, 424, 459, 460, 559, 560, 900].map(breakpointOf)).toEqual([0, 0, 0, 0, 460, 460, 560, 560]);
    for (const width of [378, 459, 460, 559, 560, 900]) expect(columnsAt(breakpointOf(width)), String(width)).toEqual(columnsAt(width));
  });

  it('are read from the width of the page\'s column inside its gutter, as it is laid out: a phone\'s column is never 460 wide, so three rarities to a row', async () => {
    renderGame(<Collection />, memoryServices());
    const panel = await opened('Badges');
    const rows = () => Array.from(within(panel).getByRole('radiogroup', { name: 'Rarity' }).children).map((row) => row.children.length);
    // All and the four rarities: three to a row, the last row's other place empty.
    expect(rows()).toEqual([3, 3]);
    // The page laid out on the widest phone: its column is 448, 424 inside the gutter.
    const page = panel as Laid;
    act(() => page.__reactLayoutHandler!({ nativeEvent: { layout: { x: 0, y: 0, width: 440, height: 900 } } }));
    expect(rows()).toEqual([3, 3]);
  });

  it('are not a reason to draw the page again when it is laid out at a width that crosses no breakpoint', async () => {
    const renders: Renders = { count: 0 };
    renderGame(
      <Counted into={renders}>
        <Collection />
      </Counted>,
      memoryServices(),
    );
    const panel = await opened('Badges');
    await settled();
    const before = renders.count;
    act(() => panel.__reactLayoutHandler!({ nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 900 } } }));
    act(() => panel.__reactLayoutHandler!({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 900 } } }));
    expect(renders.count).toBe(before);
  });
});

describe('what the collection is drawn again for', () => {
  it('is not drawn again by a change of the game it does not show: the news left, a card answered', async () => {
    const services = memoryServices();
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
          <Collection />
        </Counted>
      </>,
      services,
    );
    await waitFor(() => expect(probe.state?.status).toBe('playing'));
    await settled(() => probe.state?.leaveNews());
    const before = renders.count;
    await settled(() => probe.state?.pick(0));
    await settled(() => probe.state?.afterCard());
    expect(probe.state?.view?.answered).toBe(1);
    expect(renders.count).toBe(before);
  });

  it('draws again only the badges whose look changes when one rarity is chosen: those that stay are not drawn again', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { ten_million: { at: 1, gameId: 'g' }, millionaire: { at: 1, gameId: 'g' } } });
    renderGame(<Collection />, services);
    const panel = await opened('Badges');
    await within(panel).findByText('Ten million');
    // A rare badge earned, and a common one: each medal drawn once.
    expect(spriteRenders.get('badge.ten_million')).toBe(1);
    expect(spriteRenders.get('badge.millionaire')).toBe(1);
    fireEvent.click(within(panel).getByRole('radio', { name: /^Rare/ }));
    expect(within(panel).queryByText('Millionaire')).toBeNull();
    // The rare one stays where it was, as it was: not drawn again.
    expect(spriteRenders.get('badge.ten_million')).toBe(1);
    fireEvent.click(within(panel).getByRole('radio', { name: /^All/ }));
    expect(spriteRenders.get('badge.ten_million')).toBe(1);
    // The common one is back: drawn anew.
    expect(spriteRenders.get('badge.millionaire')).toBe(2);
  });
});
