import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

import { CONTENT_DIR, ROUTES } from '../../src/lib/constants';

interface ContentMarker {
    lat: number;
    lng: number;
    name: string;
}

interface StructuredData {
    '@context': string;
    '@graph': {
        '@type': string;
        'itemListElement'?: unknown[];
        'name'?: string;
        'url'?: string;
    }[];
}

const DESCRIPTION_MAX = 160;
const DESCRIPTION_MIN = 120;

const contentRoot = join(process.cwd(), CONTENT_DIR);
const journeyFiles = readdirSync(join(contentRoot, 'journeys')).filter(file => file.endsWith('.json'));
const markerCount = countAtlasMarkers();

function countAtlasMarkers() {
    const markerKeys = new Set<string>();

    for (const file of journeyFiles) {
        for (const marker of readMarkers(join(contentRoot, 'journeys', file))) {
            markerKeys.add(getDedupeKey(marker));
        }
    }

    for (const marker of readMarkers(join(contentRoot, 'starred.json'))) {
        markerKeys.add(getDedupeKey(marker));
    }

    return markerKeys.size;
}

function getDedupeKey(marker: ContentMarker) {
    return `${marker.name}|${marker.lat}|${marker.lng}`;
}

function readMarkers(path: string) {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as ContentMarker[] | { markers: ContentMarker[] };

    return Array.isArray(data) ? data : data.markers;
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('index page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('loads with the bare travel title', async ({ page }) => {
        await expect(page).toHaveTitle('Travel');
    });

    test('renders the screen-reader-only atlas heading', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Atlas');
        await expect(page.locator('h1')).toHaveClass('sr-only');
    });

    test('mounts the map canvas', async ({ page }) => {
        await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    });

    test('shows the four overlay controls', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Open filters' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Search markers' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Aephonics' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Switch to cards' })).toBeVisible();
    });

    test('announces the full marker count in the status message', async ({ page }) => {
        expect(getDedupeKey({ lat: 1, lng: 2, name: 'Alpha' })).toBe('Alpha|1|2');

        await expect(page.locator('p[role="status"]')).toHaveText(`${markerCount} of ${markerCount} markers shown.`);
    });

    test('exposes a meta description of the expected length naming the marker count', async ({ page }) => {
        const description = await page.locator('meta[name="description"]').getAttribute('content');

        expect(description).not.toBeNull();
        expect(String(description).length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
        expect(String(description).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(String(description)).toContain(`${markerCount} markers across ${journeyFiles.length} journeys`);
    });

    test('embeds parseable json-ld website data', async ({ page }) => {
        const raw = await page.locator('script[type="application/ld+json"]').textContent();

        const data = JSON.parse(String(raw)) as StructuredData;

        const itemList = data['@graph'].find(node => node['@type'] === 'ItemList');
        const website = data['@graph'].find(node => node['@type'] === 'WebSite');

        expect(data['@context']).toBe('https://schema.org');
        expect(itemList?.itemListElement).toHaveLength(ROUTES.length);
        expect(website?.name).toBe('Travel');
        expect(website?.url).toContain('travel.aephonics.com');
    });

    test('fits the default viewport without horizontal overflow', async ({ page }) => {
        const metrics = await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
        }));

        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    });

    test('loads without console errors', async ({ page }) => {
        const errors: string[] = [];

        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        expect(errors).toEqual([]);
    });
});
