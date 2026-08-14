import { useEffect, useRef } from 'react';

import IconCategory from '@components/IconCategory';
import IconClose from '@components/IconClose';
import IconStar from '@components/IconStar';
import { STAR_COLOR } from '@lib/constants';
import { categoryColor } from '@lib/utils';

const CATEGORY_CHIP_CLASS = 'atlas-chip after:absolute after:content-[""] after:inset-x-0 after:inset-y-[-6px] hover:brightness-[0.97] relative max-w-full gap-[6px] px-[14px] py-[8px] font-medium text-[12px] wrap-anywhere';
const DIALOG_CLASS = 'atlas-panel overflow-y-auto static max-h-[min(780px,calc(100dvh-40px))] w-[min(var(--width-medium),100%)] m-0 p-0 text-ink';
const FOCUSABLE_SELECTOR = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const GROUP_LABEL_CLASS = 'font-mono text-[10px] tracking-[0.22em] uppercase text-storm';
const TRIP_CLASS = 'after:absolute after:content-[""] after:inset-x-0 after:inset-y-[-6px] relative max-w-full gap-[8px] px-[14px] py-[8px] wrap-anywhere';
const TRIP_SCROLLER_CLASS = 'overflow-y-auto overscroll-contain max-h-[40dvh] pr-[8px] [scrollbar-color:var(--color-flint)_transparent] [scrollbar-width:thin]';

function getCategoryChipStyle(categoryId: string, isSelected: boolean) {
    if (!isSelected) return undefined;

    const color = categoryColor(categoryId);

    return {
        background: `color-mix(in oklab, ${color} 13%, var(--color-snow))`,
        borderColor: `color-mix(in oklab, ${color} 55%, var(--color-snow))`,
        color: getCategoryForeground(categoryId),
    };
}

function getCategoryForeground(categoryId: string) {
    return `color-mix(in oklab, ${categoryColor(categoryId)} 55%, var(--color-ink))`;
}

function getStarredChipStyle(isSelected: boolean) {
    if (!isSelected) return undefined;

    return {
        background: `color-mix(in oklab, ${STAR_COLOR} 13%, var(--color-snow))`,
        borderColor: `color-mix(in oklab, ${STAR_COLOR} 55%, var(--color-snow))`,
        color: getStarredForeground(),
    };
}

function getStarredForeground() {
    return `color-mix(in oklab, ${STAR_COLOR} 55%, var(--color-ink))`;
}

function getTripClassName(isOrdered: boolean, isSelected: boolean) {
    const classNames = ['atlas-chip'];

    if (!isOrdered) classNames.push('atlas-chip--dashed');
    if (isSelected) classNames.push('atlas-chip--selected');

    classNames.push(TRIP_CLASS);

    return classNames.join(' ');
}

function trapTabKey(event: KeyboardEvent, dialog: HTMLElement) {
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (!focusables.length) return;

    const activeElement = document.activeElement;
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];

    if (!(activeElement instanceof HTMLElement) || !dialog.contains(activeElement)) {
        event.preventDefault();
        firstFocusable.focus();

        return;
    }

    if (activeElement === firstFocusable && event.shiftKey) {
        event.preventDefault();
        lastFocusable.focus();

        return;
    }

    if (activeElement === lastFocusable && !event.shiftKey) {
        event.preventDefault();
        firstFocusable.focus();
    }
}

