/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

interface AtlasCategory {
    description: string;
    id: string;
    name: string;
}

interface AtlasData {
    categories: AtlasCategory[];
    places: AtlasPlace[];
    regions: AtlasRegions;
    trips: AtlasTrip[];
}

interface AtlasFlyTarget {
    placeId: number;
}

interface AtlasPlace {
    category: string;
    description: string;
    id: number;
    lat: number;
    lng: number;
    name: string;
    order: number;
    starred?: boolean;
    trip: string | null;
}

interface AtlasRegionFeature {
    geometry: { coordinates: unknown; type: string };
    properties: { country: string; state: string; status: 'explored' | 'visiting' };
    type: string;
}

interface AtlasRegions {
    features: AtlasRegionFeature[];
    type: string;
}

interface AtlasState {
    categories: string[];
    page: number;
    search: string;
    trips: string[];
    view: 'cards' | 'map';
}

interface AtlasTrip {
    count: number;
    id: string;
    name: string;
    order: number;
    ordered: boolean;
    year: number;
}

interface ImportMetaEnv {
    readonly SUPABASE_PUBLISHABLE_KEY: string;
    readonly SUPABASE_URL: string;
}
