export const CARDS_PER_PAGE = 40;

export const CATEGORY_COLORS = {
    dining: 'var(--color-terracotta)',
    landmarks: 'var(--color-azure)',
    misc: 'var(--color-taupe)',
    nature: 'var(--color-moss)',
    urban: 'var(--color-violet)',
    wellness: 'var(--color-teal)',
} as const;

export const COVERAGE_REGIONS = [
    {
        east: -81.5,
        maxZoom: 15,
        name: 'americas',
        north: 51.3,
        south: 14.8,
        west: -125.8,
    },
    {
        east: 123.2,
        maxZoom: 15,
        name: 'china',
        north: 34.5,
        south: 23,
        west: 113,
    },
] as const;

export const SEARCH_KEY = '/';
export const SEARCH_LENGTH_LIMIT = 100;
export const STAR_COLOR = 'var(--color-gold)';
export const STAR_LABEL = 'Starred favorite';
export const TITLE = 'Atlas';
export const TITLE_ID = 'atlas-title';
