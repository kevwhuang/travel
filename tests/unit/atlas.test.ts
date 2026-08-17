import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

import { CATEGORY_COLORS, CONTENT_DIR } from '../../src/lib/constants';
import { getAtlasData } from '../../src/lib/atlas';

interface CategoryFile {
    description: string;
    name: string;
}

interface CollectionEntry {
    data: Record<string, unknown>;
    id: string;
}

interface JourneyFile {
    markers: MarkerFile[];
    name: string;
    ordered: boolean;
}

interface MarkerFile {
    category: string;
    description: string;
    lat: number;
    lng: number;
    name: string;
    starred?: boolean;
}

interface RegionFile {
    boundary: unknown;
    country: string;
    state: string;
}

const [FIRST_CATEGORY_ID] = Object.keys(CATEGORY_COLORS);

const contentRoot = join(process.cwd(), CONTENT_DIR);

let atlasData: AtlasData;

function buildExpectedAtlas() {
    const markerCounts = new Map<string, number>();
    const markers: AtlasMarker[] = [];
    const markersByKey = new Map<string, AtlasMarker>();

    for (const journeyId of listJourneyIds().sort(compareJourneyIdsNewestFirst)) {
        const journey = readJourneyFile(journeyId);

        let markerCount = 0;

        for (const marker of journey.markers) {
            const existingMarker = markersByKey.get(getDedupeKey(marker));

            if (existingMarker) {
                if (marker.starred === true) existingMarker.isStarred = true;

                continue;
            }

            markerCount++;

            const atlasMarker: AtlasMarker = {
                categoryId: marker.category,
                description: marker.description,
                id: markers.length,
                isStarred: marker.starred === true,
                journeyId,
                lat: marker.lat,
                lng: marker.lng,
                name: marker.name,
                stopNumber: journey.ordered ? markerCount : 0,
            };

            markers.push(atlasMarker);
            markersByKey.set(getDedupeKey(atlasMarker), atlasMarker);
        }

        markerCounts.set(journeyId, markerCount);
    }

    for (const entry of readContentFile<MarkerFile[]>('starred.json')) {
        const existingMarker = markersByKey.get(getDedupeKey(entry));

        if (existingMarker) {
            existingMarker.isStarred = true;

            continue;
        }

        const atlasMarker: AtlasMarker = {
            categoryId: entry.category,
            description: entry.description,
            id: markers.length,
            isStarred: true,
            journeyId: null,
            lat: entry.lat,
            lng: entry.lng,
            name: entry.name,
            stopNumber: 0,
        };

        markers.push(atlasMarker);
        markersByKey.set(getDedupeKey(atlasMarker), atlasMarker);
    }

    return { markerCounts, markers };
}

function buildJourneyEntry(id: string, markers: MarkerFile[], ordered = true): CollectionEntry {
    return { data: { markers, name: id, ordered }, id };
}

function buildMarker(overrides: Partial<MarkerFile> = {}): MarkerFile {
    return {
        category: FIRST_CATEGORY_ID,
        description: 'A crafted stop.',
        lat: 10.5,
        lng: 20.5,
        name: 'Crafted Stop',
        ...overrides,
    };
}

function compareJourneyIdsNewestFirst(first: string, second: string) {
    return parseJourneyYear(second) - parseJourneyYear(first) || parseJourneyOrder(second) - parseJourneyOrder(first);
}

function getCrossJourneyDuplicates() {
    const claims = new Map<string, string>();
    const duplicates: { claimedBy: string; key: string; shadowedIn: string }[] = [];

    for (const journeyId of listJourneyIds().sort(compareJourneyIdsNewestFirst)) {
        for (const marker of readJourneyFile(journeyId).markers) {
            const key = getDedupeKey(marker);
            const claimedBy = claims.get(key);

            if (claimedBy) duplicates.push({ claimedBy, key, shadowedIn: journeyId });
            else claims.set(key, journeyId);
        }
    }

    return duplicates;
}

function getDedupeKey(marker: { lat: number; lng: number; name: string }) {
    return `${marker.name}|${marker.lat}|${marker.lng}`;
}

async function importAtlasWith(collections: Partial<Record<string, CollectionEntry[]>>) {
    vi.resetModules();

    vi.doMock('astro:content', () => ({
        getCollection: vi.fn(async (name: string) => collections[name] ?? []),
    }));

    return import('../../src/lib/atlas');
}

