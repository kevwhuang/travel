import { useEffect, useMemo, useRef } from 'react';

import CardMarker from '@components/CardMarker';
import { ARROW_PAGE_STEPS, ATLAS_TITLE, CARDS_PER_PAGE } from '@lib/constants';
import { getJourneysById, getPageCount, isModifiedEvent } from '@lib/utils';
import { prefersReducedMotion } from '@lib/motion';

import type { KeyboardEvent, RefObject } from 'react';

const CLASS_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(276px,100%),1fr))] max-w-[var(--width-shell)] gap-[20px] mx-auto';
const CLASS_PAGE_BUTTON = 'after:absolute after:content-[""] after:inset-x-[-4px] after:inset-y-[-8px] relative shrink-0 h-[34px] min-w-[34px] px-[8px] font-medium text-[14px]';
const CLASS_SECTION_GAP = 'mb-[clamp(28px,calc(21.34px+2.084vw),48px)]';
const CLASS_SHELL_PAD = 'px-[var(--shell-pad)]';
const CLASS_TITLE = 'mb-[16px] font-normal font-serif leading-[1.05] text-[clamp(44px,calc(34.67px+2.917vw),72px)] uppercase bg-clip-text bg-linear-to-b from-ink text-transparent to-storm';
const HIGHLIGHT_SCROLL_OFFSET = 130;
const PAGE_EDGE_SLOTS = 2;
const PAGE_SLOTS = 7;
const PAGE_STEPS: Record<string, number> = { ...ARROW_PAGE_STEPS, PageDown: 1, PageUp: -1 };
const PAGE_WINDOW_SIZE = PAGE_SLOTS - PAGE_EDGE_SLOTS * 2;
const PAGE_WINDOW_START_OFFSET = Math.floor(PAGE_WINDOW_SIZE / 2);

function getPageSlots(currentPage: number, pageCount: number): (number | null)[] {
    if (pageCount <= PAGE_SLOTS) return Array.from({ length: pageCount }, (_, page) => page);

    const lastStart = pageCount - PAGE_EDGE_SLOTS - PAGE_WINDOW_SIZE;

    const start = Math.min(Math.max(currentPage - PAGE_WINDOW_START_OFFSET, PAGE_EDGE_SLOTS), lastStart);

    const windowPages = Array.from({ length: PAGE_WINDOW_SIZE }, (_, index) => start + index);

    return [
        0,
        start === PAGE_EDGE_SLOTS ? PAGE_EDGE_SLOTS - 1 : null,
        ...windowPages,
        start === lastStart ? pageCount - PAGE_EDGE_SLOTS : null,
        pageCount - 1,
    ];
}

