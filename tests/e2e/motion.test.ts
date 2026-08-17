import { expect, test } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';

interface ScrollRecorder {
    __scrollBehaviors?: string[];
}

const POLL = { timeout: 10_000 };
const POLL_FLIGHT = { timeout: 15_000 };
const POLL_SETTLE = { timeout: 5_000 };
const RING_POLL = { timeout: 2_000 };
const SETTLED_TRANSFORM = 'matrix(1, 0, 0, 1, 0, 0)';

function areAllRevealed(page: Page, selector: string) {
    return page.locator(selector).evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1'));
}

function getAnimationDuration(locator: Locator) {
    return locator.evaluate(element => getComputedStyle(element).animationDuration);
}

function getAnimationName(locator: Locator) {
    return locator.evaluate(element => getComputedStyle(element).animationName);
}

function getBoxShadow(locator: Locator) {
    return locator.evaluate(element => getComputedStyle(element).boxShadow);
}

function getDurationToken(page: Page, token: string) {
    return page.evaluate(name => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), token);
}

function getOpacity(locator: Locator) {
    return locator.evaluate(element => getComputedStyle(element).opacity);
}

function getScrollBehaviors(page: Page) {
    return page.evaluate(() => (window as ScrollRecorder).__scrollBehaviors ?? []);
}

function getTransform(locator: Locator) {
    return locator.evaluate(element => getComputedStyle(element).transform);
}

async function gotoReady(page: Page) {
    await page.goto('/');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible(POLL);
}

function mockScrollBehaviors(page: Page) {
    return page.addInitScript(() => {
        const recorder = window as ScrollRecorder;
        const scrollTo = Element.prototype.scrollTo;

        recorder.__scrollBehaviors = [];

        Element.prototype.scrollTo = function (this: Element, ...args: [ScrollToOptions?] | [number, number]) {
            const [options] = args;

            if (typeof options === 'object') recorder.__scrollBehaviors?.push(String(options.behavior));

            return scrollTo.apply(this, args as [ScrollToOptions]);
        };
    });
}

async function openFilters(page: Page) {
    await page.getByRole('button', { name: 'Open filters' }).click();
    await expect(page.locator('dialog.atlas-modal')).toBeVisible(POLL);
}

async function showFirstMarkerOnMap(page: Page) {
    await page.getByRole('button', { name: 'Switch to cards' }).click();

    const showOnMap = page.getByRole('button', { name: 'Show on map' }).first();

    await expect(showOnMap).toBeVisible(POLL);
    await showOnMap.click();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible(POLL);
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('entrance motion', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

    test('runs the modal and backdrop entrance keyframes at their authored durations', async ({ page }) => {
        await gotoReady(page);
        await openFilters(page);

        const backdrop = page.locator('div.atlas-fade.fixed');
        const dialog = page.locator('dialog.atlas-modal');

        expect(await getAnimationName(dialog)).toBe('atlas-modal__in');
        expect(await getAnimationDuration(dialog)).toBe(await getDurationToken(page, '--duration-base'));
        expect(await getAnimationName(backdrop)).toBe('atlas-fade__in');
        expect(await getAnimationDuration(backdrop)).toBe(await getDurationToken(page, '--duration-base'));

        await expect.poll(() => getOpacity(dialog), POLL).toBe('1');
        await expect.poll(() => getTransform(dialog), POLL).toBe(SETTLED_TRANSFORM);
    });

    test('rises the popup card in with its keyframes after show on map', async ({ page }) => {
        await gotoReady(page);
        await showFirstMarkerOnMap(page);

        await expect(page.locator('#atlas-popup article')).toBeVisible(POLL_FLIGHT);

        const rise = page.locator('#atlas-popup .atlas-rise');

        expect(await getAnimationName(rise)).toBe('atlas-rise__in');
        expect(await getAnimationDuration(rise)).toBe(await getDurationToken(page, '--duration-base'));

        await expect.poll(() => getOpacity(rise), POLL).toBe('1');
    });

    test('fades the map view in with the slow fade keyframes on load', async ({ page }) => {
        await gotoReady(page);

        const fade = page.locator('.atlas-fade--slow');

        expect(await getAnimationName(fade)).toBe('atlas-fade__in');
        expect(await getAnimationDuration(fade)).toBe(await getDurationToken(page, '--duration-slow'));

        await expect.poll(() => getOpacity(fade), POLL).toBe('1');
    });

    test('scrolls the highlighted card smoothly into view after show in cards', async ({ page }) => {
        await mockScrollBehaviors(page);
        await gotoReady(page);
        await showFirstMarkerOnMap(page);

        const popup = page.locator('#atlas-popup');

        await expect(popup.locator('article')).toBeVisible(POLL_FLIGHT);

        const markerId = await popup.locator('[data-marker-id]').getAttribute('data-marker-id');

        expect(markerId).not.toBeNull();

        const card = page.locator(`[data-marker-id="${markerId}"]`);

        await popup.getByRole('button', { name: 'Show in cards' }).click();

        await expect.poll(() => getBoxShadow(card), RING_POLL).toContain('4px');
        await expect.poll(() => getScrollBehaviors(page), POLL).toContain('smooth');
        await expect(card).toBeInViewport(POLL);
        await expect(card.locator('button')).toBeFocused();
    });
});

test.describe('entrance motion under reduced motion', () => {
    test('lands the map fade surfaces fully opaque on load', async ({ page }) => {
        await gotoReady(page);

        await expect.poll(() => getOpacity(page.locator('.atlas-fade--slow')), POLL).toBe('1');
        await expect.poll(() => page.locator('button.atlas-marker').count(), POLL).toBeGreaterThan(0);
        await expect.poll(() => areAllRevealed(page, 'button.atlas-marker'), POLL).toBe(true);
    });

    test('lands the filters modal fully opaque within the settle window after opening', async ({ page }) => {
        await gotoReady(page);
        await openFilters(page);

        const dialog = page.locator('dialog.atlas-modal');

        await expect.poll(() => getOpacity(dialog), POLL_SETTLE).toBe('1');
        await expect.poll(() => getTransform(dialog), POLL_SETTLE).toBe(SETTLED_TRANSFORM);

        expect(await getOpacity(page.locator('div.atlas-fade.fixed'))).toBe('1');
    });

    test('scrolls the highlighted card instantly into view after show in cards', async ({ page }) => {
        await mockScrollBehaviors(page);
        await gotoReady(page);
        await showFirstMarkerOnMap(page);

        const popup = page.locator('#atlas-popup');

        await expect(popup.locator('article')).toBeVisible(POLL_SETTLE);

        const markerId = await popup.locator('[data-marker-id]').getAttribute('data-marker-id');

        expect(markerId).not.toBeNull();

        const card = page.locator(`[data-marker-id="${markerId}"]`);

        await popup.getByRole('button', { name: 'Show in cards' }).click();

        await expect.poll(() => getScrollBehaviors(page), POLL).toContain('auto');
        await expect(card).toBeInViewport(POLL);

        expect(await getScrollBehaviors(page)).not.toContain('smooth');
    });

    test('settles show on map without a flight and opens the popup within the settle window', async ({ page }) => {
        await gotoReady(page);
        await showFirstMarkerOnMap(page);

        await expect(page.locator('#atlas-popup article')).toBeVisible(POLL_SETTLE);

        const rise = page.locator('#atlas-popup .atlas-rise');

        await expect.poll(() => getOpacity(rise), POLL_SETTLE).toBe('1');
        await expect.poll(() => getTransform(rise), POLL_SETTLE).toBe(SETTLED_TRANSFORM);
    });
});
