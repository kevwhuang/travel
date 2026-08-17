import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, test } from 'vitest';

import AtlasSection from '../../src/sections/Atlas.astro';
import { ATLAS_TITLE } from '../../src/lib/constants';
import { getAtlasData } from '../../src/lib/atlas';

describe('AtlasSection', () => {
    let html: string;
    let markerTotal: number;

    beforeAll(async () => {
        const container = await AstroContainer.create();

        container.addServerRenderer({ name: '@astrojs/react', renderer: (await import('@astrojs/react/server.js')).default });
        container.addClientRenderer({ entrypoint: '@astrojs/react/client.js', name: '@astrojs/react' });

        html = await container.renderToString(AtlasSection);
        markerTotal = (await getAtlasData()).markers.length;
    });

    test('labels the section by the atlas title for assistive tech', () => {
        expect(html).toMatch(new RegExp(`<section[^>]*aria-label="${ATLAS_TITLE}"`));
        expect(html.split('<section').length - 1).toBe(1);
    });

    test('hydrates the atlas island on load', () => {
        expect(html).toContain('<astro-island');
        expect(html).toContain('client="load"');
        expect(html).toContain('component-export="default"');
    });

    test('server-renders the island with the full marker count announced', () => {
        expect(markerTotal).toBeGreaterThan(0);
        expect(html).toContain(`${markerTotal} of ${markerTotal} markers shown`);
    });
});
