import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconLogo from '../../src/components/IconLogo';

function renderIcon() {
    return renderToStaticMarkup(createElement(IconLogo));
}

describe('IconLogo', () => {
    test('renders the pink brand mark hidden from assistive tech', () => {
        const html = renderIcon();

        expect(html).toContain('<svg class="text-pink"');
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain('fill="currentColor"');
    });

    test('sizes to the fixed brand dimensions', () => {
        const html = renderIcon();

        expect(html).toContain('height="18"');
        expect(html).toContain('viewBox="8 4 16 24"');
        expect(html).toContain('width="12"');
    });

    test('draws the pennant as a single polygon', () => {
        const html = renderIcon();

        expect(html.split('<polygon').length - 1).toBe(1);
        expect(html).toContain('<polygon points="16,6 22,26 16,21 10,26"');
        expect(html).not.toContain('<path');
        expect(html).not.toContain('stroke=');
    });
});
