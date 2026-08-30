import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

import { CARDS_PER_PAGE, CONTENT_DIR, SEARCH_LENGTH_LIMIT, SEARCH_SHORTCUT } from '../../src/lib/constants';

import type { Page } from '@playwright/test';

type MirrorMarker = Pick<AtlasMarker, 'categoryId' | 'isStarred' | 'journeyId' | 'name'>;

interface ContentMarker {
    category: string;
    lat: number;
    lng: number;
    name: string;
    starred?: boolean;
}

interface JourneyFile {
    markers: ContentMarker[];
}

const CANVAS_TIMEOUT = 15_000;
const EMPTY_STATUS = 'No markers match.';
const PREFIX_LENGTH = 6;
const STORAGE_KEY = 'travel_atlas';
const STORAGE_POLL = { timeout: 5_000 } as const;

const markers = loadAtlasMarkers();

const accentedMarker = markers.find(marker => foldText(marker.name) !== marker.name.toLowerCase());
const cardsPageCount = Math.max(1, Math.ceil(markers.length / CARDS_PER_PAGE));
const narrowingPrefix = getNarrowingPrefix();
const totalCount = markers.length;

function foldText(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getDedupeKey(marker: { lat: number; lng: number; name: string }) {
    return `${marker.name}|${marker.lat}|${marker.lng}`;
}

function getMatchCount(query: string) {
    const folded = foldText(query.trim());

    return markers.filter(marker => foldText(marker.name).includes(folded)).length;
}

function getNarrowingPrefix() {
    for (const marker of markers) {
        const prefix = marker.name.slice(0, PREFIX_LENGTH);

        if (prefix.includes(SEARCH_SHORTCUT)) continue;

        const matches = getMatchCount(prefix);

        if (matches > 0 && matches < markers.length) return prefix;
    }

    throw new Error('Expected a marker name prefix matching some but not all markers.');
}

function getSearchControl(page: Page) {
    return page.locator('search');
}

function getSearchInput(page: Page) {
    return page.getByLabel('Search markers by name');
}

function getStatus(page: Page) {
    return page.locator('p[role="status"]');
}

function getStatusText(shown: number, view: 'cards' | 'map') {
    if (shown === 0) return EMPTY_STATUS;

    const pageCount = Math.max(1, Math.ceil(shown / CARDS_PER_PAGE));

    const pageSuffix = pageCount > 1 && view === 'cards' ? `, page 1 of ${pageCount}` : '';

    return `${shown} of ${totalCount} markers shown${pageSuffix}.`;
}

async function gotoCardsView(page: Page) {
    await page.addInitScript(([key, state]) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, state);
    }, [STORAGE_KEY, JSON.stringify({ view: 'cards' })] as const);

    await page.goto('/');

    await expect(getStatus(page)).toHaveText(getStatusText(totalCount, 'cards'));
}

async function gotoMapView(page: Page) {
    await page.goto('/');

    await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: CANVAS_TIMEOUT });
}

function loadAtlasMarkers() {
    const journeyIds = readdirSync(join(CONTENT_DIR, 'journeys'))
        .filter(file => file.endsWith('.json'))
        .map(file => basename(file, '.json'))
        .sort((first, second) => parseJourneyYear(second) - parseJourneyYear(first) || parseJourneyOrder(second) - parseJourneyOrder(first));

    const markersByKey = new Map<string, MirrorMarker>();

    for (const journeyId of journeyIds) {
        const journey = JSON.parse(readFileSync(join(CONTENT_DIR, 'journeys', `${journeyId}.json`), 'utf-8')) as JourneyFile;

        for (const marker of journey.markers) {
            const existing = markersByKey.get(getDedupeKey(marker));

            if (existing) {
                if (marker.starred === true) existing.isStarred = true;

                continue;
            }

            markersByKey.set(getDedupeKey(marker), {
                categoryId: marker.category,
                isStarred: marker.starred === true,
                journeyId,
                name: marker.name,
            });
        }
    }

    const starredMarkers = JSON.parse(readFileSync(join(CONTENT_DIR, 'starred.json'), 'utf-8')) as ContentMarker[];

    for (const marker of starredMarkers) {
        const existing = markersByKey.get(getDedupeKey(marker));

        if (existing) {
            existing.isStarred = true;

            continue;
        }

        markersByKey.set(getDedupeKey(marker), {
            categoryId: marker.category,
            isStarred: true,
            journeyId: null,
            name: marker.name,
        });
    }

    return [...markersByKey.values()];
}

