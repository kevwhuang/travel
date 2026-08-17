import { expect, test } from '@playwright/test';

import { MAP_FONT_STACKS, TILE_EXTENSION, WORLD_SOURCE_ID } from '../../src/lib/constants';

const CONTENT_SECURITY_POLICY = 'base-uri \'none\'; connect-src \'self\' https://*.supabase.co; default-src \'self\'; font-src \'self\' data:; form-action \'none\'; frame-ancestors \'self\'; img-src \'self\' data:; script-src \'self\' \'unsafe-inline\' data:; style-src \'self\' \'unsafe-inline\'';
const FONT_PATH = `/fonts/map/${encodeURIComponent(MAP_FONT_STACKS.regular)}/0-255.pbf`;
const TILE_PATH = `/tiles/${WORLD_SOURCE_ID}${TILE_EXTENSION}`;

test.describe('pages', () => {
    test('serves the home page as html', async ({ request }) => {
        const response = await request.get('/');

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('text/html');
    });

    test('serves the error page as html with a 500 status', async ({ request }) => {
        const response = await request.get('/500');

        expect(response.status()).toBe(500);
        expect(response.headers()['content-type']).toContain('text/html');
        expect(await response.text()).toContain('<title>Server Error \u2014 Travel</title>');
    });

    test('returns 404 for unknown pages', async ({ request }) => {
        const response = await request.get('/this-page-does-not-exist');

        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('text/html');
    });

    test('serves the hardened security headers', async ({ request }) => {
        const response = await request.get('/');

        expect(response.headers()['content-security-policy']).toBe(CONTENT_SECURITY_POLICY);
        expect(response.headers()['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
        expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(response.headers()['strict-transport-security']).toBe('max-age=31536000; includeSubDomains; preload');
        expect(response.headers()['x-content-type-options']).toBe('nosniff');
        expect(response.headers()['x-frame-options']).toBe('sameorigin');
    });
});

test.describe('api', () => {
    test('returns a json 404 for an unknown api path on get', async ({ request }) => {
        const response = await request.get('/api/anything');

        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('application/json');

        const body: Record<string, unknown> = await response.json();

        expect(body.error).toBe('Not found');
    });

    test('returns a json 404 for an unknown api path on post', async ({ request }) => {
        const response = await request.post('/api/anything', { data: {} });

        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('application/json');

        const body: Record<string, unknown> = await response.json();

        expect(body.error).toBe('Not found');
    });

    test('returns a json 404 for an unknown api path on delete', async ({ request }) => {
        const response = await request.delete('/api/anything', { data: {} });

        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('application/json');

        const body: Record<string, unknown> = await response.json();

        expect(body.error).toBe('Not found');
    });
});

test.describe('map assets', () => {
    test('serves a partial tile response for a byte range request', async ({ request }) => {
        const response = await request.get(TILE_PATH, { headers: { range: 'bytes=0-1023' } });

        expect(response.status()).toBe(206);
        expect(response.headers()['accept-ranges']).toBe('bytes');
        expect(response.headers()['content-range']).toContain('bytes 0-1023/');
        expect(response.headers()['content-type']).toContain('application/octet-stream');
    });

    test('serves the regular map font glyphs as protobuf', async ({ request }) => {
        const response = await request.get(FONT_PATH);

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/x-protobuf');
    });
});
