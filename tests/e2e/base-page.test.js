// SPDX-License-Identifier: MIT

import { test, expect } from '@playwright/test';

test('page title contains Windfall', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Windfall/);
});

test('game canvas is present', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible();
});

test('top bar displays game title', async ({ page }) => {
  await page.goto('/');
  const title = page.locator('#game-title');
  await expect(title).toHaveText('Windfall');
});

test('session controls are in the top bar', async ({ page }) => {
  await page.goto('/');
  const topBar = page.locator('#top-bar');
  await expect(topBar.locator('#btn-new-game')).toBeVisible();
  await expect(topBar.locator('#btn-save')).toBeVisible();
  await expect(topBar.locator('#btn-load')).toBeVisible();
});

test('turn controls are in the right panel', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('#info-panel');
  await expect(panel.locator('#btn-end-turn')).toBeVisible();
  await expect(panel.locator('#turn-counter')).toBeVisible();
});

test('no console errors on load', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  expect(errors).toHaveLength(0);
});

test('new game renders terrain on canvas', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await page.click('#btn-new-game');
  await page.waitForTimeout(200);

  const isNonEmpty = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Check that not all pixels are the same color (i.e., something was drawn)
    const first = [data[0], data[1], data[2], data[3]].join(',');
    for (let i = 4; i < data.length; i += 4) {
      const px = [data[i], data[i + 1], data[i + 2], data[i + 3]].join(',');
      if (px !== first) return true;
    }
    return false;
  });

  expect(isNonEmpty).toBe(true);
  expect(errors).toHaveLength(0);
});
