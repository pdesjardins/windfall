// SPDX-License-Identifier: MIT

const { test, expect } = require('@playwright/test');

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
