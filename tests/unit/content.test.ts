import { describe, expect, test } from 'vitest';
import { join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

import { CATEGORY_COLORS, CONTENT_DIR, LATITUDE_LIMIT, LONGITUDE_LIMIT } from '../../src/lib/constants';
import { collections } from '../../src/content.config';

interface ArrayFile {
    entries: Record<string, unknown>[];
    name: string;
    raw: string;
}

interface SchemaParser {
    safeParse: (data: unknown) => { error?: { message: string }; success: boolean };
}

interface StubMarker {
    category: string;
    description: string;
    lat: number;
    lng: number;
    name: string;
}

const CURLY_APOSTROPHE_PATTERN = /[\u2018\u2019]/;
const JOURNEY_STEM_PATTERN = /^\d{4}_\d+_[a-z_]+$/;

const contentRoot = join(process.cwd(), CONTENT_DIR);

const journeysRoot = join(contentRoot, 'journeys');

const activeRegions = loadArrayFile('active');
const categories = loadArrayFile('categories');
const categoryIds = Object.keys(CATEGORY_COLORS);
const exploredRegions = loadArrayFile('explored');
const journeys = loadJourneys();
const starredMarkers = loadArrayFile('starred');

const allFiles: { name: string; raw: string }[] = [activeRegions, categories, exploredRegions, starredMarkers, ...journeys];

const categoryParser = collections.categories.schema as SchemaParser;
const journeyParser = collections.journeys.schema as SchemaParser;
const markerParser = collections.starredMarkers.schema as SchemaParser;
const regionParser = collections.activeRegions.schema as SchemaParser;

function buildCategory(overrides: Record<string, unknown> = {}) {
    return { description: 'Places to wander outdoors.', name: 'Nature', ...overrides };
}

function buildJourney(overrides: Record<string, unknown> = {}) {
    return { markers: [buildMarker()], name: 'Test Journey', ordered: true, ...overrides };
}

function buildMarker(overrides: Partial<StubMarker> = {}) {
    return {
        category: categoryIds[0],
        description: 'A quiet overlook above the river bend.',
        lat: 30.5,
        lng: -97.5,
        name: 'River Overlook',
        ...overrides,
    };
}

function buildRegion(overrides: Record<string, unknown> = {}) {
    return {
        boundary: [[[[-97.5, 30.5], [-97.4, 30.5], [-97.4, 30.6]]]],
        country: 'USA',
        state: 'Texas',
        ...overrides,
    };
}

function expectSchemaSuccess(entries: { data: unknown; name: string }[], schema: unknown) {
    const parser = schema as SchemaParser;

    expect(typeof parser.safeParse).toBe('function');
    expect(entries.length).toBeGreaterThan(0);

    for (const { data, name } of entries) {
        const result = parser.safeParse(data);

        expect(result.success, `${name}${result.error ? ` ${result.error.message}` : ''}`).toBe(true);
    }
}

function getDedupeKey(marker: Record<string, unknown>) {
    return `${String(marker.name)}|${String(marker.lat)}|${String(marker.lng)}`;
}

function getEntries({ entries, name }: ArrayFile) {
    return entries.map((data, index) => ({ data, name: `${name} ${index}` }));
}

function loadArrayFile(file: string): ArrayFile {
    const raw = readFileSync(join(contentRoot, `${file}.json`), 'utf-8');

    return { entries: JSON.parse(raw) as Record<string, unknown>[], name: `${file}.json`, raw };
}

function loadJourneys() {
    return readdirSync(journeysRoot)
        .filter(file => file.endsWith('.json'))
        .sort()
        .map((file) => {
            const raw = readFileSync(join(journeysRoot, file), 'utf-8');

            return {
                data: JSON.parse(raw) as { markers: StubMarker[]; name: string; ordered: boolean },
                name: `journeys/${file}`,
                raw,
                stem: file.replace('.json', ''),
            };
        });
}

describe('categories', () => {
    test('gives every category a unique non-empty name', () => {
        expect(categories.entries.length).toBeGreaterThan(0);

        const names = categories.entries.map(entry => String(entry.name));

        for (const name of names) {
            expect(name.trim(), name).not.toBe('');
        }

        expect(new Set(names).size).toBe(names.length);
    });

    test('mirrors the category color keys in both directions', () => {
        const ids = categories.entries.map(entry => String(entry.name).toLowerCase());

        expect([...ids].sort()).toEqual([...categoryIds].sort());
    });
});

describe('journeys', () => {
    test('names files with year, order, and slug stems', () => {
        expect(journeys.length).toBeGreaterThan(0);

        for (const { stem } of journeys) {
            expect(stem).toMatch(JOURNEY_STEM_PATTERN);
        }
    });

    test('keeps year and order pairs unique across files', () => {
        const pairs = journeys.map(({ stem }) => stem.split('_').slice(0, 2).join('_'));

        expect(new Set(pairs).size).toBe(journeys.length);
    });

    test('uses only known category ids for markers', () => {
        for (const { data, name } of journeys) {
            for (const marker of data.markers) {
                expect(categoryIds, `${name} ${marker.name}`).toContain(marker.category);
            }
        }
    });
});

describe('regions', () => {
    test('keys every region by a unique country and state pair', () => {
        for (const file of [activeRegions, exploredRegions]) {
            expect(file.entries.length, file.name).toBeGreaterThan(0);

            const keys = file.entries.map(entry => `${String(entry.country)}-${String(entry.state)}`.toLowerCase());

            expect(new Set(keys).size, file.name).toBe(file.entries.length);
        }
    });
});

describe('starred markers', () => {
    test('gives every entry a unique dedupe key', () => {
        expect(getDedupeKey({ lat: 1.5, lng: -2, name: 'Cove' })).toBe('Cove|1.5|-2');
        expect(starredMarkers.entries.length).toBeGreaterThan(0);

        const keys = starredMarkers.entries.map(entry => getDedupeKey(entry));

        expect(new Set(keys).size).toBe(starredMarkers.entries.length);
    });

    test('keys every entry by a unique lowercased name', () => {
        const keys = starredMarkers.entries.map(entry => String(entry.name).toLowerCase());

        expect(new Set(keys).size).toBe(starredMarkers.entries.length);
    });

    test('uses only known category ids', () => {
        for (const entry of starredMarkers.entries) {
            expect(categoryIds, String(entry.name)).toContain(entry.category);
        }
    });
});

describe('schemas', () => {
    test('every active region parses against its collection schema', () => {
        expectSchemaSuccess(getEntries(activeRegions), collections.activeRegions.schema);
    });

    test('every category parses against its collection schema', () => {
        expectSchemaSuccess(getEntries(categories), collections.categories.schema);
    });

    test('every explored region parses against its collection schema', () => {
        expectSchemaSuccess(getEntries(exploredRegions), collections.exploredRegions.schema);
    });

    test('every journey file parses against its collection schema', () => {
        expectSchemaSuccess(journeys, collections.journeys.schema);
    });

    test('every starred marker parses against its collection schema', () => {
        expectSchemaSuccess(getEntries(starredMarkers), collections.starredMarkers.schema);
    });

    test('accepts the crafted marker, journey, and region baselines', () => {
        expect(markerParser.safeParse(buildMarker()).success).toBe(true);
        expect(journeyParser.safeParse(buildJourney()).success).toBe(true);
        expect(regionParser.safeParse(buildRegion()).success).toBe(true);
    });

    test('rejects a category with an empty name or description', () => {
        expect(categoryParser.safeParse(buildCategory()).success).toBe(true);
        expect(categoryParser.safeParse(buildCategory({ name: '' })).success).toBe(false);
        expect(categoryParser.safeParse(buildCategory({ description: '' })).success).toBe(false);
    });

    test('rejects a marker with an unknown category', () => {
        expect(markerParser.safeParse(buildMarker({ category: 'castles' })).success).toBe(false);
    });

    test('rejects a marker with latitude beyond the limit', () => {
        expect(markerParser.safeParse(buildMarker({ lat: LATITUDE_LIMIT + 1 })).success).toBe(false);
    });

    test('rejects a marker with longitude beyond the negative limit', () => {
        expect(markerParser.safeParse(buildMarker({ lng: -(LONGITUDE_LIMIT + 1) })).success).toBe(false);
    });

    test('rejects a marker with an empty name', () => {
        expect(markerParser.safeParse(buildMarker({ name: '' })).success).toBe(false);
    });

    test('rejects a marker breaching each remaining constraint side', () => {
        const violations = [
            { label: 'latitude below the negative limit', overrides: { lat: -(LATITUDE_LIMIT + 1) } },
            { label: 'longitude beyond the limit', overrides: { lng: LONGITUDE_LIMIT + 1 } },
            { label: 'empty description', overrides: { description: '' } },
        ];

        for (const { label, overrides } of violations) {
            expect(markerParser.safeParse(buildMarker(overrides)).success, label).toBe(false);
        }

        expect(journeyParser.safeParse(buildJourney({ markers: [{ ...buildMarker(), starred: 'yes' }] })).success, 'non-boolean starred').toBe(false);
    });

    test('rejects a journey missing its ordered flag', () => {
        expect(journeyParser.safeParse({ markers: [buildMarker()], name: 'Test Journey' }).success).toBe(false);
    });

    test('rejects a journey with an invalid marker or an empty name', () => {
        expect(journeyParser.safeParse(buildJourney({ markers: [buildMarker({ category: 'castles' })] })).success).toBe(false);
        expect(journeyParser.safeParse(buildJourney({ name: '' })).success).toBe(false);
    });

    test('rejects a region with a malformed boundary', () => {
        expect(regionParser.safeParse(buildRegion({ boundary: [[[0, 0]]] })).success).toBe(false);
        expect(regionParser.safeParse(buildRegion({ boundary: [[[[-(LONGITUDE_LIMIT + 1), 0]]]] })).success).toBe(false);
    });

    test('rejects a region boundary position with latitude beyond the limit', () => {
        expect(regionParser.safeParse(buildRegion({ boundary: [[[[0, LATITUDE_LIMIT + 1]]]] })).success).toBe(false);
    });

    test('rejects a region with an empty country or state', () => {
        expect(regionParser.safeParse(buildRegion({ country: '' })).success).toBe(false);
        expect(regionParser.safeParse(buildRegion({ state: '' })).success).toBe(false);
    });
});

describe('json files', () => {
    test('files end without a trailing newline', () => {
        for (const { name, raw } of allFiles) {
            expect(raw.endsWith('\n'), name).toBe(false);
        }
    });

    test('files contain no curly apostrophes', () => {
        for (const { name, raw } of allFiles) {
            expect(CURLY_APOSTROPHE_PATTERN.test(raw), name).toBe(false);
        }
    });
});
