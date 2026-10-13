import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerHand, auditOf, fitsWidth, playRound, settle, smallTargets, startLife, watch, WORDS } from './game';
import type { Lang } from './game';

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
    if (round < 20) {
      await expect(page.getByText(w.round(round + 1)).first()).toBeVisible();
      await settle(page);
    }
  }

  await expect(page.getByRole('heading', { name: w.theEnd })).toBeVisible();
  await expect(page.getByText('Age 62')).toBeVisible();
  const score = page.getByRole('group', { name: 'Score' });
  await expect(score.getByText('Wealth')).toBeVisible();
  await expect(score.getByText('Status', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Your net worth through life/ })).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
  await shot(page, 'end', info.project.name);

  // A first life lived to the end: its badges, and the life it unlocked.
  await expect(page.getByText('New life unlocked: Delivery rider')).toBeVisible();
  const earned = page.getByRole('region', { name: 'Badges of this life' });
  const badgeCount = await earned.getByRole('listitem').count();
  expect(await auditOf(page), 'the end: accessibility').toEqual([]);
  expect(await smallTargets(page), 'the end: too small to press').toEqual([]);

  // The picture of the life: drawn at full size, and saved as a file with a name that says whose it is.
  await page.getByRole('button', { name: 'Share this life' }).click();
  const picture = page.getByRole('dialog', { name: 'A picture of this life' }).getByRole('img');
  await expect(picture).toBeVisible();
  expect(await picture.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1348]);
  if (SHOTS) {
    const bytes = await picture.evaluate(async (img: HTMLImageElement) => [...new Uint8Array(await (await fetch(img.src)).arrayBuffer())]);
    writeFileSync(`${SHOTS}/${info.project.name}-share-card.png`, Buffer.from(bytes));
  }
  const saving = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Save the picture' }).click();
  expect((await saving).suggestedFilename()).toMatch(/^rat-race-nurse-\d+\.png$/);
  await page.keyboard.press('Escape');

  // Closing the page on the score does not lose it.
  const total = await score.locator('p').nth(1).textContent();
  await page.reload();
  await expect(page.getByRole('heading', { name: w.theEnd })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Score' }).locator('p').nth(1)).toHaveText(total ?? '');

  // The life is over: the front door offers a look back and a new life, and nothing to continue.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('link', { name: w.newLife })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See how your last life ended' })).toBeVisible();
  await expect(page.getByRole('link', { name: w.continue })).toHaveCount(0);

  // The records list the life, and the collection shows what it earned.
  await page.getByRole('link', { name: 'Records' }).click();
  await expect(page.getByRole('region', { name: 'Past lives' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Personal bests' }).getByText('Best score')).toBeVisible();
  await expect(page).toHaveTitle('Records · The Rat Race');
  expect(await auditOf(page), 'records: accessibility').toEqual([]);
  await shot(page, 'records', info.project.name);
  await page.getByRole('link', { name: 'Back' }).click();
  await page.getByRole('link', { name: 'Collection' }).click();
  await page.getByRole('tab', { name: 'Badges' }).click();
  await expect(page.getByText(new RegExp(`^${badgeCount} of 30 earned$`))).toBeVisible();
  await shot(page, 'collection-badges-earned', info.project.name);
  await page.getByRole('link', { name: 'Back' }).click();

  // The delivery rider is now a life to choose, and a veteran is no longer guided.
  await page.getByRole('link', { name: w.newLife }).click();
  await expect(page.getByRole('radio', { name: /^Delivery rider/ })).toBeEnabled();
  await page.goto('/en');

  // A new life begins without a question, since nothing is in progress, and Back does not lead to the chooser again.
  await page.getByRole('link', { name: w.newLife }).click();
  await page.getByRole('button', { name: w.start }).click();
  await expect(page.getByRole('button', { name: w.toCards })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('note', { name: w.guide })).toHaveCount(0);
  await expect(page).toHaveTitle('Your life · The Rat Race');
  await page.goBack();
  await expect(page).not.toHaveURL(/\/new$/);
  expect(problems).toEqual([]);
});

test('a life closed in the middle of a hand reopens on the card that was waiting', async ({ page }) => {
  const problems = watch(page);
  const w = WORDS.en;
  await startLife(page, 'en', 'Software engineer');
  await page.getByRole('button', { name: w.toCards }).click();
  await expect(page.getByText(w.card(1))).toBeVisible();
  await settle(page);
  await page.getByRole('group', { name: w.choices }).getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();

  await page.reload();
  await expect(page.getByText(w.card(2))).toBeVisible();

  // And from the front door, the life in progress is the first thing offered.
  await page.goto('/en');
  await page.getByRole('link', { name: w.continue }).click();
  await expect(page.getByText(w.card(2))).toBeVisible();

  // Starting another life over this one asks first, and "no" keeps it.
  await page.goto('/en/new');
  await page.getByRole('button', { name: w.start }).click();
  const ask = page.getByRole('dialog', { name: 'End the life you are living?' });
  await expect(ask.getByText(/^Software engineer, age 22\./)).toBeVisible();
  await ask.getByRole('button', { name: 'Keep my life' }).click();
  await page.goto('/en/play');
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

  // The pension takes what it says it takes: all of what is offered is accepted.
  await expect(page.getByText(/^Up to \$[\d,]+ more this round$/)).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '100%' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Confirm/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/^Not possible/)).toHaveCount(0);
  await expect(page.getByText('Nothing more can go in this round.')).toBeVisible();
  if (wide) await page.getByRole('complementary', { name: w.news }).getByRole('button', { name: /^Remove: Pension/ }).click();
  else {
    await page.getByRole('button', { name: '1 order' }).click();
    await page.getByRole('dialog', { name: w.orders }).getByRole('button', { name: /^Remove: Pension/ }).click();
    await page.keyboard.press('Escape');
  }

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

/**
 * Walks every screen of a first round and hands each to `check`: the front door, the chooser, the
 * news, a card and its result, each finance tab, the profile or the side columns, and the ledger.
 */
async function walk(page: Page, lang: Lang, wide: boolean, check: (name: string) => Promise<void>) {
  const w = WORDS[lang];
  await page.goto(`/${lang}`);
  await expect(page.getByRole('link', { name: w.newLife })).toBeVisible();
  await check('home');
  await page.getByRole('link', { name: w.collection }).click();
  await expect(page.getByRole('heading', { level: 1, name: w.collection })).toBeVisible();
  await check('collection');
  await page.getByRole('tab').nth(1).click();
  await check('collection-badges');
  await page.goto(`/${lang}/records`);
  await expect(page.getByRole('heading', { level: 1, name: w.records })).toBeVisible();
  await check('records-empty');
  await page.goto(`/${lang}/new`);
  await expect(page.getByRole('button', { name: w.start })).toBeVisible();
  await check('new-life');
  await page.getByRole('button', { name: w.start }).click();
  await expect(page.getByRole('button', { name: w.toCards })).toBeVisible();
  // A first life is guided: the tip is part of the screen being measured.
  await expect(page.getByRole('note', { name: w.guide })).toBeVisible();
  await check('news');
  await settle(page);
  await page.getByRole('button', { name: w.toCards }).click();
  await expect(page.getByText(w.card(1))).toBeVisible();
  await check('card');
  await settle(page);
  await page.getByRole('group', { name: w.choices }).getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();
  await check('outcome');
  await settle(page);
  const next = page.getByRole('button', { name: w.nextCard });
  if (await next.isVisible()) {
    await next.click();
    await answerHand(page, lang);
  } else {
    await page.getByRole('button', { name: w.toFinance }).click();
    await settle(page);
  }

  for (const [i, tab] of w.tabs.entries()) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await check(`finance-${WORDS.en.tabs[i].toLowerCase()}`);
  }
  // A sheet is a screen too.
  await page.getByRole('tab', { name: w.tabs[0], exact: true }).click();
  await page.getByRole('tabpanel').getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await check('amount-sheet');
  await page.keyboard.press('Escape');
  if (!wide) {
    await page.getByRole('button', { name: w.openProfile }).click();
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
}

test('every screen fits the width, everything pressable is big enough for a thumb, and an audit finds nothing', async ({ page }, info) => {
  const wide = info.project.name !== 'phone';
  await page.goto('/en');
  await expect(page.getByRole('link', { name: WORDS.en.newLife })).toBeVisible();
  // The ruler itself is checked first: a button too small to press is found and named.
  await page.evaluate(() => {
    const tiny = document.createElement('button');
    tiny.textContent = 'tiny';
    tiny.id = 'tiny';
    tiny.style.cssText = 'width:30px;height:30px;position:fixed;top:0;left:0';
    document.body.append(tiny);
  });
  expect(await smallTargets(page)).toEqual(['button "tiny" 30x30']);
  // And so is the audit: text that cannot be read against its background is found.
  await page.evaluate(() => {
    const tiny = document.getElementById('tiny') as HTMLElement;
    tiny.style.cssText += ';width:60px;height:60px;color:#1f2a4d;background:#141b33';
  });
  expect((await auditOf(page)).some((line) => line.startsWith('color-contrast'))).toBe(true);
  await page.evaluate(() => document.getElementById('tiny')?.remove());

  const found = await measure(page, 'en', wide, (name) => shot(page, name, info.project.name));
  expect(found).toEqual([]);
});

/** Walks every screen and returns everything wrong with any of them, so one run shows the whole list. */
async function measure(page: Page, lang: Lang, wide: boolean, also: (name: string) => Promise<void> = async () => {}): Promise<string[]> {
  const found: string[] = [];
  await walk(page, lang, wide, async (name) => {
    if (!(await fitsWidth(page))) found.push(`${name}: wider than the screen`);
    for (const small of await smallTargets(page)) found.push(`${name}: too small to press: ${small}`);
    for (const breach of await auditOf(page)) found.push(`${name}: ${breach}`);
    await also(name);
  });
  return found;
}

test('the smallest phone, in Spanish, where the words are longest: every screen still fits', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'a phone is where space runs out');
  await page.setViewportSize({ width: 360, height: 740 });
  expect(await measure(page, 'es', false, (name) => shot(page, `${name}-es-360`, info.project.name))).toEqual([]);
});

