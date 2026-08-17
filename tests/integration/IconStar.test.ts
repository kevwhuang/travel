import { createElement } from 'react';
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IconStar from '../../src/components/IconStar';
import { STAR_COLOR } from '../../src/lib/constants';

type IconProps = Parameters<typeof IconStar>[0];

function renderIcon(overrides: Partial<IconProps> = {}) {
    return renderToStaticMarkup(createElement(IconStar, { color: STAR_COLOR, ...overrides }));
}

describe('IconStar', () => {
    test('renders a hidden star filled with the color prop', () => {
        const html = renderIcon();

        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain(`fill="${STAR_COLOR}"`);
        expect(html).toContain('viewBox="0 0 24 24"');
    });

    test('sizes to sixteen by default', () => {
        const html = renderIcon();

        expect(html).toContain('height="16"');
        expect(html).toContain('width="16"');
    });

    test('draws the five-point star as a single path', () => {
        const html = renderIcon();

        expect(html.split('<path').length - 1).toBe(1);
        expect(html).toContain('<path d="M12 3.5l2.7 5.47 6.04.88');
    });

    test('omits every outline attribute by default', () => {
        const html = renderIcon();

        expect(html).not.toMatch(/ paint-order=/);
        expect(html).not.toMatch(/ stroke=/);
        expect(html).not.toMatch(/ stroke-linejoin=/);
        expect(html).not.toMatch(/ stroke-width=/);
    });

    test('paints an ink outline under the fill for the outlined variant', () => {
        const html = renderIcon({ hasOutline: true });

        expect(html).toContain('paint-order="stroke"');
        expect(html).toContain('stroke="var(--color-ink)"');
        expect(html).toContain('stroke-linejoin="round"');
        expect(html).toContain('stroke-width="2.6"');
    });

    test('scales to the size prop', () => {
        const html = renderIcon({ size: 24 });

        expect(html).toContain('height="24"');
        expect(html).toContain('width="24"');
    });
});
