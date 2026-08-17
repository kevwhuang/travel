import { afterEach, describe, expect, test, vi } from 'vitest';

import { LATITUDE_LIMIT, LONGITUDE_LIMIT, MAP_MAX_ZOOM, MAP_MIN_ZOOM, SEARCH_LENGTH_LIMIT } from '../../src/lib/constants';
import { loadAtlasState, saveAtlasState } from '../../src/lib/store';

const ATLAS_KEY = 'travel_atlas';

const BOUNDARY_CAMERAS = [
    { lat: LATITUDE_LIMIT, lng: LONGITUDE_LIMIT, zoom: MAP_MAX_ZOOM },
    { lat: -LATITUDE_LIMIT, lng: -LONGITUDE_LIMIT, zoom: MAP_MIN_ZOOM },
] as const;

const INVALID_CAMERAS = [
    { camera: { lat: LATITUDE_LIMIT + 1, lng: 0, zoom: MAP_MIN_ZOOM }, reason: 'latitude beyond the limit' },
    { camera: { lat: -LATITUDE_LIMIT - 1, lng: 0, zoom: MAP_MIN_ZOOM }, reason: 'latitude beyond the negative limit' },
    { camera: { lat: 0, lng: LONGITUDE_LIMIT + 1, zoom: MAP_MIN_ZOOM }, reason: 'longitude beyond the limit' },
    { camera: { lat: 0, lng: -LONGITUDE_LIMIT - 1, zoom: MAP_MIN_ZOOM }, reason: 'longitude beyond the negative limit' },
    { camera: { lat: 0, lng: 0, zoom: MAP_MIN_ZOOM - 1 }, reason: 'zoom below the minimum' },
    { camera: { lat: 0, lng: 0, zoom: MAP_MAX_ZOOM + 1 }, reason: 'zoom above the maximum' },
    { camera: { lat: '30', lng: 0, zoom: MAP_MIN_ZOOM }, reason: 'non-number latitude' },
    { camera: { lat: 0, lng: 0 }, reason: 'missing zoom key' },
    { camera: 'centered', reason: 'non-object camera' },
    { camera: null, reason: 'null camera' },
] as const;

const NON_OBJECT_PAYLOADS = ['null', '7', '"atlas"', 'true', '["cards"]'] as const;

const REJECTED_STARRED_VALUES = [false, 'true', 1, null] as const;

function buildStoredState(overrides: Record<string, unknown> = {}) {
    return {
        camera: { lat: 30.4, lng: -97.7, zoom: 10 },
        isStarredOnly: true,
        page: 2,
        searchValue: 'plaza',
        selectedCategoryIds: ['dining', 'nature'],
        selectedJourneyIds: ['2025_1_austin'],
        view: 'cards',
        ...overrides,
    };
}

