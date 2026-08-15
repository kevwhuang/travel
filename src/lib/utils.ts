import { CARDS_PER_PAGE, CATEGORY_COLORS, SEARCH_LENGTH_LIMIT, SEARCH_SHORTCUT } from '@lib/constants';

const FALLBACK_COLOR = 'var(--color-storm)';

export function getAccentBorder(color: string): string {
    return `color-mix(in oklab, ${color} 28%, var(--color-snow))`;
}

export function getAccentForeground(color: string): string {
    return `color-mix(in oklab, ${color} 56%, var(--color-ink))`;
}

export function getAccentSurface(color: string): string {
    return `color-mix(in oklab, ${color} 10%, var(--color-snow))`;
}

export function getCategoryColor(categoryId: string): string {
    return CATEGORY_COLORS[categoryId as keyof typeof CATEGORY_COLORS] ?? FALLBACK_COLOR;
}

export function getJourneysById(journeys: AtlasJourney[]): Record<string, AtlasJourney> {
    return Object.fromEntries(journeys.map(journey => [journey.id, journey] as const));
}

export function getPageCount(total: number): number {
    return Math.max(1, Math.ceil(total / CARDS_PER_PAGE));
}

export function isModifiedEvent(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function sanitizeSearch(value: string): string {
    return value.replaceAll(SEARCH_SHORTCUT, '').slice(0, SEARCH_LENGTH_LIMIT);
}
