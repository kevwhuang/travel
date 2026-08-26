import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import robots from 'astro-robots-txt';
import sitemap from '@astrojs/sitemap';
import tailwind from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

import pmtiles from './scripts/pmtiles';

export default defineConfig({
    adapter: netlify(),
    build: {
        format: 'file',
    },
    devToolbar: {
        enabled: false,
    },
    fonts: [
        {
            cssVariable: '--font-fragment-mono',
            display: 'block',
            fallbacks: ['Courier New', 'monospace'],
            name: 'Fragment Mono',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: [400],
        },
        {
            cssVariable: '--font-gloock',
            display: 'block',
            fallbacks: ['Georgia', 'serif'],
            name: 'Gloock',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: [400],
        },
        {
            cssVariable: '--font-schibsted-grotesk',
            display: 'block',
            name: 'Schibsted Grotesk',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: [400, 500, 600],
        },
    ],
    integrations: [
        pmtiles(),
        react(),
        robots(),
        sitemap({ lastmod: new Date() }),
    ],
    site: 'https://travel.aephonics.com',
    trailingSlash: 'never',
    vite: {
        plugins: [tailwind()],
    },
});
