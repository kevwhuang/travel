import { createElement } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ViewMap from '../../src/components/ViewMap';
import { CATEGORY_COLORS } from '../../src/lib/constants';

type ViewMapProps = Parameters<typeof ViewMap>[0];

const [FIRST_CATEGORY_ID] = Object.keys(CATEGORY_COLORS);

function buildMarker(overrides: Partial<AtlasMarker> = {}): AtlasMarker {
    return {
        categoryId: FIRST_CATEGORY_ID,
        description: 'A stub stop',
        id: 0,
        isStarred: false,
        journeyId: null,
        lat: 30.4,
        lng: -97.8,
        name: 'Stub Stop',
        stopNumber: 0,
        ...overrides,
    };
}

function buildProps(overrides: Partial<ViewMapProps> = {}): ViewMapProps {
    return {
        categories: [],
        flyTarget: null,
        journeys: [],
        markers: [],
        onSelectMarker: vi.fn(),
        onShowInCards: vi.fn(),
        regions: { features: [], type: 'FeatureCollection' },
        selectedMarkerId: null,
        ...overrides,
    };
}

function renderMap(overrides: Partial<ViewMapProps> = {}) {
    return renderToStaticMarkup(createElement(ViewMap, buildProps(overrides)));
}

describe('ViewMap', () => {
    test('exports a function component', () => {
        expect(ViewMap).toBeTypeOf('function');
    });

    test('renders the fade wrapper around the map container', () => {
        const html = renderMap();

        expect(html).toContain('<div class="atlas-fade atlas-fade--slow absolute inset-0 overflow-hidden">');
        expect(html).toContain('<div class="h-full w-full"></div>');
    });

    test('renders an empty scale bar hidden from assistive tech', () => {
        const html = renderMap();

        expect(html).toMatch(/<div class="atlas-scale-bar[^"]*" aria-hidden="true">/);
        expect(html).toMatch(/<p class="[^"]*font-mono[^"]*"><\/p>/);
        expect(html).toContain('style="width:0');
    });

    test('withholds markers, popup, and canvas from the static render', () => {
        const html = renderMap({ markers: [buildMarker()], selectedMarkerId: 0 });

        expect(html).not.toContain('atlas-marker');
        expect(html).not.toContain('maplibregl-canvas');
        expect(html).not.toContain('id="atlas-popup"');
    });

    test('renders the same shell regardless of marker props', () => {
        expect(renderMap({ flyTarget: { markerId: 0 }, markers: [buildMarker()], selectedMarkerId: 0 })).toBe(renderMap());
    });
});
