import { createElement, isValidElement } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import Overlay from '../../src/components/Overlay';
import { COPYRIGHT_MARK, CREDIT_MAP, SEARCH_LENGTH_LIMIT, SEARCH_SHORTCUT } from '../../src/lib/constants';

import type { ReactElement, ReactNode } from 'react';

type OverlayProps = Parameters<typeof Overlay>[0];

interface KeyEventStub {
    currentTarget: { blur: ReturnType<typeof vi.fn> };
    key: string;
    nativeEvent: { isComposing: boolean };
    preventDefault: ReturnType<typeof vi.fn>;
}

interface TreeProps {
    children?: ReactNode;
    onBlur?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onClick?: () => void;
    onFocus?: () => void;
    onKeyDown?: (event: KeyEventStub) => void;
}

const CREDIT_YEAR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric' }).format(new Date());

function buildKeyEvent(key: string, isComposing = false): KeyEventStub {
    return {
        currentTarget: { blur: vi.fn() },
        key,
        nativeEvent: { isComposing },
        preventDefault: vi.fn(),
    };
}

function buildProps(overrides: Partial<OverlayProps> = {}): OverlayProps {
    return {
        filterButtonRef: { current: null },
        filterCount: 0,
        isSearchExpanded: false,
        onClearSearch: vi.fn(),
        onOpenFilters: vi.fn(),
        onSearchBlur: vi.fn(),
        onSearchChange: vi.fn(),
        onSearchFocus: vi.fn(),
        onToggleView: vi.fn(),
        searchButtonRef: { current: null },
        searchInputRef: { current: null },
        searchValue: '',
        view: 'map',
        ...overrides,
    };
}

function collectByType(node: ReactNode, type: string): ReactElement<TreeProps>[] {
    if (Array.isArray(node)) return node.flatMap(child => collectByType(child as ReactNode, type));

    if (!isValidElement(node)) return [];

    const element = node as ReactElement<TreeProps>;

    const nested = collectByType(element.props.children, type);

    return element.type === type ? [element, ...nested] : nested;
}

function renderOverlay(overrides: Partial<OverlayProps> = {}) {
    return renderToStaticMarkup(createElement(Overlay, buildProps(overrides)));
}

