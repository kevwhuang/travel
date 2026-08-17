import { beforeAll, describe, expect, test } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Atlas from '../../src/components/Atlas';
import { ATLAS_TITLE, CREDIT_MAP, SEARCH_LENGTH_LIMIT } from '../../src/lib/constants';
import { getAtlasData } from '../../src/lib/atlas';

describe('Atlas', () => {
    let html: string;
    let markerTotal: number;

    beforeAll(async () => {
        const data = await getAtlasData();

        html = renderToStaticMarkup(createElement(Atlas, { data }));
        markerTotal = data.markers.length;
    });

    test('renders the atlas title as a screen-reader-only heading', () => {
        expect(html).toContain(`<h1 class="sr-only">${ATLAS_TITLE}</h1>`);
        expect(html.split('<h1').length - 1).toBe(1);
    });

    test('renders the loading skeleton while the lazy map view is unresolved', () => {
        expect(html).toMatch(/<div class="atlas-fade[^"]*" role="status">/);
        expect(html).toContain('atlas-pulse');
        expect(html).toContain('>Loading</p>');
    });

    test('renders the filter, search, credit, and view toggle controls', () => {
        expect(html).toContain('aria-haspopup="dialog"');
        expect(html).toContain('aria-label="Open filters"');
        expect(html).toMatch(/<search class="atlas-control[^"]*"/);
        expect(html).toContain(`maxLength="${SEARCH_LENGTH_LIMIT}"`);
        expect(html).toContain('placeholder="Search\u2026"');
        expect(html).toContain(CREDIT_MAP);
        expect(html).toContain('aria-label="Switch to cards"');
        expect(html).toContain('>Cards</span>');
    });

    test('starts with the search collapsed and no filters active', () => {
        expect(html).not.toContain('atlas-control--active');
        expect(html).not.toContain('atlas-control--open');
    });

    test('hides the grain layer from assistive tech', () => {
        expect(html).toMatch(/<div class="atlas-grain[^"]*" aria-hidden="true">/);
    });

    test('announces the full marker count in the status message', () => {
        expect(markerTotal).toBeGreaterThan(0);
        expect(html).toContain(`<p class="sr-only" role="status">${markerTotal} of ${markerTotal} markers shown</p>`);
        expect(html).not.toContain(', page ');
    });

    test('withholds the filters modal at rest', () => {
        expect(html).not.toContain('<dialog');
        expect(html).not.toContain('aria-modal');
        expect(html).not.toContain('modal-filters-title');
    });

    test('keeps the island wrapper interactive with no inert attribute', () => {
        expect(html).toContain('<div class="contents">');
        expect(html).not.toContain('inert');
    });
});
