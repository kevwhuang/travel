import { getCollection } from 'astro:content';

import exploredRegions from '@content/explored.json';
import visitingRegions from '@content/visiting.json';

let cachedAtlasData: Promise<AtlasData> | null = null;

async function buildAtlasData() {
    const categoryEntries = await getCollection('categories');
    const starredEntries = await getCollection('starred');
    const tripEntries = await getCollection('trips');

    const categories: AtlasCategory[] = categoryEntries
        .map(entry => ({
            description: entry.data.description,
            id: entry.id,
            name: entry.data.name,
        }))
        .sort((first, second) => first.id.localeCompare(second.id));

    const sortedTrips = [...tripEntries].sort((first, second) => (
        second.data.year - first.data.year || orderOf(first.id) - orderOf(second.id)
    ));

    const trips: AtlasTrip[] = sortedTrips.map(entry => ({
        count: entry.data.places.length,
        id: entry.id,
        name: entry.data.name,
        order: orderOf(entry.id),
        ordered: entry.data.ordered,
        year: entry.data.year,
    }));

    const stops = sortedTrips.flatMap(entry => entry.data.places.map((place, index) => ({ entry, index, place })));

    const places: AtlasPlace[] = [
        ...stops.map(({ entry, index, place }, id) => ({
            category: place.category,
            description: place.description,
            id,
            lat: place.lat,
            lng: place.lng,
            name: place.name,
            order: entry.data.ordered ? index + 1 : 0,
            starred: place.starred,
            trip: entry.id,
        })),
        ...starredEntries.map((entry, index) => ({
            category: entry.data.category,
            description: entry.data.description,
            id: stops.length + index,
            lat: entry.data.lat,
            lng: entry.data.lng,
            name: entry.data.name,
            order: 0,
            starred: entry.data.starred,
            trip: null,
        })),
    ];

    const regions: AtlasRegions = {
        features: [
            ...visitingRegions.features.map(feature => ({ ...feature, properties: { ...feature.properties, status: 'visiting' as const } })),
            ...exploredRegions.features.map(feature => ({ ...feature, properties: { ...feature.properties, status: 'explored' as const } })),
        ],
        type: 'FeatureCollection',
    };

    return { categories, places, regions, trips };
}

function orderOf(tripId: string) {
    const [, order] = tripId.split('-');

    return Number(order);
}

export function atlasData(): Promise<AtlasData> {
    cachedAtlasData ??= buildAtlasData();

    return cachedAtlasData;
}

export async function atlasDescription(): Promise<string> {
    const { places, trips } = await atlasData();

    return `Personal travel atlas of ${places.length} places across ${trips.length} trips \u2014 dining, landmarks, nature, wellness, and city stops plotted on a searchable, filterable map.`;
}