test('a double tap never does a second thing: no card answered, no round played, no ledger skipped', async ({ page }) => {
  const problems = watch(page);
  const w = WORDS.en;
  await startLife(page, 'en', 'Nurse');

  // The first option of the card lands exactly where the button was.
  await page.getByRole('button', { name: w.toCards }).dblclick();
  await expect(page.getByText(w.card(1))).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByText(w.card(1))).toBeVisible();
  await expect(page.getByRole('heading', { name: w.happened })).toHaveCount(0);

  // "Next card" and "To your finances" give way to an option, or to "Play the round".
  for (;;) {
    await settle(page);
    await page.getByRole('group', { name: w.choices }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();
    await settle(page);
    const next = page.getByRole('button', { name: w.nextCard });
    if (await next.isVisible()) {
      const before = await page.evaluate(() => document.body.innerText);
      await next.dblclick();
      await page.waitForTimeout(600);
      // The next card is on screen, unanswered.
      await expect(page.getByRole('heading', { name: w.happened })).toHaveCount(0);
      await expect(page.getByRole('group', { name: w.choices })).toBeVisible();
      expect(await page.evaluate(() => document.body.innerText)).not.toBe(before);
    } else {
      await page.getByRole('button', { name: w.toFinance }).dblclick();
      await page.waitForTimeout(600);
      await expect(page.getByRole('button', { name: w.play })).toBeVisible();
      await expect(page.getByRole('heading', { name: w.later })).toHaveCount(0);
      break;
    }
  }

  // "Play the round" gives way to "Next round": the ledger must be seen.
  await page.getByRole('button', { name: w.play }).dblclick();
  await page.waitForTimeout(600);
  await expect(page.getByRole('heading', { name: w.later })).toBeVisible();
  await expect(page.getByText('Age 22 to 24')).toBeVisible();

  // "Next round" gives way to "See what life brings", which gives way to a card.
  await page.getByRole('button', { name: w.nextRound }).dblclick();
  await page.waitForTimeout(600);
  await expect(page.getByRole('button', { name: w.toCards })).toBeVisible();
  await expect(page.getByText(w.round(2)).first()).toBeVisible();
  expect(problems).toEqual([]);
});

