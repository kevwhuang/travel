import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconNorth from '../../src/components/IconNorth';

type IconProps = Parameters<typeof IconNorth>[0];

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconNorth, { size: 18, strokeWidth: 2, ...overrides }));
}

describe('IconNorth', () => {
    test('renders an unfilled svg hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg aria-hidden="true"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('width="18"');
    });

    test('draws the needle shaft and arrowhead in the current color', () => {
        const html = renderIcon();

        expect(html.split('<path').length - 1).toBe(2);
        expect(html).toContain('stroke="currentColor"');
        expect(html).toContain('stroke-linecap="round"');
        expect(html).toContain('stroke-linejoin="round"');
        expect(html).toContain('<path d="M12 20V7"');
        expect(html).toContain('<path d="M8.5 10.5L12 4l3.5 6.5"');
    });

    test('scales to the size and stroke width props', () => {
        const html = renderIcon({ size: 24, strokeWidth: 1.6 });

        expect(html).toContain('height="24"');
        expect(html).toContain('stroke-width="1.6"');
        expect(html).toContain('width="24"');
    });
});
