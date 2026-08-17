import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconCategory from '../../src/components/IconCategory';
import { CATEGORY_COLORS } from '../../src/lib/constants';

type IconProps = Parameters<typeof IconCategory>[0];

const CATEGORY_IDS = Object.keys(CATEGORY_COLORS);
const UNKNOWN_CATEGORY_ID = 'archipelago';

const [FIRST_CATEGORY_ID] = CATEGORY_IDS;

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconCategory, {
        categoryId: FIRST_CATEGORY_ID,
        color: 'currentColor',
        size: 18,
        ...overrides,
    }));
}

describe('IconCategory', () => {
    test('renders an unfilled svg hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg class="block shrink-0');
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('width="18"');
    });

    test('draws at least one path for every category', () => {
        for (const categoryId of CATEGORY_IDS) {
            const html = renderIcon({ categoryId });

            expect(html.split('<path').length - 1, categoryId).toBeGreaterThan(0);
            expect(html, categoryId).toContain('<path d="M');
        }
    });

    test('draws a distinct mark for every category', () => {
        const marks = new Set(CATEGORY_IDS.map(categoryId => renderIcon({ categoryId })));

        expect(marks.size).toBe(CATEGORY_IDS.length);
    });

    test('draws no paths for an unknown category id', () => {
        const html = renderIcon({ categoryId: UNKNOWN_CATEGORY_ID });

        expect(CATEGORY_IDS).not.toContain(UNKNOWN_CATEGORY_ID);
        expect(html).toContain('<svg');
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toContain('<path');
    });

    test('strokes the mark with rounded joints in the color prop', () => {
        const html = renderIcon({ color: 'var(--color-moss)' });

        expect(html).toContain('stroke="var(--color-moss)"');
        expect(html).toContain('stroke-linecap="round"');
        expect(html).toContain('stroke-linejoin="round"');
        expect(html).toContain('stroke-width="1.9"');
    });

    test('scales to the size prop', () => {
        const html = renderIcon({ size: 24 });

        expect(html).toContain('height="24"');
        expect(html).toContain('width="24"');
    });
});