test('a card follows the finger, says which way picks which, and a short drag picks nothing', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'swiping is how a phone answers a card');
  const w = WORDS.en;
  await startLife(page, 'en', 'Nurse');
  await page.getByRole('button', { name: w.toCards }).click();

  // Walk the hands until a card with two open options turns up.
  for (let tries = 0; tries < 40; tries++) {
    const options = page.getByRole('group', { name: w.choices }).getByRole('button');
    await expect(options.first()).toBeVisible();
    await settle(page);
    if ((await options.count()) === 2 && (await options.nth(1).isEnabled())) break;
    await options.first().click();
    await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();
    await settle(page);
    const next = page.getByRole('button', { name: w.nextCard });
    if (await next.isVisible()) await next.click();
    else {
      await page.getByRole('button', { name: w.toFinance }).click();
      await settle(page);
      await page.getByRole('button', { name: w.play }).click();
      await expect(page.getByRole('heading', { name: w.later })).toBeVisible();
      await settle(page);
      await page.getByRole('button', { name: w.nextRound }).click();
      await settle(page);
      await page.getByRole('button', { name: w.toCards }).click();
    }
  }
  const options = page.getByRole('group', { name: w.choices }).getByRole('button');
  expect(await options.count()).toBe(2);
  const second = (await options.nth(1).locator('.pixel').first().textContent()) ?? '';
  const first = (await options.nth(0).locator('.pixel').first().textContent()) ?? '';
  // Each side of the card says what it picks.
  await expect(page.getByText(`← ${first}`)).toBeVisible();
  await expect(page.getByText(`${second} →`)).toBeVisible();

  const card = page.locator('article');
  const rest = await card.boundingBox();
  if (!rest) throw new Error('no card on screen');
  const from = { x: rest.x + rest.width / 2, y: rest.y + 40 };

  // A short drag: the card comes along, then goes back, and nothing is answered.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y, { steps: 4 });
  await page.mouse.move(from.x + 60, from.y, { steps: 4 });
  const dragged = await card.boundingBox();
  expect((dragged?.x ?? 0) - rest.x).toBeGreaterThan(25);
  await page.mouse.up();
  // It springs back to where it was.
  await expect.poll(async () => Math.abs(((await card.boundingBox())?.x ?? 0) - rest.x), { timeout: 3_000 }).toBeLessThan(1.5);
  await expect(page.getByRole('heading', { name: w.happened })).toHaveCount(0);

  // A long drag to the right picks the second option.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 70, from.y, { steps: 5 });
  await page.mouse.move(from.x + 150, from.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: w.happened })).toBeVisible();
  await expect(page.getByText(`You chose: ${second}`)).toBeVisible();
});

