import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import Layout from '../../src/Layout.astro';
import { ROUTES } from '../../src/lib/constants';

type Variant = 'indexed' | 'noindexed';

interface StructuredData {
    '@context': string;
    '@graph': {
        '@type': string;
        'author'?: { '@type': string; 'name': string };
        'inLanguage'?: string;
        'itemListElement'?: unknown[];
        'name'?: string;
    }[];
}

const DESCRIPTION = 'Personal travel atlas plotted on an interactive map with markers, journeys, and starred favorites.';
const SITE = 'https://travel.aephonics.com';
const SLOT = '<section data-slot="page">Slot content</section>';
const TITLE = 'Travel';

class SiteAwareUrl extends URL {
    constructor(input: string | URL, base?: string | URL) {
        super(input, base ?? SITE);
    }
}

async function renderLayout(variant: Variant = 'indexed') {
    const container = await AstroContainer.create();

    vi.stubGlobal('URL', SiteAwareUrl);

    try {
        return await container.renderToString(Layout, {
            partial: false,
            props: { description: DESCRIPTION, noindex: variant === 'noindexed', title: TITLE },
            slots: { default: SLOT },
        });
    } finally {
        vi.unstubAllGlobals();
    }
}

describe('Layout', () => {
    let html: string;

    beforeAll(async () => {
        html = await renderLayout();
    });

    test('renders the full page skeleton', () => {
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('<head>');
        expect(html).toContain('</head>');
        expect(html).toContain('<body class="flex flex-col min-h-svh antialiased bg-paper text-ink">');
        expect(html).toContain('</body></html>');
    });

    test('declares the charset and viewport metas', () => {
        expect(html).toContain('<meta charset="utf-8">');
        expect(html).toContain('<meta content="width=device-width, initial-scale=1" name="viewport">');
    });

    test('renders the title prop as the document title', () => {
        expect(html).toContain(`<title>${TITLE}</title>`);
    });

    test('wires the description prop into meta tags', () => {
        expect(html).toContain(`<meta content="${DESCRIPTION}" name="description">`);
        expect(html).toContain(`<meta content="${DESCRIPTION}" property="og:description">`);
        expect(html).toContain(`<meta content="${DESCRIPTION}" name="twitter:description">`);
    });

    test('mirrors the title into social metas', () => {
        expect(html).toContain(`<meta content="${TITLE}" property="og:title">`);
        expect(html).toContain(`<meta content="${TITLE}" name="twitter:title">`);
    });

    test('renders canonical and site identity tags', () => {
        expect(html).toContain(`<link href="${SITE}/" rel="canonical">`);
        expect(html).toContain(`<meta content="${SITE}/" property="og:url">`);
        expect(html).toContain('<meta content="Travel" property="og:site_name">');
        expect(html).toContain('<meta content="website" property="og:type">');
        expect(html).toContain('<meta content="summary_large_image" name="twitter:card">');
        expect(html).toContain('<meta content="Kevin Huang" name="author">');
        expect(html).toContain('<meta content="#f3f5f4" name="theme-color">');
        expect(html).toContain('property="og:image"');
        expect(html).toContain('name="twitter:image"');
    });

    test('links the favicon and touch icon', () => {
        expect(html).toContain('<link href="/apple-touch-icon.png" rel="apple-touch-icon">');
        expect(html).toContain('<link href="/favicon.svg" rel="icon" type="image/svg+xml">');
    });

    test('embeds valid json-ld describing the site', () => {
        const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

        const jsonLd = match ? JSON.parse(match[1]) as StructuredData : null;

        const itemList = jsonLd?.['@graph'].find(node => node['@type'] === 'ItemList');
        const website = jsonLd?.['@graph'].find(node => node['@type'] === 'WebSite');

        expect(jsonLd).not.toBeNull();
        expect(jsonLd?.['@context']).toBe('https://schema.org');
        expect(itemList?.itemListElement).toHaveLength(ROUTES.length);
        expect(website?.name).toBe('Travel');
        expect(website?.inLanguage).toBe('en');
        expect(website?.author).toEqual({ '@type': 'Person', 'name': 'Kevin Huang' });
    });

    test('enables the client router', () => {
        expect(html).toContain('<meta name="astro-view-transitions-enabled" content="true">');
        expect(html).toContain('<meta name="astro-view-transitions-fallback" content="animate">');
        expect(html.split('ClientRouter.astro?astro&type=script').length - 1).toBe(1);
    });

    test('renders slot content inside the main landmark', () => {
        expect(html).toContain('<main class="flex flex-1 flex-col">');
        expect(html).toContain(SLOT);
        expect(html.indexOf(SLOT)).toBeGreaterThan(html.indexOf('<main'));
        expect(html.indexOf(SLOT)).toBeLessThan(html.indexOf('</main>'));
    });

    describe('robots directives', () => {
        test('serves index, follow by default', () => {
            expect(html).toContain('<meta content="index, follow" name="robots">');
            expect(html).not.toContain('noindex');
        });

        test('serves noindex, nofollow for the noindexed variant', async () => {
            const noindexed = await renderLayout('noindexed');

            expect(noindexed).toContain('<meta content="noindex, nofollow" name="robots">');
            expect(noindexed).not.toContain('content="index, follow"');
        });
    });
});
