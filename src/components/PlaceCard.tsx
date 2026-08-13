import CategoryBadge from '@components/CategoryBadge';
import IconMapPin from '@components/IconMapPin';
import StarMark from '@components/StarMark';
import { CARD_COORDINATES_CLASS, CARD_DESCRIPTION_CLASS, CARD_META_CLASS, CARD_NAME_CLASS, CARD_TRIP_NAME_CLASS, CARD_TRIP_YEAR_CLASS, STAR_COLOR } from '@lib/constants';
import { accentBorder, accentSurface, categoryColor, formatCoordinates } from '@lib/utils';

const HIGHLIGHT_RING_NONE = '0 0 0 0 transparent';
const UNORDERED_LABEL = 'Unordered trip \u2014 no itinerary position';

function OrderBadge({ isOrdered, order }: {
    isOrdered: boolean;
    order: number;
}) {
    if (isOrdered) {
        return (
            <span
                className="grid place-items-center shrink-0 h-[30px] w-[30px] border border-flint rounded-full font-serif text-[13px] bg-paper text-ink"
                title="Itinerary stop"
            >
                {order}
            </span>
        );
    }

    return (
        <span
            className="grid place-items-center shrink-0 h-[30px] w-[30px] border border-dashed border-storm rounded-full"
            aria-label={UNORDERED_LABEL}
            role="img"
            title={UNORDERED_LABEL}
        >
            <span
                className="h-[5px] w-[5px] rounded-full bg-storm"
                aria-hidden="true"
            />
        </span>
    );
}

export default function PlaceCard({ categoryLabel, isHighlighted, onShowOnMap, place, trip }: {
    categoryLabel: string;
    isHighlighted: boolean;
    onShowOnMap: (place: AtlasPlace) => void;
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
            className="h-full rounded-[12px] duration-[var(--duration-slow)] ease-[ease] transition-[box-shadow]"
            data-place-id={place.id}
            style={{ boxShadow: isHighlighted ? `0 0 0 4px color-mix(in oklab, ${categoryColor(place.category)} 45%, transparent)` : HIGHLIGHT_RING_NONE }}
        >
            <article
                className="atlas-card flex flex-col relative h-full gap-[8px] pb-[12px] pt-[16px] px-[16px]"
                style={starredStyle}
            >
                <div className="flex items-center justify-between gap-[8px] mb-[2px]">
                    <OrderBadge isOrdered={isOrdered} order={place.order} />
                    <CategoryBadge category={place.category} label={categoryLabel} />
                </div>
                <h2 className={CARD_NAME_CLASS}>
                    {place.name}
                    {isStarred && <StarMark />}
                </h2>
                <p className={`${CARD_DESCRIPTION_CLASS} line-clamp-3`}>{place.description}</p>
                <p className={CARD_COORDINATES_CLASS}>{coordinates}</p>
                <div className={`${CARD_META_CLASS} mt-auto`}>
                    <span className="inline-flex items-baseline min-w-0 gap-[8px]">
                        <span className={CARD_TRIP_NAME_CLASS}>{tripName}</span>
                        {tripYear !== undefined && (
                            <time
                                className={CARD_TRIP_YEAR_CLASS}
                                dateTime={String(tripYear)}
                            >
                                {tripYear}
                            </time>
                        )}
                    </span>
                    <button
                        className="atlas-pill after:absolute after:content-[''] after:inset-x-[-6px] after:inset-y-[-10px] relative shrink-0 h-[26px] w-[26px] p-0 text-slate"
                        aria-label="Show on map"
                        onClick={() => onShowOnMap(place)}
                        title="Show on map"
                        type="button"
                    >
                        <IconMapPin size={11} strokeWidth={2} />
                    </button>
                </div>
            </article>
        </div>
    );
}