function listJourneyIds() {
    return readdirSync(join(contentRoot, 'journeys'))
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
}

function parseJourneyOrder(journeyId: string) {
    return Number(journeyId.split('_')[1]);
}

function parseJourneyYear(journeyId: string) {
    return Number(journeyId.split('_')[0]);
}

function readContentFile<Payload>(name: string) {
    return JSON.parse(readFileSync(join(contentRoot, name), 'utf-8')) as Payload;
}

function readJourneyFile(journeyId: string) {
    return readContentFile<JourneyFile>(join('journeys', `${journeyId}.json`));
}

beforeAll(async () => {
    atlasData = await getAtlasData();
});

describe('buildAtlasData', () => {
    afterEach(() => {
        vi.doUnmock('astro:content');
        vi.resetModules();
    });

    test('merges a starred duplicate from an older journey into the newest claim', async () => {
        const atlas = await importAtlasWith({
            journeys: [
                buildJourneyEntry('2024_1_repeat', [buildMarker({ starred: true })]),
                buildJourneyEntry('2026_1_claim', [buildMarker()]),
            ],
        });

        const { journeys, markers } = await atlas.getAtlasData();

        expect(markers).toHaveLength(1);
        expect(markers[0]?.isStarred).toBe(true);
        expect(markers[0]?.journeyId).toBe('2026_1_claim');
        expect(journeys.map(journey => journey.markerCount)).toEqual([1, 0]);
    });

    test('leaves the newest claim unstarred when an older duplicate is not starred', async () => {
        const atlas = await importAtlasWith({
            journeys: [
                buildJourneyEntry('2024_1_repeat', [buildMarker()]),
                buildJourneyEntry('2026_1_claim', [buildMarker()]),
            ],
        });

        const { markers } = await atlas.getAtlasData();

        expect(markers).toHaveLength(1);
        expect(markers[0]?.isStarred).toBe(false);
        expect(markers[0]?.journeyId).toBe('2026_1_claim');
    });

    test('treats an explicit starred false flag as unstarred', async () => {
        const atlas = await importAtlasWith({
            journeys: [buildJourneyEntry('2026_1_claim', [buildMarker({ starred: false })])],
        });

        const { markers } = await atlas.getAtlasData();

        expect(markers).toHaveLength(1);
        expect(markers[0]?.isStarred).toBe(false);
    });

    test('stars an existing journey marker when a starred entry matches its key', async () => {
        const atlas = await importAtlasWith({
            journeys: [buildJourneyEntry('2026_1_claim', [buildMarker()])],
            starredMarkers: [{ data: { ...buildMarker() }, id: 'crafted stop' }],
        });

        const { markers } = await atlas.getAtlasData();

        expect(markers).toHaveLength(1);
        expect(markers[0]?.isStarred).toBe(true);
        expect(markers[0]?.journeyId).toBe('2026_1_claim');
    });

    test('appends a starred entry unmatched by any journey with a null journey id', async () => {
        const atlas = await importAtlasWith({
            journeys: [buildJourneyEntry('2026_1_claim', [buildMarker()])],
            starredMarkers: [{ data: { ...buildMarker({ lat: -33.9, lng: 151.2, name: 'Starred Only' }) }, id: 'starred only' }],
        });

        const { markers } = await atlas.getAtlasData();

        expect(markers).toHaveLength(2);

        expect(markers[1]).toEqual({
            categoryId: FIRST_CATEGORY_ID,
            description: 'A crafted stop.',
            id: 1,
            isStarred: true,
            journeyId: null,
            lat: -33.9,
            lng: 151.2,
            name: 'Starred Only',
            stopNumber: 0,
        });
    });

    test('skips claimed markers while numbering stops in an older ordered journey', async () => {
        const atlas = await importAtlasWith({
            journeys: [
                buildJourneyEntry('2025_1_repeat', [
                    buildMarker({ name: 'First' }),
                    buildMarker({ name: 'Shared' }),
                    buildMarker({ name: 'Last' }),
                ]),
                buildJourneyEntry('2026_1_claim', [buildMarker({ name: 'Shared' })]),
            ],
        });

        const { journeys, markers } = await atlas.getAtlasData();

        const repeatStops = markers.filter(marker => marker.journeyId === '2025_1_repeat');

        expect(repeatStops.map(marker => [marker.name, marker.stopNumber])).toEqual([['First', 1], ['Last', 2]]);
        expect(journeys.find(journey => journey.id === '2025_1_repeat')?.markerCount).toBe(2);
    });
});

