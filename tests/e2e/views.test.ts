import { expect, test } from '@playwright/test';

import { CARDS_PER_PAGE, LATITUDE_LIMIT, SEARCH_LENGTH_LIMIT } from '../../src/lib/constants';

import type { Page } from '@playwright/test';

const POLL = { timeout: 10_000 };

const SANITIZED_DEFAULTS = {
    isStarredOnly: false,
    page: 0,
    searchValue: '',
    selectedCategoryIds: [],
    selectedJourneyIds: [],
    view: 'map',
};

const STATUS_PATTERN = /^(\d+) of (\d+) markers shown/;
const STORAGE_KEY = 'travel_atlas';

const cappedSearch = 'a'.repeat(SEARCH_LENGTH_LIMIT);
const oversizedSearch = `/${'a'.repeat(SEARCH_LENGTH_LIMIT * 2)}/`;

function createErrorLog(page: Page) {
    const errors: string[] = [];

    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });

    page.on('pageerror', (error) => {
        errors.push(error.message);
    });

    return errors;
}

async function getStatusCounts(page: Page) {
    const text = await page.locator('p[role="status"]').textContent();

    const match = STATUS_PATTERN.exec(String(text));

    return match === null ? null : { shown: Number(match[1]), total: Number(match[2]) };
}

function getStoredState(page: Page) {
    return page.evaluate((key) => {
        const raw = localStorage.getItem(key);

        return raw === null ? null : JSON.parse(raw) as Record<string, unknown>;
    }, STORAGE_KEY);
}

async function gotoReady(page: Page) {
    await page.goto('/');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible(POLL);
}

function seedAtlasState(page: Page, raw: string) {
    return page.addInitScript(([key, value]) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }, [STORAGE_KEY, raw] as const);
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('storage hardening', () => {
    test('recovers defaults and rewrites storage clean after malformed json', async ({ page }) => {
        await seedAtlasState(page, '{"view":"cards"');

        const errors = createErrorLog(page);

        await gotoReady(page);
        await expect(page.getByRole('button', { name: 'Switch to cards' })).toBeVisible(POLL);

        const counts = await getStatusCounts(page);

        expect(counts?.shown).toBeGreaterThan(0);
        expect(counts?.shown).toBe(counts?.total);

        await expect.poll(() => getStoredState(page), POLL).toEqual(SANITIZED_DEFAULTS);

        expect(errors).toEqual([]);
    });

    test('drops wrong typed fields and rewrites the record clean', async ({ page }) => {
        await seedAtlasState(page, JSON.stringify({
            camera: 'north',
            isStarredOnly: 'yes',
            junk: true,
            page: 2.5,
            searchValue: 42,
            selectedCategoryIds: 'dining',
            selectedJourneyIds: [7, false],
            view: 'grid',
        }));

        const errors = createErrorLog(page);

        await gotoReady(page);
        await expect(page.getByRole('button', { name: 'Switch to cards' })).toBeVisible(POLL);
        await expect(page.getByRole('button', { exact: true, name: 'Open filters' })).toBeVisible();
        await expect(page.locator('search input')).toHaveValue('');

        await expect.poll(() => getStoredState(page), POLL).toEqual(SANITIZED_DEFAULTS);

        expect(errors).toEqual([]);
    });

    test('drops an out of range camera and clamps an oversized page', async ({ page }) => {
        await seedAtlasState(page, JSON.stringify({
            camera: { lat: LATITUDE_LIMIT + 30, lng: 0, zoom: 3 },
            page: 9_999,
            view: 'cards',
        }));

        const errors = createErrorLog(page);

        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Switch to map' })).toBeVisible(POLL);

        const counts = await getStatusCounts(page);

        const total = Number(counts?.total ?? 0);

        expect(total).toBeGreaterThan(0);

        const lastPage = Math.max(1, Math.ceil(total / CARDS_PER_PAGE)) - 1;

        await expect.poll(() => getStoredState(page), POLL).toEqual({ ...SANITIZED_DEFAULTS, page: lastPage, view: 'cards' });

        if (lastPage > 0) await expect(page.locator('[aria-current="page"]')).toHaveText(String(lastPage + 1));

        expect(errors).toEqual([]);
    });

    test('caps an oversized search value and strips its slashes', async ({ page }) => {
        await seedAtlasState(page, JSON.stringify({ searchValue: oversizedSearch }));

        const errors = createErrorLog(page);

        await gotoReady(page);
        await expect(page.locator('search input')).toHaveValue(cappedSearch, POLL);
        await expect(page.locator('p[role="status"]')).toHaveText('No markers match');

        await expect.poll(() => getStoredState(page), POLL).toEqual({ ...SANITIZED_DEFAULTS, searchValue: cappedSearch });

        expect(errors).toEqual([]);
    });

    test('stays functional when localStorage setItem throws', async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(Storage.prototype, 'setItem', {
                value: () => {
                    throw new Error('storage denied');
                },
            });
        });

        const errors = createErrorLog(page);

        await gotoReady(page);
        await page.getByRole('button', { name: 'Switch to cards' }).click();
        await expect(page.getByRole('button', { name: 'Switch to map' })).toBeVisible(POLL);
        await expect(page.locator('.atlas-card').first()).toBeVisible();

        expect(await getStoredState(page)).toBeNull();
        expect(errors).toEqual([]);
    });
});

test.describe('view persistence', () => {
    test('restores the cards view after a reload', async ({ page }) => {
        await gotoReady(page);
        await page.getByRole('button', { name: 'Switch to cards' }).click();
        await expect(page.getByRole('button', { name: 'Switch to map' })).toBeVisible(POLL);
        await expect(page.locator('.atlas-card').first()).toBeVisible();

        await expect.poll(async () => (await getStoredState(page))?.view, POLL).toBe('cards');

        await page.reload();

        await expect(page.getByRole('button', { name: 'Switch to map' })).toBeVisible(POLL);
        await expect(page.locator('.atlas-card').first()).toBeVisible();
    });

    test('restores the map view after toggling back and reloading', async ({ page }) => {
        await seedAtlasState(page, JSON.stringify({ view: 'cards' }));
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Switch to map' })).toBeVisible(POLL);
        await page.getByRole('button', { name: 'Switch to map' }).click();
        await expect(page.locator('.maplibregl-canvas')).toBeVisible(POLL);

        await expect.poll(async () => (await getStoredState(page))?.view, POLL).toBe('map');

        await page.reload();

        await expect(page.locator('.maplibregl-canvas')).toBeVisible(POLL);
        await expect(page.getByRole('button', { name: 'Switch to cards' })).toBeVisible();
    });
});