test('the figures of the HUD are never cut short, in either language, on a small phone or a large one', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the HUD is tightest on a phone');
  // The longest amounts a life can show, as each language writes them.
  const longest = {
    en: ['+$9,999', '−$9,999', '+$99.9K', '−$999K', '+$9.99M', '−$9.99M', '$1.23B'],
    es: ['+9.999\u00a0$', '−9.999\u00a0$', '+99,9K\u00a0$', '−999K\u00a0$', '+9,99M\u00a0$', '−9,99M\u00a0$', '9.880M\u00a0$'],
  } as const;
  await startLife(page, 'en', 'Nurse');
  for (const lang of ['en', 'es'] as const) {
    // The same life, read in each language.
    await page.goto(`/${lang}/play`);
    await expect(page.getByRole('button', { name: WORDS[lang].toCards })).toBeVisible();
    for (const width of [360, 375, 390, 412, 430]) {
      await page.setViewportSize({ width, height: 800 });
      const cut = await page.evaluate((samples) => {
        const values = [...document.querySelectorAll<HTMLElement>('header .truncate.pixel')];
        const found: string[] = [];
        for (const value of values) {
          const original = value.textContent;
          for (const sample of samples) {
            value.textContent = sample;
            if (value.scrollWidth > value.clientWidth) found.push(`${sample} needs ${value.scrollWidth}px, has ${value.clientWidth}px`);
          }
          value.textContent = original;
        }
        return { stats: values.length, found };
      }, longest[lang]);
      expect(cut.stats, `${lang} ${width}`).toBe(3);
      expect(cut.found, `${lang} at ${width}px`).toEqual([]);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }
});

