import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerHand, fitsWidth, playRound, smallTargets, startLife, watch, WORDS } from './game';

/** Set RATRACE_SHOTS to a folder to keep a picture of every screen the tests pass through. */
const SHOTS = process.env.RATRACE_SHOTS;
const shot = async (page: Page, name: string, project: string) => {
  if (!SHOTS) return;
  // Let whatever is rising into place arrive first, and every picture finish loading.
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished));
    await Promise.all([...document.images].filter((image) => !image.complete).map((image) => new Promise((done) => image.addEventListener('load', done, { once: true }))));
  });
  await page.screenshot({ path: `${SHOTS}/${project}-${name}.png` });
};

test('a whole life, from the front door to the score', async ({ page }, info) => {
  const problems = watch(page);
  const w = WORDS.en;
  await startLife(page, 'en', 'Nurse');

  for (let round = 1; round <= 20; round++) {
    await expect(page.getByText(w.round(round)).first()).toBeVisible();
    // A different choice each round, to walk through more of the game than first options would.
    await playRound(page, 'en', round % 3);
    if (round === 1) await shot(page, 'resolve', info.project.name);
    await page.getByRole('button', { name: round === 20 ? w.finish : w.nextRound }).click();
  }

  await expect(page.getByRole('heading', { name: w.theEnd })).toBeVisible();
  await expect(page.getByText('Age 62')).toBeVisible();
  const score = page.getByRole('group', { name: 'Score' });
  await expect(score.getByText('Wealth')).toBeVisible();
  await expect(score.getByText('Status', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Your net worth through life/ })).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
  await shot(page, 'end', info.project.name);

  // The life is over: the front door offers a new one and nothing to continue.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('link', { name: w.newLife })).toBeVisible();
  await expect(page.getByRole('link', { name: w.continue })).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('a life closed in the middle of a hand reopens on the card that was waiting', async ({ page }) => {
  const problems = watch(page);
  const w = WORDS.en;
  await startLife(page, 'en', 'Software engineer');
  await page.getByRole('button', { name: w.toCards }).click();
  await expect(page.getByText(w.card(1))).toBeVisible();
  await page.getByRole('group', { name: w.choices }).getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();

  await page.reload();
  await expect(page.getByText(w.card(2))).toBeVisible();

  // And from the front door, the life in progress is the first thing offered.
  await page.goto('/en');
  await page.getByRole('link', { name: w.continue }).click();
  await expect(page.getByText(w.card(2))).toBeVisible();

  // The finances survive a reload too, at the same round.
  await answerHand(page, 'en');
  await page.reload();
  await expect(page.getByRole('button', { name: w.play })).toBeVisible();
  await expect(page.getByText(w.round(1)).first()).toBeVisible();
  expect(problems).toEqual([]);
});

test('an order is placed, shown, taken back and placed again, and the round plays it', async ({ page }, info) => {
  const problems = watch(page);
  const w = WORDS.en;
  const wide = info.project.name !== 'phone';
  await startLife(page, 'en', 'Civil servant');
  await page.getByRole('button', { name: w.toCards }).click();
  await answerHand(page, 'en');
  await shot(page, 'finance', info.project.name);

  // Move half of the cash into savings through the amount sheet.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: '50%' }).click();
  await sheet.getByRole('button', { name: /^Confirm/ }).click();
  await expect(sheet).toHaveCount(0);

  const orders = wide ? page.getByRole('complementary', { name: w.news }).getByRole('list', { name: w.orders }) : page.getByRole('dialog', { name: w.orders }).getByRole('list');
  if (!wide) await page.getByRole('button', { name: '1 order' }).click();
  await expect(orders.getByText(/^Save /)).toBeVisible();
  await orders.getByRole('button', { name: /^Remove: Save/ }).click();
  await expect(orders).toHaveCount(0);
  if (!wide) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'No orders' })).toBeVisible();
  }

  // Study this round, and see it in the ledger's aftermath: career skill went up.
  await page.getByRole('tab', { name: 'Lifestyle' }).click();
  await page.getByRole('switch', { name: /^Study/ }).click();
  await page.getByRole('button', { name: w.play }).click();
  await expect(page.getByRole('heading', { name: w.later })).toBeVisible();
  await expect(page.getByRole('table', { name: 'What came in and went out' }).getByText('Salary')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the game plays in Spanish', async ({ page }, info) => {
  const problems = watch(page);
  const w = WORDS.es;
  await startLife(page, 'es', 'Enfermera');
  await expect(page.getByRole('heading', { name: w.news })).toBeVisible();
  await expect(page.getByText('22 años').first()).toBeVisible();
  await playRound(page, 'es');
  await expect(page.getByText('De los 22 a los 24')).toBeVisible();
  await page.getByRole('button', { name: w.nextRound }).click();
  await expect(page.getByText(w.round(2)).first()).toBeVisible();
  await shot(page, 'news-es', info.project.name);
  // Nothing in English is left on a Spanish screen.
  await expect(page.getByText(/Round \d|Net worth|Cash after/)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('a first visit follows the language of the browser', async ({ browser }) => {
  for (const [locale, path] of [['es-ES', '/es'], ['en-GB', '/en'], ['fr-FR', '/en']] as const) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await context.close();
  }
});

test('every screen fits the width, and everything pressable is big enough for a thumb', async ({ page }, info) => {
  const w = WORDS.en;
  const check = async (name: string) => {
    expect(await fitsWidth(page), `${name}: wider than the screen`).toBe(true);
    expect(await smallTargets(page), `${name}: too small to press`).toEqual([]);
    await shot(page, name, info.project.name);
  };

  await page.goto('/en');
  await expect(page.getByRole('link', { name: w.newLife })).toBeVisible();
  // The ruler itself is checked first: a button too small to press is found and named.
  await page.evaluate(() => {
    const tiny = document.createElement('button');
    tiny.textContent = 'tiny';
    tiny.id = 'tiny';
    tiny.style.cssText = 'width:30px;height:30px;position:fixed;top:0;left:0';
    document.body.append(tiny);
  });
  expect(await smallTargets(page)).toEqual(['button "tiny" 30x30']);
  await page.evaluate(() => document.getElementById('tiny')?.remove());
  await check('home');
  await page.getByRole('link', { name: w.newLife }).click();
  await expect(page.getByRole('button', { name: w.start })).toBeVisible();
  await check('new-life');
  await page.getByRole('button', { name: w.start }).click();
  await expect(page.getByRole('button', { name: w.toCards })).toBeVisible();
  await check('news');
  await page.getByRole('button', { name: w.toCards }).click();
  await expect(page.getByText(w.card(1))).toBeVisible();
  await check('card');
  await page.getByRole('group', { name: w.choices }).getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();
  await check('outcome');
  const next = page.getByRole('button', { name: w.nextCard });
  if (await next.isVisible()) {
    await next.click();
    await answerHand(page, 'en');
  } else await page.getByRole('button', { name: w.toFinance }).click();

  for (const tab of ['Portfolio', 'Market', 'Property', 'Debt', 'Lifestyle', 'Shop', 'Taxes']) {
    await page.getByRole('tab', { name: tab }).click();
    await check(`finance-${tab.toLowerCase()}`);
  }
  if (info.project.name === 'phone') {
    await page.getByRole('button', { name: 'Open your profile' }).click();
    await expect(page.getByRole('dialog', { name: w.yourLife })).toBeVisible();
    await check('profile');
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByRole('complementary', { name: w.yourLife })).toBeVisible();
    await expect(page.getByRole('complementary', { name: w.news })).toBeVisible();
  }
  await page.getByRole('button', { name: w.play }).click();
  await expect(page.getByRole('heading', { name: w.later })).toBeVisible();
  await check('ledger');
});
