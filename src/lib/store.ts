const ATLAS_KEY = 'atlas';
const LEGACY_ATLAS_KEY = 'travel-atlas';

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function clearAtlasState(): void {
    try {
        localStorage.removeItem(ATLAS_KEY);
    } catch {
        return;
    }
}

export function loadAtlasState(): Partial<AtlasState> | null {
    try {
        const legacy = localStorage.getItem(LEGACY_ATLAS_KEY);

        if (legacy) {
            if (!localStorage.getItem(ATLAS_KEY)) localStorage.setItem(ATLAS_KEY, legacy);

            localStorage.removeItem(LEGACY_ATLAS_KEY);
        }

        const raw = localStorage.getItem(ATLAS_KEY);

        if (!raw) return null;

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const state: Partial<AtlasState> = {};

        if (isStringArray(parsed.categories)) state.categories = parsed.categories;
        if (Number.isInteger(parsed.page) && parsed.page >= 0) state.page = parsed.page;
        if (typeof parsed.search === 'string') state.search = parsed.search;
        if (isStringArray(parsed.trips)) state.trips = parsed.trips;
        if (parsed.view === 'cards' || parsed.view === 'map') state.view = parsed.view;

        return state;
    } catch {
        return null;
    }
}

export function saveAtlasState(state: AtlasState): void {
    try {
        localStorage.setItem(ATLAS_KEY, JSON.stringify(state));
    } catch {
        return;
    }
}
