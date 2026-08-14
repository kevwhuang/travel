import { getCollection } from 'astro:content';

let cachedAtlasData: Promise<AtlasData> | null = null;

async function buildAtlasData() {
    const activeEntries = await getCollection('active');
    const categoryEntries = await getCollection('categories');
    const exploredEntries = await getCollection('explored');
    const starredEntries = await getCollection('starred');
    const tripEntries = await getCollection('trips');

    const categories: AtlasCategory[] = categoryEntries
        .map(entry => ({
            description: entry.data.description,
            id: entry.id,
            name: entry.data.name,
        }))
        .sort((first, second) => first.id.localeCompare(second.id));

    const keptCounts = new Map<string, number>();
    const places: AtlasPlace[] = [];
    const placesByKey = new Map<string, AtlasPlace>();

    const newestFirstTrips = [...tripEntries].sort((first, second) => (
        yearOf(second.id) - yearOf(first.id) || orderOf(second.id) - orderOf(first.id)
    ));

    for (const entry of newestFirstTrips) {
        let kept = 0;

        for (const marker of entry.data.markers) {
            const survivor = placesByKey.get(placeKeyOf(marker));

            if (survivor) {
                if (marker.starred === true) survivor.starred = true;

                continue;
            }

            kept += 1;

            const place: AtlasPlace = {
                category: marker.category,
                description: marker.description,
                id: places.length,
                lat: marker.lat,
                lng: marker.lng,
                name: marker.name,
                order: entry.data.ordered ? kept : 0,
                starred: marker.starred,
                trip: entry.id,
            };

            places.push(place);
            placesByKey.set(placeKeyOf(place), place);
        }

        keptCounts.set(entry.id, kept);
    }

    for (const entry of starredEntries) {
        const survivor = placesByKey.get(placeKeyOf(entry.data));

        if (survivor) {
            survivor.starred = true;

            continue;
        }

        const place: AtlasPlace = {
            category: entry.data.category,
            description: entry.data.description,
            id: places.length,
            lat: entry.data.lat,
            lng: entry.data.lng,
            name: entry.data.name,
            order: 0,
            starred: true,
            trip: null,
        };

        places.push(place);
        placesByKey.set(placeKeyOf(place), place);
    }

    const trips: AtlasTrip[] = [...tripEntries]
        .sort((first, second) => yearOf(second.id) - yearOf(first.id) || orderOf(first.id) - orderOf(second.id))
        .map(entry => ({
            count: keptCounts.get(entry.id) ?? 0,
            id: entry.id,
            name: entry.data.name,
            order: orderOf(entry.id),
            ordered: entry.data.ordered,
            year: yearOf(entry.id),
        }));

    const regions: AtlasRegions = {
        features: [
            ...activeEntries.map(entry => regionFeatureOf(entry.data, 'active')),
            ...exploredEntries.map(entry => regionFeatureOf(entry.data, 'explored')),
        ],
        type: 'FeatureCollection',
    };

    return { categories, places, regions, trips };
}

function orderOf(tripId: string) {
    const [, order] = tripId.split('_');

    return Number(order);
}

function placeKeyOf(place: { lat: number; lng: number; name: string }) {
    return `${place.name}|${place.lat}|${place.lng}`;
}

function regionFeatureOf(region: { boundary: unknown }, status: 'active' | 'explored'): AtlasRegionFeature {
    return {
        geometry: { coordinates: region.boundary, type: 'MultiPolygon' },
        properties: { status },
        type: 'Feature',
    };
}

function yearOf(tripId: string) {
    const [year] = tripId.split('_');

    return Number(year);
}

export function atlasData(): Promise<AtlasData> {
    cachedAtlasData ??= buildAtlasData();

    return cachedAtlasData;
}

export async function atlasDescription(): Promise<string> {
    const { places, trips } = await atlasData();

    return `Travel atlas of ${places.length} places across ${trips.length} journeys, plotted on an interactive map and listed as cards, with category filters, starred favorites, and search.`;
}
