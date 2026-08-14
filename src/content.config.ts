import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'zod';

import { CATEGORY_COLORS } from '@lib/constants';

const categoryIds = Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[];

const markerSchema = z.object({
    category: z.enum(categoryIds),
    description: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    name: z.string().min(1),
    starred: z.boolean().optional(),
});

const positionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const regionSchema = z.object({
    boundary: z.array(z.array(z.array(positionSchema))),
    country: z.string().min(1),
    state: z.string().min(1),
});

const active = defineCollection({
    loader: file('./src/content/active.json', { parser: regionRecordOf }),
    schema: regionSchema,
});

const categories = defineCollection({
    loader: file('./src/content/categories.json', { parser: text => Object.fromEntries((JSON.parse(text) as { name: string }[]).map(category => [category.name.toLowerCase(), category])) }),
    schema: z.object({
        color: z.string().regex(/^#[0-9a-f]{6}$/),
        description: z.string().min(1),
        name: z.string().min(1),
    }),
});

const explored = defineCollection({
    loader: file('./src/content/explored.json', { parser: regionRecordOf }),
    schema: regionSchema,
});

const starred = defineCollection({
    loader: file('./src/content/starred.json', { parser: text => Object.fromEntries((JSON.parse(text) as { name: string }[]).map(marker => [marker.name, marker])) }),
    schema: markerSchema.omit({ starred: true }),
});

const trips = defineCollection({
    loader: glob({ base: './src/content/journeys', pattern: '**/*.json' }),
    schema: z.object({
        markers: z.array(markerSchema).min(1),
        name: z.string().min(1),
        ordered: z.boolean(),
    }),
});

function regionRecordOf(text: string) {
    return Object.fromEntries((JSON.parse(text) as { country: string; state: string }[]).map(region => [`${region.country}-${region.state}`.toLowerCase(), region]));
}

export const collections = { active, categories, explored, starred, trips };