export default function ViewCards({ data, highlightedMarkerId, isKeyboardPagingRef, markers, onPageChange, onShowOnMap, page }: {
    data: AtlasData;
    highlightedMarkerId: number | null;
    isKeyboardPagingRef: RefObject<boolean>;
    markers: AtlasMarker[];
    onPageChange: (page: number) => void;
    onShowOnMap: (marker: AtlasMarker) => void;
    page: number;
}) {
    const categoryLabels = useMemo(() => Object.fromEntries(data.categories
        .map(category => [category.id, category.name] as const)), [data.categories]);

    const journeysById = useMemo(() => getJourneysById(data.journeys), [data.journeys]);
    const navRef = useRef<HTMLElement>(null);
    const pageCount = getPageCount(markers.length);
    const paneRef = useRef<HTMLDivElement>(null);

    const hasMultiplePages = pageCount > 1;
    const pageMarkers = markers.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE);

    const subline = useMemo(() => {
        const journeyCount = new Set(markers
            .map(marker => marker.journeyId)
            .filter(journeyId => journeyId !== null)).size;

        const markerCount = markers.length;

        const markerText = `${markerCount} ${markerCount === 1 ? 'marker' : 'markers'}`;

        if (journeyCount === 0) return markerText;

        return `${markerText} across ${journeyCount} ${journeyCount === 1 ? 'journey' : 'journeys'}`;
    }, [markers]);

    function handlePageKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        const step = PAGE_STEPS[event.key];

        if (event.nativeEvent.isComposing || isModifiedEvent(event) || step === undefined) return;

        const targetPage = Math.min(pageCount - 1, Math.max(0, page + step));

        if (targetPage === page) return;

        isKeyboardPagingRef.current = true;
        event.preventDefault();
        onPageChange(targetPage);
    }

    function renderPageSlot(slot: number | null, index: number) {
        if (slot === null) {
            return (
                <li
                    className="grid place-items-center shrink-0 h-[34px] w-[14px] font-mono text-[12px] uppercase text-storm select-none"
                    aria-hidden="true"
                    key={`slot-${index}`}
                >
                    &hellip;
                </li>
            );
        }

        return (
            <li key={`slot-${index}`}>
                <button
                    className={['pill', slot === page && 'pill--solid', CLASS_PAGE_BUTTON, slot !== page && 'bg-snow text-ink'].filter(Boolean).join(' ')}
                    aria-current={slot === page ? 'page' : undefined}
                    aria-label={`Page ${slot + 1}`}
                    onClick={() => onPageChange(slot)}
                    onKeyDown={handlePageKeyDown}
                    type="button"
                >
                    {slot + 1}
                </button>
            </li>
        );
    }

    useEffect(() => {
        const nav = navRef.current;
        const pane = paneRef.current;

        if (isKeyboardPagingRef.current) {
            isKeyboardPagingRef.current = false;

            if (nav?.contains(document.activeElement)) {
                nav.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus({ preventScroll: true });

                return;
            }

            pane?.scrollTo({ behavior: 'auto', top: 0 });
            pane?.querySelector<HTMLButtonElement>('article button')?.focus({ preventScroll: true });

            return;
        }

        if (highlightedMarkerId !== null || !pane) return;

        pane.scrollTo({ behavior: 'auto', top: 0 });
    }, [page]);

    useEffect(() => {
        const pane = paneRef.current;

        if (highlightedMarkerId === null || !pane) return;

        const card = pane.querySelector(`[data-marker-id="${highlightedMarkerId}"]`);

        if (!card) return;

        const offset = card.getBoundingClientRect().top - pane.getBoundingClientRect().top - HIGHLIGHT_SCROLL_OFFSET;

        pane.scrollTo({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', top: Math.max(0, pane.scrollTop + offset) });
        card.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }, [highlightedMarkerId]);

    return (
        <div
            className="absolute inset-0 overflow-x-hidden overflow-y-auto pb-[clamp(112px,calc(104px+2.5vw),136px)] [scrollbar-gutter:stable_both-edges]"
            ref={paneRef}
        >
            <header className={`max-w-[var(--width-shell)] ${CLASS_SECTION_GAP} mx-auto pt-[clamp(84px,calc(76px+2.5vw),108px)] ${CLASS_SHELL_PAD} text-center`}>
                <h1 className={CLASS_TITLE}>{ATLAS_TITLE}</h1>
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-storm">{subline}</p>
            </header>
            {markers.length > 0 && (
                <ul className={hasMultiplePages ? `${CLASS_GRID} ${CLASS_SECTION_GAP} ${CLASS_SHELL_PAD}` : `${CLASS_GRID} ${CLASS_SHELL_PAD}`}>
                    {pageMarkers.map(marker => (
                        <li
                            className="grid"
                            key={marker.id}
                        >
                            <CardMarker
                                categoryLabel={categoryLabels[marker.categoryId] ?? marker.categoryId}
                                isHighlighted={marker.id === highlightedMarkerId}
                                journey={marker.journeyId === null ? null : journeysById[marker.journeyId] ?? null}
                                marker={marker}
                                onShowOnMap={onShowOnMap}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {hasMultiplePages && (
                <nav
                    className={`max-w-[var(--width-shell)] mx-auto ${CLASS_SHELL_PAD}`}
                    aria-label="Pagination"
                    ref={navRef}
                >
                    <ul className="flex flex-wrap items-center justify-center gap-[8px]">
                        {getPageSlots(page, pageCount).map(renderPageSlot)}
                    </ul>
                </nav>
            )}
        </div>
    );
}
