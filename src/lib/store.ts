import { LATITUDE_LIMIT, LONGITUDE_LIMIT, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '@lib/constants';
import { sanitizeSearch } from '@lib/utils';

interface AtlasCamera {
    lat: number;
    lng: number;
    zoom: number;
}

interface AtlasStoredState {
    camera?: AtlasCamera;
    isStarredOnly: boolean;
    page: number;
    searchValue: string;
    selectedCategoryIds: string[];
    selectedJourneyIds: string[];
    view: AtlasView;
}

const ATLAS_KEY = 'travel_atlas';

function isCamera(value: unknown): value is AtlasCamera {
    if (!value || typeof value !== 'object') return false;
    if (!('lat' in value && 'lng' in value && 'zoom' in value)) return false;

    const { lat, lng, zoom } = value;

    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof zoom !== 'number') return false;

    return Math.abs(lat) <= LATITUDE_LIMIT && Math.abs(lng) <= LONGITUDE_LIMIT && zoom >= MAP_MIN_ZOOM && zoom <= MAP_MAX_ZOOM;
}

function stringsOf(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null;
}

export function loadAtlasState(): Partial<AtlasStoredState> | null {
    try {
        const raw = localStorage.getItem(ATLAS_KEY);

        if (!raw) return null;

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const { camera } = parsed;
        const selectedCategoryIds = stringsOf(parsed.selectedCategoryIds);
        const selectedJourneyIds = stringsOf(parsed.selectedJourneyIds);
        const state: Partial<AtlasStoredState> = {};

        if (isCamera(camera)) state.camera = { lat: camera.lat, lng: camera.lng, zoom: camera.zoom };
        if (parsed.isStarredOnly === true) state.isStarredOnly = true;
        if (Number.isInteger(parsed.page) && parsed.page >= 0) state.page = parsed.page;
        if (typeof parsed.searchValue === 'string') state.searchValue = sanitizeSearch(parsed.searchValue);
        if (selectedCategoryIds) state.selectedCategoryIds = selectedCategoryIds;
        if (selectedJourneyIds) state.selectedJourneyIds = selectedJourneyIds;
        if (parsed.view === 'cards' || parsed.view === 'map') state.view = parsed.view;

        return state;
    } catch {
        return null;
    }
}

export function saveAtlasState(state: Partial<AtlasStoredState>): void {
    try {
        localStorage.setItem(ATLAS_KEY, JSON.stringify({ ...loadAtlasState(), ...state }));
    } catch {
        return;
    }
}
