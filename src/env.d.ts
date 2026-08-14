/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

interface AtlasCamera {
    lat: number;
    lng: number;
    zoom: number;
}

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
    geometry: { coordinates: unknown; type: 'MultiPolygon' };
    properties: { status: 'active' | 'explored' };
    type: 'Feature';
}

interface AtlasRegions {
    features: AtlasRegionFeature[];
    type: 'FeatureCollection';
}

interface AtlasState {
    camera?: AtlasCamera;
    categories: string[];
    page: number;
    search: string;
    starredOnly: boolean;
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
