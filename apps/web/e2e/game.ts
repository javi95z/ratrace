import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** The words the tests press and look for, in each language the game speaks. */
export const WORDS = {
  en: {
    newLife: 'New life', start: 'Start this life', toCards: 'See what life brings', nextCard: 'Next card', toFinance: 'To your finances',
    play: 'Play the round', nextRound: 'Next round', finish: 'See how it ended', theEnd: 'The end', news: 'News', choices: /^Your choices/,
    happened: 'What happened', later: 'Two years later', card: (n: number) => new RegExp(`^Card ${n} of \\d`), round: (n: number) => `Round ${n} of 20`,
    continue: /Continue your life/, yourLife: 'Your life', orders: "This round's orders", again: 'Live another life',
    tabs: ['Portfolio', 'Market', 'Property', 'Debt', 'Lifestyle', 'Shop', 'Taxes'], openProfile: 'Open your profile', collection: 'Collection', records: 'Records', guide: 'Guide', skipGuide: 'Skip the guide',
  },
  es: {
    newLife: 'Nueva vida', start: 'Empezar esta vida', toCards: 'Ver qué trae la vida', nextCard: 'Siguiente carta', toFinance: 'A tus finanzas',
    play: 'Jugar la ronda', nextRound: 'Siguiente ronda', finish: 'Ver cómo acabó', theEnd: 'Fin', news: 'Noticias', choices: /^Tus opciones/,
    happened: 'Qué ha pasado', later: 'Dos años después', card: (n: number) => new RegExp(`^Carta ${n} de \\d`), round: (n: number) => `Ronda ${n} de 20`,
    continue: /Seguir con tu vida/, yourLife: 'Tu vida', orders: 'Las órdenes de esta ronda', again: 'Vivir otra vida',
    tabs: ['Cartera', 'Mercado', 'Vivienda', 'Deuda', 'Vida', 'Tienda', 'Impuestos'], openProfile: 'Abrir tu perfil', collection: 'Colección', records: 'Récords', guide: 'Guía', skipGuide: 'Quitar la guía',
  },
} as const;

export type Lang = keyof typeof WORDS;

/**
 * The game ignores a tap for this long after the screen changes, so that the second tap of a
 * double tap cannot press whatever took the first one's place. A test presses faster than any
 * thumb, so it waits this out the way a person would without noticing.
 */
const TAP_GUARD_MS = 400;
export const settle = (page: Page) => page.waitForTimeout(TAP_GUARD_MS + 30);

/** Everything the page complains about while a test runs. A clean game says nothing. */
export function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    if (message.type() === 'warning' && /sprite missing|could not save|not saving/.test(message.text())) problems.push(`warning: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

/** Starts a new life from the front door. */
export async function startLife(page: Page, lang: Lang, life: string) {
  const w = WORDS[lang];
  await page.goto(`/${lang}`);
  await page.getByRole('link', { name: w.newLife }).click();
  await page.getByRole('radio', { name: new RegExp(`^${life}`) }).click();
  await page.getByRole('button', { name: w.start }).click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/play$`));
  await expect(page.getByRole('button', { name: w.toCards })).toBeVisible();
  await settle(page);
}

/** Answers every card of the hand with the option at `pick`, or the last open one before it, and stops in the finances. */
export async function answerHand(page: Page, lang: Lang, pick = 0) {
  const w = WORDS[lang];
  for (;;) {
    const options = page.getByRole('group', { name: w.choices }).getByRole('button');
    await expect(options.first()).toBeVisible();
    await settle(page);
    let chosen = Math.min(pick, (await options.count()) - 1);
    while (chosen > 0 && !(await options.nth(chosen).isEnabled())) chosen -= 1;
    await options.nth(chosen).click();
    await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();
    await settle(page);
    const next = page.getByRole('button', { name: w.nextCard });
    if (await next.isVisible()) await next.click();
    else {
      await page.getByRole('button', { name: w.toFinance }).click();
      await expect(page.getByRole('button', { name: w.play })).toBeVisible();
      await settle(page);
      return;
    }
  }
}

/** Plays one whole round from its news: the cards, no orders, the ledger. Leaves the page on the ledger. */
export async function playRound(page: Page, lang: Lang, pick = 0) {
  const w = WORDS[lang];
  await page.getByRole('button', { name: w.toCards }).click();
  await answerHand(page, lang, pick);
  await page.getByRole('button', { name: w.play }).click();
  await expect(page.getByRole('heading', { name: w.later })).toBeVisible();
  await settle(page);
}

/**
 * What an accessibility audit finds wrong with the page as it stands: every breach of WCAG 2 A and AA
 * that axe can see, one line each, with the first element it is about. A clean page gives none.
 */
export async function auditOf(page: Page): Promise<string[]> {
  // Whatever is rising into place is still half transparent, and would be measured as unreadable.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id} (${violation.impact}): ${node.html.slice(0, 120)}`));
}

/** True if nothing on the page is wider than the screen. */
export const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/**
 * Buttons, links and switches on screen that a thumb would miss: smaller than 44px both ways.
 * Returns what each one says, so a failure names the culprit.
 */
export const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], [role="tab"], [role="switch"], [role="radio"], input[type="range"]')]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const shown = box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && !el.closest('nextjs-portal');
        return shown && (box.height < 44 || box.width < 44);
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
  );
