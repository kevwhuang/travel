import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconClose from '../../src/components/IconClose';

type IconProps = Parameters<typeof IconClose>[0];

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconClose, { size: 18, strokeWidth: 2, ...overrides }));
}

describe('IconClose', () => {
    test('renders an unfilled svg hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg aria-hidden="true"');
        expect(html).toContain('fill="none"');
        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain('width="18"');
    });

    test('draws the crossing strokes in the current color', () => {
        const html = renderIcon();

        expect(html.split('<path').length - 1).toBe(1);
        expect(html).toContain('stroke="currentColor"');
        expect(html).toContain('stroke-linecap="round"');
        expect(html).toContain('<path d="M6 6l12 12M18 6L6 18"');
    });

    test('scales to the size and stroke width props', () => {
        const html = renderIcon({ size: 24, strokeWidth: 1.6 });

        expect(html).toContain('height="24"');
        expect(html).toContain('stroke-width="1.6"');
        expect(html).toContain('width="24"');
    });
});
