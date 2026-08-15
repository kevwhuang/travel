import { useEffect, useMemo, useRef } from 'react';

import PlaceCard from '@components/PlaceCard';
import { CARDS_PER_PAGE, TITLE, TITLE_ID } from '@lib/constants';
import { isModifiedEvent, pageCountOf, tripsByIdOf } from '@lib/utils';
import { prefersReducedMotion } from '@lib/motion';

import type { KeyboardEvent, RefObject } from 'react';

const CARTOUCHE_TITLE_CLASS = 'mb-[16px] font-normal font-serif leading-[1.05] text-[clamp(44px,calc(34.67px+2.917vw),72px)] tracking-[0.01em] uppercase bg-clip-text bg-linear-to-b from-ink text-transparent to-storm';
const ELLIPSIS_CLASS = 'grid place-items-center shrink-0 h-[34px] w-[14px] font-mono text-[12px] uppercase text-storm select-none';
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(min(272px,100%),1fr))] max-w-[var(--width-shell)] gap-[clamp(16px,calc(14px+0.625vw),22px)] mx-auto';
const HEADER_CLASS = 'max-w-[var(--width-shell)] mx-auto pt-[clamp(84px,calc(76px+2.5vw),108px)] text-center';
const HIGHLIGHT_SCROLL_OFFSET = 130;
const NAV_CLASS = 'max-w-[var(--width-shell)] mx-auto';
const NAV_LIST_CLASS = 'flex flex-wrap items-center justify-center gap-[8px]';
const PAGE_BUTTON_CLASS = 'atlas-pill after:absolute after:content-[""] after:inset-x-[-5px] after:inset-y-[-8px] relative shrink-0 h-[34px] min-w-[34px] px-[8px] font-medium text-[13px]';
const PAGE_BUTTON_IDLE_CLASS = 'bg-snow text-ink';
const PAGE_EDGE_SLOTS = 2;
const PAGE_SLOTS = 7;
const PAGE_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: 1, PageUp: -1 };
const PAGE_WINDOW_SIZE = PAGE_SLOTS - PAGE_EDGE_SLOTS * 2;
const PAGE_WINDOW_START_OFFSET = Math.floor(PAGE_WINDOW_SIZE / 2);
const PANE_CLASS = 'absolute inset-0 overflow-x-hidden overflow-y-auto pb-[clamp(112px,calc(104px+2.5vw),136px)] [scrollbar-gutter:stable_both-edges]';
const SECTION_GAP_CLASS = 'mb-[clamp(28px,calc(21.34px+2.084vw),48px)]';
const SHELL_PAD_CLASS = 'px-[clamp(20px,calc(5.34px+4.584vw),64px)]';

function pageSlots(current: number, count: number): (number | null)[] {
    if (count <= PAGE_SLOTS) return Array.from({ length: count }, (_, page) => page);

    const lastStart = count - PAGE_EDGE_SLOTS - PAGE_WINDOW_SIZE;

    const start = Math.min(Math.max(current - PAGE_WINDOW_START_OFFSET, PAGE_EDGE_SLOTS), lastStart);

    const middle = Array.from({ length: PAGE_WINDOW_SIZE }, (_, index) => start + index);

    return [0, start === PAGE_EDGE_SLOTS ? PAGE_EDGE_SLOTS - 1 : null, ...middle, start === lastStart ? count - PAGE_EDGE_SLOTS : null, count - 1];
}

export default function CardView({ data, highlightId, isKeyboardPagingRef, onPageChange, onShowOnMap, page, places }: {
    data: AtlasData;
    highlightId: number | null;
    isKeyboardPagingRef: RefObject<boolean>;
    onPageChange: (page: number) => void;
    onShowOnMap: (place: AtlasPlace) => void;
    page: number;
    places: AtlasPlace[];
}) {
    const categoryLabels = useMemo(() => Object.fromEntries(data.categories.map(category => [category.id, category.name] as const)), [data.categories]);
    const navRef = useRef<HTMLElement>(null);
    const pageCount = pageCountOf(places.length);
    const paneRef = useRef<HTMLDivElement>(null);
    const tripsById = useMemo(() => tripsByIdOf(data.trips), [data.trips]);

    const hasPages = pageCount > 1;
    const pageItems = places.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE);

    const subline = useMemo(() => {
        const placeTally = places.length;
        const tripTally = new Set(places.map(place => place.trip).filter(trip => trip !== null)).size;

        const placeText = `${placeTally} ${placeTally === 1 ? 'place' : 'places'}`;

        if (tripTally === 0) return placeText;

        return `${placeText} across ${tripTally} ${tripTally === 1 ? 'journey' : 'journeys'}`;
    }, [places]);

    function handlePageKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        const step = PAGE_STEPS[event.key];

        if (event.nativeEvent.isComposing || isModifiedEvent(event) || step === undefined) return;

        const target = Math.min(pageCount - 1, Math.max(0, page + step));

        if (target === page) return;

        event.preventDefault();
        isKeyboardPagingRef.current = true;
        onPageChange(target);
    }

    function renderPageSlot(item: number | null, index: number) {
        if (item === null) {
            return (
                <li
                    className={ELLIPSIS_CLASS}
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
                    className={item === page ? `${PAGE_BUTTON_CLASS} atlas-pill--solid` : `${PAGE_BUTTON_CLASS} ${PAGE_BUTTON_IDLE_CLASS}`}
                    aria-current={item === page ? 'page' : undefined}
                    aria-label={`Page ${item + 1}`}
                    onClick={() => onPageChange(item)}
                    onKeyDown={handlePageKeyDown}
                    type="button"
                >
                    {item + 1}
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
            }

            return;
        }

        if (highlightId !== null || !pane) return;

        pane.scrollTo({ behavior: 'auto', top: 0 });
    }, [page]);

    useEffect(() => {
        const pane = paneRef.current;

        if (highlightId === null || !pane) return;

        const card = pane.querySelector(`[data-place-id="${highlightId}"]`);

        if (!card) return;

        const offset = card.getBoundingClientRect().top - pane.getBoundingClientRect().top - HIGHLIGHT_SCROLL_OFFSET;

        pane.scrollTo({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', top: Math.max(0, pane.scrollTop + offset) });
        card.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }, [highlightId]);

    return (
        <div
            className={PANE_CLASS}
            ref={paneRef}
        >
            <header className={`${HEADER_CLASS} ${SECTION_GAP_CLASS} ${SHELL_PAD_CLASS}`}>
                <h1
                    className={CARTOUCHE_TITLE_CLASS}
                    id={TITLE_ID}
                >
                    {TITLE}
                </h1>
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-storm">{subline}</p>
            </header>
            {places.length > 0 && (
                <ul className={hasPages ? `${GRID_CLASS} ${SECTION_GAP_CLASS} ${SHELL_PAD_CLASS}` : `${GRID_CLASS} ${SHELL_PAD_CLASS}`}>
                    {pageItems.map(place => (
                        <li
                            className="grid"
                            key={place.id}
                        >
                            <PlaceCard
                                categoryLabel={categoryLabels[place.category] ?? place.category}
                                isHighlighted={place.id === highlightId}
                                onShowOnMap={onShowOnMap}
                                place={place}
                                trip={place.trip === null ? null : tripsById[place.trip] ?? null}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {hasPages && (
                <nav
                    className={`${NAV_CLASS} ${SHELL_PAD_CLASS}`}
                    aria-label="Pagination"
                    ref={navRef}
                >
                    <ul className={NAV_LIST_CLASS}>
                        {pageSlots(page, pageCount).map(renderPageSlot)}
                    </ul>
                </nav>
            )}
        </div>
    );
}
