import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import Badge from '../../src/components/Badge';
import { CATEGORY_COLORS } from '../../src/lib/constants';
import { getAccentBorder, getAccentForeground, getAccentSurface, getCategoryColor } from '../../src/lib/utils';

type BadgeProps = Parameters<typeof Badge>[0];

const CATEGORY_IDS = Object.keys(CATEGORY_COLORS);
const UNKNOWN_CATEGORY_ID = 'archipelago';

const [FIRST_CATEGORY_ID] = CATEGORY_IDS;

function renderBadge(overrides: Partial<BadgeProps> = {}) {
    return renderToStaticMarkup(createElement(Badge, {
        categoryId: FIRST_CATEGORY_ID,
        label: 'Night Market',
        ...overrides,
    }));
}

describe('Badge', () => {
    test('renders a mono uppercase pill titled with the label', () => {
        const html = renderBadge();

        expect(html).toContain('<span class="inline-flex items-center');
        expect(html).toContain('rounded-full font-mono');
        expect(html).toContain('uppercase');
        expect(html).toContain('title="Night Market"');
    });

    test('truncates the label inside an ellipsis span', () => {
        const html = renderBadge();

        expect(html).toContain('class="overflow-hidden text-ellipsis whitespace-nowrap">Night Market</span>');
    });

    test('embeds the category icon at badge scale in the accent foreground', () => {
        const html = renderBadge();

        const foreground = getAccentForeground(getCategoryColor(FIRST_CATEGORY_ID));

        expect(html).toContain('<svg');
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain('height="12"');
        expect(html).toContain('width="12"');
        expect(html).toContain(`stroke="${foreground}"`);
        expect(html.split('<path').length - 1).toBeGreaterThan(0);
    });

    test('washes the surface, border, and text with each category accent', () => {
        for (const categoryId of CATEGORY_IDS) {
            const html = renderBadge({ categoryId });

            const color = getCategoryColor(categoryId);

            expect(html, categoryId).toContain(`background:${getAccentSurface(color)}`);
            expect(html, categoryId).toContain(`border-color:${getAccentBorder(color)}`);
            expect(html, categoryId).toContain(`color:${getAccentForeground(color)}`);
        }
    });

    test('falls back to the storm accent for an unknown category', () => {
        const html = renderBadge({ categoryId: UNKNOWN_CATEGORY_ID });

        const color = getCategoryColor(UNKNOWN_CATEGORY_ID);

        expect(CATEGORY_IDS).not.toContain(UNKNOWN_CATEGORY_ID);
        expect(html).toContain('var(--color-storm)');
        expect(html).toContain(`background:${getAccentSurface(color)}`);
        expect(html).toContain(`color:${getAccentForeground(color)}`);
        expect(html).not.toContain('<path');
    });
});
