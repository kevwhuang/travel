import CategoryBadge from '@components/CategoryBadge';
import IconClose from '@components/IconClose';
import IconGrid from '@components/IconGrid';
import IconMapPin from '@components/IconMapPin';
import StarMark from '@components/StarMark';
import { STAR_COLOR } from '@lib/constants';
import { accentBorder, accentSurface, categoryColor, formatCoordinates } from '@lib/utils';

const CARD_CLOSE_CLASS = 'atlas-pill after:absolute after:content-[\'\'] after:inset-y-[-12px] after:left-0 after:right-[-12px] relative shrink-0 h-[26px] w-[26px] p-0 text-storm';
const CARD_COORDINATES_CLASS = 'font-mono text-[10px] tracking-[0.12em] uppercase wrap-anywhere text-storm';
const CARD_DESCRIPTION_CLASS = 'leading-[1.55] text-[13px] text-pretty wrap-anywhere text-storm';
const CARD_DESCRIPTION_GRID_CLASS = `overflow-y-auto max-h-[101px] pr-[4px] ${CARD_DESCRIPTION_CLASS} [scrollbar-color:var(--color-flint)_transparent] [scrollbar-width:thin]`;
const CARD_META_CLASS = 'flex items-center justify-between gap-[8px] pt-[12px] border-linen border-t';
const CARD_NAME_CLASS = 'font-semibold leading-[1.3] text-[16px] text-pretty tracking-[-0.005em] wrap-anywhere';
const CARD_SWITCH_ADJACENT_CLASS = 'atlas-pill after:absolute after:content-[\'\'] after:inset-y-[-12px] after:left-[-12px] after:right-0 relative shrink-0 h-[26px] w-[26px] p-0 text-slate';
const CARD_SWITCH_CLASS = 'atlas-pill after:absolute after:content-[\'\'] after:inset-[-12px] relative shrink-0 h-[26px] w-[26px] p-0 text-slate';
const CARD_TRIP_NAME_CLASS = 'overflow-hidden font-serif text-[13px] text-ellipsis whitespace-nowrap';
const CARD_TRIP_YEAR_CLASS = 'font-mono text-[10px] uppercase text-storm';
const FLOATING_CARD_CLASS = 'overflow-y-auto max-h-[calc(100dvh-72px)] max-w-[calc(100dvw-36px)] w-[var(--width-narrow)] shadow-[0_18px_44px_var(--color-ink-20)]';
const HIGHLIGHT_RING_NONE = '0 0 0 0 transparent';
const UNORDERED_LABEL = 'Unordered journey \u2014 no itinerary position';

function OrderBadge({ isOrdered, order, stopCount }: {
    isOrdered: boolean;
    order: number;
    stopCount: number;
}) {
    if (isOrdered) {
        const stopLabel = `Stop ${order} of ${stopCount}`;

        return (
            <span
                className="grid place-items-center shrink-0 h-[24px] w-[24px] border border-flint rounded-[6px] font-serif text-[11px] bg-paper text-ink"
                aria-label={stopLabel}
                role="img"
                title={stopLabel}
            >
                {order}
            </span>
        );
    }

    return (
        <span
            className="grid place-items-center shrink-0 h-[24px] w-[24px] border border-dashed border-storm rounded-[6px]"
            aria-label={UNORDERED_LABEL}
            role="img"
            title={UNORDERED_LABEL}
        >
            <span
                className="h-[7px] w-[7px] rounded-full bg-storm"
                aria-hidden="true"
            />
        </span>
    );
}

export default function PlaceCard({ categoryLabel, isFloating = false, isHighlighted = false, onClose, onShowInCards, onShowOnMap, place, trip }: {
    categoryLabel: string;
    isFloating?: boolean;
    isHighlighted?: boolean;
    onClose?: () => void;
    onShowInCards?: (place: AtlasPlace) => void;
    onShowOnMap?: (place: AtlasPlace) => void;
    place: AtlasPlace;
    trip: AtlasTrip | null;
}) {
    const coordinates = formatCoordinates(place);
    const isOrdered = trip?.ordered === true;
    const isStarred = place.starred === true;
    const tripName = trip?.name ?? '';
    const tripYear = trip?.year;

    const starredStyle = isStarred ? { background: accentSurface(STAR_COLOR), borderColor: accentBorder(STAR_COLOR) } : undefined;

    return (
        <div
            className={isFloating ? 'atlas-rise atlas-rise--quick' : 'h-full min-w-0 rounded-[12px] duration-[var(--duration-slow)] ease-[ease] transition-[box-shadow]'}
            data-place-id={place.id}
            style={{ boxShadow: isHighlighted ? `0 0 0 4px color-mix(in oklab, ${categoryColor(place.category)} 45%, transparent)` : HIGHLIGHT_RING_NONE }}
        >
            <article
                className={`atlas-card flex flex-col relative gap-[8px] pb-[12px] pt-[16px] px-[16px] ${isFloating ? FLOATING_CARD_CLASS : 'atlas-card--lift h-full'}`}
                style={starredStyle}
            >
                <div className="flex items-center gap-[8px]">
                    <span className="min-w-0 mr-auto">
                        <CategoryBadge
                            category={place.category}
                            label={categoryLabel}
                        />
                    </span>
                    {onShowOnMap && (
                        <button
                            className={onClose ? CARD_SWITCH_ADJACENT_CLASS : CARD_SWITCH_CLASS}
                            aria-label="Show on map"
                            onClick={() => onShowOnMap(place)}
                            title="Show on map"
                            type="button"
                        >
                            <IconMapPin size={11} strokeWidth={2} />
                        </button>
                    )}
                    {onShowInCards && (
                        <button
                            className={onClose ? CARD_SWITCH_ADJACENT_CLASS : CARD_SWITCH_CLASS}
                            aria-label="Show in cards"
                            onClick={() => onShowInCards(place)}
                            title="Show in cards"
                            type="button"
                        >
                            <IconGrid size={11} strokeWidth={2} />
                        </button>
                    )}
                    {onClose && (
                        <button
                            className={CARD_CLOSE_CLASS}
                            aria-label="Close"
                            onClick={onClose}
                            type="button"
                        >
                            <IconClose size={11} strokeWidth={2} />
                        </button>
                    )}
                </div>
                <h2 className={CARD_NAME_CLASS}>
                    {place.name}
                    {isStarred && <StarMark />}
                </h2>
                <p className={isFloating ? CARD_DESCRIPTION_CLASS : CARD_DESCRIPTION_GRID_CLASS}>{place.description}</p>
                <p className={`mt-auto ${CARD_COORDINATES_CLASS}`}>{coordinates}</p>
                <div className={CARD_META_CLASS}>
                    <span className="inline-flex items-baseline min-w-0 gap-[8px]">
                        <span
                            className={CARD_TRIP_NAME_CLASS}
                            title={tripName}
                        >
                            {tripName}
                        </span>
                        {tripYear !== undefined && (
                            <time
                                className={CARD_TRIP_YEAR_CLASS}
                                dateTime={String(tripYear)}
                            >
                                {tripYear}
                            </time>
                        )}
                    </span>
                    <OrderBadge
                        isOrdered={isOrdered}
                        order={place.order}
                        stopCount={trip?.count ?? 0}
                    />
                </div>
            </article>
        </div>
    );
}
