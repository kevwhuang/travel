import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

import { ATLAS_TITLE, CARDS_PER_PAGE, CONTENT_DIR, COVERAGE_REGIONS, SEARCH_SHORTCUT } from '../../src/lib/constants';

import type { Page } from '@playwright/test';

type CardEntry = Pick<AtlasMarker, 'id' | 'isStarred' | 'journeyId' | 'lat' | 'lng' | 'name'>;

interface ContentMarker {
    lat: number;
    lng: number;
    name: string;
    starred?: boolean;
}

interface JourneyFile {
    markers: ContentMarker[];
}

const JOURNEYS_DIR = join(CONTENT_DIR, 'journeys');
const MAP_READY = { timeout: 15_000 };
const POPUP_POLL = { intervals: [250, 500, 1_000], timeout: 15_000 };
const SCROLL_POLL = { timeout: 5_000 };
const STARRED_FILE = join(CONTENT_DIR, 'starred.json');
const STORAGE_KEY = 'travel_atlas';
const STORE_POLL = { timeout: 5_000 };

const cards = buildCards();

const journeyCount = new Set(cards
    .map(card => card.journeyId)
    .filter(journeyId => journeyId !== null)).size;

const markerText = `${cards.length} ${cards.length === 1 ? 'marker' : 'markers'}`;

const orderedCards = [
    ...cards.filter(card => card.journeyId !== null),
    ...cards.filter(card => card.journeyId === null),
];

const pageCount = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));

const pageOneCards = orderedCards.slice(0, CARDS_PER_PAGE);

const searchQuery = foldSearchText(orderedCards[0].name).slice(0, 1);

const subline = journeyCount === 0
    ? markerText
    : `${markerText} across ${journeyCount} ${journeyCount === 1 ? 'journey' : 'journeys'}`;

function buildCards(): CardEntry[] {
    const cardsByKey = new Map<string, CardEntry>();

    const journeyIds = readdirSync(JOURNEYS_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace(/\.json$/, ''))
        .sort(compareJourneyIdsNewestFirst);

    for (const journeyId of journeyIds) {
        const journey = JSON.parse(readFileSync(join(JOURNEYS_DIR, `${journeyId}.json`), 'utf-8')) as JourneyFile;

        for (const marker of journey.markers) {
            const existingCard = cardsByKey.get(getDedupeKey(marker));

            if (existingCard) {
                if (marker.starred === true) existingCard.isStarred = true;

                continue;
            }

            cardsByKey.set(getDedupeKey(marker), { id: cardsByKey.size, isStarred: marker.starred === true, journeyId, lat: marker.lat, lng: marker.lng, name: marker.name });
        }
    }

    for (const marker of JSON.parse(readFileSync(STARRED_FILE, 'utf-8')) as ContentMarker[]) {
        const existingCard = cardsByKey.get(getDedupeKey(marker));

        if (existingCard) {
            existingCard.isStarred = true;

            continue;
        }

        cardsByKey.set(getDedupeKey(marker), { id: cardsByKey.size, isStarred: true, journeyId: null, lat: marker.lat, lng: marker.lng, name: marker.name });
    }

    return [...cardsByKey.values()];
}

function compareJourneyIdsNewestFirst(firstId: string, secondId: string) {
    return parseJourneyYear(secondId) - parseJourneyYear(firstId) || parseJourneyOrder(secondId) - parseJourneyOrder(firstId);
}

async function expectCardsReady(page: Page) {
    await expect(page.locator('h1')).toHaveText(ATLAS_TITLE);
    await expect(page.locator('article').first()).toBeVisible();
}

async function expectCurrentPage(page: Page, pageNumber: number) {
    await expect(page.locator('[aria-current="page"]')).toHaveAttribute('aria-label', `Page ${pageNumber}`);
}

function foldSearchText(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getDedupeKey(marker: ContentMarker) {
    return `${marker.name}|${marker.lat}|${marker.lng}`;
}

function getFirstCardId(page: Page) {
    return page.locator('[data-marker-id]').first().getAttribute('data-marker-id');
}

function getPane(page: Page) {
    return page.locator('div.overflow-y-auto').filter({ has: page.locator('h1') });
}

function getStoredPage(page: Page) {
    return page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);

        if (!raw) return null;

        return (JSON.parse(raw) as { page?: number }).page ?? null;
    }, STORAGE_KEY);
}

function isWithinCoverage(marker: Pick<CardEntry, 'lat' | 'lng'>) {
    return COVERAGE_REGIONS.some(region => (
        marker.lat >= region.south
        && marker.lat <= region.north
        && marker.lng >= region.west
        && marker.lng <= region.east
    ));
}