function createLocalStorage(raw?: string) {
    const backing = new Map<string, string>();

    if (raw !== undefined) backing.set(ATLAS_KEY, raw);

    const storage = {
        getItem: vi.fn((key: string) => backing.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            backing.set(key, value);
        }),
    };

    vi.stubGlobal('localStorage', storage);

    return storage;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('loadAtlasState', () => {
    test('returns null when nothing is stored', () => {
        const storage = createLocalStorage();

        expect(loadAtlasState()).toBeNull();
        expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(ATLAS_KEY);
    });

    test('returns null for malformed json', () => {
        createLocalStorage('{not json');

        expect(loadAtlasState()).toBeNull();
    });

    test('returns null for every non-object json payload', () => {
        for (const payload of NON_OBJECT_PAYLOADS) {
            createLocalStorage(payload);

            expect(loadAtlasState(), payload).toBeNull();
        }
    });

    test('returns null when reading storage throws', () => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => {
                throw new Error('denied');
            }),
        });

        expect(loadAtlasState()).toBeNull();
    });

    test('returns every field of a fully valid stored state', () => {
        const stored = buildStoredState();

        createLocalStorage(JSON.stringify(stored));

        expect(loadAtlasState()).toEqual(stored);
    });

    test('keeps a camera sitting exactly on the coordinate and zoom limits', () => {
        for (const camera of BOUNDARY_CAMERAS) {
            createLocalStorage(JSON.stringify(buildStoredState({ camera })));

            expect(loadAtlasState()?.camera, JSON.stringify(camera)).toEqual(camera);
        }
    });

    test('copies only lat, lng, and zoom from a stored camera carrying extra keys', () => {
        createLocalStorage(JSON.stringify(buildStoredState({ camera: { bearing: 45, lat: 30.4, lng: -97.7, zoom: 10 } })));

        expect(loadAtlasState()?.camera).toEqual({ lat: 30.4, lng: -97.7, zoom: 10 });
    });

    test('drops an out-of-range or malformed camera while keeping the other fields', () => {
        for (const { camera, reason } of INVALID_CAMERAS) {
            createLocalStorage(JSON.stringify(buildStoredState({ camera })));

            const state = loadAtlasState();

            expect(state?.camera, reason).toBeUndefined();
            expect(state?.view, reason).toBe('cards');
        }
    });

    test('keeps isStarredOnly when it is literally true', () => {
        createLocalStorage(JSON.stringify(buildStoredState({ isStarredOnly: true })));

        expect(loadAtlasState()?.isStarredOnly).toBe(true);
    });

    test('drops every non-true isStarredOnly value', () => {
        for (const value of REJECTED_STARRED_VALUES) {
            createLocalStorage(JSON.stringify(buildStoredState({ isStarredOnly: value })));

            expect(loadAtlasState()?.isStarredOnly, String(value)).toBeUndefined();
        }
    });

    test('keeps zero and positive integer pages', () => {
        const pages = [0, 7] as const;

        for (const page of pages) {
            createLocalStorage(JSON.stringify(buildStoredState({ page })));

            expect(loadAtlasState()?.page, String(page)).toBe(page);
        }
    });

    test('drops negative, fractional, and non-number pages', () => {
        const pages = [-1, 2.5, '3'] as const;

        for (const page of pages) {
            createLocalStorage(JSON.stringify(buildStoredState({ page })));

            expect(loadAtlasState()?.page, String(page)).toBeUndefined();
        }
    });

    test('strips the search shortcut from the stored search value', () => {
        createLocalStorage(JSON.stringify(buildStoredState({ searchValue: '/pla/za/' })));

        expect(loadAtlasState()?.searchValue).toBe('plaza');
    });

    test('caps the stored search value at the length limit', () => {
        createLocalStorage(JSON.stringify(buildStoredState({ searchValue: 'a'.repeat(SEARCH_LENGTH_LIMIT + 5) })));

        expect(loadAtlasState()?.searchValue).toBe('a'.repeat(SEARCH_LENGTH_LIMIT));
    });

    test('drops a non-string search value', () => {
        createLocalStorage(JSON.stringify(buildStoredState({ searchValue: 7 })));

        expect(loadAtlasState()?.searchValue).toBeUndefined();
    });

    test('filters the selected id arrays down to strings', () => {
        createLocalStorage(JSON.stringify(buildStoredState({
            selectedCategoryIds: ['dining', 4, null, 'nature'],
            selectedJourneyIds: [],
        })));

        const state = loadAtlasState();

        expect(state?.selectedCategoryIds).toEqual(['dining', 'nature']);
        expect(state?.selectedJourneyIds).toEqual([]);
    });

    test('drops selected ids that are not arrays', () => {
        createLocalStorage(JSON.stringify(buildStoredState({ selectedCategoryIds: 'dining', selectedJourneyIds: { trip: true } })));

        const state = loadAtlasState();

        expect(state?.selectedCategoryIds).toBeUndefined();
        expect(state?.selectedJourneyIds).toBeUndefined();
    });

    test('keeps the two known view values', () => {
        const views = ['cards', 'map'] as const;

        for (const view of views) {
            createLocalStorage(JSON.stringify(buildStoredState({ view })));

            expect(loadAtlasState()?.view, view).toBe(view);
        }
    });

    test('drops an unknown view value', () => {
        createLocalStorage(JSON.stringify(buildStoredState({ view: 'grid' })));

        expect(loadAtlasState()?.view).toBeUndefined();
    });
});

describe('saveAtlasState', () => {
    test('writes the state under the travel_atlas key', () => {
        const storage = createLocalStorage();

        saveAtlasState({ view: 'cards' });

        expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(ATLAS_KEY, JSON.stringify({ view: 'cards' }));
    });

    test('merges the new fields over the stored state', () => {
        const storage = createLocalStorage(JSON.stringify(buildStoredState()));

        saveAtlasState({ page: 5, view: 'map' });

        const [, written] = storage.setItem.mock.calls[0];

        expect(JSON.parse(written)).toEqual({ ...buildStoredState(), page: 5, view: 'map' });
    });

    test('swallows a setItem failure', () => {
        const storage = createLocalStorage();

        storage.setItem.mockImplementation(() => {
            throw new Error('quota exceeded');
        });

        expect(() => saveAtlasState({ view: 'map' })).not.toThrow();
    });
});