describe('categories', () => {
    test('maps every category file entry to its lowercased id with description and name', () => {
        const expected = readContentFile<CategoryFile[]>('categories.json')
            .map(category => ({ description: category.description, id: category.name.toLowerCase(), name: category.name }))
            .sort((first, second) => first.id.localeCompare(second.id));

        expect(expected.length).toBeGreaterThan(0);
        expect(atlasData.categories).toEqual(expected);
    });

    test('sorts categories ascending by id', () => {
        const ids = atlasData.categories.map(category => category.id);

        expect(ids).toEqual([...ids].sort((first, second) => first.localeCompare(second)));
    });
});

describe('content mirror', () => {
    test('pins the dedupe key and newest-first comparison to literal fixtures', () => {
        expect(getDedupeKey({ lat: 30.4, lng: -97.7, name: 'Pin' })).toBe('Pin|30.4|-97.7');
        expect(['2025_1_west', '2026_2_east', '2026_10_north'].sort(compareJourneyIdsNewestFirst)).toEqual(['2026_10_north', '2026_2_east', '2025_1_west']);
    });

    test('finds the live edge cases the disk content must keep exercising', () => {
        const expected = buildExpectedAtlas();

        expect(getCrossJourneyDuplicates().length).toBeGreaterThan(0);
        expect(expected.markers.some(marker => marker.isStarred && marker.journeyId !== null)).toBe(true);
        expect(expected.markers.some(marker => marker.journeyId === null)).toBe(true);
    });
});

describe('getAtlasData', () => {
    test('returns the identical promise and resolved object on repeat calls', async () => {
        const first = getAtlasData();
        const second = getAtlasData();

        expect(second).toBe(first);

        expect(await second).toBe(await first);
    });
});

describe('journeys', () => {
    test('sorts journeys year-descending then order-descending', () => {
        expect(atlasData.journeys.map(journey => journey.id)).toEqual(listJourneyIds().sort(compareJourneyIdsNewestFirst));
    });

    test('parses year and order from each journey id', () => {
        for (const journey of atlasData.journeys) {
            const [year, order] = journey.id.split('_');

            expect(journey.year, journey.id).toBe(Number(year));
            expect(journey.order, journey.id).toBe(Number(order));
        }
    });

    test('mirrors the name and ordered flag from each journey file', () => {
        for (const journey of atlasData.journeys) {
            const file = readJourneyFile(journey.id);

            expect(journey.name, journey.id).toBe(file.name);
            expect(journey.isOrdered, journey.id).toBe(file.ordered);
        }
    });

    test('counts only the markers each journey claims first', () => {
        const expected = buildExpectedAtlas();

        for (const journey of atlasData.journeys) {
            expect(journey.markerCount, journey.id).toBe(expected.markerCounts.get(journey.id));
        }
    });

    test('a journey shadowed by a newer duplicate counts fewer markers than its file lists', () => {
        const duplicates = getCrossJourneyDuplicates();
        const shadowed = atlasData.journeys.filter(journey => duplicates.some(duplicate => duplicate.shadowedIn === journey.id));

        expect(shadowed.length).toBeGreaterThan(0);

        for (const journey of shadowed) {
            const shadowedCount = duplicates.filter(duplicate => duplicate.shadowedIn === journey.id).length;

            expect(journey.markerCount, journey.id).toBe(readJourneyFile(journey.id).markers.length - shadowedCount);
        }
    });

    test('a journey without markers counts zero', () => {
        const empty = atlasData.journeys.find(journey => readJourneyFile(journey.id).markers.length === 0);

        expect(empty).toBeDefined();
        expect(empty?.markerCount).toBe(0);
    });
});

