export const ARROW_PAGE_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
export const ATLAS_TITLE = 'Atlas';
export const CARDS_PER_PAGE = 30;

export const CATEGORY_COLORS = {
    dining: 'var(--color-terracotta)',
    landmarks: 'var(--color-azure)',
    misc: 'var(--color-taupe)',
    nature: 'var(--color-moss)',
    urban: 'var(--color-violet)',
    wellness: 'var(--color-teal)',
} as const;

export const CONTENT_DIR = 'src/content';
export const COPYRIGHT_MARK = '\u00a9';

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

export const CREDIT_MAP = 'OpenStreetMap';
export const LATITUDE_LIMIT = 90;
export const LONGITUDE_LIMIT = 180;

export const MAP_FONT_STACKS = {
    bold: 'Noto Sans Medium',
    italic: 'Noto Sans Italic',
    regular: 'Noto Sans Regular',
} as const;

export const MAP_MAX_ZOOM = 15;
export const MAP_MIN_ZOOM = 2;

export const ROUTES = [
    { href: '/', label: 'Home' },
] as const;

export const SEARCH_LENGTH_LIMIT = 100;
export const SEARCH_SHORTCUT = '/';
export const STAR_COLOR = 'var(--color-gold)';
export const STAR_LABEL = 'Starred favorite';
export const TILE_EXTENSION = '.pmtiles';
export const WORLD_SOURCE_ID = 'world';
