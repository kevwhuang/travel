import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, test } from 'vitest';

import ErrorNotFound from '../../src/sections/ErrorNotFound.astro';

describe('ErrorNotFound', () => {
    let html: string;

    beforeAll(async () => {
        const container = await AstroContainer.create();

        html = await container.renderToString(ErrorNotFound);
    });

    test('labels the section by the status code heading', () => {
        expect(html).toMatch(/<section[^>]*aria-labelledby="error-not-found-title"/);
        expect(html.split('id="error-not-found-title"').length - 1).toBe(1);
    });

    test('renders 404 as the heading text', () => {
        expect(html).toMatch(/<h1 id="error-not-found-title"[^>]*>\s*404\s*<\/h1>/);
    });

    test('links back to the home page with a labelled pill', () => {
        expect(html).toMatch(/<a class="pill[^>]*" aria-label="Return to home" href="\/">\s*Home\s*<\/a>/);
    });
});
