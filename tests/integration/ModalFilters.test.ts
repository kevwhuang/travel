import { beforeAll, describe, expect, test, vi } from 'vitest';
import { createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ModalFilters from '../../src/components/ModalFilters';
import { STAR_COLOR } from '../../src/lib/constants';
import { getAccentForeground, getCategoryColor } from '../../src/lib/utils';
import { getAtlasData } from '../../src/lib/atlas';

import type { ReactElement, ReactNode } from 'react';

type ModalFiltersProps = Parameters<typeof ModalFilters>[0];

interface ChipProps {
    children?: ReactNode;
    onClick?: () => void;
}

let atlasData: AtlasData;

function buildProps(overrides: Partial<ModalFiltersProps> = {}): ModalFiltersProps {
    return {
        categories: atlasData.categories,
        filterCount: 0,
        isStarredOnly: false,
        journeys: atlasData.journeys,
        onClearAll: vi.fn(),
        onClose: vi.fn(),
        onToggleCategory: vi.fn(),
        onToggleJourney: vi.fn(),
        onToggleStarred: vi.fn(),
        selectedCategoryIds: [],
        selectedJourneyIds: [],
        shownCount: atlasData.markers.length,
        totalCount: atlasData.markers.length,
        ...overrides,
    };
}

function collectButtons(node: ReactNode): ReactElement<ChipProps>[] {
    if (Array.isArray(node)) return node.flatMap(child => collectButtons(child as ReactNode));

    if (!isValidElement(node)) return [];

    const element = node as ReactElement<ChipProps>;

    const nested = collectButtons(element.props.children);

    return element.type === 'button' ? [element, ...nested] : nested;
}

function getChipStyleAttribute(color: string) {
    return `style="background:color-mix(in oklab, ${color} 13%, var(--color-snow));border-color:color-mix(in oklab, ${color} 55%, var(--color-snow));color:${getAccentForeground(color)}"`;
}

function getJourneyChipOrder() {
    const visibleJourneys = atlasData.journeys.filter(journey => journey.markerCount > 0);

    const years = [...new Set(visibleJourneys.map(journey => journey.year))].sort((first, second) => second - first);

    return years.flatMap(year => visibleJourneys
        .filter(journey => journey.year === year)
        .sort((first, second) => second.order - first.order));
}

function renderModal(overrides: Partial<ModalFiltersProps> = {}): string {
    return renderToStaticMarkup(createElement(ModalFilters, buildProps(overrides)));
}

function renderTree(props: ModalFiltersProps): ReactNode {
    let tree: ReactNode = null;

    function CaptureTree() {
        tree = ModalFilters(props);

        return null;
    }

    renderToStaticMarkup(createElement(CaptureTree));

    return tree;
}

beforeAll(async () => {
    atlasData = await getAtlasData();
});

describe('ModalFilters', () => {
    test('renders an accessible modal dialog', () => {
        const html = renderModal();

        expect(html).toContain('<dialog');
        expect(html).toContain('aria-labelledby="modal-filters-title" aria-modal="true" open="" tabindex="-1"');
        expect(html).toContain('<h2 id="modal-filters-title"');
        expect(html).toContain('>Filters</h2>');
    });

    test('renders the starred chip unpressed by default', () => {
        const html = renderModal();

        expect(html).toContain('aria-pressed="false" title="Show starred markers only"');
        expect(html).toContain('Starred</button>');
        expect(html).not.toContain(getChipStyleAttribute(STAR_COLOR));
    });

    test('presses and tints the starred chip while starred only is active', () => {
        const html = renderModal({ filterCount: 1, isStarredOnly: true });

        expect(getChipStyleAttribute(STAR_COLOR)).toContain('background:color-mix(in oklab, var(--color-gold) 13%');
        expect(getChipStyleAttribute(STAR_COLOR)).toContain('border-color:color-mix(in oklab, var(--color-gold) 55%');
        expect(html.split('aria-pressed="true"').length - 1).toBe(1);
        expect(html).toContain(`aria-pressed="true" ${getChipStyleAttribute(STAR_COLOR)} title="Show starred markers only"`);
    });

    test('renders a chip for every category with its description as the title', () => {
        const html = renderModal();

        expect(atlasData.categories.length).toBeGreaterThan(0);
        expect(html.split('aria-pressed').length - 1).toBe(atlasData.categories.length + getJourneyChipOrder().length + 1);

        for (const category of atlasData.categories) {
            expect(html, category.id).toContain(`aria-pressed="false" title="${category.description}"`);
            expect(html, category.id).toContain(`${category.name}</button>`);
        }
    });

    test('presses and tints a selected category chip', () => {
        const [category] = atlasData.categories;

        const html = renderModal({ filterCount: 1, selectedCategoryIds: [category.id] });

        expect(html.split('aria-pressed="true"').length - 1).toBe(1);
        expect(html).toContain(`aria-pressed="true" ${getChipStyleAttribute(getCategoryColor(category.id))} title="${category.description}"`);
    });

    test('tints chip icons with the accent only while pressed', () => {
        const [category] = atlasData.categories;

        const categoryHtml = renderModal({ filterCount: 1, selectedCategoryIds: [category.id] });
        const html = renderModal();
        const starredHtml = renderModal({ filterCount: 1, isStarredOnly: true });

        expect(html).toContain('fill="var(--color-storm)"');
        expect(html).not.toContain(`fill="${getAccentForeground(STAR_COLOR)}"`);
        expect(html.split('stroke="var(--color-storm)"').length - 1).toBe(atlasData.categories.length);
        expect(starredHtml).toContain(`fill="${getAccentForeground(STAR_COLOR)}"`);
        expect(starredHtml).not.toContain('fill="var(--color-storm)"');
        expect(categoryHtml).toContain(`stroke="${getAccentForeground(getCategoryColor(category.id))}"`);
        expect(categoryHtml.split('stroke="var(--color-storm)"').length - 1).toBe(atlasData.categories.length - 1);
    });

    test('groups journeys by year in descending order', () => {
        const html = renderModal();
        const years = [...new Set(getJourneyChipOrder().map(journey => journey.year))];

        expect(years.length).toBeGreaterThan(1);

        let previousIndex = -1;

        for (const year of years) {
            const index = html.indexOf(`<time dateTime="${year}">${year}</time>`);

            expect(index, String(year)).toBeGreaterThan(previousIndex);
            previousIndex = index;
        }
    });

    test('orders journeys within a year by descending order number', () => {
        const chipOrder = getJourneyChipOrder();
        const html = renderModal();
        const year = [...new Set(chipOrder.map(journey => journey.year))].find(candidate => chipOrder.filter(journey => journey.year === candidate).length > 1);

        expect(year).toBeDefined();

        let previousIndex = -1;

        for (const journey of chipOrder.filter(candidate => candidate.year === year)) {
            const index = html.indexOf(`>${journey.name}</span>`);

            expect(index, journey.id).toBeGreaterThan(previousIndex);
            previousIndex = index;
        }
    });

    test('hides journeys without markers', () => {
        const hiddenJourneys = atlasData.journeys.filter(journey => journey.markerCount === 0);
        const html = renderModal();

        expect(hiddenJourneys.length).toBeGreaterThan(0);
        expect(html.split('self-baseline font-serif').length - 1).toBe(getJourneyChipOrder().length);

        for (const journey of hiddenJourneys) {
            expect(html, journey.id).not.toContain(journey.name);
        }
    });

    test('pairs a journey chip name with its hidden marker count', () => {
        const [journey] = getJourneyChipOrder();

        const html = renderModal();

        expect(html).toContain(`<span class="self-baseline font-serif text-[14px]">${journey.name}</span><span class="self-baseline font-mono text-[10px] opacity-[0.85]" aria-hidden="true">${journey.markerCount}</span>`);
    });

    test('titles journey chips with their marker count and ordering', () => {
        const chipOrder = getJourneyChipOrder();
        const html = renderModal();

        const orderedJourney = chipOrder.find(journey => journey.isOrdered);
        const unorderedJourney = chipOrder.find(journey => !journey.isOrdered);

        expect(orderedJourney?.id).toBeDefined();
        expect(unorderedJourney?.id).toBeDefined();
        expect(html).toContain(`title="${orderedJourney?.markerCount} markers, ordered itinerary"`);
        expect(html).toContain(`title="${unorderedJourney?.markerCount} markers, unordered"`);
        expect(html).toContain('atlas-chip atlas-chip--dashed');
    });

    test('presses and marks a selected journey chip', () => {
        const [journey] = getJourneyChipOrder();

        const html = renderModal({ filterCount: 1, selectedJourneyIds: [journey.id] });

        expect(html.split('aria-pressed="true"').length - 1).toBe(1);
        expect(html.split('atlas-chip--selected').length - 1).toBe(1);
        expect(html).toMatch(new RegExp(`atlas-chip--selected[^>]*" aria-pressed="true" title="${journey.markerCount} markers`));
    });

    test('summarizes shown markers in the footer', () => {
        const filteredHtml = renderModal({ shownCount: 12 });
        const html = renderModal();

        expect(atlasData.markers.length).toBeGreaterThan(0);
        expect(html).toContain(`>Showing ${atlasData.markers.length} of ${atlasData.markers.length}.</span>`);
        expect(filteredHtml).toContain(`>Showing 12 of ${atlasData.markers.length}.</span>`);
    });

    test('disables clear until a filter is active', () => {
        const filteredHtml = renderModal({ filterCount: 2 });
        const html = renderModal();

        expect(html.split('disabled=""').length - 1).toBe(1);
        expect(html).toContain('>Clear</button>');
        expect(html).toContain('>Done</button>');
        expect(filteredHtml).not.toContain('disabled=""');
    });

    test('wires a chip of each kind and the footer actions to their handlers', () => {
        const chipOrder = getJourneyChipOrder();
        const props = buildProps({ filterCount: 1 });

        const buttons = collectButtons(renderTree(props));

        expect(buttons).toHaveLength(atlasData.categories.length + chipOrder.length + 3);

        buttons[0].props.onClick?.();
        buttons[1].props.onClick?.();
        buttons[1 + atlasData.categories.length].props.onClick?.();
        buttons[buttons.length - 2].props.onClick?.();
        buttons[buttons.length - 1].props.onClick?.();

        expect(props.onToggleStarred).toHaveBeenCalledTimes(1);
        expect(props.onToggleCategory).toHaveBeenCalledWith(atlasData.categories[0].id);
        expect(props.onToggleJourney).toHaveBeenCalledWith(chipOrder[0].id);
        expect(props.onClearAll).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });
});