test('the Back button closes a sheet and leaves the life where it was', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the Back button is a phone habit');
  const problems = watch(page);
  const w = WORDS.en;
  await startLife(page, 'en', 'Nurse');
  await page.getByRole('button', { name: w.toCards }).click();
  await answerHand(page, 'en');

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/en\/play$/);
  await expect(page.getByRole('button', { name: w.play })).toBeVisible();

  // A sheet closed by its own button leaves nothing behind for Back to trip over: twice in and out, then Back still closes the third.
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: w.openProfile }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  }
  await page.getByRole('button', { name: w.openProfile }).click();
  await expect(page.getByRole('dialog', { name: w.yourLife })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: w.play })).toBeVisible();

  // With no sheet open, one Back leaves the game for the front door.
  await page.goBack();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole('link', { name: w.continue })).toBeVisible();
  expect(problems).toEqual([]);
});

test('the round on screen survives a change of language', async ({ page }, info) => {
  const problems = watch(page);
  const w = WORDS.en;
  await startLife(page, 'en', 'Nurse');
  await page.getByRole('button', { name: w.toCards }).click();
  await answerHand(page, 'en');
  await page.getByRole('tab', { name: 'Lifestyle' }).click();
  await page.getByRole('switch', { name: /^Study/ }).click();

  // Home, by the game's own way out, and into Spanish.
  if (info.project.name === 'phone') await page.getByRole('button', { name: w.openProfile }).click();
  await page.getByRole('link', { name: 'Leave to the home screen' }).click();
  await expect(page.getByRole('link', { name: w.continue })).toBeVisible();
  await page.getByRole('link', { name: 'Español' }).click();
  await page.getByRole('link', { name: WORDS.es.continue }).click();
  await expect(page.getByRole('button', { name: WORDS.es.play })).toBeVisible();
  // The order placed in English is still in the basket.
  await page.getByRole('tab', { name: 'Vida', exact: true }).click();
  await expect(page.getByRole('switch', { name: /^Estudiar/ })).toHaveAttribute('aria-checked', 'true');
  expect(problems).toEqual([]);
});

test('a first life is guided, one tip at a time, until the player says enough', async ({ page }) => {
  const w = WORDS.en;
  await startLife(page, 'en', 'Nurse');
  const tip = page.getByRole('note', { name: w.guide });
  await expect(tip).toContainText('Every round opens with the news');
  await tip.getByRole('button', { name: 'Got it' }).click();
  await expect(tip).toHaveCount(0);
  await page.getByRole('button', { name: w.toCards }).click();
  await expect(tip).toContainText('Life deals you a few cards');
  await tip.getByRole('button', { name: w.skipGuide }).click();
  await expect(tip).toHaveCount(0);
  // Turned off, it stays off: through the round, and after the page is opened again.
  await answerHand(page, 'en');
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: w.play })).toBeVisible();
  await expect(tip).toHaveCount(0);
});
