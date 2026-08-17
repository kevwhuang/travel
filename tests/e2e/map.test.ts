import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

import { ATLAS_TITLE, CONTENT_DIR, COVERAGE_REGIONS, LATITUDE_LIMIT, LONGITUDE_LIMIT, MAP_MAX_ZOOM, MAP_MIN_ZOOM, SEARCH_SHORTCUT } from '../../src/lib/constants';
import { getCategoryColor } from '../../src/lib/utils';

import type { Page } from '@playwright/test';

interface ContentMarker {
    category: string;
    lat: number;
    lng: number;
    name: string;
    starred?: boolean;
}

interface JourneyBounds {
    east: number;
    north: number;
    south: number;
    west: number;
}

interface JourneyEntry {
    markers: ContentMarker[];
    name: string;
}

interface StoredCamera {
    lat: number;
    lng: number;
    zoom: number;
}

const BACKGROUND_POINT = { x: 16, y: 360 } as const;
const CLUSTER_SELECTOR = 'button.atlas-marker[aria-label$="markers \u2014 expand"]';
const DEFAULT_CENTER = { lat: 30.4, lng: -97.8 } as const;
const DEFAULT_ZOOM = 3;
const HIGHLIGHT_DURATION = 2_600;
const HIGHLIGHT_MARGIN = 2_400;
const JOURNEY_FIT_MARGIN = 0.5;
const MAP_POLL = { timeout: 20_000 } as const;
const MARKER_SELECTOR = 'button.atlas-marker';
const PAIR_LAT_SPAN = 0.05;
const PAIR_LNG_MAX = 0.32;
const PAIR_LNG_MIN = 0.25;
const PAIR_SOLITUDE = 0.03;
const PAIR_ZOOM = 11;
const PAN_END = { x: 320, y: 360 } as const;
const PAN_START = { x: 200, y: 420 } as const;
const PAN_STEPS = 8;
const PIN_SELECTOR = 'button.atlas-marker[aria-expanded]';
const PIN_ZOOM = 13;
const POPUP_SELECTOR = '#atlas-popup';

const RING_CLEAR_POLL = { timeout: HIGHLIGHT_DURATION + HIGHLIGHT_MARGIN } as const;
const RING_NONE = 'transparent 0px 0px 0px 0px';
const RING_POLL = { timeout: 2_000 } as const;
const ROVING_SELECTOR = 'button.atlas-marker[tabindex="0"]';
const STORAGE_KEY = 'travel_atlas';
const UNCOVERED_CAMERA = { lat: 48.8, lng: 2.3, zoom: 13 } as const;
const UNCOVERED_MAX_ZOOM = 7.9;

const contentRoot = join(process.cwd(), CONTENT_DIR);

const journeyEntries = readdirSync(join(contentRoot, 'journeys'))
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => JSON.parse(readFileSync(join(contentRoot, 'journeys', file), 'utf-8')) as JourneyEntry);

const journeyMarkers = journeyEntries.flatMap(entry => entry.markers);

const starredMarkers = JSON.parse(readFileSync(join(contentRoot, 'starred.json'), 'utf-8')) as ContentMarker[];

const markerPool = [...journeyMarkers, ...starredMarkers];

const filterJourney = getFilterJourney();
const [pairFirst, pairSecond] = getPairMarkers();

const [pinMarker] = journeyMarkers.filter(marker => (
    !marker.starred
    && isCovered(marker)
    && markerPool.filter(item => item.name === marker.name).length === 1
));

const pairCamera = {
    lat: (pairFirst.lat + pairSecond.lat) / 2,
    lng: (pairFirst.lng + pairSecond.lng) / 2,
    zoom: PAIR_ZOOM,
} as const;

const pinCamera = { lat: pinMarker.lat, lng: pinMarker.lng, zoom: PIN_ZOOM } as const;

