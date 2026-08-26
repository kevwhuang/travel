import { useEffect, useRef } from 'react';

import IconCategory from '@components/IconCategory';
import IconStar from '@components/IconStar';
import { STAR_COLOR } from '@lib/constants';
import { getAccentForeground, getCategoryColor } from '@lib/utils';

const CLASS_CATEGORY_CHIP = 'atlas-chip after:absolute after:content-[""] after:inset-x-0 after:inset-y-[-6px] hover:brightness-[0.97] relative max-w-full gap-[6px] px-[14px] py-[8px] font-medium text-[12px] wrap-anywhere';
const CLASS_CLEAR_BUTTON = 'pill after:absolute after:content-[""] after:inset-x-0 after:inset-y-[-6px] relative px-[16px] py-[8px] font-medium text-[12px] text-slate';
const CLASS_DONE_BUTTON = 'pill pill--solid after:absolute after:content-[""] after:inset-x-0 after:inset-y-[-6px] relative px-[20px] py-[8px] font-medium text-[12px]';
const CLASS_FOOTER = 'flex flex-wrap items-center justify-between shrink-0 gap-[12px] pb-[24px] pt-[16px] px-[clamp(20px,calc(17.34px+0.833vw),28px)] border-linen border-t';
const CLASS_GROUP_LABEL = 'font-mono text-[10px] tracking-[0.22em] uppercase text-storm';
const FOCUSABLE_SELECTOR = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function getChipStyle(color: string, isSelected: boolean) {
    if (!isSelected) return undefined;

    return {
        background: `color-mix(in oklab, ${color} 13%, var(--color-snow))`,
        borderColor: `color-mix(in oklab, ${color} 55%, var(--color-snow))`,
        color: getAccentForeground(color),
    };
}

