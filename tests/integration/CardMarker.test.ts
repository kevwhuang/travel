import { createElement, isValidElement } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import CardMarker from '../../src/components/CardMarker';
import { STAR_COLOR, STAR_LABEL } from '../../src/lib/constants';
import { getAccentBorder, getAccentForeground, getAccentSurface, getCategoryColor } from '../../src/lib/utils';

import type { ReactElement, ReactNode } from 'react';

type CardMarkerProps = Parameters<typeof CardMarker>[0];

interface ActionButtonProps {
    children?: ReactNode;
    onClick?: () => void;
}

const COORDINATE_CASES = [
    { lat: 30.4, lng: 120.5, text: '30.40\u00B0N \u00B7 120.50\u00B0E' },
    { lat: 30.4, lng: -120.5, text: '30.40\u00B0N \u00B7 120.50\u00B0W' },
    { lat: -30.4, lng: 120.5, text: '30.40\u00B0S \u00B7 120.50\u00B0E' },
    { lat: -30.4, lng: -120.5, text: '30.40\u00B0S \u00B7 120.50\u00B0W' },
] as const;

const UNORDERED_LABEL = 'Unordered journey \u2014 no itinerary position';

function buildJourney(overrides: Partial<AtlasJourney> = {}): AtlasJourney {
    return {
        id: '2024_2_kyoto',
        isOrdered: true,
        markerCount: 8,
        name: 'Kyoto in Autumn',
        order: 2,
        year: 2024,
        ...overrides,
    };
}

function buildMarker(overrides: Partial<AtlasMarker> = {}): AtlasMarker {
    return {
        categoryId: 'dining',
        description: 'Hand-pulled noodles beside the canal.',
        id: 7,
        isStarred: false,
        journeyId: '2024_2_kyoto',
        lat: 35.01,
        lng: 135.77,
        name: 'Nishiki Market',
        stopNumber: 3,
        ...overrides,
    };
}

function buildProps(overrides: Partial<CardMarkerProps> = {}): CardMarkerProps {
    return {
        categoryLabel: 'Dining',
        journey: buildJourney(),
        marker: buildMarker(),
        onClose: vi.fn(),
        onShowInCards: vi.fn(),
        onShowOnMap: vi.fn(),
        ...overrides,
    };
}

function collectButtons(node: ReactNode): ReactElement<ActionButtonProps>[] {
    if (Array.isArray(node)) return node.flatMap(child => collectButtons(child as ReactNode));

    if (!isValidElement(node)) return [];

    const element = node as ReactElement<ActionButtonProps>;

    const nested = collectButtons(element.props.children);

    return element.type === 'button' ? [element, ...nested] : nested;
}

function renderCard(overrides: Partial<CardMarkerProps> = {}) {
    return renderToStaticMarkup(createElement(CardMarker, buildProps(overrides)));
}

