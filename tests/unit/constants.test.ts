import { describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
    ARROW_PAGE_STEPS,
    ATLAS_TITLE,
    CARDS_PER_PAGE,
    CATEGORY_COLORS,
    CONTENT_DIR,
    COPYRIGHT_MARK,
    COVERAGE_REGIONS,
    CREDIT_MAP,
    LATITUDE_LIMIT,
    LONGITUDE_LIMIT,
    MAP_FONT_STACKS,
    MAP_MAX_ZOOM,
    MAP_MIN_ZOOM,
    SEARCH_LENGTH_LIMIT,
    SEARCH_SHORTCUT,
    STAR_COLOR,
    STAR_LABEL,
    TILE_EXTENSION,
    WORLD_SOURCE_ID,
} from '../../src/lib/constants';

const COLOR_TOKEN_PATTERN = /^var\(--color-[a-z]+\)$/;

describe('ARROW_PAGE_STEPS', () => {
    test('steps one page back for ArrowLeft and one forward for ArrowRight', () => {
        expect(ARROW_PAGE_STEPS).toEqual({ ArrowLeft: -1, ArrowRight: 1 });
    });
});

describe('CATEGORY_COLORS', () => {
    test('lists six categories in alphabetical order', () => {
        const ids = Object.keys(CATEGORY_COLORS);

        expect(ids).toHaveLength(6);
        expect(ids).toEqual([...ids].sort());
    });

    test('assigns every category a css color token', () => {
        for (const [id, color] of Object.entries(CATEGORY_COLORS)) {
            expect(color, id).toMatch(COLOR_TOKEN_PATTERN);
        }
    });

    test('gives no two categories the same color', () => {
        const colors = Object.values(CATEGORY_COLORS);

        expect(new Set(colors).size).toBe(colors.length);
    });
});

describe('CONTENT_DIR', () => {
    test('points at a directory that exists on disk', () => {
        expect(existsSync(join(process.cwd(), CONTENT_DIR))).toBe(true);
    });
});

describe('COPYRIGHT_MARK', () => {
    test('is the copyright sign', () => {
        expect(COPYRIGHT_MARK).toBe('\u00a9');
    });
});

describe('COVERAGE_REGIONS', () => {
    test('names every region uniquely in alphabetical order', () => {
        const names = COVERAGE_REGIONS.map(region => region.name);

        expect(new Set(names).size).toBe(names.length);
        expect(names).toEqual([...names].sort());
    });

    test('places south below north and west below east', () => {
        for (const region of COVERAGE_REGIONS) {
            expect(region.south, region.name).toBeLessThan(region.north);
            expect(region.west, region.name).toBeLessThan(region.east);
        }
    });

    test('keeps bounds within the coordinate limits', () => {
        for (const region of COVERAGE_REGIONS) {
            expect(region.north, region.name).toBeLessThanOrEqual(LATITUDE_LIMIT);
            expect(region.south, region.name).toBeGreaterThanOrEqual(-LATITUDE_LIMIT);
            expect(region.east, region.name).toBeLessThanOrEqual(LONGITUDE_LIMIT);
            expect(region.west, region.name).toBeGreaterThanOrEqual(-LONGITUDE_LIMIT);
        }
    });

    test('caps zoom within the map zoom range', () => {
        for (const region of COVERAGE_REGIONS) {
            expect(region.maxZoom, region.name).toBeGreaterThanOrEqual(MAP_MIN_ZOOM);
            expect(region.maxZoom, region.name).toBeLessThanOrEqual(MAP_MAX_ZOOM);
        }
    });
});

describe('MAP_FONT_STACKS', () => {
    test('maps the three text styles to noto sans stacks', () => {
        expect(MAP_FONT_STACKS).toEqual({
            bold: 'Noto Sans Medium',
            italic: 'Noto Sans Italic',
            regular: 'Noto Sans Regular',
        });
    });
});

describe('SEARCH_SHORTCUT', () => {
    test('is the single slash character', () => {
        expect(SEARCH_SHORTCUT).toBe('/');
        expect(SEARCH_SHORTCUT).toHaveLength(1);
    });
});

describe('STAR_COLOR', () => {
    test('is the gold css color token', () => {
        expect(STAR_COLOR).toBe('var(--color-gold)');
        expect(STAR_COLOR).toMatch(COLOR_TOKEN_PATTERN);
    });
});

describe('TILE_EXTENSION', () => {
    test('is the pmtiles file extension', () => {
        expect(TILE_EXTENSION).toBe('.pmtiles');
    });
});

describe('WORLD_SOURCE_ID', () => {
    test('names the worldwide tile source', () => {
        expect(WORLD_SOURCE_ID).toBe('world');
    });
});

describe('labels', () => {
    test('name the atlas, the map credit, and starred favorites', () => {
        expect(ATLAS_TITLE).toBe('Atlas');
        expect(CREDIT_MAP).toBe('OpenStreetMap');
        expect(STAR_LABEL).toBe('Starred favorite');
    });
});

describe('limits', () => {
    test('orders the minimum map zoom below the maximum', () => {
        expect(MAP_MIN_ZOOM).toBeLessThan(MAP_MAX_ZOOM);
    });

    test('keeps the page size and search length positive', () => {
        expect(CARDS_PER_PAGE).toBeGreaterThan(0);
        expect(SEARCH_LENGTH_LIMIT).toBeGreaterThan(0);
    });

    test('uses the geographic coordinate limits', () => {
        expect(LATITUDE_LIMIT).toBe(90);
        expect(LONGITUDE_LIMIT).toBe(180);
    });
});