async function openSearch(page: Page) {
    await page.keyboard.press(SEARCH_SHORTCUT);

    await expect(getSearchInput(page)).toBeFocused();
}

function parseJourneyOrder(journeyId: string) {
    return Number(journeyId.split('_')[1]);
}

function parseJourneyYear(journeyId: string) {
    return Number(journeyId.split('_')[0]);
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('search in the cards view', () => {
    test.beforeEach(async ({ page }) => {
        await gotoCardsView(page);
    });

    test('slash shortcut focuses and expands the search input', async ({ page }) => {
        const searchControl = getSearchControl(page);

        await expect(searchControl).not.toHaveClass(/atlas-control--open/);

        await page.keyboard.press(SEARCH_SHORTCUT);

        await expect(getSearchInput(page)).toBeFocused();
        await expect(searchControl).toHaveClass(/atlas-control--open/);
    });

    test('ignores the slash shortcut with a held modifier', async ({ page }) => {
        await page.keyboard.press(`Control+${SEARCH_SHORTCUT}`);

        await expect(getSearchInput(page)).not.toBeFocused();
        await expect(getSearchControl(page)).not.toHaveClass(/atlas-control--open/);

        await page.keyboard.press(SEARCH_SHORTCUT);

        await expect(getSearchInput(page)).toBeFocused();
        await expect(getSearchControl(page)).toHaveClass(/atlas-control--open/);
    });

    test('expands and focuses the input from the search toggle click', async ({ page }) => {
        const searchControl = getSearchControl(page);

        await expect(searchControl).not.toHaveClass(/atlas-control--open/);

        await page.getByRole('button', { name: 'Search markers' }).click();

        await expect(getSearchInput(page)).toBeFocused();
        await expect(searchControl).toHaveClass(/atlas-control--open/);
    });

    test('collapses the empty search when the input loses focus', async ({ page }) => {
        await openSearch(page);

        await expect(getSearchControl(page)).toHaveClass(/atlas-control--open/);

        await page.keyboard.press('Tab');

        await expect(getSearchInput(page)).not.toBeFocused();
        await expect(getSearchControl(page)).not.toHaveClass(/atlas-control--open/);
    });

    test('typing narrows the status count', async ({ page }) => {
        expect(getDedupeKey({ lat: 1, lng: 2, name: 'Alpha' })).toBe('Alpha|1|2');

        await openSearch(page);
        await getSearchInput(page).fill(narrowingPrefix);

        await expect(getStatus(page)).toHaveText(getStatusText(getMatchCount(narrowingPrefix), 'cards'));
    });

    test('folds diacritics so an ascii query matches an accented marker name', async ({ page }) => {
        expect(foldText('M\u00e9rida')).toBe('merida');

        if (!accentedMarker) throw new Error('Expected a marker name with a diacritic.');

        const query = foldText(accentedMarker.name);

        expect(query).not.toBe(accentedMarker.name.toLowerCase());

        const matches = getMatchCount(query);

        expect(matches).toBeGreaterThanOrEqual(1);

        await openSearch(page);
        await getSearchInput(page).fill(query);

        await expect(getStatus(page)).toHaveText(getStatusText(matches, 'cards'));
    });

    test('clear button empties the search and keeps focus in the input', async ({ page }) => {
        await openSearch(page);
        await getSearchInput(page).fill(narrowingPrefix);

        await expect(getStatus(page)).toHaveText(getStatusText(getMatchCount(narrowingPrefix), 'cards'));

        await page.getByRole('button', { name: 'Clear search' }).click();

        await expect(getSearchInput(page)).toHaveValue('');
        await expect(getSearchInput(page)).toBeFocused();
        await expect(getSearchControl(page)).toHaveClass(/atlas-control--open/);
        await expect(page.getByRole('button', { name: 'Search markers' })).toBeVisible();
        await expect(getStatus(page)).toHaveText(getStatusText(totalCount, 'cards'));
    });

    test('escape clears the search text and collapses on the second press', async ({ page }) => {
        await openSearch(page);
        await getSearchInput(page).fill(narrowingPrefix);
        await page.keyboard.press('Escape');

        await expect(getSearchInput(page)).toHaveValue('');
        await expect(getSearchInput(page)).toBeFocused();
        await expect(getSearchControl(page)).toHaveClass(/atlas-control--open/);
        await expect(getStatus(page)).toHaveText(getStatusText(totalCount, 'cards'));

        await page.keyboard.press('Escape');

        await expect(getSearchControl(page)).not.toHaveClass(/atlas-control--open/);
        await expect(page.getByRole('button', { name: 'Search markers' })).toBeFocused();
    });

    test('enter blurs the search input without clearing it', async ({ page }) => {
        await openSearch(page);
        await getSearchInput(page).fill(narrowingPrefix);
        await page.keyboard.press('Enter');

        await expect(getSearchInput(page)).not.toBeFocused();
        await expect(getSearchInput(page)).toHaveValue(narrowingPrefix);
        await expect(getSearchControl(page)).toHaveClass(/atlas-control--open/);
    });

    test('escape clears and collapses the blurred search in one press', async ({ page }) => {
        await openSearch(page);
        await getSearchInput(page).fill(narrowingPrefix);
        await page.keyboard.press('Enter');

        await expect(getSearchInput(page)).not.toBeFocused();

        await page.keyboard.press('Escape');

        await expect(getSearchInput(page)).toHaveValue('');
        await expect(getSearchControl(page)).not.toHaveClass(/atlas-control--open/);
        await expect(getStatus(page)).toHaveText(getStatusText(totalCount, 'cards'));
    });

    test('keeps arrow keys in the focused search input instead of paging the cards', async ({ page }) => {
        expect(cardsPageCount).toBeGreaterThan(1);

        await openSearch(page);
        await page.keyboard.press('ArrowRight');

        await expect(getSearchInput(page)).toBeFocused();
        await expect(getStatus(page)).toHaveText(getStatusText(totalCount, 'cards'));

        await getSearchInput(page).blur();
        await page.keyboard.press('ArrowRight');

        await expect(getStatus(page)).toHaveText(`${totalCount} of ${totalCount} markers shown, page 2 of ${cardsPageCount}.`);
    });

    test('strips typed slashes from the search value', async ({ page }) => {
        await openSearch(page);
        await getSearchInput(page).pressSequentially(`${SEARCH_SHORTCUT}${narrowingPrefix}${SEARCH_SHORTCUT}`);

        await expect(getSearchInput(page)).toHaveValue(narrowingPrefix);
        await expect(getStatus(page)).toHaveText(getStatusText(getMatchCount(narrowingPrefix), 'cards'));
    });

    test('caps the search value at the length limit', async ({ page }) => {
        const input = getSearchInput(page);

        await expect(input).toHaveAttribute('maxlength', String(SEARCH_LENGTH_LIMIT));

        await openSearch(page);
        await input.fill('x'.repeat(SEARCH_LENGTH_LIMIT + 10));

        await expect(input).toHaveValue('x'.repeat(SEARCH_LENGTH_LIMIT));
        await expect(getStatus(page)).toHaveText(EMPTY_STATUS);
    });

    test('persists the search across reload', async ({ page }) => {
        const narrowedStatus = getStatusText(getMatchCount(narrowingPrefix), 'cards');

        await openSearch(page);
        await getSearchInput(page).fill(narrowingPrefix);

        await expect(getStatus(page)).toHaveText(narrowedStatus);

        await expect.poll(async () => {
            const raw = await page.evaluate(key => window.localStorage.getItem(key), STORAGE_KEY);

            return raw === null ? null : (JSON.parse(raw) as { searchValue?: string }).searchValue;
        }, STORAGE_POLL).toBe(narrowingPrefix);

        await page.reload();

        await expect(getStatus(page)).toHaveText(narrowedStatus);
        await expect(getSearchInput(page)).toHaveValue(narrowingPrefix);
        await expect(getSearchControl(page)).toHaveClass(/atlas-control--open/);
    });
});

test.describe('search on the map view', () => {
    test.beforeEach(async ({ page }) => {
        await gotoMapView(page);
    });

    test('slash shortcut focuses the search input over the map', async ({ page }) => {
        await page.keyboard.press(SEARCH_SHORTCUT);

        await expect(getSearchInput(page)).toBeFocused();
        await expect(getSearchControl(page)).toHaveClass(/atlas-control--open/);
    });

    test('escape clears then collapses the search over the map', async ({ page }) => {
        await openSearch(page);
        await getSearchInput(page).fill(narrowingPrefix);

        await expect(getStatus(page)).toHaveText(getStatusText(getMatchCount(narrowingPrefix), 'map'));

        await page.keyboard.press('Escape');

        await expect(getSearchInput(page)).toHaveValue('');
        await expect(getStatus(page)).toHaveText(getStatusText(totalCount, 'map'));

        await page.keyboard.press('Escape');

        await expect(getSearchControl(page)).not.toHaveClass(/atlas-control--open/);
        await expect(page.getByRole('button', { name: 'Search markers' })).toBeFocused();
    });
});