export default function ModalFilter({ canClear, categories, isStarredOnly, onClearAll, onClose, onToggleCategory, onToggleStarred, onToggleTrip, selectedCategories, selectedTrips, shownCount, totalCount, trips }: {
    canClear: boolean;
    categories: AtlasCategory[];
    isStarredOnly: boolean;
    onClearAll: () => void;
    onClose: () => void;
    onToggleCategory: (categoryId: string) => void;
    onToggleStarred: () => void;
    onToggleTrip: (tripId: string) => void;
    selectedCategories: string[];
    selectedTrips: string[];
    shownCount: number;
    totalCount: number;
    trips: AtlasTrip[];
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const years = [...new Set(trips.map(trip => trip.year))].sort((first, second) => second - first);

    function handleKeyDown(event: KeyboardEvent) {
        if (!dialogRef.current || event.key !== 'Tab') return;

        trapTabKey(event, dialogRef.current);
    }

    function handleMouseDown(event: MouseEvent) {
        const dialog = dialogRef.current;

        if (dialog && event.target instanceof Node && !dialog.contains(event.target)) onClose();
    }

    useEffect(() => {
        const previousElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleMouseDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleMouseDown);
            previousElement?.focus();
        };
    }, []);

    return (
        <div className="atlas-veil grid place-items-center z-[70] p-[20px]">
            <dialog
                className={DIALOG_CLASS}
                aria-labelledby="filter-modal-title"
                aria-modal="true"
                open
                ref={dialogRef}
            >
                <header className="relative pb-[20px] pt-[24px] px-[28px] border-b border-linen">
                    <h2
                        id="filter-modal-title"
                        className="font-serif text-[26px]"
                    >
                        Filter
                    </h2>
                    <button
                        className="atlas-pill after:absolute after:content-[''] after:inset-[-9px] absolute right-[20px] top-[20px] h-[32px] w-[32px] p-0 text-storm"
                        aria-label="Close filter"
                        onClick={onClose}
                        type="button"
                    >
                        <IconClose size={11} strokeWidth={2} />
                    </button>
                </header>
                <div className="pb-[8px] pt-[20px] px-[28px]">
                    <h3 className={`${GROUP_LABEL_CLASS} mb-[12px]`}>Categories</h3>
                    <ul className="flex flex-wrap gap-[8px]">
                        <li>
                            <button
                                className={CATEGORY_CHIP_CLASS}
                                aria-pressed={isStarredOnly}
                                onClick={onToggleStarred}
                                style={getStarredChipStyle(isStarredOnly)}
                                title="Show starred places only"
                                type="button"
                            >
                                <span className="inline-flex shrink-0">
                                    <IconStar
                                        color={isStarredOnly ? getStarredForeground() : 'var(--color-storm)'}
                                        size={13}
                                    />
                                </span>
                                Starred
                            </button>
                        </li>
                        {categories.map((category) => {
                            const isSelected = selectedCategories.includes(category.id);

                            return (
                                <li key={category.id}>
                                    <button
                                        className={CATEGORY_CHIP_CLASS}
                                        aria-pressed={isSelected}
                                        onClick={() => onToggleCategory(category.id)}
                                        style={getCategoryChipStyle(category.id, isSelected)}
                                        title={category.description}
                                        type="button"
                                    >
                                        <IconCategory
                                            category={category.id}
                                            color={isSelected ? getCategoryForeground(category.id) : 'var(--color-storm)'}
                                            size={13}
                                        />
                                        {category.name}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="pb-[8px] pt-[20px] px-[28px]">
                    <h3 className={`${GROUP_LABEL_CLASS} mb-[4px]`}>Journeys</h3>
                    <ul className={TRIP_SCROLLER_CLASS}>
                        {years.map(year => (
                            <li
                                className="flex gap-[16px] py-[16px] max-md:flex-col max-md:gap-[12px]"
                                key={year}
                            >
                                <h4 className="flex-none w-[82px] font-serif leading-none text-[26px]">
                                    <time dateTime={String(year)}>{year}</time>
                                </h4>
                                <ul className="content-start flex flex-wrap gap-[8px]">
                                    {trips.filter(trip => trip.year === year).sort((first, second) => first.order - second.order).map((trip) => {
                                        const isSelected = selectedTrips.includes(trip.id);

                                        return (
                                            <li key={trip.id}>
                                                <button
                                                    className={getTripClassName(trip.ordered, isSelected)}
                                                    aria-pressed={isSelected}
                                                    onClick={() => onToggleTrip(trip.id)}
                                                    title={trip.ordered ? `${trip.count} places, ordered itinerary` : `${trip.count} places, unordered`}
                                                    type="button"
                                                >
                                                    <span className="self-baseline font-serif text-[13px]">{trip.name}</span>
                                                    <span
                                                        className="self-baseline font-mono text-[10px] opacity-[0.85]"
                                                        aria-hidden="true"
                                                    >
                                                        {trip.count}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-[12px] pb-[24px] pt-[16px] px-[28px]">
                    <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-storm">{`Showing ${shownCount} of ${totalCount}`}</span>
                    <span className="inline-flex gap-[8px]">
                        <button
                            className="atlas-pill after:absolute after:content-[''] after:inset-x-0 after:inset-y-[-6px] relative px-[16px] py-[8px] font-medium text-[12px] text-slate"
                            disabled={!canClear}
                            onClick={onClearAll}
                            type="button"
                        >
                            Clear
                        </button>
                        <button
                            className="atlas-pill atlas-pill--solid after:absolute after:content-[''] after:inset-x-0 after:inset-y-[-6px] relative px-[20px] py-[8px] font-medium text-[12px]"
                            onClick={onClose}
                            type="button"
                        >
                            Done
                        </button>
                    </span>
                </footer>
            </dialog>
        </div>
    );
}
