import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, test } from 'vitest';

import ErrorServer from '../../src/sections/ErrorServer.astro';

describe('ErrorServer', () => {
    let html: string;

    beforeAll(async () => {
        const container = await AstroContainer.create();

        html = await container.renderToString(ErrorServer);
    });

    test('labels the section by the status code heading', () => {
        expect(html).toMatch(/<section[^>]*aria-labelledby="error-server-title"/);
        expect(html.split('id="error-server-title"').length - 1).toBe(1);
    });

    test('renders 500 as the heading text', () => {
        expect(html).toMatch(/<h1 id="error-server-title"[^>]*>\s*500\s*<\/h1>/);
    });

    test('links back to the home page with a labelled pill', () => {
        expect(html).toMatch(/<a class="pill[^>]*" aria-label="Return to home" href="\/">\s*Home\s*<\/a>/);
    });
});
