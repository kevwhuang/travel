import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { CATEGORY_COLORS, CONTENT_DIR, LATITUDE_LIMIT, LONGITUDE_LIMIT } from '@lib/constants';

function parseRecords<Entry>(text: string, getKey: (entry: Entry) => string) {
    return Object.fromEntries((JSON.parse(text) as Entry[]).map(entry => [getKey(entry), entry]));
}

function parseRegionRecords(text: string) {
    return parseRecords(text, (region: { country: string; state: string }) => `${region.country}-${region.state}`.toLowerCase());
}

const categories = defineCollection({
    loader: file(`./${CONTENT_DIR}/categories.json`, {
        parser: text => parseRecords(text, (category: { name: string }) => category.name.toLowerCase()),
    }),
    schema: z.object({
        description: z.string().min(1),
        name: z.string().min(1),
    }),
});

const categoryIds = Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[];
const positionSchema = z.tuple([z.number().min(-LONGITUDE_LIMIT).max(LONGITUDE_LIMIT), z.number().min(-LATITUDE_LIMIT).max(LATITUDE_LIMIT)]);

const markerSchema = z.object({
    category: z.enum(categoryIds),
    description: z.string().min(1),
    lat: z.number().min(-LATITUDE_LIMIT).max(LATITUDE_LIMIT),
    lng: z.number().min(-LONGITUDE_LIMIT).max(LONGITUDE_LIMIT),
    name: z.string().min(1),
    starred: z.boolean().optional(),
});

const regionSchema = z.object({
    boundary: z.array(z.array(z.array(positionSchema))),
    country: z.string().min(1),
    state: z.string().min(1),
});

const activeRegions = defineCollection({
    loader: file(`./${CONTENT_DIR}/active.json`, { parser: parseRegionRecords }),
    schema: regionSchema,
});

const exploredRegions = defineCollection({
    loader: file(`./${CONTENT_DIR}/explored.json`, { parser: parseRegionRecords }),
    schema: regionSchema,
});

const journeys = defineCollection({
    loader: glob({ base: `./${CONTENT_DIR}/journeys`, pattern: '**/*.json' }),
    schema: z.object({
        markers: z.array(markerSchema),
        name: z.string().min(1),
        ordered: z.boolean(),
    }),
});

const starredMarkers = defineCollection({
    loader: file(`./${CONTENT_DIR}/starred.json`, { parser: text => parseRecords(text, (marker: { name: string }) => marker.name.toLowerCase()) }),
    schema: markerSchema.omit({ starred: true }),
});

export const collections = { activeRegions, categories, exploredRegions, journeys, starredMarkers };