describe('Overlay', () => {
    test('labels the filter button without a badge by default', () => {
        const html = renderOverlay();

        expect(html).toContain('aria-haspopup="dialog" aria-label="Open filters" type="button"');
        expect(html).not.toContain('atlas-control--active');
        expect(html).not.toContain('rounded-full font-mono');
    });

    test('counts active filters in the button label and badge', () => {
        const html = renderOverlay({ filterCount: 3 });

        expect(html).toContain('atlas-control atlas-control--active');
        expect(html).toContain('aria-label="Open filters, 3 active"');
        expect(html).toContain('bg-paper text-ink">3</span>');
    });

    test('expands the search region only while search is expanded', () => {
        const expandedHtml = renderOverlay({ isSearchExpanded: true });
        const html = renderOverlay();

        expect(html).toContain('<search class="atlas-control ');
        expect(html).not.toContain('atlas-control--open');
        expect(expandedHtml).toContain('atlas-control--open');
    });

    test('swaps the search toggle between search and clear by value', () => {
        const clearableHtml = renderOverlay({ searchValue: 'Uxmal' });
        const html = renderOverlay();

        expect(html).toContain('aria-label="Search markers"');
        expect(html).not.toContain('aria-label="Clear search"');
        expect(html).not.toContain('border-ink');
        expect(clearableHtml).toContain('aria-label="Clear search"');
        expect(clearableHtml).not.toContain('aria-label="Search markers"');
        expect(clearableHtml).toContain('border-ink');
        expect(renderOverlay({ searchValue: '  ' })).toContain('aria-label="Search markers"');
    });

    test('caps the search input and reflects the current value', () => {
        const html = renderOverlay();

        expect(html).toContain('autoComplete="off"');
        expect(html).toContain(`maxLength="${SEARCH_LENGTH_LIMIT}"`);
        expect(html).toContain('placeholder="Search\u2026"');
        expect(html).toContain('value=""');
        expect(renderOverlay({ searchValue: 'Uxmal' })).toContain('value="Uxmal"');
    });

    test('labels the search input for screen readers only', () => {
        const html = renderOverlay();

        expect(html).toContain('<span class="sr-only">Search markers by name</span>');
    });

    test('credits the map source and site owner with the current year', () => {
        const html = renderOverlay();

        expect(CREDIT_YEAR).toMatch(/^\d{4}$/);
        expect(html.split(COPYRIGHT_MARK).length - 1).toBe(2);
        expect(html).toContain(`${COPYRIGHT_MARK}</span> ${CREDIT_MAP}`);
        expect(html).toContain(`<time dateTime="${CREDIT_YEAR}">${CREDIT_YEAR}</time>`);
        expect(html).toContain('href="https://aephonics.com" rel="noreferrer" target="_blank"');
        expect(html).toContain('>Aephonics</a>');
    });

    test('switches the view toggle between cards and map', () => {
        const cardsHtml = renderOverlay({ view: 'cards' });
        const html = renderOverlay();

        expect(html).toContain('aria-label="Switch to cards"');
        expect(html).toContain('>Cards</span>');
        expect(html).not.toContain('>Map</span>');
        expect(cardsHtml).toContain('aria-label="Switch to map"');
        expect(cardsHtml).toContain('>Map</span>');
        expect(cardsHtml).not.toContain('>Cards</span>');
    });

    test('wires the filter and view controls to their handlers', () => {
        const props = buildProps();

        const buttons = collectByType(Overlay(props), 'button');

        expect(buttons).toHaveLength(3);

        buttons[0].props.onClick?.();
        buttons[2].props.onClick?.();

        expect(props.onOpenFilters).toHaveBeenCalledTimes(1);
        expect(props.onToggleView).toHaveBeenCalledTimes(1);
    });

    test('sanitizes the typed value before reporting a change', () => {
        const props = buildProps();

        const inputs = collectByType(Overlay(props), 'input');

        expect(inputs).toHaveLength(1);

        inputs[0].props.onChange?.({ target: { value: '/uxm/al' } });
        inputs[0].props.onChange?.({ target: { value: 'x'.repeat(SEARCH_LENGTH_LIMIT + 5) } });

        expect(props.onSearchChange).toHaveBeenNthCalledWith(1, 'uxmal');
        expect(props.onSearchChange).toHaveBeenNthCalledWith(2, 'x'.repeat(SEARCH_LENGTH_LIMIT));
    });

    test('reports focus and blur from the search input', () => {
        const props = buildProps();

        const inputs = collectByType(Overlay(props), 'input');

        expect(inputs).toHaveLength(1);

        inputs[0].props.onFocus?.();

        expect(props.onSearchFocus).toHaveBeenCalledTimes(1);
        expect(props.onSearchBlur).not.toHaveBeenCalled();

        inputs[0].props.onBlur?.();

        expect(props.onSearchBlur).toHaveBeenCalledTimes(1);
    });

    test('intercepts the shortcut key and blurs on enter outside composition', () => {
        const composingEvent = buildKeyEvent('Enter', true);
        const enterEvent = buildKeyEvent('Enter');
        const shortcutEvent = buildKeyEvent(SEARCH_SHORTCUT);

        const inputs = collectByType(Overlay(buildProps()), 'input');

        expect(inputs).toHaveLength(1);

        inputs[0].props.onKeyDown?.(shortcutEvent);

        expect(shortcutEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(shortcutEvent.currentTarget.blur).not.toHaveBeenCalled();

        inputs[0].props.onKeyDown?.(enterEvent);

        expect(enterEvent.currentTarget.blur).toHaveBeenCalledTimes(1);
        expect(enterEvent.preventDefault).toHaveBeenCalledTimes(1);

        inputs[0].props.onKeyDown?.(composingEvent);

        expect(composingEvent.currentTarget.blur).not.toHaveBeenCalled();
        expect(composingEvent.preventDefault).not.toHaveBeenCalled();
    });

    test('clears or refocuses the search from the toggle depending on state', () => {
        const clearableProps = buildProps({ searchValue: 'Uxmal' });
        const props = buildProps();

        const [, clearToggle] = collectByType(Overlay(clearableProps), 'button');
        const [, searchToggle] = collectByType(Overlay(props), 'button');

        searchToggle.props.onClick?.();

        expect(props.onSearchFocus).toHaveBeenCalledTimes(1);
        expect(props.onClearSearch).not.toHaveBeenCalled();

        clearToggle.props.onClick?.();

        expect(clearableProps.onClearSearch).toHaveBeenCalledTimes(1);
        expect(clearableProps.onSearchFocus).not.toHaveBeenCalled();
    });
});