function parseJourneyOrder(journeyId: string) {
    const [, order] = journeyId.split('_');

    return Number(order);
}

function parseJourneyYear(journeyId: string) {
    const [year] = journeyId.split('_');

    return Number(year);
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('view toggle', () => {
    test('switches from the map to the cards view', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_READY);

        await page.getByRole('button', { name: 'Switch to cards' }).click();

        await expectCardsReady(page);
        await expect(page.locator('h1')).not.toHaveClass(/sr-only/);
        await expect(page.getByRole('button', { name: 'Switch to map' })).toBeVisible();
    });
});

test.describe('cards view', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            if (localStorage.getItem('travel_atlas') === null) localStorage.setItem('travel_atlas', JSON.stringify({ view: 'cards' }));
        });

        await page.goto('/');
        await expectCardsReady(page);
    });

    test('restores the cards view from storage with the visible heading and derived subline', async ({ page }) => {
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('h1')).not.toHaveClass(/sr-only/);
        await expect(page.locator('header p')).toHaveText(subline);
    });

    test('fills the first page with cards in journey order', async ({ page }) => {
        await expect(page.locator('article')).toHaveCount(Math.min(cards.length, CARDS_PER_PAGE));
        await expect(page.locator('article h2').first()).toContainText(pageOneCards[0].name);

        const ids = await page
            .locator('[data-marker-id]')
            .evaluateAll(nodes => nodes.map(node => String(node.getAttribute('data-marker-id'))));

        expect(ids).toEqual(pageOneCards.map(card => String(card.id)));
    });

    test('marks the first page current in pagination when markers overflow one page', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        const nav = page.getByRole('navigation', { name: 'Pagination' });

        await expect(nav).toBeVisible();
        await expect(nav.getByRole('button', { exact: true, name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
        await expect(nav.getByRole('button', { exact: true, name: `Page ${pageCount}` })).toBeVisible();
    });

    test('moves to page two from the pagination and scrolls the pane back to the top', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        const pageTwoButton = page.getByRole('button', { exact: true, name: 'Page 2' });

        await pageTwoButton.scrollIntoViewIfNeeded();

        expect(await getPane(page).evaluate(node => node.scrollTop)).toBeGreaterThan(0);

        const firstCardId = await getFirstCardId(page);

        await pageTwoButton.click();

        await expectCurrentPage(page, 2);
        await expect(page.locator('article h2').first()).toContainText(orderedCards[CARDS_PER_PAGE].name);

        expect(await getFirstCardId(page)).not.toBe(firstCardId);

        await expect.poll(() => getPane(page).evaluate(node => node.scrollTop), SCROLL_POLL).toBe(0);
    });

    test('persists the current page across reload', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        await page.getByRole('button', { exact: true, name: 'Page 2' }).click();

        await expectCurrentPage(page, 2);
        await expect.poll(() => getStoredPage(page), STORE_POLL).toBe(1);

        await page.reload();

        await expectCardsReady(page);
        await expectCurrentPage(page, 2);
        await expect(page.locator('article h2').first()).toContainText(orderedCards[CARDS_PER_PAGE].name);
    });

    test('announces the second page in the status message after paging', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        await expect(page.getByRole('status')).toHaveText(`${cards.length} of ${cards.length} markers shown, page 1 of ${pageCount}`);

        await page.getByRole('button', { exact: true, name: 'Page 2' }).click();

        await expect(page.getByRole('status')).toHaveText(`${cards.length} of ${cards.length} markers shown, page 2 of ${pageCount}`);
    });

    test('pages forward and back with the arrow keys from the body', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        await page.keyboard.press('ArrowRight');

        await expectCurrentPage(page, 2);
        await expect(page.locator('article h2').first()).toContainText(orderedCards[CARDS_PER_PAGE].name);

        await page.keyboard.press('ArrowLeft');

        await expectCurrentPage(page, 1);
        await expect(page.locator('article h2').first()).toContainText(orderedCards[0].name);
    });

    test('scrolls to the top and focuses the first card action after body arrow paging', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        await page.getByRole('navigation', { name: 'Pagination' }).scrollIntoViewIfNeeded();

        expect(await getPane(page).evaluate(node => node.scrollTop)).toBeGreaterThan(0);

        await page.keyboard.press('ArrowRight');

        await expectCurrentPage(page, 2);
        await expect(page.locator(`[data-marker-id="${orderedCards[CARDS_PER_PAGE].id}"]`).getByRole('button', { name: 'Show on map' })).toBeFocused();
        await expect.poll(() => getPane(page).evaluate(node => node.scrollTop), SCROLL_POLL).toBe(0);
    });

    test('ignores arrow paging past the first and last pages', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        await page.keyboard.press('ArrowLeft');

        await expectCurrentPage(page, 1);
        await expect(page.locator('article h2').first()).toContainText(orderedCards[0].name);

        await page.getByRole('button', { exact: true, name: `Page ${pageCount}` }).click();

        await expectCurrentPage(page, pageCount);

        await page.keyboard.press('ArrowRight');

        await expectCurrentPage(page, pageCount);
        await expect(page.locator('article h2').first()).toContainText(orderedCards[(pageCount - 1) * CARDS_PER_PAGE].name);
    });

    test('pages with page down and page up while keeping focus on the current page button', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        await page.getByRole('button', { exact: true, name: 'Page 1' }).focus();
        await page.keyboard.press('PageDown');

        await expectCurrentPage(page, 2);
        await expect(page.getByRole('button', { exact: true, name: 'Page 2' })).toBeFocused();

        await page.keyboard.press('PageUp');

        await expectCurrentPage(page, 1);
        await expect(page.getByRole('button', { exact: true, name: 'Page 1' })).toBeFocused();
    });

    test('pages exactly once when an arrow key fires on a focused pagination button', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        await page.getByRole('button', { exact: true, name: 'Page 1' }).focus();
        await page.keyboard.press('ArrowRight');

        await expectCurrentPage(page, 2);
        await expect(page.getByRole('button', { exact: true, name: 'Page 2' })).toBeFocused();
        await expect(page.locator('article h2').first()).toContainText(orderedCards[CARDS_PER_PAGE].name);
    });

    test('returns to the first page when a search is typed from page two', async ({ page }) => {
        test.skip(pageCount === 1, 'content fits on a single page');

        const searchInput = page.getByRole('textbox', { name: 'Search markers by name' });

        await page.getByRole('button', { exact: true, name: 'Page 2' }).click();

        await expectCurrentPage(page, 2);

        await page.keyboard.press(SEARCH_SHORTCUT);

        await expect(searchInput).toBeFocused();

        await searchInput.pressSequentially(searchQuery);

        const matchedCards = orderedCards.filter(card => foldSearchText(card.name).includes(searchQuery));

        await expect(page.locator('article h2').first()).toContainText(matchedCards[0].name);

        if (matchedCards.length > CARDS_PER_PAGE) await expectCurrentPage(page, 1);
        else await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeHidden();
    });

    test('returns to the map and opens the popup from the show on map action', async ({ page }) => {
        const [firstCard] = pageOneCards;

        await page.locator(`[data-marker-id="${firstCard.id}"]`).getByRole('button', { name: 'Show on map' }).click();

        await expect(page.getByRole('button', { name: 'Switch to cards' })).toBeVisible();
        await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_READY);

        await expect.poll(() => page.evaluate(() => document.querySelector('#atlas-popup h2')?.textContent ?? ''), POPUP_POLL).toContain(firstCard.name);
        await expect(page.locator('#atlas-popup article')).toBeVisible();
    });

    test('focuses the flown pin with expanded state after show on map', async ({ page }) => {
        const [flyCard] = pageOneCards.filter(card => (
            !card.isStarred
            && isWithinCoverage(card)
            && cards.every(other => other === card || other.name !== card.name)
        ));

        const pin = page.getByRole('button', { exact: true, name: flyCard.name });

        await page.locator(`[data-marker-id="${flyCard.id}"]`).getByRole('button', { name: 'Show on map' }).click();

        await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_READY);

        await expect.poll(() => page.evaluate(() => document.querySelector('#atlas-popup h2')?.textContent ?? ''), POPUP_POLL).toContain(flyCard.name);

        await expect(pin).toBeFocused(MAP_READY);
        await expect(pin).toHaveAttribute('aria-expanded', 'true');
        await expect(pin).toHaveAttribute('aria-controls', 'atlas-popup');
    });
});

test.describe('content mirror', () => {
    test('pins the dedupe key and newest-first comparison to literal fixtures and keeps derived card ids sequential', () => {
        expect(getDedupeKey({ lat: 30.4, lng: -97.7, name: 'Pin' })).toBe('Pin|30.4|-97.7');
        expect(['2025_1_west', '2026_2_east', '2026_10_north'].sort(compareJourneyIdsNewestFirst)).toEqual(['2026_10_north', '2026_2_east', '2025_1_west']);
        expect(cards.map(card => card.id)).toEqual([...cards.keys()]);
    });

    test('pins the search fold and coverage containment to literal fixtures', () => {
        expect(foldSearchText('M\u00e9rida')).toBe('merida');
        expect(isWithinCoverage({ lat: 30.4, lng: -97.8 })).toBe(true);
        expect(isWithinCoverage({ lat: 48.9, lng: 2.4 })).toBe(false);
    });
});