function foldText(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getFilterJourney() {
    for (const entry of journeyEntries) {
        if (entry.markers.length === 0) continue;
        if (!entry.markers.every(marker => markerPool.filter(item => item.name === marker.name && item.lat === marker.lat && item.lng === marker.lng).length === 1)) continue;

        const latitudes = entry.markers.map(marker => marker.lat);
        const longitudes = entry.markers.map(marker => marker.lng);

        const bounds: JourneyBounds = {
            east: Math.max(...longitudes),
            north: Math.max(...latitudes),
            south: Math.min(...latitudes),
            west: Math.min(...longitudes),
        };

        if (isInsideBounds(DEFAULT_CENTER, bounds, JOURNEY_FIT_MARGIN)) continue;

        return { bounds, name: entry.name };
    }

    throw new Error('expected a journey of unique markers away from the default camera');
}

function getPairMarkers(): [ContentMarker, ContentMarker] {
    const candidates = journeyMarkers.filter(marker => (
        !marker.starred
        && isCovered(marker)
        && isSolitary(marker)
        && markerPool.filter(item => item.name === marker.name).length === 1
    ));

    for (const first of candidates) {
        const second = candidates.find(item => (
            item !== first
            && Math.abs(item.lat - first.lat) <= PAIR_LAT_SPAN
            && Math.abs(item.lng - first.lng) >= PAIR_LNG_MIN
            && Math.abs(item.lng - first.lng) <= PAIR_LNG_MAX
        ));

        if (second) return [first, second];
    }

    throw new Error('expected two solitary covered pins sharing a viewport');
}

function getSearchInput(page: Page) {
    return page.getByLabel('Search markers by name');
}

function getStoredCamera(page: Page) {
    return page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);

        if (!raw) return null;

        return (JSON.parse(raw) as { camera?: StoredCamera }).camera ?? null;
    }, STORAGE_KEY);
}

function isCovered(point: { lat: number; lng: number }) {
    return COVERAGE_REGIONS.some(region => (
        point.lat >= region.south
        && point.lat <= region.north
        && point.lng >= region.west
        && point.lng <= region.east
    ));
}

function isInsideBounds(point: { lat: number; lng: number }, bounds: JourneyBounds, margin: number) {
    return (
        point.lat >= bounds.south - margin
        && point.lat <= bounds.north + margin
        && point.lng >= bounds.west - margin
        && point.lng <= bounds.east + margin
    );
}

function isSolitary(marker: ContentMarker) {
    return !markerPool.some(item => (
        item !== marker
        && Math.abs(item.lat - marker.lat) < PAIR_SOLITUDE
        && Math.abs(item.lng - marker.lng) < PAIR_SOLITUDE
    ));
}

async function loadDefaultMap(page: Page) {
    await page.goto('/');

    await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_POLL);
    await expect.poll(() => page.locator(MARKER_SELECTOR).count(), MAP_POLL).toBeGreaterThan(0);
}

async function loadPairedMap(page: Page) {
    await page.addInitScript(({ camera, key }) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, JSON.stringify({ camera }));
    }, { camera: pairCamera, key: STORAGE_KEY });

    await page.goto('/');

    await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_POLL);
    await expect(page.getByRole('button', { exact: true, name: pairFirst.name })).toBeVisible(MAP_POLL);
    await expect(page.getByRole('button', { exact: true, name: pairSecond.name })).toBeVisible(MAP_POLL);
}

async function loadPinnedMap(page: Page) {
    await page.addInitScript(({ camera, key }) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, JSON.stringify({ camera }));
    }, { camera: pinCamera, key: STORAGE_KEY });

    await page.goto('/');

    await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_POLL);
    await expect.poll(() => page.locator(PIN_SELECTOR).count(), MAP_POLL).toBeGreaterThan(0);
    await expect(page.getByRole('button', { exact: true, name: pinMarker.name })).toBeVisible(MAP_POLL);
}

