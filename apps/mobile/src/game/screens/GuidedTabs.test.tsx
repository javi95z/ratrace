// @vitest-environment jsdom
import { messagesFor } from '@ratrace/i18n';
import { TAB_FROM_ROUND } from '@ratrace/core/game/guide';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { Tabs } from '../../ui/overlay';
import { offeredTabs } from './Finance';
import { Play } from './Play';

afterEach(cleanup);

const en = messagesFor('en');
const ru = messagesFor('ru');
const TABS = ['portfolio', 'market', 'property', 'business', 'debt', 'lifestyle', 'shop', 'taxes'] as const;

/** The finances of the first round (a life whose cards are answered opens there) of a first life, guided, for a life that begins as given. */
async function firstFinances(lifeId: string, locale: 'en' | 'ru' = 'en') {
  const services = { ...memoryServices(), introduceTabs: true };
  const session = await services.sessions.start(lifeId);
  while (session.view().phase === 'cards') await session.answerCard(0);
  renderGame(<Play />, services, locale);
  return screen.findAllByRole('tab');
}

describe('the tabs of a first life', () => {
  it('keep the debt tab for later for someone who owes nothing', async () => {
    const tabs = await firstFinances('nurse');
    expect(tabs.map((tab) => tab.textContent)).not.toContain('Debt');
    // What the first round offers: what a first round needs, the rest as their tips come.
    expect(offeredTabs(true, 0, false)).toEqual(['portfolio', 'market', 'lifestyle', 'shop']);
  });

  it('show it from the first round to someone who already owes something', async () => {
    // The engineer begins with a student loan.
    const tabs = await firstFinances('engineer');
    expect(offeredTabs(true, 0, true)).toEqual(['portfolio', 'market', 'debt', 'lifestyle', 'shop']);
    expect(tabs.map((tab) => tab.textContent)).toContain('Debt');
    // Every tab drawn is one offered, in the web's order.
    const offered = offeredTabs(true, 0, true).map((id) => en.finance.tabs[id]);
    const titles = tabs.map((tab) => tab.textContent ?? '');
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.filter((title) => offered.includes(title))).toEqual(titles);
    expect(titles).toEqual(offered.filter((title) => titles.includes(title)));
  });

  it('open one by one as the rounds go by, all of them by the fifth; a life not guided has all eight from the start', () => {
    expect(offeredTabs(true, 2, false)).toEqual(['portfolio', 'market', 'debt', 'lifestyle', 'shop', 'taxes']);
    expect(offeredTabs(true, 3, false)).toEqual(['portfolio', 'market', 'property', 'debt', 'lifestyle', 'shop', 'taxes']);
    expect(offeredTabs(true, 4, false)).toEqual([...TABS]);
    expect(offeredTabs(false, 0, false)).toEqual([...TABS]);
    // The rounds are the guide's own.
    for (const id of TABS) expect(offeredTabs(true, TAB_FROM_ROUND[id] ?? 0, false)).toContain(id);
  });
});

describe('the tabs in Russian, their structure (a row that scrolls, titles never cut; widths are the batch pass\'s)', () => {
  it('scroll sideways rather than squeeze: a row that runs off the screen, every title whole on one line', async () => {
    const tabs = await firstFinances('engineer', 'ru');
    const strip = screen.getByRole('tablist', { name: ru.finance.tabsLabel });
    // A horizontal scroll (react-native-web draws one as a box that scrolls on x), its tabs in a row that does not wrap.
    expect(getComputedStyle(strip).overflowX).toMatch(/auto|scroll/);
    const row = strip.firstElementChild as HTMLElement;
    expect(getComputedStyle(row).flexDirection).toBe('row');
    expect(getComputedStyle(row).flexWrap).not.toBe('wrap');
    // Each title is all there is of it, never cut to a line with an ellipsis, and its tab does not shrink to fit.
    for (const tab of tabs) {
      const id = TABS.find((one) => ru.finance.tabs[one] === tab.textContent);
      expect(id, tab.textContent ?? '').toBeDefined();
      for (const text of within(tab).getAllByText(/./)) expect(text.className).not.toMatch(/r-textOverflow-|r-WebkitLineClamp|r-whiteSpace-nowrap.*r-overflow-hidden/);
    }
    for (const tab of strip.querySelectorAll('[role="tab"]')) expect((tab as HTMLElement).style.flexShrink).toBe('0');
  });

  it('draw all eight titles whole, as Finance\'s row draws them (the row of a life five rounds in, once every tab is on the phone)', () => {
    renderGame(<Tabs label={ru.finance.tabsLabel} tabs={TABS.map((id) => ({ id, label: ru.finance.tabs[id] }))} value="portfolio" onChange={() => {}} />, memoryServices(), 'ru');
    const strip = screen.getByRole('tablist', { name: ru.finance.tabsLabel });
    expect(getComputedStyle(strip).overflowX).toMatch(/auto|scroll/);
    expect(within(strip).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(TABS.map((id) => ru.finance.tabs[id]));
    for (const tab of within(strip).getAllByRole('tab')) {
      expect(tab.style.flexShrink).toBe('0');
      for (const text of within(tab).getAllByText(/./)) expect(text.className).not.toMatch(/r-textOverflow-|r-WebkitLineClamp/);
    }
  });
});
