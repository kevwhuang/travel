import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconPin from '../../src/components/IconPin';

type IconProps = Parameters<typeof IconPin>[0];

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconPin, { size: 18, strokeWidth: 2, ...overrides }));
}

describe('IconPin', () => {
    test('renders an unfilled svg hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg aria-hidden="true"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('width="18"');
    });

    test('draws the teardrop outline with its center dot in the current color', () => {
        const html = renderIcon();

        expect(html.split('<path').length - 1).toBe(1);
        expect(html.split('<circle').length - 1).toBe(1);
        expect(html).toContain('stroke="currentColor"');
        expect(html).toContain('stroke-linecap="round"');
        expect(html).toContain('<path d="M12 21c-4.2-3.8-6.3-7-6.3-9.7a6.3 6.3 0 1 1 12.6 0C18.3 14 16.2 17.2 12 21z"');
        expect(html).toContain('<circle cx="12" cy="11.2" r="2.2"');
    });

    test('scales to the size and stroke width props', () => {
        const html = renderIcon({ size: 24, strokeWidth: 1.6 });

        expect(html).toContain('height="24"');
        expect(html).toContain('stroke-width="1.6"');
        expect(html).toContain('width="24"');
    });
});