async function loadUncoveredMap(page: Page) {
    await page.addInitScript(({ camera, key }) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, JSON.stringify({ camera }));
    }, { camera: UNCOVERED_CAMERA, key: STORAGE_KEY });

    await page.goto('/');

    await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_POLL);
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('map markers', () => {
    test.beforeEach(async ({ page }) => {
        await loadDefaultMap(page);
    });

    test('renders cluster buttons over the default texas camera', async ({ page }) => {
        const clusters = page.locator(CLUSTER_SELECTOR);

        await expect.poll(() => clusters.count(), MAP_POLL).toBeGreaterThan(0);
        await expect(clusters.first()).toBeVisible();
        await expect(clusters.first()).toHaveAttribute('aria-label', /^\d+ markers \u2014 expand$/);
        await expect(clusters.first()).toHaveText(/^\d+$/);
    });

    test('expands a cluster and saves a deeper camera zoom on click', async ({ page }) => {
        const cluster = page.locator(CLUSTER_SELECTOR).first();

        await expect(cluster).toBeVisible(MAP_POLL);

        await cluster.click();

        await expect.poll(async () => (await getStoredCamera(page))?.zoom ?? DEFAULT_ZOOM, MAP_POLL).toBeGreaterThan(DEFAULT_ZOOM);
    });

    test('expands a focused cluster with enter and moves focus to a revealed marker', async ({ page }) => {
        const focusedCluster = page.locator(`${CLUSTER_SELECTOR}:focus`);
        const roving = page.locator(ROVING_SELECTOR);

        await expect.poll(() => page.locator(CLUSTER_SELECTOR).count(), MAP_POLL).toBeGreaterThan(0);

        await roving.focus();

        await expect(roving).toBeFocused();

        const markerCount = await page.locator(MARKER_SELECTOR).count();

        for (let step = 0; step < markerCount && (await focusedCluster.count()) === 0; step++) {
            await page.keyboard.press('ArrowRight');
        }

        await expect(focusedCluster).toHaveCount(1);

        await page.keyboard.press('Enter');

        await expect.poll(async () => (await getStoredCamera(page))?.zoom ?? DEFAULT_ZOOM, MAP_POLL).toBeGreaterThan(DEFAULT_ZOOM);
        await expect.poll(() => page.locator(`${MARKER_SELECTOR}:focus`).count(), MAP_POLL).toBe(1);
    });
});

test.describe('marker popup', () => {
    test.beforeEach(async ({ page }) => {
        await loadPinnedMap(page);
    });

    test('opens the marker card popup from its pin', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);

        await pin.click();

        await expect(popup).toBeVisible();
        await expect(popup).toHaveAttribute('aria-label', pinMarker.name);
        await expect(popup.locator('article')).toBeVisible();
        await expect(popup.getByRole('heading', { level: 2 })).toHaveText(pinMarker.name);
        await expect(pin).toHaveAttribute('aria-expanded', 'true');
        await expect(pin).toHaveAttribute('aria-controls', 'atlas-popup');
    });

    test('closes the popup from the card close button and returns focus to the pin', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);

        await pin.click();

        await expect(popup).toBeVisible();

        await popup.getByRole('button', { name: 'Close' }).click();

        await expect(popup).toBeHidden();
        await expect(pin).toHaveAttribute('aria-expanded', 'false');
        await expect(pin).toBeFocused();
    });

    test('closes the popup when the map background is clicked', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);

        await pin.click();

        await expect(popup).toBeVisible();

        await page.locator('.maplibregl-canvas').click({ position: BACKGROUND_POINT });

        await expect(popup).toBeHidden();
        await expect(pin).toHaveAttribute('aria-expanded', 'false');
    });

    test('closes the popup on escape', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);

        await pin.click();

        await expect(popup).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(popup).toBeHidden();
        await expect(pin).toHaveAttribute('aria-expanded', 'false');
    });

    test('escape closes the popup before clearing the active search', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);
        const searchInput = getSearchInput(page);

        await page.keyboard.press(SEARCH_SHORTCUT);

        await expect(searchInput).toBeFocused();

        await searchInput.fill(pinMarker.name);

        await expect.poll(() => page.locator(MARKER_SELECTOR).count(), MAP_POLL).toBe(1);

        await pin.click();

        await expect(popup).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(popup).toBeHidden();
        await expect(pin).toHaveAttribute('aria-expanded', 'false');
        await expect(searchInput).toHaveValue(pinMarker.name);
    });
});

