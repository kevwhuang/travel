import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconGrid from '../../src/components/IconGrid';

type IconProps = Parameters<typeof IconGrid>[0];

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconGrid, { size: 18, strokeWidth: 2, ...overrides }));
}

describe('IconGrid', () => {
    test('renders an unfilled svg hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg aria-hidden="true"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('width="18"');
    });

    test('draws four equally rounded square cells in the current color', () => {
        const html = renderIcon();

        expect(html.split('<rect').length - 1).toBe(4);
        expect(html.split('rx="1.4"').length - 1).toBe(4);
        expect(html.split('height="7"').length - 1).toBe(4);
        expect(html.split('width="7"').length - 1).toBe(4);
        expect(html).toContain('stroke="currentColor"');
        expect(html).not.toContain('<path');
    });

    test('positions one cell in each corner of the grid', () => {
        const html = renderIcon();

        expect(html).toContain('x="4" y="4"');
        expect(html).toContain('x="13" y="4"');
        expect(html).toContain('x="4" y="13"');
        expect(html).toContain('x="13" y="13"');
    });

    test('scales to the size and stroke width props', () => {
        const html = renderIcon({ size: 24, strokeWidth: 1.6 });

        expect(html).toContain('height="24"');
        expect(html).toContain('stroke-width="1.6"');
        expect(html).toContain('width="24"');
    });
});