describe('CardMarker', () => {
    test('renders the lifted grid frame by default', () => {
        const html = renderCard();

        expect(html).toContain('atlas-card atlas-card--lift');
        expect(html).toContain('transition-[box-shadow]');
        expect(html).toContain('max-h-[5lh]');
        expect(html).not.toContain('atlas-rise');
    });

    test('renders the popup frame when shown as a popup', () => {
        const html = renderCard({ isPopup: true });

        expect(html).toContain('atlas-rise');
        expect(html).toContain('shadow-[0_18px_44px_var(--color-ink-20)]');
        expect(html).not.toContain('atlas-card--lift');
        expect(html).not.toContain('max-h-[5lh]');
    });

    test('tags the wrapper with the marker id', () => {
        const marker = buildMarker();

        expect(renderCard({ marker })).toContain(`data-marker-id="${marker.id}"`);
    });

    test('labels the category badge from the label prop', () => {
        const categoryLabel = 'Panoramas';

        const html = renderCard({ categoryLabel });

        expect(html).toContain(`title="${categoryLabel}"`);
        expect(html).toContain(`>${categoryLabel}</span>`);
    });

    test('washes a starred card in the star accent with an icon and label', () => {
        const html = renderCard({ marker: buildMarker({ isStarred: true }) });

        expect(html).toContain(`background:${getAccentSurface(STAR_COLOR)}`);
        expect(html).toContain(`border-color:${getAccentBorder(STAR_COLOR)}`);
        expect(html).toContain(`fill="${getAccentForeground(STAR_COLOR)}"`);
        expect(html).toContain(`<span class="sr-only">${STAR_LABEL}</span>`);
    });

    test('leaves an unstarred card without the star treatment', () => {
        const html = renderCard();

        expect(html).not.toContain(STAR_COLOR);
        expect(html).not.toContain(STAR_LABEL);
    });

    test('numbers the stop badge within an ordered journey', () => {
        const journey = buildJourney();
        const marker = buildMarker();

        const html = renderCard({ journey, marker });

        const stopLabel = `Stop ${marker.stopNumber} of ${journey.markerCount}`;

        expect(html).toContain(`aria-label="${stopLabel}"`);
        expect(html).toContain('role="img"');
        expect(html).toContain(`title="${stopLabel}"`);
        expect(html).toContain(`>${marker.stopNumber}</span>`);
    });

    test('marks an unordered journey with a dashed placeholder badge', () => {
        const html = renderCard({ journey: buildJourney({ isOrdered: false }), marker: buildMarker({ stopNumber: 0 }) });

        expect(html).toContain(`aria-label="${UNORDERED_LABEL}"`);
        expect(html).toContain('border-dashed');
        expect(html).toContain('role="img"');
        expect(html).not.toContain('Stop ');
    });

    test('renders the marker description in both frames', () => {
        const marker = buildMarker();

        expect(renderCard({ marker })).toMatch(new RegExp(`max-h-\\[5lh\\][^>]*>${marker.description}</p>`));
        expect(renderCard({ isPopup: true, marker })).toMatch(new RegExp(`<p class="leading-[^>]*>${marker.description}</p>`));
    });

    test('formats coordinates for every hemisphere pair', () => {
        for (const { lat, lng, text } of COORDINATE_CASES) {
            expect(renderCard({ marker: buildMarker({ lat, lng }) }), text).toContain(`>${text}</p>`);
        }
    });

    test('renders the journey footer with the year as a time element', () => {
        const journey = buildJourney();

        const html = renderCard({ journey });

        expect(html).toContain(`title="${journey.name}"`);
        expect(html).toContain(`>${journey.name}</span>`);
        expect(html).toContain(`dateTime="${journey.year}">${journey.year}</time>`);
    });

    test('omits the journey footer for a journeyless marker', () => {
        const html = renderCard({ journey: null, marker: buildMarker({ journeyId: null }) });

        expect(html).not.toContain('<time');
        expect(html).not.toContain('border-linen');
        expect(html).not.toContain('role="img"');
    });

    test('renders each action button only alongside its handler', () => {
        const html = renderCard();

        expect(html.split('<button').length - 1).toBe(3);
        expect(html).toContain('aria-label="Show on map"');
        expect(html).toContain('aria-label="Show in cards"');
        expect(html).toContain('aria-label="Close"');

        const mapOnly = renderCard({ onClose: undefined, onShowInCards: undefined });

        expect(mapOnly.split('<button').length - 1).toBe(1);
        expect(mapOnly).toContain('aria-label="Show on map"');

        const bare = renderCard({ onClose: undefined, onShowInCards: undefined, onShowOnMap: undefined });

        expect(bare).not.toContain('<button');
    });

    test('skews action hit areas away from the close button when it is present', () => {
        const withClose = renderCard();

        expect(withClose.split('after:left-[-16px]').length - 1).toBe(2);
        expect(withClose).not.toContain('after:inset-[-12px]');

        const withoutClose = renderCard({ onClose: undefined });

        expect(withoutClose.split('after:inset-[-12px]').length - 1).toBe(2);
        expect(withoutClose).not.toContain('after:left-[-16px]');
    });

    test('rings a highlighted card in its category color', () => {
        const marker = buildMarker();

        const html = renderCard({ isHighlighted: true, marker });

        expect(html).toContain(`box-shadow:0 0 0 4px color-mix(in oklab, ${getCategoryColor(marker.categoryId)} 45%, transparent)`);
        expect(renderCard({ marker })).toContain('box-shadow:0 0 0 0 transparent');
    });

    test('wires every action button to its handler', () => {
        const props = buildProps();

        const buttons = collectButtons(CardMarker(props));

        expect(buttons).toHaveLength(3);

        buttons[0].props.onClick?.();
        buttons[1].props.onClick?.();
        buttons[2].props.onClick?.();

        expect(props.onShowOnMap).toHaveBeenCalledWith(props.marker);
        expect(props.onShowInCards).toHaveBeenCalledWith(props.marker);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });
});
