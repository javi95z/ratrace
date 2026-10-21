// @vitest-environment jsdom
import { content, skillArt } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import { quoteItem } from '@ratrace/engine';
import type { ItemDef, ItemQuote } from '@ratrace/engine';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { webBaseline } from '../../ui/fonts';
import { COLORS } from '../../ui/theme';
import { ItemCost, owedLine } from './ItemCost';
import { ItemUses } from './ItemUses';
import { StatusNote } from './StatusNote';

/*
 * The pieces a thing looked at closely is told with, in the shop's sheet (Task 15) and among what the player owns (Task 17): what it cost and what
 * is owed on it, what it is good for, and why it gives less status than its own. The web's tests of them are the shop's and the profile's.
 */

afterEach(cleanup);

const fmt = formatFor('en');
/** Whether something on the page says these words (its words whole, however they are set in runs by font). */
const says = (words: string): boolean => [...document.body.querySelectorAll<HTMLElement>('[dir="auto"]')].some((line) => line.textContent === words);
/** A colour of the palette as the page writes it. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

/** The shop's quote of a thing in a nurse's first round, changed as the test needs it (what was paid, what is owed, what it would sell for). */
async function quoted(itemId: string, change: Partial<ItemQuote> = {}) {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  return { services, quote: { ...quoteItem(content, session.view(), itemId), ...change } };
}
const itemOf = (id: string) => content.items.find((item) => item.id === id) as ItemDef;

describe('what a thing owned cost', () => {
  it('says nothing of a thing not owned and owing nothing', async () => {
    const { services, quote } = await quoted('tech_laptop', { paid: null, owed: 0 });
    const { container } = renderGame(<ItemCost quote={quote} />, services);
    expect(container.textContent).toBe('');
  });

  it('says what it cost, and what selling it today would leave up or down against that', async () => {
    const gained = await quoted('tech_laptop', { paid: 200_000, resale: 260_000, sellable: true, owed: 0 });
    renderGame(<ItemCost quote={gained.quote} />, gained.services);
    expect(says(`It cost you ${fmt.money(200_000)}`)).toBe(true);
    expect(says(`Sell it today and you gain ${fmt.money(60_000)}`)).toBe(true);
    const gain = [...document.body.querySelectorAll<HTMLElement>('[dir="auto"]')].find((line) => line.textContent?.startsWith('Sell it today'));
    expect(gain?.style.color).toBe(rgb(COLORS['teal-300']));
    cleanup();
    const gift = await quoted('tech_laptop', { paid: 0, resale: 100_000, sellable: true, owed: 0 });
    renderGame(<ItemCost quote={gift.quote} />, gift.services);
    expect(says('It cost you nothing')).toBe(true);
  });

  it('says what is still owed on the loan that bought it, and what a sale would leave of the debt, on a wine note', async () => {
    const { services, quote } = await quoted('tech_laptop', { paid: 200_000, resale: 100_000, sellable: true, owed: 150_000 });
    renderGame(<ItemCost quote={quote} />, services);
    const note = screen.getByRole('note');
    expect(note.style.backgroundColor).toBe(rgb(COLORS['wine-900']));
    expect(says('Still owed on the loan')).toBe(true);
    expect(says(fmt.money(150_000))).toBe(true);
    expect(says(`You bought it on instalments. Selling it today would not clear the debt: you would be ${fmt.money(50_000)} short.`)).toBe(true);
    // Sold, the debt is all that is left of it.
    cleanup();
    const gone = await quoted('tech_laptop', { paid: null, owed: 150_000 });
    renderGame(<ItemCost quote={gone.quote} />, gone.services);
    expect(says('You bought it on instalments and no longer have it. The debt stays.')).toBe(true);
  });

  it('stands what is owed and its figure on one baseline as the browser does, each let down from the top of a row that does not read baselines', async () => {
    for (const language of ['en', 'es', 'ru'] as const) {
      // The browser's baselines of the words (14 on a line of 1.45) and of the pixel figure (14 on a line of 1.1), below each line's top.
      const words = webBaseline('read', 400, 14, 14 * 1.45, language);
      const figure = webBaseline('pixel', 400, 14, 14 * 1.1, language);
      const line = owedLine(language);
      expect(line.words + words, language).toBe(line.figure + figure);
      expect(Math.min(line.words, line.figure), language).toBe(0);
    }
    // In English the words' baseline is the lower one: the figure is let down to it.
    expect(owedLine('en').words).toBe(0);
    expect(owedLine('en').figure).toBeGreaterThan(0);

    const { services, quote } = await quoted('tech_laptop', { paid: 200_000, resale: 100_000, sellable: true, owed: 150_000 });
    renderGame(<ItemCost quote={quote} />, services);
    const boxOf = (words: string) => ([...document.body.querySelectorAll<HTMLElement>('[dir="auto"]')].find((text) => text.textContent === words) as HTMLElement).parentElement as HTMLElement;
    const [label, owed] = [boxOf('Still owed on the loan'), boxOf(fmt.money(150_000))];
    expect(label.parentElement).toBe(owed.parentElement);
    // Aligned at the top: a native row's `baseline` reads each text's box, and the kit moves the glyphs inside it.
    expect(label.parentElement?.style.alignItems).toBe('flex-start');
    expect(label.style.marginTop).toBe(`${owedLine('en').words}px`);
    expect(owed.style.marginTop).toBe(`${owedLine('en').figure}px`);
  });
});

