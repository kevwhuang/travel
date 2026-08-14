import { SEARCH_LENGTH_LIMIT } from '@lib/constants';

const ATLAS_KEY = 'atlas';
const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;
const ZOOM_LIMIT = 16;

function isCamera(value: unknown): value is AtlasCamera {
    if (!value || typeof value !== 'object') return false;
    if (!('lat' in value && 'lng' in value && 'zoom' in value)) return false;

    const { lat, lng, zoom } = value;

    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof zoom !== 'number') return false;

    return Math.abs(lat) <= LATITUDE_LIMIT && Math.abs(lng) <= LONGITUDE_LIMIT && zoom >= 0 && zoom <= ZOOM_LIMIT;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function loadAtlasState(): Partial<AtlasState> | null {
    try {
        const raw = localStorage.getItem(ATLAS_KEY);

        if (!raw) return null;

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const state: Partial<AtlasState> = {};

        if (isCamera(parsed.camera)) state.camera = parsed.camera;
        if (isStringArray(parsed.categories)) state.categories = parsed.categories;
        if (Number.isInteger(parsed.page) && parsed.page >= 0) state.page = parsed.page;
        if (typeof parsed.search === 'string') state.search = parsed.search.slice(0, SEARCH_LENGTH_LIMIT);
        if (parsed.starredOnly === true) state.starredOnly = true;
        if (isStringArray(parsed.trips)) state.trips = parsed.trips;
        if (parsed.view === 'cards' || parsed.view === 'map') state.view = parsed.view;

        return state;
    } catch {
        return null;
    }
}

export function saveAtlasState(state: Partial<AtlasState>): void {
    try {
        localStorage.setItem(ATLAS_KEY, JSON.stringify({ ...loadAtlasState(), ...state }));
    } catch {
        return;
    }
}
