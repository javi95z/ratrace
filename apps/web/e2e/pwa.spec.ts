import { expect, test } from '@playwright/test';

test('the app is installable, a visited screen reopens offline, and a life is played with no connection', async ({ context, page, request }, info) => {
  test.skip(info.project.name !== 'phone', 'one browser is enough to prove the shared manifest and worker');

  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: 'The Rat Race', start_url: '/', scope: '/', display: 'standalone' });
  expect(manifest.icons).toEqual(expect.arrayContaining([expect.objectContaining({ sizes: '512x512', purpose: 'maskable' })]));

  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' }]);
  await page.goto('/en');
  await expect(page.getByRole('button', { name: 'Install' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  // Precaching the other two languages must not overwrite the preference set by this navigation.
  expect((await context.cookies()).find((cookie) => cookie.name === 'NEXT_LOCALE')?.value).toBe('en');

  await page.goto('/en/new');
  await expect(page.getByRole('button', { name: 'Start this life' })).toBeVisible();
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('button', { name: 'Start this life' })).toBeVisible();
    // With no connection at all, a life starts and is played: the game runs on the device.
    await page.getByRole('button', { name: 'Start this life' }).click();
    await expect(page).toHaveURL(/\/en\/play$/);
    await expect(page.getByRole('button', { name: /^See what life brings/ })).toBeVisible();
    await page.getByRole('button', { name: /^See what life brings/ }).click();
    await expect(page.locator('[data-card-option]').first()).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
