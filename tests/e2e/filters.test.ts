import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

import { CARDS_PER_PAGE, CONTENT_DIR } from '../../src/lib/constants';

import type { Page } from '@playwright/test';

type MirrorMarker = Pick<AtlasMarker, 'categoryId' | 'isStarred' | 'journeyId' | 'name'>;

interface CategoryFile {
    description: string;
    name: string;
}

interface ContentMarker {
    category: string;
    lat: number;
    lng: number;
    name: string;
    starred?: boolean;
}

interface JourneyFile {
    markers: ContentMarker[];
    name: string;
}

const CANVAS_TIMEOUT = 15_000;
const EMPTY_STATUS = 'No markers match.';
const STORAGE_KEY = 'travel_atlas';
const STORAGE_POLL = { timeout: 5_000 } as const;

const categories = loadCategories();
const markers = loadAtlasMarkers();

const filterCategory = getFilterCategory();
const filterCategoryCount = getCategoryCount(filterCategory.id);
const filterJourney = getFilterJourney();
const starredCount = markers.filter(marker => marker.isStarred).length;
const totalCount = markers.length;

async function expectFooterCount(page: Page, shown: number) {
    await expect(getDialog(page).getByText(`Showing ${shown} of ${totalCount}.`)).toBeVisible();
}

function getCategoryCount(categoryId: string) {
    return markers.filter(marker => marker.categoryId === categoryId).length;
}

function getDedupeKey(marker: { lat: number; lng: number; name: string }) {
    return `${marker.name}|${marker.lat}|${marker.lng}`;
}

function getDialog(page: Page) {
    return page.getByRole('dialog');
}

function getFilterButton(page: Page) {
    return page.getByRole('button', { name: /^Open filters/ });
}

function getFilterCategory() {
    const category = categories.find((entry) => {
        const count = getCategoryCount(entry.id);

        return count > 0 && count < markers.length;
    });

    if (!category) throw new Error('Expected a category matching some but not all markers.');

    return category;
}

function getFilterJourney() {
    const journeyIds = readdirSync(join(CONTENT_DIR, 'journeys'))
        .filter(file => file.endsWith('.json'))
        .map(file => basename(file, '.json'))
        .sort((first, second) => parseJourneyYear(second) - parseJourneyYear(first) || parseJourneyOrder(second) - parseJourneyOrder(first));

    for (const journeyId of journeyIds) {
        const markerCount = markers.filter(marker => marker.journeyId === journeyId).length;

        if (markerCount === 0) continue;

        const journey = JSON.parse(readFileSync(join(CONTENT_DIR, 'journeys', `${journeyId}.json`), 'utf-8')) as JourneyFile;

        return { id: journeyId, markerCount, name: journey.name };
    }

    throw new Error('Expected a journey with at least one marker.');
}

function getStatus(page: Page) {
    return page.locator('p[role="status"]');
}

function getStatusText(shown: number) {
    if (shown === 0) return EMPTY_STATUS;

    const pageCount = Math.max(1, Math.ceil(shown / CARDS_PER_PAGE));
    const pageSuffix = pageCount > 1 ? `, page 1 of ${pageCount}` : '';

    return `${shown} of ${totalCount} markers shown${pageSuffix}`;
}

async function gotoCardsView(page: Page, storedState: object = {}) {
    await page.addInitScript(([key, state]) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, state);
    }, [STORAGE_KEY, JSON.stringify({ view: 'cards', ...storedState })] as const);

    await page.goto('/');
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

function loadCategories() {
    const entries = JSON.parse(readFileSync(join(CONTENT_DIR, 'categories.json'), 'utf-8')) as CategoryFile[];

    return entries
        .map(entry => ({ id: entry.name.toLowerCase(), name: entry.name }))
        .sort((first, second) => first.id.localeCompare(second.id));
}

