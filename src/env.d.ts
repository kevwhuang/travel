/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

type AtlasRegionStatus = 'active' | 'explored';
type AtlasView = 'cards' | 'map';

interface AtlasCategory {
    description: string;
    id: string;
    name: string;
}

interface AtlasData {
    categories: AtlasCategory[];
    journeys: AtlasJourney[];
    markers: AtlasMarker[];
    regions: AtlasRegions;
}

interface AtlasFlyTarget {
    markerId: number;
}

interface AtlasJourney {
    id: string;
    isOrdered: boolean;
    markerCount: number;
    name: string;
    order: number;
    year: number;
}

interface AtlasMarker {
    categoryId: string;
    description: string;
    id: number;
    isStarred: boolean;
    journeyId: string | null;
    lat: number;
    lng: number;
    name: string;
    stopNumber: number;
}

interface AtlasRegionFeature {
    geometry: { coordinates: unknown; type: 'MultiPolygon' };
    properties: { status: AtlasRegionStatus };
    type: 'Feature';
}

interface AtlasRegions {
    features: AtlasRegionFeature[];
    type: 'FeatureCollection';
}

interface ImportMetaEnv {
    readonly SUPABASE_PUBLISHABLE_KEY: string;
    readonly SUPABASE_URL: string;
}
