import { expect, test } from '@playwright/test';

import { TILE_EXTENSION, WORLD_SOURCE_ID } from '../../src/lib/constants';

const BASE_URL = 'https://travel.aephonics.com';
const PROBE_TIMEOUT = 15_000;

const SECURITY_HEADERS = {
    'content-security-policy': 'base-uri \'none\'; connect-src \'self\' https://*.supabase.co; default-src \'self\'; font-src \'self\' data:; form-action \'none\'; frame-ancestors \'self\'; img-src \'self\' data:; script-src \'self\' \'unsafe-inline\' data:; style-src \'self\' \'unsafe-inline\'',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'sameorigin',
} as const;

const TILE_PATH = `/tiles/${WORLD_SOURCE_ID}${TILE_EXTENSION}`;

let isProdReachable = false;

test.describe.configure({ timeout: 60_000 });

test.beforeAll(async ({ request }) => {
    try {
        const response = await request.get(`${BASE_URL}/`, { timeout: PROBE_TIMEOUT });

        isProdReachable = response.ok();
    } catch {
        isProdReachable = false;
    }
});

test.beforeEach(() => {
    test.skip(!isProdReachable, `production origin ${BASE_URL} is unreachable`);
});

test.describe('production pages', () => {
    test('serves the home page with the travel title', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/`);

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('text/html');

        expect(await response.text()).toContain('<title>Travel</title>');
    });

    test('returns the not found page for an unknown path', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/this-page-does-not-exist`);

        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('text/html');

        expect(await response.text()).toContain('<title>Page Not Found \u2014 Travel</title>');
    });

    test('serves the configured security headers on the home page', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/`);

        const headers = response.headers();

        for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
            expect(headers[name], name).toBe(value);
        }
    });

    test('renders the atlas map in a real browser', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });

        const errors: string[] = [];

        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });

        const response = await page.goto(`${BASE_URL}/`);

        expect(response?.status()).toBe(200);

        await expect(page).toHaveTitle('Travel');
        await expect(page.locator('.maplibregl-canvas')).toBeVisible();

        expect(errors).toEqual([]);
    });
});

test.describe('production api', () => {
    test('returns a json not found error for an unknown api path', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/x`);

        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('application/json');

        expect(await response.json()).toEqual({ error: 'Not found' });
    });
});

test.describe('production assets', () => {
    test('serves robots.txt with the sitemap directive', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/robots.txt`);

        expect(response.status()).toBe(200);

        expect(await response.text()).toContain(`Sitemap: ${BASE_URL}/sitemap-index.xml`);
    });

    test('serves the sitemap index as xml', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/sitemap-index.xml`);

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/xml');
    });

    test('serves the open graph image as png', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/og.png`);

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/png');
    });

    test('serves a partial tile response for a byte range request', async ({ request }) => {
        const response = await request.get(`${BASE_URL}${TILE_PATH}`, { headers: { range: 'bytes=0-1023' } });

        expect(response.status()).toBe(206);
        expect(response.headers()['accept-ranges']).toBe('bytes');
        expect(response.headers()['content-range']).toContain('bytes 0-1023/');
        expect(response.headers()['content-type']).toContain('application/octet-stream');
    });
});