test.describe('marker keyboard roving', () => {
    test.beforeEach(async ({ page }) => {
        await loadDefaultMap(page);
        await expect.poll(() => page.locator(MARKER_SELECTOR).count(), MAP_POLL).toBeGreaterThan(1);
    });

    test('keeps exactly one marker button in the tab order', async ({ page }) => {
        await expect(page.locator(ROVING_SELECTOR)).toHaveCount(1);
        await expect(page.locator(`${MARKER_SELECTOR}:not([tabindex="-1"])`)).toHaveCount(1);
    });

    test('moves focus across markers with arrow keys, home, and end', async ({ page }) => {
        const roving = page.locator(ROVING_SELECTOR);

        await roving.focus();

        await expect(roving).toBeFocused();

        const fromBox = await roving.boundingBox();

        await page.keyboard.press('ArrowRight');

        await expect(page.locator(ROVING_SELECTOR)).toBeFocused();

        const arrowBox = await page.locator(ROVING_SELECTOR).boundingBox();

        expect(arrowBox).not.toEqual(fromBox);

        await page.keyboard.press('End');

        await expect(page.locator(ROVING_SELECTOR)).toBeFocused();

        const endBox = await page.locator(ROVING_SELECTOR).boundingBox();

        await page.keyboard.press('Home');

        await expect(page.locator(ROVING_SELECTOR)).toBeFocused();

        const homeBox = await page.locator(ROVING_SELECTOR).boundingBox();

        expect(Number(homeBox?.x)).toBeLessThanOrEqual(Number(endBox?.x));
        expect(homeBox).not.toEqual(endBox);
    });
});

test.describe('cross-view navigation', () => {
    test.beforeEach(async ({ page }) => {
        await loadPinnedMap(page);
    });

    test('shows the highlighted marker card in the cards view from the popup', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);

        await pin.click();

        await expect(popup).toBeVisible();

        const markerId = await popup.locator('[data-marker-id]').getAttribute('data-marker-id');
        const card = page.locator(`[data-marker-id="${markerId}"]`);

        await popup.getByRole('button', { name: 'Show in cards' }).click();

        await expect.poll(() => card.getAttribute('style'), RING_POLL).toContain(`color-mix(in oklab, ${getCategoryColor(pinMarker.category)}`);
        await expect(card).toBeVisible();
        await expect(card.getByRole('button', { name: 'Show on map' })).toBeFocused();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(ATLAS_TITLE);
        await expect(popup).toBeHidden();
    });

    test('keeps the popup closed after toggling to cards and back', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);

        await pin.click();

        await expect(popup).toBeVisible();

        await page.getByRole('button', { name: 'Switch to cards' }).click();
        await page.getByRole('button', { name: 'Switch to map' }).click();

        await expect(page.locator('.maplibregl-canvas')).toBeVisible(MAP_POLL);
        await expect.poll(() => page.locator(PIN_SELECTOR).count(), MAP_POLL).toBeGreaterThan(0);
        await expect(popup).toBeHidden();
        await expect(page.locator(`${MARKER_SELECTOR}[aria-expanded="true"]`)).toHaveCount(0);
    });

    test('clears the highlight ring after the highlight duration', async ({ page }) => {
        const pin = page.getByRole('button', { exact: true, name: pinMarker.name });
        const popup = page.locator(POPUP_SELECTOR);

        await pin.click();

        await expect(popup).toBeVisible();

        const markerId = await popup.locator('[data-marker-id]').getAttribute('data-marker-id');
        const card = page.locator(`[data-marker-id="${markerId}"]`);

        await popup.getByRole('button', { name: 'Show in cards' }).click();

        await expect.poll(() => card.getAttribute('style'), RING_POLL).toContain(`color-mix(in oklab, ${getCategoryColor(pinMarker.category)}`);
        await expect.poll(() => card.getAttribute('style'), RING_CLEAR_POLL).toContain(RING_NONE);
    });
});

