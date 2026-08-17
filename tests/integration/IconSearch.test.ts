import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconSearch from '../../src/components/IconSearch';

type IconProps = Parameters<typeof IconSearch>[0];

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconSearch, { size: 18, strokeWidth: 2, ...overrides }));
}

describe('IconSearch', () => {
    test('renders an unfilled svg hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg aria-hidden="true"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('width="18"');
    });

    test('draws the lens and its handle in the current color', () => {
        const html = renderIcon();

        expect(html.split('<circle').length - 1).toBe(1);
        expect(html.split('<path').length - 1).toBe(1);
        expect(html).toContain('stroke="currentColor"');
        expect(html).toContain('stroke-linecap="round"');
        expect(html).toContain('<circle cx="11" cy="11" r="6.5"');
        expect(html).toContain('<path d="M16 16l4.5 4.5"');
    });

    test('scales to the size and stroke width props', () => {
        const html = renderIcon({ size: 24, strokeWidth: 1.6 });

        expect(html).toContain('height="24"');
        expect(html).toContain('stroke-width="1.6"');
        expect(html).toContain('width="24"');
    });
});