describe('markers', () => {
    test('assembles the exact marker list the disk mirror predicts', () => {
        expect(atlasData.markers).toEqual(buildExpectedAtlas().markers);
    });

    test('assigns sequential ids matching insertion order', () => {
        expect(atlasData.markers.length).toBeGreaterThan(0);
        expect(atlasData.markers.map(marker => marker.id)).toEqual(atlasData.markers.map((_, index) => index));
    });

    test('keeps every dedupe key unique', () => {
        const keys = atlasData.markers.map(marker => getDedupeKey(marker));

        expect(new Set(keys).size).toBe(keys.length);
    });

    test('numbers stops sequentially in ordered journeys and zeroes unordered ones', () => {
        expect(atlasData.journeys.some(journey => journey.isOrdered)).toBe(true);
        expect(atlasData.journeys.some(journey => !journey.isOrdered)).toBe(true);

        for (const journey of atlasData.journeys) {
            const stops = atlasData.markers.filter(marker => marker.journeyId === journey.id).map(marker => marker.stopNumber);

            if (journey.isOrdered) expect(stops, journey.id).toEqual(stops.map((_, index) => index + 1));
            else expect(stops, journey.id).toEqual(stops.map(() => 0));
        }
    });

    test('a marker repeated across journeys belongs to the newest journey', () => {
        const duplicates = getCrossJourneyDuplicates();

        expect(duplicates.length).toBeGreaterThan(0);

        for (const duplicate of duplicates) {
            const marker = atlasData.markers.find(candidate => getDedupeKey(candidate) === duplicate.key);

            expect(marker?.journeyId, duplicate.key).toBe(duplicate.claimedBy);
        }
    });

    test('flags markers declared starred inside their journey file', () => {
        const starredKeys = new Set<string>();

        for (const journeyId of listJourneyIds()) {
            for (const marker of readJourneyFile(journeyId).markers) {
                if (marker.starred === true) starredKeys.add(getDedupeKey(marker));
            }
        }

        expect(starredKeys.size).toBeGreaterThan(0);

        for (const marker of atlasData.markers) {
            if (starredKeys.has(getDedupeKey(marker))) expect(marker.isStarred, marker.name).toBe(true);
        }
    });

    test('appends starred entries absent from every journey with a null journey id', () => {
        const journeyKeys = new Set(atlasData.markers.filter(marker => marker.journeyId !== null).map(marker => getDedupeKey(marker)));

        const appended = readContentFile<MarkerFile[]>('starred.json').filter(entry => !journeyKeys.has(getDedupeKey(entry)));

        expect(appended.length).toBeGreaterThan(0);

        for (const entry of appended) {
            const marker = atlasData.markers.find(candidate => getDedupeKey(candidate) === getDedupeKey(entry));

            expect(marker, entry.name).toBeDefined();
            expect(marker?.categoryId, entry.name).toBe(entry.category);
            expect(marker?.isStarred, entry.name).toBe(true);
            expect(marker?.journeyId, entry.name).toBeNull();
            expect(marker?.stopNumber, entry.name).toBe(0);
        }
    });
});

describe('regions', () => {
    test('collects active features before explored ones as a feature collection', () => {
        const activeRegions = readContentFile<RegionFile[]>('active.json');
        const exploredRegions = readContentFile<RegionFile[]>('explored.json');

        const expectedStatuses = [
            ...activeRegions.map(() => 'active'),
            ...exploredRegions.map(() => 'explored'),
        ];

        expect(activeRegions.length).toBeGreaterThan(0);
        expect(exploredRegions.length).toBeGreaterThan(0);
        expect(atlasData.regions.type).toBe('FeatureCollection');
        expect(atlasData.regions.features.map(feature => feature.properties.status)).toEqual(expectedStatuses);
    });

    test('wraps every boundary as a multipolygon feature', () => {
        for (const [index, feature] of atlasData.regions.features.entries()) {
            expect(feature.type, `feature ${index}`).toBe('Feature');
            expect(feature.geometry.type, `feature ${index}`).toBe('MultiPolygon');
        }
    });

    test('carries each region boundary through as geometry coordinates', () => {
        const boundaries = [
            ...readContentFile<RegionFile[]>('active.json'),
            ...readContentFile<RegionFile[]>('explored.json'),
        ].map(region => region.boundary);

        expect(atlasData.regions.features.map(feature => feature.geometry.coordinates)).toEqual(boundaries);
    });
});