test.describe('camera persistence', () => {
    test.beforeEach(async ({ page }) => {
        await loadDefaultMap(page);
    });

    test('saves the panned camera within the map bounds', async ({ page }) => {
        await page.mouse.move(PAN_START.x, PAN_START.y);
        await page.mouse.down();
        await page.mouse.move(PAN_END.x, PAN_END.y, { steps: PAN_STEPS });
        await page.mouse.up();

        await expect.poll(async () => Boolean(await getStoredCamera(page)), MAP_POLL).toBe(true);

        const camera = await getStoredCamera(page);

        expect(Math.abs(Number(camera?.lat))).toBeLessThanOrEqual(LATITUDE_LIMIT);
        expect(Math.abs(Number(camera?.lng))).toBeLessThanOrEqual(LONGITUDE_LIMIT);
        expect(Number(camera?.zoom)).toBeGreaterThanOrEqual(MAP_MIN_ZOOM);
        expect(Number(camera?.zoom)).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    });
});

test.describe('camera zoom caps', () => {
    test.beforeEach(async ({ page }) => {
        await loadUncoveredMap(page);
    });

    test('eases an over-zoomed uncovered camera back under the cap and saves the clamped zoom', async ({ page }) => {
        expect(isCovered(UNCOVERED_CAMERA)).toBe(false);

        await expect.poll(async () => (await getStoredCamera(page))?.zoom ?? UNCOVERED_CAMERA.zoom, MAP_POLL).toBeLessThanOrEqual(UNCOVERED_MAX_ZOOM);

        const camera = await getStoredCamera(page);

        expect(Number(camera?.zoom)).toBeGreaterThanOrEqual(MAP_MIN_ZOOM);
        expect(Number(camera?.lat)).toBeCloseTo(UNCOVERED_CAMERA.lat, 0);
        expect(Number(camera?.lng)).toBeCloseTo(UNCOVERED_CAMERA.lng, 0);
    });
});

test.describe('marker filtering', () => {
    test('narrows the visible pins when a search filters the markers', async ({ page }) => {
        expect(foldText('M\u00e9rida')).toBe('merida');
        expect(markerPool.filter(item => foldText(item.name).includes(foldText(pinMarker.name)))).toHaveLength(1);

        await loadPinnedMap(page);
        await page.keyboard.press(SEARCH_SHORTCUT);

        await expect(getSearchInput(page)).toBeFocused();

        await getSearchInput(page).fill(pinMarker.name);

        await expect.poll(() => page.locator(MARKER_SELECTOR).count(), MAP_POLL).toBe(1);
        await expect(page.locator(MARKER_SELECTOR)).toHaveAttribute('aria-label', pinMarker.name);
    });

    test('refits the camera to the remaining markers after a filter narrows them', async ({ page }) => {
        expect(isInsideBounds(DEFAULT_CENTER, filterJourney.bounds, JOURNEY_FIT_MARGIN)).toBe(false);

        await loadDefaultMap(page);
        await page.getByRole('button', { name: /^Open filters/ }).click();

        const dialog = page.getByRole('dialog');

        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { exact: true, name: filterJourney.name }).click();
        await dialog.getByRole('button', { name: 'Done' }).click();

        await expect(dialog).toBeHidden();

        await expect.poll(async () => {
            const camera = await getStoredCamera(page);

            return camera !== null && isInsideBounds(camera, filterJourney.bounds, JOURNEY_FIT_MARGIN);
        }, MAP_POLL).toBe(true);
    });
});

test.describe('popup reanchoring', () => {
    test.beforeEach(async ({ page }) => {
        await loadPairedMap(page);
    });

    test('moves the popup to a second pin on click', async ({ page }) => {
        const firstPin = page.getByRole('button', { exact: true, name: pairFirst.name });
        const popup = page.locator(POPUP_SELECTOR);
        const secondPin = page.getByRole('button', { exact: true, name: pairSecond.name });

        await firstPin.click();

        await expect(popup).toBeVisible();
        await expect(popup.getByRole('heading', { level: 2 })).toHaveText(pairFirst.name);
        await expect(firstPin).toHaveAttribute('aria-expanded', 'true');

        await secondPin.click();

        await expect(popup.getByRole('heading', { level: 2 })).toHaveText(pairSecond.name);
        await expect(popup).toHaveAttribute('aria-label', pairSecond.name);
        await expect(secondPin).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator(`${MARKER_SELECTOR}[aria-expanded="true"]`)).toHaveCount(1);
    });
});
