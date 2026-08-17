import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconFilters from '../../src/components/IconFilters';

type IconProps = Parameters<typeof IconFilters>[0];

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconFilters, { size: 18, strokeWidth: 2, ...overrides }));
}

describe('IconFilters', () => {
    test('renders an unfilled svg hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg aria-hidden="true"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('width="18"');
    });

    test('draws three slider tracks in one rounded path', () => {
        const html = renderIcon();

        expect(html.split('<path').length - 1).toBe(1);
        expect(html).toContain('stroke="currentColor"');
        expect(html).toContain('stroke-linecap="round"');
        expect(html).toContain('<path d="M4 7h4M13 7h7M4 12h9M18 12h2M4 17h2M11 17h9"');
    });

    test('places a knob of equal radius on every track', () => {
        const html = renderIcon();

        expect(html.split('<circle').length - 1).toBe(3);
        expect(html.split('r="2.2"').length - 1).toBe(3);
        expect(html).toContain('<circle cx="10.5" cy="7"');
        expect(html).toContain('<circle cx="15.5" cy="12"');
        expect(html).toContain('<circle cx="8.5" cy="17"');
    });

    test('scales to the size and stroke width props', () => {
        const html = renderIcon({ size: 24, strokeWidth: 1.6 });

        expect(html).toContain('height="24"');
        expect(html).toContain('stroke-width="1.6"');
        expect(html).toContain('width="24"');
    });
});
