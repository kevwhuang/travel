import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const ERROR_PAGES = [
    { name: 'server error', path: '/500' },
    { name: 'not found', path: '/nonexistent-404' },
] as const;

const OVERLAY_CONTROL_COUNT = 4;
const SCRIPT_TIMEOUT = 20_000;
const STORAGE_KEY = 'travel_atlas';
const VIEWPORT_HEIGHT = 800;
const WIDTHS = [320, 375, 767, 768, 769, 1_023, 1_024, 1_025, 1_280, 1_440] as const;

function countHiddenControls(page: Page) {
    return page.evaluate(() => [...document.querySelectorAll('.atlas-control')].filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return rect.width === 0 || rect.height === 0 || style.opacity === '0' || style.visibility === 'hidden';
    }).length);
}

function getCanvasDelta(page: Page) {
    return page.evaluate(() => {
        const canvas = document.querySelector('.maplibregl-canvas');

        if (!canvas) return null;

        return Math.max(
            Math.abs(canvas.clientWidth - document.documentElement.clientWidth),
            Math.abs(canvas.clientHeight - document.documentElement.clientHeight),
        );
    });
}

function getOverflow(page: Page) {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('responsive layout', () => {
    for (const entry of ERROR_PAGES) {
        test(`${entry.name} page has no horizontal overflow at any width`, async ({ page }) => {
            await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: WIDTHS[0] });
            await page.goto(entry.path);
            await page.locator('main').waitFor();

            for (const width of WIDTHS) {
                await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });

                const overflow = await getOverflow(page);

                expect(overflow, `horizontal overflow at width ${width}`).toBeLessThanOrEqual(0);
            }
        });
    }

    test('map view fits every width with all overlay controls visible and a viewport-sized canvas', async ({ page }) => {
        await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: WIDTHS[0] });
        await page.goto('/');
        await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: SCRIPT_TIMEOUT });
        await expect(page.locator('.atlas-control')).toHaveCount(OVERLAY_CONTROL_COUNT);

        for (const width of WIDTHS) {
            await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });

            const overflow = await getOverflow(page);

            expect(overflow, `horizontal overflow at width ${width}`).toBeLessThanOrEqual(0);

            await expect
                .poll(() => countHiddenControls(page), { message: `hidden overlay controls at width ${width}`, timeout: SCRIPT_TIMEOUT })
                .toBe(0);

            await expect
                .poll(() => getCanvasDelta(page), { message: `canvas size off the viewport at width ${width}`, timeout: SCRIPT_TIMEOUT })
                .toBe(0);
        }
    });

    test('cards view fits every width with all overlay controls visible', async ({ page }) => {
        await page.addInitScript(([key, state]) => {
            if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, state);
        }, [STORAGE_KEY, JSON.stringify({ view: 'cards' })] as const);

        await page.setViewportSize({ height: VIEWPORT_HEIGHT, width: WIDTHS[0] });
        await page.goto('/');
        await expect(page.locator('.atlas-card').first()).toBeVisible({ timeout: SCRIPT_TIMEOUT });
        await expect(page.locator('.atlas-control')).toHaveCount(OVERLAY_CONTROL_COUNT);

        for (const width of WIDTHS) {
            await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });

            const overflow = await getOverflow(page);

            expect(overflow, `horizontal overflow at width ${width}`).toBeLessThanOrEqual(0);

            await expect
                .poll(() => countHiddenControls(page), { message: `hidden overlay controls at width ${width}`, timeout: SCRIPT_TIMEOUT })
                .toBe(0);
        }
    });
});
