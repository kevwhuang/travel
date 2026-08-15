import Badge from '@components/Badge';
import IconClose from '@components/IconClose';
import IconGrid from '@components/IconGrid';
import IconPin from '@components/IconPin';
import IconStar from '@components/IconStar';
import { STAR_COLOR, STAR_LABEL } from '@lib/constants';
import { getAccentBorder, getAccentForeground, getAccentSurface, getCategoryColor } from '@lib/utils';

const CLASS_CARD_ACTION = 'pill after:absolute after:content-[\'\'] after:inset-[-12px] relative shrink-0 h-[26px] w-[26px] p-0 text-slate';
const CLASS_CARD_ACTION_ADJACENT = 'pill after:absolute after:content-[\'\'] after:inset-y-[-12px] after:left-[-12px] after:right-[-6px] relative shrink-0 h-[26px] w-[26px] p-0 text-slate';
const CLASS_CARD_CLOSE = 'pill after:absolute after:content-[\'\'] after:inset-y-[-12px] after:left-[-6px] after:right-[-12px] relative shrink-0 h-[26px] w-[26px] p-0 text-storm';
const CLASS_CARD_DESCRIPTION = 'leading-[1.55] text-[14px] text-pretty wrap-anywhere text-storm';
const CLASS_CARD_FRAME = 'atlas-card atlas-card--lift flex flex-col relative h-full gap-[8px] pb-[12px] pt-[16px] px-[16px]';
const CLASS_CARD_FRAME_POPUP = 'atlas-card flex flex-col overflow-y-auto relative max-h-[calc(100dvh-72px)] max-w-[calc(100dvw-36px)] w-[clamp(288px,calc(256px+10vw),var(--width-third))] gap-[8px] pb-[12px] pt-[16px] px-[16px] shadow-[0_18px_44px_var(--color-ink-20)]';
const CLASS_STOP_BADGE = 'grid place-items-center shrink-0 h-[24px] w-[24px] pt-[2px] border border-flint rounded-[6px] font-serif text-[12px] bg-paper text-ink';
const HIGHLIGHT_RING_NONE = '0 0 0 0 transparent';
const UNORDERED_LABEL = 'Unordered journey \u2014 no itinerary position';

function formatDegrees(value: number, negativeLabel: string, positiveLabel: string) {
    return `${Math.abs(value).toFixed(2)}\u00b0${value < 0 ? negativeLabel : positiveLabel}`;
}

function OrderBadge({ isOrdered, stopCount, stopNumber }: {
    isOrdered: boolean;
    stopCount: number;
    stopNumber: number;
}) {
    if (isOrdered) {
        const stopLabel = `Stop ${stopNumber} of ${stopCount}`;

        return (
            <span
                className={CLASS_STOP_BADGE}
                aria-label={stopLabel}
                role="img"
                title={stopLabel}
            >
                {stopNumber}
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
            <span className="h-[6px] w-[6px] rounded-full bg-storm" aria-hidden="true" />
        </span>
    );
}

export default function CardMarker({ categoryLabel, isHighlighted = false, isPopup = false, journey, marker, onClose, onShowInCards, onShowOnMap }: {
    categoryLabel: string;
    isHighlighted?: boolean;
    isPopup?: boolean;
    journey: AtlasJourney | null;
    marker: AtlasMarker;
    onClose?: () => void;
    onShowInCards?: (marker: AtlasMarker) => void;
    onShowOnMap?: (marker: AtlasMarker) => void;
}) {
    const coordinates = `${formatDegrees(marker.lat, 'S', 'N')} \u00b7 ${formatDegrees(marker.lng, 'W', 'E')}`;
    const isOrdered = journey?.isOrdered === true;
    const journeyName = journey?.name ?? '';
    const journeyYear = journey?.year;
    const starredStyle = marker.isStarred ? { background: getAccentSurface(STAR_COLOR), borderColor: getAccentBorder(STAR_COLOR) } : undefined;

    return (
        <div
            className={isPopup ? 'atlas-rise' : 'h-full min-w-0 rounded-[12px] duration-[var(--duration-slow)] ease-[ease] transition-[box-shadow]'}
            data-marker-id={marker.id}
            style={{ boxShadow: isHighlighted ? `0 0 0 4px color-mix(in oklab, ${getCategoryColor(marker.categoryId)} 45%, transparent)` : HIGHLIGHT_RING_NONE }}
        >
            <article
                className={isPopup ? CLASS_CARD_FRAME_POPUP : CLASS_CARD_FRAME}
                style={starredStyle}
            >
                <div className="flex items-center gap-[8px]">
                    <span className="min-w-0 mr-auto">
                        <Badge categoryId={marker.categoryId} label={categoryLabel} />
                    </span>
                    {onShowOnMap && (
                        <button
                            className={onClose ? CLASS_CARD_ACTION_ADJACENT : CLASS_CARD_ACTION}
                            aria-label="Show on map"
                            onClick={() => onShowOnMap(marker)}
                            title="Show on map"
                            type="button"
                        >
                            <IconPin size={12} strokeWidth={2} />
                        </button>
                    )}
                    {onShowInCards && (
                        <button
                            className={onClose ? CLASS_CARD_ACTION_ADJACENT : CLASS_CARD_ACTION}
                            aria-label="Show in cards"
                            onClick={() => onShowInCards(marker)}
                            title="Show in cards"
                            type="button"
                        >
                            <IconGrid size={12} strokeWidth={2} />
                        </button>
                    )}
                    {onClose && (
                        <button
                            className={CLASS_CARD_CLOSE}
                            aria-label="Close"
                            onClick={onClose}
                            type="button"
                        >
                            <IconClose size={12} strokeWidth={2} />
                        </button>
                    )}
                </div>
                <h2 className="font-semibold leading-[1.3] text-[16px] text-pretty wrap-anywhere">
                    {marker.name}
                    {marker.isStarred && (
                        <span className="inline-flex items-center relative top-[-0.08em] pl-[8px] align-middle">
                            <IconStar color={getAccentForeground(STAR_COLOR)} />
                            <span className="sr-only">{STAR_LABEL}</span>
                        </span>
                    )}
                </h2>
                <p className={isPopup ? CLASS_CARD_DESCRIPTION : `overflow-y-auto max-h-[108px] pr-[4px] ${CLASS_CARD_DESCRIPTION} [scrollbar-color:var(--color-flint)_transparent] [scrollbar-width:thin]`}>{marker.description}</p>
                <p className="mt-auto font-mono text-[10px] tracking-[0.12em] uppercase wrap-anywhere text-storm">{coordinates}</p>
                {journey && (
                    <div className="flex items-center justify-between gap-[8px] pt-[12px] border-linen border-t">
                        <span className="inline-flex items-baseline min-w-0 gap-[8px]">
                            <span
                                className="overflow-hidden font-serif text-[14px] text-ellipsis whitespace-nowrap"
                                title={journeyName}
                            >
                                {journeyName}
                            </span>
                            {journeyYear !== undefined && (
                                <time
                                    className="font-mono text-[10px] tracking-[0.12em] uppercase text-storm"
                                    dateTime={String(journeyYear)}
                                >
                                    {journeyYear}
                                </time>
                            )}
                        </span>
                        <OrderBadge isOrdered={isOrdered} stopCount={journey?.markerCount ?? 0} stopNumber={marker.stopNumber} />
                    </div>
                )}
            </article>
        </div>
    );
}