function trapTabKey(event: KeyboardEvent, dialog: HTMLElement) {
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (!focusables.length) return;

    const activeElement = document.activeElement;
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];

    if (!(activeElement instanceof HTMLElement) || activeElement === dialog || !dialog.contains(activeElement)) {
        event.preventDefault();

        if (event.shiftKey) lastFocusable.focus();
        else firstFocusable.focus();

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

export default function ModalFilters({ categories, filterCount, isStarredOnly, journeys, onClearAll, onClose, onToggleCategory, onToggleJourney, onToggleStarred, selectedCategoryIds, selectedJourneyIds, shownCount, totalCount }: {
    categories: AtlasCategory[];
    filterCount: number;
    isStarredOnly: boolean;
    journeys: AtlasJourney[];
    onClearAll: () => void;
    onClose: () => void;
    onToggleCategory: (categoryId: string) => void;
    onToggleJourney: (journeyId: string) => void;
    onToggleStarred: () => void;
    selectedCategoryIds: string[];
    selectedJourneyIds: string[];
    shownCount: number;
    totalCount: number;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const hasFilters = filterCount > 0;
    const visibleJourneys = journeys.filter(journey => journey.markerCount > 0);

    const years = [...new Set(visibleJourneys.map(journey => journey.year))].sort((first, second) => second - first);

    function handleKeyDown(event: KeyboardEvent) {
        if (!dialogRef.current || event.key !== 'Tab') return;

        trapTabKey(event, dialogRef.current);
    }

    function handleMouseDown(event: MouseEvent) {
        const dialog = dialogRef.current;

        if (!dialog || !(event.target instanceof Node) || dialog.contains(event.target)) return;

        event.preventDefault();
        onClose();
    }

    useEffect(() => {
        dialogRef.current?.focus();
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleMouseDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    return (
        <div className="atlas-fade fixed grid inset-0 place-items-center z-[70] p-[20px] bg-ink-40 backdrop-blur-[4px] cursor-pointer">
            <dialog
                className="atlas-modal flex flex-col overflow-hidden static max-h-[min(780px,calc(100dvh-40px))] w-[min(calc((var(--width-shell)-var(--shell-pad)*2)/2),100%)] m-0 p-0 border border-haze rounded-[14px] bg-paper text-ink shadow-[0_30px_80px_var(--color-ink-30)] cursor-auto"
                aria-labelledby="modal-filters-title"
                aria-modal="true"
                open
                ref={dialogRef}
                tabIndex={-1}
            >
                <div className="shrink-0 pb-[20px] pt-[24px] px-[clamp(20px,calc(17.34px+0.833vw),28px)] border-b border-linen">
                    <h2
                        id="modal-filters-title"
                        className="font-serif text-[26px]"
                    >
                        Filters
                    </h2>
                </div>
                <div className="grow overflow-y-auto overscroll-contain min-h-0 [scrollbar-color:var(--color-flint)_transparent] [scrollbar-width:thin]">
                    <div className="pb-[8px] pt-[20px] px-[clamp(20px,calc(17.34px+0.833vw),28px)]">
                        <h3 className={`mb-[12px] ${CLASS_GROUP_LABEL}`}>Categories</h3>
                        <ul className="flex flex-wrap gap-[8px]">
                            <li>
                                <button
                                    className={CLASS_CATEGORY_CHIP}
                                    aria-pressed={isStarredOnly}
                                    onClick={onToggleStarred}
                                    style={getChipStyle(STAR_COLOR, isStarredOnly)}
                                    title="Show starred markers only"
                                    type="button"
                                >
                                    <span className="inline-flex shrink-0">
                                        <IconStar color={isStarredOnly ? getAccentForeground(STAR_COLOR) : 'var(--color-storm)'} size={12} />
                                    </span>
                                    Starred
                                </button>
                            </li>
                            {categories.map((category) => {
                                const isSelected = selectedCategoryIds.includes(category.id);

                                return (
                                    <li key={category.id}>
                                        <button
                                            className={CLASS_CATEGORY_CHIP}
                                            aria-pressed={isSelected}
                                            onClick={() => onToggleCategory(category.id)}
                                            style={getChipStyle(getCategoryColor(category.id), isSelected)}
                                            title={category.description}
                                            type="button"
                                        >
                                            <IconCategory
                                                categoryId={category.id}
                                                color={isSelected ? getAccentForeground(getCategoryColor(category.id)) : 'var(--color-storm)'}
                                                size={12}
                                            />
                                            {category.name}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div className="pb-[8px] pt-[20px] px-[clamp(20px,calc(17.34px+0.833vw),28px)]">
                        <h3 className={`mb-[4px] ${CLASS_GROUP_LABEL}`}>Journeys</h3>
                        <ul>
                            {years.map(year => (
                                <li
                                    className="flex gap-[16px] py-[16px] max-md:flex-col max-md:gap-[12px]"
                                    key={year}
                                >
                                    <h4 className="flex-none w-[82px] font-serif leading-none text-[26px]">
                                        <time dateTime={String(year)}>{year}</time>
                                    </h4>
                                    <ul className="content-start flex flex-wrap gap-[8px]">
                                        {visibleJourneys
                                            .filter(journey => journey.year === year)
                                            .sort((first, second) => second.order - first.order)
                                            .map((journey) => {
                                                const isSelected = selectedJourneyIds.includes(journey.id);
                                                const orderLabel = journey.isOrdered ? 'ordered itinerary' : 'unordered';

                                                return (
                                                    <li key={journey.id}>
                                                        <button
                                                            className={[
                                                                'atlas-chip',
                                                                !journey.isOrdered && 'atlas-chip--dashed',
                                                                isSelected && 'atlas-chip--selected',
                                                                'after:absolute after:content-[""] after:inset-x-0 after:inset-y-[-6px] relative max-w-full gap-[8px] px-[14px] py-[8px] wrap-anywhere',
                                                            ].filter(Boolean).join(' ')}
                                                            aria-pressed={isSelected}
                                                            onClick={() => onToggleJourney(journey.id)}
                                                            title={`${journey.markerCount} markers, ${orderLabel}`}
                                                            type="button"
                                                        >
                                                            <span className="self-baseline font-serif text-[14px]">{journey.name}</span>
                                                            <span
                                                                className="self-baseline font-mono text-[10px] opacity-[0.85]"
                                                                aria-hidden="true"
                                                            >
                                                                {journey.markerCount}
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
                </div>
                <div className={CLASS_FOOTER}>
                    <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-storm">{`Showing ${shownCount} of ${totalCount}.`}</span>
                    <span className="inline-flex gap-[8px]">
                        <button
                            className={CLASS_CLEAR_BUTTON}
                            disabled={!hasFilters}
                            onClick={onClearAll}
                            type="button"
                        >
                            Clear
                        </button>
                        <button
                            className={CLASS_DONE_BUTTON}
                            onClick={onClose}
                            type="button"
                        >
                            Done
                        </button>
                    </span>
                </div>
            </dialog>
        </div>
    );
}
