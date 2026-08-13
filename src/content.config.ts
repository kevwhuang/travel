import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'zod';

import { CATEGORY_COLORS } from '@lib/constants';

const categoryIds = Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[];

const categories = defineCollection({
    loader: file('./src/content/categories.json'),
    schema: z.object({
        color: z.string().regex(/^#[0-9a-f]{6}$/),
        description: z.string().min(1),
        id: z.enum(categoryIds),
        name: z.string().min(1),
    }),
});

const placeSchema = z.object({
    category: z.enum(categoryIds),
    description: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    name: z.string().min(1),
    starred: z.boolean().optional(),
});

const starred = defineCollection({
    loader: file('./src/content/starred.json', { parser: text => Object.fromEntries((JSON.parse(text) as { name: string }[]).map(place => [place.name, place])) }),
    schema: placeSchema.extend({ starred: z.literal(true) }),
});

const trips = defineCollection({
    loader: glob({ base: './src/content/trips', pattern: '**/*.json' }),
    schema: z.object({
        name: z.string().min(1),
        ordered: z.boolean(),
        places: z.array(placeSchema).min(1),
        year: z.number().int(),
    }),
});

export const collections = { categories, starred, trips };
