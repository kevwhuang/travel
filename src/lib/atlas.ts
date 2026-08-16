import { getCollection } from 'astro:content';

let cachedAtlasData: Promise<AtlasData> | null = null;

async function buildAtlasData() {
    const activeRegionEntries = await getCollection('activeRegions');
    const categoryEntries = await getCollection('categories');
    const exploredRegionEntries = await getCollection('exploredRegions');
    const journeyEntries = await getCollection('journeys');
    const starredMarkerEntries = await getCollection('starredMarkers');

    const categories: AtlasCategory[] = categoryEntries
        .map(entry => ({
            description: entry.data.description,
            id: entry.id,
            name: entry.data.name,
        }))
        .sort((first, second) => first.id.localeCompare(second.id));

    const markerCounts = new Map<string, number>();
    const markers: AtlasMarker[] = [];
    const markersByKey = new Map<string, AtlasMarker>();
    const newestFirstJourneys = [...journeyEntries].sort(compareJourneyEntries);

    for (const entry of newestFirstJourneys) {
        let markerCount = 0;

        for (const marker of entry.data.markers) {
            const existingMarker = markersByKey.get(getDedupeKey(marker));

            if (existingMarker) {
                if (marker.starred === true) existingMarker.isStarred = true;

                continue;
            }

            markerCount++;

            const atlasMarker: AtlasMarker = {
                categoryId: marker.category,
                description: marker.description,
                id: markers.length,
                isStarred: marker.starred === true,
                journeyId: entry.id,
                lat: marker.lat,
                lng: marker.lng,
                name: marker.name,
                stopNumber: entry.data.ordered ? markerCount : 0,
            };

            markers.push(atlasMarker);
            markersByKey.set(getDedupeKey(atlasMarker), atlasMarker);
        }

        markerCounts.set(entry.id, markerCount);
    }

    for (const entry of starredMarkerEntries) {
        const existingMarker = markersByKey.get(getDedupeKey(entry.data));

        if (existingMarker) {
            existingMarker.isStarred = true;

            continue;
        }

        const atlasMarker: AtlasMarker = {
            categoryId: entry.data.category,
            description: entry.data.description,
            id: markers.length,
            isStarred: true,
            journeyId: null,
            lat: entry.data.lat,
            lng: entry.data.lng,
            name: entry.data.name,
            stopNumber: 0,
        };

        markers.push(atlasMarker);
        markersByKey.set(getDedupeKey(atlasMarker), atlasMarker);
    }

    const journeys: AtlasJourney[] = [...journeyEntries]
        .sort(compareJourneyEntries)
        .map(entry => ({
            id: entry.id,
            isOrdered: entry.data.ordered,
            markerCount: markerCounts.get(entry.id) ?? 0,
            name: entry.data.name,
            order: parseJourneyOrder(entry.id),
            year: parseJourneyYear(entry.id),
        }));

    const regions: AtlasRegions = {
        features: [
            ...activeRegionEntries.map(entry => toRegionFeature(entry.data, 'active')),
            ...exploredRegionEntries.map(entry => toRegionFeature(entry.data, 'explored')),
        ],
        type: 'FeatureCollection',
    };

    return { categories, journeys, markers, regions };
}

function compareJourneyEntries(first: { id: string }, second: { id: string }) {
    return parseJourneyYear(second.id) - parseJourneyYear(first.id) || parseJourneyOrder(second.id) - parseJourneyOrder(first.id);
}

function getDedupeKey(marker: { lat: number; lng: number; name: string }) {
    return `${marker.name}|${marker.lat}|${marker.lng}`;
}

function parseJourneyOrder(journeyId: string) {
    const [, order] = journeyId.split('_');

    return Number(order);
}

function parseJourneyYear(journeyId: string) {
    const [year] = journeyId.split('_');

    return Number(year);
}

function toRegionFeature(region: { boundary: unknown }, status: AtlasRegionStatus): AtlasRegionFeature {
    return {
        geometry: { coordinates: region.boundary, type: 'MultiPolygon' },
        properties: { status },
        type: 'Feature',
    };
}

export function getAtlasData(): Promise<AtlasData> {
    cachedAtlasData ??= buildAtlasData();

    return cachedAtlasData;
}
