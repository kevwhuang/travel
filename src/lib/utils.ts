import { CARDS_PER_PAGE, CATEGORY_COLORS } from '@lib/constants';

const FALLBACK_COLOR = 'var(--color-storm)';

function formatDegrees(value: number, negativeLabel: string, positiveLabel: string) {
    return `${Math.abs(value).toFixed(2)}\u00b0${value < 0 ? negativeLabel : positiveLabel}`;
}

export function accentBorder(color: string): string {
    return `color-mix(in oklab, ${color} 28%, var(--color-snow))`;
}

export function accentForeground(color: string): string {
    return `color-mix(in oklab, ${color} 56%, var(--color-ink))`;
}

export function accentSurface(color: string): string {
    return `color-mix(in oklab, ${color} 10%, var(--color-snow))`;
}

export function categoryColor(category: string): string {
    return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? FALLBACK_COLOR;
}

export function formatCoordinates(place: AtlasPlace): string {
    return `${formatDegrees(place.lat, 'S', 'N')} \u00b7 ${formatDegrees(place.lng, 'W', 'E')}`;
}

export function isModifiedEvent(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function pageCountOf(total: number): number {
    return Math.max(1, Math.ceil(total / CARDS_PER_PAGE));
}

export function tripsByIdOf(trips: AtlasTrip[]): Record<string, AtlasTrip> {
    return Object.fromEntries(trips.map(trip => [trip.id, trip] as const));
}
