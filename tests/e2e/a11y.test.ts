import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const FOCUS_TARGETS = [
    { name: 'filter button', selector: 'button[aria-label="Open filters"]' },
    { name: 'search toggle', selector: 'button[aria-label="Search markers"]' },
    { name: 'credit link', selector: 'a[href="https://aephonics.com"]' },
    { name: 'view toggle', selector: 'button[aria-label="Switch to cards"]' },
] as const;

const HOME_TITLE = 'Travel';
const MAX_TAB_PRESSES = 12;
const PUBLIC_PATHS = ['/', '/500', '/nonexistent-404'] as const;
const SCRIPT_TIMEOUT = 20_000;
const TITLE_PATTERN = /^.+ \u2014 Travel$/;

function getOutline(page: Page, selector: string) {
    return page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element);

        return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
    });
}

function getStructure(page: Page) {
    return page.evaluate(() => ({
        dialogCount: document.querySelectorAll('dialog, [role="dialog"]').length,
        h1Count: document.querySelectorAll('h1').length,
        headingLevels: [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(heading => Number(heading.tagName.slice(1))),
        mainCount: document.querySelectorAll('main, [role="main"]').length,
        missingAltCount: [...document.querySelectorAll('img')].filter(image => !image.hasAttribute('alt')).length,
        unresolvedLabelIds: [...document.querySelectorAll('[aria-labelledby]')]
            .flatMap(element => (element.getAttribute('aria-labelledby') || '').split(/\s+/))
            .filter(id => id && !document.getElementById(id)),
    }));
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('document structure', () => {
    for (const path of PUBLIC_PATHS) {
        test(`${path} exposes one main, one h1, unskipped heading levels, image alt text, resolvable label ids, and no resting dialog`, async ({ page }) => {
            await page.goto(path);
            await page.locator('main').waitFor();

            const structure = await getStructure(page);

            const skippedLevels = structure.headingLevels.filter((level, index) => level > (structure.headingLevels[index - 1] ?? 0) + 1);

            expect(structure.mainCount).toBe(1);
            expect(structure.h1Count).toBe(1);
            expect(skippedLevels).toEqual([]);
            expect(structure.missingAltCount).toBe(0);
            expect(structure.unresolvedLabelIds).toEqual([]);
            expect(structure.dialogCount).toBe(0);
        });
    }

    test('switching to cards keeps a single h1 above level-two card headings', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: SCRIPT_TIMEOUT });

        await page.locator('button[aria-label="Switch to cards"]').click();

        await expect(page.locator('.atlas-card').first()).toBeVisible({ timeout: SCRIPT_TIMEOUT });
        await expect(page.locator('h1')).toHaveText('Atlas');

        const structure = await getStructure(page);

        const skippedLevels = structure.headingLevels.filter((level, index) => level > (structure.headingLevels[index - 1] ?? 0) + 1);

        expect(structure.h1Count).toBe(1);
        expect(structure.headingLevels[0]).toBe(1);
        expect(skippedLevels).toEqual([]);
        expect(structure.headingLevels.filter(level => level === 2).length).toBeGreaterThan(0);
    });
});

test.describe('keyboard navigation', () => {
    test('tab from body reaches every overlay control with visible focus styles', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: SCRIPT_TIMEOUT });

        const baseline: Record<string, string> = {};
        const remaining = new Map(FOCUS_TARGETS.map(target => [target.selector, target.name]));

        for (const target of FOCUS_TARGETS) {
            baseline[target.selector] = await getOutline(page, target.selector);
        }

        for (let press = 0; press < MAX_TAB_PRESSES && remaining.size > 0; press++) {
            await page.keyboard.press('Tab');

            for (const selector of [...remaining.keys()]) {
                const isFocused = await page.locator(selector).evaluate(element => element === document.activeElement);

                if (!isFocused) continue;

                const focusedOutline = await getOutline(page, selector);

                expect(focusedOutline, `focus indicator on ${remaining.get(selector)}`).not.toMatch(/^none /);
                expect(focusedOutline, `focus indicator on ${remaining.get(selector)}`).not.toBe(baseline[selector]);
                remaining.delete(selector);
            }
        }

        expect([...remaining.values()]).toEqual([]);
    });
});

test.describe('page titles', () => {
    test('titles are unique, bare on home, and suffixed with an em dash on error pages', async ({ page }) => {
        const titles: string[] = [];

        for (const path of PUBLIC_PATHS) {
            await page.goto(path);
            titles.push(await page.title());
        }

        expect(new Set(titles).size).toBe(titles.length);
        expect(titles[0]).toBe(HOME_TITLE);

        for (const title of titles.slice(1)) {
            expect(title).toMatch(TITLE_PATTERN);
        }
    });
});