describe('what a thing is good for', () => {
  it('names each use with its sign, and that within a ladder only the best counts', async () => {
    const services = memoryServices();
    renderGame(<ItemUses item={itemOf('tech_laptop')} />, services);
    const uses = await screen.findByRole('region', { name: 'Good for' });
    expect(says('+1 career skill when you study')).toBe(true);
    expect(says('Within a ladder only the best you own counts.')).toBe(true);
    expect(uses.querySelectorAll('[data-sprite]')).toHaveLength(1);
  });

  it('says which skill a thing used every round trains', async () => {
    const services = memoryServices();
    renderGame(<ItemUses item={itemOf('member_gym')} />, services);
    await screen.findByRole('region', { name: 'Good for' });
    expect(says(`Trains Health: +${content.life.skills.practicePoints} point every round`)).toBe(true);
    expect(document.body.querySelector(`[data-sprite="${skillArt.health}"]`)).not.toBeNull();
  });

  it('draws nothing for a thing that is status and nothing else', async () => {
    const plain = content.items.find((item) => Object.keys(item.perks ?? {}).length === 0 && !Object.values(content.life.skills.practiceItems).some((ids) => (ids ?? []).includes(item.id)));
    if (!plain) throw new Error('some thing is status and nothing else');
    const { container } = renderGame(<ItemUses item={plain} />, memoryServices());
    expect(container.textContent).toBe('');
  });
});

describe('why a thing gives less status than its own', () => {
  it('says nothing of a thing that gives all of it', async () => {
    const { services, quote } = await quoted('watch_omega', { status: 6, statusReal: 6 });
    const { container } = renderGame(<StatusNote quote={quote} owned={false} />, services);
    expect(container.textContent).toBe('');
  });

  it('says a better one of its kind is owned: none of it, or part of it, before buying and once owned', async () => {
    const none = await quoted('watch_omega', { status: 6, statusReal: 0 });
    renderGame(<StatusNote quote={none.quote} owned={false} />, none.services);
    expect(says('You already own something better of its kind: it adds no status.')).toBe(true);
    cleanup();
    const less = await quoted('watch_omega', { status: 6, statusReal: 2 });
    renderGame(<StatusNote quote={less.quote} owned />, less.services);
    expect(says('You own something better of its kind: it counts for 2 of its 6.')).toBe(true);
  });
});
