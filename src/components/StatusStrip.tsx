import { categoryColor } from '@lib/utils';

const CHIP_CLASS = 'atlas-chip after:absolute after:content-[""] after:inset-x-0 after:inset-y-[-3px] relative max-w-[180px] gap-[6px] px-[8px] py-[4px] text-[10px] tracking-[0.06em]';
const CHIP_LIST_CLASS = 'flex flex-wrap items-center justify-center gap-[8px]';
const EMPTY_LABEL = 'No results found';
const REMOVE_FILTER_TITLE = 'Remove this filter';
const STRIP_CLASS = 'bottom-[18px] fixed inset-x-0 z-[39] w-fit mx-auto font-mono text-[10px] tracking-[0.1em] text-storm max-md:bottom-[74px]';

function FilterChip({ label, onRemove, swatch }: {
    label: string; onRemove: () => void; swatch?: string;
}) {
    return (
        <button
            className={CHIP_CLASS}
            onClick={onRemove}
            title={REMOVE_FILTER_TITLE}
            type="button"
        >
            {swatch !== undefined && (
                <span
                    aria-hidden="true"
                    className="grid place-items-center shrink-0 h-[13px] w-[13px]"
                >
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: swatch }} />
                </span>
            )}
            <span className="min-w-0 truncate uppercase">{label}</span>
            <span
                aria-hidden="true"
                className="grid place-items-center shrink-0 h-[13px] w-[13px] leading-none text-[13px]"
            >
                &times;
            </span>
        </button>
    );
}

export default function StatusStrip({ categories, isEmpty, onClearAll, onRemoveCategory, onRemoveTrip, selectedCategories, selectedTrips, trips }: {
    categories: AtlasCategory[];
    isEmpty: boolean;
    onClearAll: () => void;
    onRemoveCategory: (id: string) => void;
    onRemoveTrip: (id: string) => void;
    selectedCategories: string[];
    selectedTrips: string[];
    trips: AtlasTrip[];
}) {
    const chosenCategories = selectedCategories.map(id => categories.find(item => item.id === id)).filter(item => item !== undefined);
    const chosenTrips = selectedTrips.map(id => trips.find(item => item.id === id)).filter(item => item !== undefined);

    if (chosenCategories.length === 0 && chosenTrips.length === 0) {
        if (!isEmpty) return null;

        return (
            <p
                className={`${STRIP_CLASS} px-[12px] py-[8px] rounded-full bg-snow-90 backdrop-blur-[8px]`}
                role="status"
            >
                {EMPTY_LABEL}
            </p>
        );
    }

    return (
        <div className={`${STRIP_CLASS} flex flex-wrap items-center justify-center max-w-[min(700px,calc(100dvw_-_220px))] gap-[8px] px-[12px] py-[8px] border border-haze rounded-[20px] bg-snow-90 backdrop-blur-[10px] shadow-[0_8px_24px_var(--color-ink-10)] max-md:max-w-[calc(100dvw_-_24px)]`}>
            <ul className={CHIP_LIST_CLASS}>
                {chosenCategories.map(category => (
                    <li key={category.id}>
                        <FilterChip
                            label={category.name}
                            onRemove={() => onRemoveCategory(category.id)}
                            swatch={categoryColor(category.id)}
                        />
                    </li>
                ))}
                {chosenTrips.map(trip => (
                    <li key={trip.id}>
                        <FilterChip
                            label={`${trip.name} ${trip.year}`}
                            onRemove={() => onRemoveTrip(trip.id)}
                        />
                    </li>
                ))}
            </ul>
            {isEmpty && (
                <span
                    className="px-[4px]"
                    role="status"
                >
                    {EMPTY_LABEL}
                </span>
            )}
            <button
                className="active:scale-[0.96] after:absolute after:content-[''] after:inset-x-0 after:inset-y-[-3px] hover:text-ink relative px-[4px] py-[2px] border-none decoration-dotted text-[9.5px] tracking-[0.12em] underline underline-offset-[3px] uppercase bg-transparent text-storm duration-[var(--duration-fast)] ease-[ease] transition-[color,transform]"
                onClick={onClearAll}
                type="button"
            >
                Clear all
            </button>
        </div>
    );
}
