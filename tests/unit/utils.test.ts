import { describe, expect, test } from 'vitest';

import { CARDS_PER_PAGE, CATEGORY_COLORS, SEARCH_LENGTH_LIMIT, SEARCH_SHORTCUT } from '../../src/lib/constants';
import {
    findJourney,
    getAccentBorder,
    getAccentForeground,
    getAccentSurface,
    getCategoryColor,
    getJourneysById,
    getPageCount,
    isModifiedEvent,
    sanitizeSearch,
} from '../../src/lib/utils';

type ModifierEvent = Parameters<typeof isModifiedEvent>[0];

const ACCENT_COLOR = 'var(--color-azure)';
const FALLBACK_COLOR = 'var(--color-storm)';
const MODIFIER_KEYS = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const;

function buildJourney(overrides: Partial<AtlasJourney> = {}): AtlasJourney {
    return {
        id: '2025_1_austin',
        isOrdered: true,
        markerCount: 3,
        name: 'Austin',
        order: 1,
        year: 2025,
        ...overrides,
    };
}

function buildMarker(overrides: Partial<AtlasMarker> = {}): AtlasMarker {
    return {
        categoryId: 'dining',
        description: 'A taco stand worth the detour',
        id: 1,
        isStarred: false,
        journeyId: '2025_1_austin',
        lat: 30.3,
        lng: -97.7,
        name: 'Taco Stand',
        stopNumber: 1,
        ...overrides,
    };
}

function buildModifierEvent(overrides: Partial<ModifierEvent> = {}): ModifierEvent {
    return { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...overrides };
}

describe('findJourney', () => {
    test('returns null for a marker without a journey', () => {
        const journey = buildJourney();

        expect(findJourney(buildMarker({ journeyId: null }), { [journey.id]: journey })).toBeNull();
    });

    test('returns null when the marker points at an unknown journey', () => {
        expect(findJourney(buildMarker({ journeyId: 'missing' }), {})).toBeNull();
    });

    test('returns the journey matching the marker journey id', () => {
        const journey = buildJourney();

        expect(findJourney(buildMarker({ journeyId: journey.id }), { [journey.id]: journey })).toBe(journey);
    });
});

describe('getAccentBorder', () => {
    test('mixes twenty-eight percent of the color into snow', () => {
        expect(getAccentBorder(ACCENT_COLOR)).toBe(`color-mix(in oklab, ${ACCENT_COLOR} 28%, var(--color-snow))`);
    });
});

describe('getAccentForeground', () => {
    test('mixes fifty-four percent of the color into ink', () => {
        expect(getAccentForeground(ACCENT_COLOR)).toBe(`color-mix(in oklab, ${ACCENT_COLOR} 54%, var(--color-ink))`);
    });
});

describe('getAccentSurface', () => {
    test('mixes ten percent of the color into snow', () => {
        expect(getAccentSurface(ACCENT_COLOR)).toBe(`color-mix(in oklab, ${ACCENT_COLOR} 10%, var(--color-snow))`);
    });
});

describe('getCategoryColor', () => {
    test('returns the palette color for each known category', () => {
        for (const [categoryId, color] of Object.entries(CATEGORY_COLORS)) {
            expect(getCategoryColor(categoryId), categoryId).toBe(color);
        }
    });

    test('falls back to storm for an unknown category', () => {
        expect(getCategoryColor('harbor')).toBe(FALLBACK_COLOR);
        expect(getCategoryColor('')).toBe(FALLBACK_COLOR);
    });
});

describe('getJourneysById', () => {
    test('keys each journey by its id', () => {
        const first = buildJourney();
        const second = buildJourney({ id: '2024_2_kyoto', name: 'Kyoto', year: 2024 });

        expect(getJourneysById([first, second])).toEqual({ [first.id]: first, [second.id]: second });
    });

    test('returns an empty record for no journeys', () => {
        expect(getJourneysById([])).toEqual({});
    });
});

describe('getPageCount', () => {
    test('returns one page for zero markers', () => {
        expect(getPageCount(0)).toBe(1);
    });

    test('returns the exact quotient for a multiple of the page size', () => {
        expect(getPageCount(CARDS_PER_PAGE * 3)).toBe(3);
    });

    test('rounds a remainder up to an extra page', () => {
        expect(getPageCount(CARDS_PER_PAGE + 1)).toBe(2);
        expect(getPageCount(CARDS_PER_PAGE - 1)).toBe(1);
    });
});

describe('isModifiedEvent', () => {
    test('returns true when any single modifier is held', () => {
        for (const key of MODIFIER_KEYS) {
            expect(isModifiedEvent(buildModifierEvent({ [key]: true })), key).toBe(true);
        }
    });

    test('returns false without modifiers', () => {
        expect(isModifiedEvent(buildModifierEvent())).toBe(false);
    });
});

describe('sanitizeSearch', () => {
    test('strips every search shortcut character', () => {
        expect(sanitizeSearch(`${SEARCH_SHORTCUT}ta${SEARCH_SHORTCUT}cos${SEARCH_SHORTCUT}`)).toBe('tacos');
    });

    test('caps the value at the length limit', () => {
        expect(sanitizeSearch('a'.repeat(SEARCH_LENGTH_LIMIT + 5))).toBe('a'.repeat(SEARCH_LENGTH_LIMIT));
    });

    test('caps only after stripping the shortcut', () => {
        expect(sanitizeSearch(`${SEARCH_SHORTCUT}a`.repeat(SEARCH_LENGTH_LIMIT))).toBe('a'.repeat(SEARCH_LENGTH_LIMIT));
    });

    test('leaves a short clean value untouched', () => {
        expect(sanitizeSearch('tacos')).toBe('tacos');
    });
});