async function openFilters(page: Page) {
    await getFilterButton(page).click();

    await expect(getDialog(page)).toBeVisible();
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

test.describe('filters modal in the cards view', () => {
    test.beforeEach(async ({ page }) => {
        await gotoCardsView(page);

        await expect(getStatus(page)).toHaveText(getStatusText(totalCount));
    });

    test('opens an accessible dialog and makes the background inert', async ({ page }) => {
        const wrapper = page.locator('div.contents');

        await expect(wrapper).not.toHaveAttribute('inert');

        await getFilterButton(page).click();

        const dialog = getDialog(page);

        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        await expect(dialog).toHaveAttribute('aria-labelledby', 'modal-filters-title');
        await expect(dialog.locator('#modal-filters-title')).toHaveText('Filters');
        await expect(dialog).toBeFocused();
        await expect(wrapper).toHaveAttribute('inert', '');

        await dialog.getByRole('button', { name: 'Done' }).click();

        await expect(dialog).toBeHidden();
        await expect(wrapper).not.toHaveAttribute('inert');
    });

    test('traps tab focus inside the dialog in both directions', async ({ page }) => {
        await openFilters(page);

        const dialog = getDialog(page);
        const doneButton = dialog.getByRole('button', { name: 'Done' });
        const starredChip = dialog.getByRole('button', { exact: true, name: 'Starred' });

        await expect(dialog).toBeFocused();

        await page.keyboard.press('Tab');

        await expect(starredChip).toBeFocused();

        await page.keyboard.press('Shift+Tab');

        await expect(doneButton).toBeFocused();

        await page.keyboard.press('Tab');

        await expect(starredChip).toBeFocused();

        await page.keyboard.press('Tab');

        await expect(dialog.getByRole('button', { exact: true, name: categories[0].name })).toBeFocused();
    });

    test('escape closes the modal and returns focus to the filter button', async ({ page }) => {
        await openFilters(page);
        await page.keyboard.press('Escape');

        await expect(getDialog(page)).toBeHidden();
        await expect(getFilterButton(page)).toBeFocused();
    });

    test('backdrop mousedown closes the modal', async ({ page }) => {
        await openFilters(page);
        await page.locator('.atlas-fade').click({ position: { x: 8, y: 8 } });

        await expect(getDialog(page)).toBeHidden();
        await expect(getFilterButton(page)).toBeFocused();
    });

    test('done closes the modal and returns focus to the filter button', async ({ page }) => {
        await openFilters(page);
        await getDialog(page).getByRole('button', { name: 'Done' }).click();

        await expect(getDialog(page)).toBeHidden();
        await expect(getFilterButton(page)).toBeFocused();
    });

    test('ignores the slash shortcut and arrow paging while the modal is open', async ({ page }) => {
        await openFilters(page);

        const dialog = getDialog(page);
        const search = page.locator('search.atlas-control');

        await expect(dialog).toBeFocused();

        await page.keyboard.press('/');

        await expect(dialog).toBeFocused();
        await expect(search).not.toHaveClass(/atlas-control--open/);

        await page.keyboard.press('ArrowRight');

        await expect(dialog).toBeFocused();

        await dialog.getByRole('button', { name: 'Done' }).click();

        await expect(dialog).toBeHidden();
        await expect(getStatus(page)).toHaveText(getStatusText(totalCount));
        await expect(search).not.toHaveClass(/atlas-control--open/);
    });

    test('category chip filters the markers and badges the filter button', async ({ page }) => {
        expect(getDedupeKey({ lat: 1, lng: 2, name: 'Alpha' })).toBe('Alpha|1|2');

        await openFilters(page);

        const chip = getDialog(page).getByRole('button', { exact: true, name: filterCategory.name });

        await expect(chip).toHaveAttribute('aria-pressed', 'false');

        await chip.click();

        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        await expectFooterCount(page, filterCategoryCount);

        await getDialog(page).getByRole('button', { name: 'Done' }).click();

        await expect(getStatus(page)).toHaveText(getStatusText(filterCategoryCount));
        await expect(getFilterButton(page)).toHaveAttribute('aria-label', 'Open filters, 1 active');
        await expect(getFilterButton(page).getByText('1', { exact: true })).toBeVisible();
    });

    test('starred chip narrows to starred markers only', async ({ page }) => {
        await openFilters(page);

        const starredChip = getDialog(page).getByRole('button', { exact: true, name: 'Starred' });

        await expect(starredChip).toHaveAttribute('aria-pressed', 'false');

        await starredChip.click();

        await expect(starredChip).toHaveAttribute('aria-pressed', 'true');
        await expectFooterCount(page, starredCount);

        await getDialog(page).getByRole('button', { name: 'Done' }).click();

        await expect(getStatus(page)).toHaveText(getStatusText(starredCount));
        await expect(getFilterButton(page)).toHaveAttribute('aria-label', 'Open filters, 1 active');
    });

    test('journey chip narrows to that journey', async ({ page }) => {
        await openFilters(page);

        const chip = getDialog(page).getByRole('button', { exact: true, name: filterJourney.name });

        await expect(chip).toHaveAttribute('aria-pressed', 'false');

        await chip.click();

        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        await expectFooterCount(page, filterJourney.markerCount);

        await getDialog(page).getByRole('button', { name: 'Done' }).click();

        await expect(getStatus(page)).toHaveText(getStatusText(filterJourney.markerCount));
        await expect(getFilterButton(page)).toHaveAttribute('aria-label', 'Open filters, 1 active');
    });

    test('clear resets every active filter', async ({ page }) => {
        const combinedCount = markers
            .filter(marker => marker.categoryId === filterCategory.id && marker.isStarred && marker.journeyId === filterJourney.id)
            .length;

        await openFilters(page);

        const dialog = getDialog(page);
        const clearButton = dialog.getByRole('button', { name: 'Clear' });

        await expect(clearButton).toBeDisabled();

        await dialog.getByRole('button', { exact: true, name: 'Starred' }).click();
        await dialog.getByRole('button', { exact: true, name: filterCategory.name }).click();
        await dialog.getByRole('button', { exact: true, name: filterJourney.name }).click();

        await expect(dialog.locator('[aria-pressed="true"]')).toHaveCount(3);
        await expectFooterCount(page, combinedCount);
        await expect(clearButton).toBeEnabled();

        await clearButton.click();

        await expect(dialog.locator('[aria-pressed="true"]')).toHaveCount(0);
        await expectFooterCount(page, totalCount);
        await expect(clearButton).toBeDisabled();

        await dialog.getByRole('button', { name: 'Done' }).click();

        await expect(getStatus(page)).toHaveText(getStatusText(totalCount));
        await expect(getFilterButton(page)).toHaveAttribute('aria-label', 'Open filters');
    });
});

test.describe('stored filter state', () => {
    test('persists applied filters across reload', async ({ page }) => {
        const starredCategoryCount = markers.filter(marker => marker.categoryId === filterCategory.id && marker.isStarred).length;

        const filteredStatus = getStatusText(starredCategoryCount);

        await gotoCardsView(page);

        await expect(getStatus(page)).toHaveText(getStatusText(totalCount));

        await openFilters(page);
        await getDialog(page).getByRole('button', { exact: true, name: 'Starred' }).click();
        await getDialog(page).getByRole('button', { exact: true, name: filterCategory.name }).click();
        await getDialog(page).getByRole('button', { name: 'Done' }).click();

        await expect(getStatus(page)).toHaveText(filteredStatus);

        await expect.poll(async () => {
            const raw = await page.evaluate(key => window.localStorage.getItem(key), STORAGE_KEY);

            if (raw === null) return null;

            const stored = JSON.parse(raw) as { isStarredOnly?: boolean; selectedCategoryIds?: string[] };

            return `${String(stored.isStarredOnly)}:${(stored.selectedCategoryIds ?? []).join(',')}`;
        }, STORAGE_POLL).toBe(`true:${filterCategory.id}`);

        await page.reload();

        await expect(getStatus(page)).toHaveText(filteredStatus);
        await expect(getFilterButton(page)).toHaveAttribute('aria-label', 'Open filters, 2 active');

        await openFilters(page);

        await expect(getDialog(page).getByRole('button', { exact: true, name: 'Starred' })).toHaveAttribute('aria-pressed', 'true');
        await expect(getDialog(page).getByRole('button', { exact: true, name: filterCategory.name })).toHaveAttribute('aria-pressed', 'true');
    });

    test('drops an unknown stored category id and rewrites the saved state', async ({ page }) => {
        await gotoCardsView(page, { selectedCategoryIds: ['unknown-category', filterCategory.id] });

        await expect(getStatus(page)).toHaveText(getStatusText(filterCategoryCount));
        await expect(getFilterButton(page)).toHaveAttribute('aria-label', 'Open filters, 1 active');

        await expect.poll(async () => {
            const raw = await page.evaluate(key => window.localStorage.getItem(key), STORAGE_KEY);

            return raw === null ? null : (JSON.parse(raw) as { selectedCategoryIds?: string[] }).selectedCategoryIds;
        }, STORAGE_POLL).toEqual([filterCategory.id]);
    });

    test('drops an unknown stored journey id and rewrites the saved state', async ({ page }) => {
        await gotoCardsView(page, { selectedJourneyIds: ['unknown-journey', filterJourney.id] });

        await expect(getStatus(page)).toHaveText(getStatusText(filterJourney.markerCount));
        await expect(getFilterButton(page)).toHaveAttribute('aria-label', 'Open filters, 1 active');

        await expect.poll(async () => {
            const raw = await page.evaluate(key => window.localStorage.getItem(key), STORAGE_KEY);

            return raw === null ? null : (JSON.parse(raw) as { selectedJourneyIds?: string[] }).selectedJourneyIds;
        }, STORAGE_POLL).toEqual([filterJourney.id]);
    });
});

test.describe('filters modal on the map view', () => {
    test('escape closes the modal over the map and restores focus', async ({ page }) => {
        await gotoMapView(page);
        await openFilters(page);
        await page.keyboard.press('Escape');

        await expect(getDialog(page)).toBeHidden();
        await expect(getFilterButton(page)).toBeFocused();
    });
});
