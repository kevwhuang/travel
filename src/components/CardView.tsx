import { useEffect, useMemo, useRef } from 'react';

import PlaceCard from '@components/PlaceCard';
import { CARDS_PER_PAGE } from '@lib/constants';
import { pageCountOf, tripsByIdOf } from '@lib/utils';
import { prefersReducedMotion } from '@lib/motion';

import type { KeyboardEvent } from 'react';

const CARTOUCHE_TITLE_CLASS = 'mb-[16px] font-normal font-serif leading-[1.05] text-[clamp(44px,calc(34.67px+2.917vw),72px)] tracking-[0.01em] bg-clip-text bg-linear-to-b from-ink text-transparent to-storm';
const ELLIPSIS_CLASS = 'atlas-label grid place-items-center shrink-0 h-[30px] w-[14px] text-[11px] text-storm select-none';
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(min(272px,100%),1fr))] max-w-[1560px] gap-[clamp(16px,calc(14px+0.625vw),22px)] mx-auto';
const HEADER_CLASS = 'max-w-[1560px] mx-auto pt-[clamp(84px,calc(76px+2.5vw),108px)] text-center';
const HIGHLIGHT_SCROLL_OFFSET = 130;
const NAV_CLASS = 'max-w-[1560px] mx-auto';
const NAV_LIST_CLASS = 'flex flex-wrap items-center justify-center gap-[8px]';
const PAGE_BUTTON_CLASS = 'atlas-pill after:absolute after:content-[""] after:inset-x-[-3px] after:inset-y-[-7px] relative shrink-0 h-[30px] min-w-[30px] px-[8px] font-medium text-[12px]';
const PAGE_BUTTON_IDLE_CLASS = 'bg-snow text-ink';
const PAGE_SLOTS = 7;
const PAGE_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: 1, PageUp: -1 };
const PANE_CLASS = 'absolute inset-0 overflow-x-hidden overflow-y-auto pb-[clamp(112px,calc(104px+2.5vw),136px)]';
const SECTION_GAP_CLASS = 'mb-[clamp(28px,calc(21.33px+2.08vw),48px)]';
const SHELL_PAD_CLASS = 'px-[clamp(20px,calc(5.33px+4.58vw),64px)]';
const TITLE = 'Atlas';
const TITLE_ID = 'atlas-title';

function hasModifier(event: KeyboardEvent<HTMLButtonElement>) {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function pageSlots(current: number, count: number): (number | null)[] {
    if (count <= PAGE_SLOTS) return Array.from({ length: count }, (_, page) => page);

    const start = Math.min(Math.max(current - 1, 2), count - 5);

    return [0, start === 2 ? 1 : null, start, start + 1, start + 2, start === count - 5 ? count - 2 : null, count - 1];
}

export default function CardView({ data, highlightId, onPageChange, onShowOnMap, page, places, totalCount }: {
    data: AtlasData;
    highlightId: number | null;
    onPageChange: (page: number) => void;
    onShowOnMap: (place: AtlasPlace) => void;
    page: number;
    places: AtlasPlace[];
    totalCount: number;
}) {
    const categoryLabels = useMemo(() => Object.fromEntries(data.categories.map(category => [category.id, category.name] as const)), [data.categories]);
    const isKeyPagingRef = useRef(false);
    const navRef = useRef<HTMLElement>(null);
    const pageCount = pageCountOf(places.length);
    const paneRef = useRef<HTMLDivElement>(null);
    const tripsById = useMemo(() => tripsByIdOf(data.trips), [data.trips]);

    const hasPages = pageCount > 1;
    const isFirstPage = page === 0;
    const isLastPage = page === pageCount - 1;
    const pageItems = places.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE);
    const subline = `${totalCount} places across ${data.trips.length} trips`;

    function handlePageKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        const step = PAGE_STEPS[event.key];

        if (step === undefined || hasModifier(event) || event.nativeEvent.isComposing) return;

        const target = Math.min(pageCount - 1, Math.max(0, page + step));

        if (target === page) return;

        event.preventDefault();
        isKeyPagingRef.current = true;
        onPageChange(target);
    }

    useEffect(() => {
        const pane = paneRef.current;

        if (highlightId !== null || !pane) return;

        pane.scrollTo({ behavior: 'auto', top: 0 });
    }, [page]);

    useEffect(() => {
        if (!isKeyPagingRef.current) return;

        isKeyPagingRef.current = false;
        navRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus();
    }, [page]);

    useEffect(() => {
        const pane = paneRef.current;

        if (highlightId === null || !pane) return;

        const card = pane.querySelector(`[data-place-id="${highlightId}"]`);

        if (!card) return;

        const offset = card.getBoundingClientRect().top - pane.getBoundingClientRect().top - HIGHLIGHT_SCROLL_OFFSET;

        pane.scrollTo({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', top: Math.max(0, pane.scrollTop + offset) });
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
                <p className="atlas-label text-[10px] tracking-[0.18em] text-storm">{subline}</p>
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
                        <li>
                            <button
                                className={`${PAGE_BUTTON_CLASS} ${PAGE_BUTTON_IDLE_CLASS}`}
                                aria-label="First page"
                                disabled={isFirstPage}
                                onClick={() => onPageChange(0)}
                                onKeyDown={handlePageKeyDown}
                                type="button"
                            >
                                &laquo;
                            </button>
                        </li>
                        <li>
                            <button
                                className={`${PAGE_BUTTON_CLASS} ${PAGE_BUTTON_IDLE_CLASS}`}
                                aria-label="Previous page"
                                disabled={isFirstPage}
                                onClick={() => onPageChange(Math.max(0, page - 1))}
                                onKeyDown={handlePageKeyDown}
                                type="button"
                            >
                                &lsaquo;
                            </button>
                        </li>
                        {pageSlots(page, pageCount).map((item, index) => (item === null
                            ? (
                                    <li
                                        className={ELLIPSIS_CLASS}
                                        aria-hidden="true"
                                        key={`slot-${index}`}
                                    >
                                        &hellip;
                                    </li>
                                )
                            : (
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
                                )
                        ))}
                        <li>
                            <button
                                className={`${PAGE_BUTTON_CLASS} ${PAGE_BUTTON_IDLE_CLASS}`}
                                aria-label="Next page"
                                disabled={isLastPage}
                                onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
                                onKeyDown={handlePageKeyDown}
                                type="button"
                            >
                                &rsaquo;
                            </button>
                        </li>
                        <li>
                            <button
                                className={`${PAGE_BUTTON_CLASS} ${PAGE_BUTTON_IDLE_CLASS}`}
                                aria-label="Last page"
                                disabled={isLastPage}
                                onClick={() => onPageChange(pageCount - 1)}
                                onKeyDown={handlePageKeyDown}
                                type="button"
                            >
                                &raquo;
                            </button>
                        </li>
                    </ul>
                </nav>
            )}
        </div>
    );
}
