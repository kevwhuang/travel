import { beforeAll, describe, expect, test, vi } from 'vitest';
import { createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ViewCards from '../../src/components/ViewCards';
import { ATLAS_TITLE, CARDS_PER_PAGE, CATEGORY_COLORS } from '../../src/lib/constants';
import { getAtlasData } from '../../src/lib/atlas';
import { getPageCount } from '../../src/lib/utils';

import type { ReactElement, ReactNode } from 'react';

type ViewCardsProps = Parameters<typeof ViewCards>[0];

interface PageButtonProps {
    children?: ReactNode;
    onClick?: () => void;
}

const CLASS_SECTION_GAP = 'mb-[clamp(28px,calc(21.34px+2.084vw),48px)]';

const PAGE_WINDOW_CASES = [
    { absentPages: [6, 7, 8, 9], ellipses: 1, page: 0, visiblePages: [1, 2, 3, 4, 5, 10] },
    { absentPages: [2, 3, 7, 8, 9], ellipses: 2, page: 4, visiblePages: [1, 4, 5, 6, 10] },
    { absentPages: [2, 3, 4, 5], ellipses: 1, page: 9, visiblePages: [1, 6, 7, 8, 9, 10] },
] as const;

const WINDOWED_PAGE_COUNT = 10;

const [FIRST_CATEGORY_ID] = Object.keys(CATEGORY_COLORS);

let atlasData: AtlasData;

function buildMarkers(count: number): AtlasMarker[] {
    return Array.from({ length: count }, (_, index) => ({
        categoryId: FIRST_CATEGORY_ID,
        description: `Stub description ${index + 1}`,
        id: index,
        isStarred: false,
        journeyId: null,
        lat: 10,
        lng: 20,
        name: `Stub marker ${index + 1}`,
        stopNumber: 0,
    }));
}

function buildProps(overrides: Partial<ViewCardsProps> = {}): ViewCardsProps {
    return {
        data: atlasData,
        highlightedMarkerId: null,
        isKeyboardPagingRef: { current: false },
        markers: atlasData.markers,
        onPageChange: vi.fn(),
        onShowOnMap: vi.fn(),
        page: 0,
        ...overrides,
    };
}

function collectButtons(node: ReactNode): ReactElement<PageButtonProps>[] {
    if (Array.isArray(node)) return node.flatMap(child => collectButtons(child as ReactNode));
    if (!isValidElement(node)) return [];

    const element = node as ReactElement<PageButtonProps>;

    const nested = collectButtons(element.props.children);

    return element.type === 'button' ? [element, ...nested] : nested;
}

function getJourneyCount(markers: AtlasMarker[]): number {
    return new Set(markers
        .map(marker => marker.journeyId)
        .filter(journeyId => journeyId !== null)).size;
}

function getJourneyMarker(): AtlasMarker {
    const marker = atlasData.markers.find(candidate => candidate.journeyId !== null);

    if (!marker) throw new Error('Expected a journey-backed marker in content');

    return marker;
}

function renderCards(overrides: Partial<ViewCardsProps> = {}) {
    return renderToStaticMarkup(createElement(ViewCards, buildProps(overrides)));
}

function renderTree(props: ViewCardsProps): ReactNode {
    let tree: ReactNode = null;

    function Probe() {
        tree = ViewCards(props);

        return null;
    }

    renderToStaticMarkup(createElement(Probe));

    return tree;
}

beforeAll(async () => {
    atlasData = await getAtlasData();
});

describe('ViewCards', () => {
    test('renders the atlas heading over a content-derived subline', () => {
        const html = renderCards();

        const journeyCount = getJourneyCount(atlasData.markers);

        expect(journeyCount).toBeGreaterThan(1);
        expect(html).toContain(`>${ATLAS_TITLE}</h1>`);
        expect(html).toContain(`${atlasData.markers.length} markers across ${journeyCount} journeys</p>`);
    });

    test('renders one card per marker up to the page size', () => {
        const html = renderCards();

        expect(html.split('data-marker-id="').length - 1).toBe(Math.min(atlasData.markers.length, CARDS_PER_PAGE));
        expect(html).toContain(`data-marker-id="${atlasData.markers[0].id}"`);
    });

    test('slices the markers for a later page', () => {
        const page = 2;

        const pageStart = page * CARDS_PER_PAGE;

        expect(atlasData.markers.length).toBeGreaterThan(pageStart);

        const html = renderCards({ page });

        expect(html.split('data-marker-id="').length - 1).toBe(Math.min(atlasData.markers.length - pageStart, CARDS_PER_PAGE));
        expect(html).toContain(`data-marker-id="${atlasData.markers[pageStart].id}"`);
        expect(html).not.toContain(`data-marker-id="${atlasData.markers[0].id}"`);
    });

    test('falls back to the raw category id for an unknown category', () => {
        const [marker] = buildMarkers(1);

        const unknownMarker = { ...marker, categoryId: 'uncharted' };

        expect(Object.keys(CATEGORY_COLORS)).not.toContain(unknownMarker.categoryId);
        expect(atlasData.categories.map(category => category.id)).not.toContain(unknownMarker.categoryId);

        const html = renderCards({ markers: [unknownMarker] });

        expect(html).toContain(`title="${unknownMarker.categoryId}"`);
        expect(html).toContain(`>${unknownMarker.categoryId}</span>`);
    });

    test('renders a singular subline for a lone journey marker', () => {
        const html = renderCards({ markers: [getJourneyMarker()] });

        expect(html).toContain('1 marker across 1 journey</p>');
    });

    test('drops the journey clause when no marker has a journey', () => {
        const html = renderCards({ markers: buildMarkers(2) });

        expect(html).toContain('2 markers</p>');
        expect(html).not.toContain('across');
    });

    test('renders only the header when no markers remain', () => {
        const html = renderCards({ markers: [] });

        expect(html).toContain('>0 markers</p>');
        expect(html).not.toContain('<ul');
        expect(html).not.toContain('data-marker-id');
        expect(html).not.toContain('aria-label="Pagination"');
    });

    test('hides pagination when the markers fit one page', () => {
        const html = renderCards({ markers: atlasData.markers.slice(0, CARDS_PER_PAGE) });

        expect(html).not.toContain('aria-label="Pagination"');
        expect(html).not.toContain('aria-label="Page 1"');
    });

    test('spaces the grid above pagination only when paginated', () => {
        const paginated = renderCards({ markers: buildMarkers(CARDS_PER_PAGE * 2) });

        expect(paginated).toContain(`gap-[20px] ${CLASS_SECTION_GAP} mx-auto`);
        expect(paginated.split(CLASS_SECTION_GAP).length - 1).toBe(2);

        const single = renderCards({ markers: buildMarkers(CARDS_PER_PAGE) });

        expect(single).toContain('gap-[20px] mx-auto');
        expect(single.split(CLASS_SECTION_GAP).length - 1).toBe(1);
    });

    test('paginates the full atlas keeping first and last pages present', () => {
        const pageCount = getPageCount(atlasData.markers.length);

        expect(pageCount).toBeGreaterThan(1);

        const html = renderCards();

        expect(html).toContain('aria-label="Pagination"');
        expect(html).toContain('aria-current="page" aria-label="Page 1"');
        expect(html).toContain(`aria-label="Page ${pageCount}"`);
        expect(html.split('aria-current="page"').length - 1).toBe(1);
    });

    test('windows the page slots around the current page behind ellipses', () => {
        const markers = buildMarkers(CARDS_PER_PAGE * WINDOWED_PAGE_COUNT);

        for (const { absentPages, ellipses, page, visiblePages } of PAGE_WINDOW_CASES) {
            const html = renderCards({ markers, page });

            expect(html.split('aria-hidden="true">\u2026</li>').length - 1, `page ${page}`).toBe(ellipses);
            expect(html, `page ${page}`).toContain(`aria-current="page" aria-label="Page ${page + 1}"`);

            for (const pageNumber of visiblePages) {
                expect(html, `page ${page} shows ${pageNumber}`).toContain(`aria-label="Page ${pageNumber}"`);
            }

            for (const pageNumber of absentPages) {
                expect(html, `page ${page} hides ${pageNumber}`).not.toContain(`aria-label="Page ${pageNumber}"`);
            }
        }
    });

    test('solidifies only the current page button', () => {
        const html = renderCards({ markers: buildMarkers(CARDS_PER_PAGE * WINDOWED_PAGE_COUNT), page: 4 });

        const pageButtonCount = html.split('aria-label="Page ').length - 1;

        expect(pageButtonCount).toBeGreaterThan(1);
        expect(html).toMatch(/class="pill pill--solid [^"]*" aria-current="page"/);
        expect(html.split('pill--solid').length - 1).toBe(1);
        expect(html.split('bg-snow text-ink').length - 1).toBe(pageButtonCount - 1);
    });

    test('wires the first and last page buttons to the page change handler', () => {
        const props = buildProps({ markers: buildMarkers(CARDS_PER_PAGE * 3) });

        const buttons = collectButtons(renderTree(props));

        expect(buttons).toHaveLength(3);

        buttons[0].props.onClick?.();
        buttons[2].props.onClick?.();

        expect(props.onPageChange).toHaveBeenNthCalledWith(1, 0);
        expect(props.onPageChange).toHaveBeenNthCalledWith(2, 2);
        expect(props.onPageChange).toHaveBeenCalledTimes(2);
    });
});
