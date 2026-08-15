import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';

import ErrorBoundary from '@components/ErrorBoundary';
import IconNorth from '@components/IconNorth';
import ModalFilters from '@components/ModalFilters';
import Overlay from '@components/Overlay';
import ViewCards from '@components/ViewCards';
import { ARROW_PAGE_STEPS, ATLAS_TITLE, CARDS_PER_PAGE, SEARCH_SHORTCUT } from '@lib/constants';
import { getJourneysById, getPageCount } from '@lib/utils';
import { loadAtlasState, saveAtlasState } from '@lib/store';

import type { Dispatch, SetStateAction } from 'react';

interface AtlasState {
    cardMarkers: AtlasMarker[];
    currentPage: number;
    filterCount: number;
    filteredMarkers: AtlasMarker[];
    flyTarget: AtlasFlyTarget | null;
    hasSearch: boolean;
    highlightedMarkerId: number | null;
    isModalOpen: boolean;
    isSearchExpanded: boolean;
    isSearchOpen: boolean;
    isStarredOnly: boolean;
    pageCount: number;
    searchValue: string;
    selectedCategoryIds: string[];
    selectedJourneyIds: string[];
    selectedMarkerId: number | null;
    setFlyTarget: Dispatch<SetStateAction<AtlasFlyTarget | null>>;
    setHighlightedMarkerId: Dispatch<SetStateAction<number | null>>;
    setIsModalOpen: Dispatch<SetStateAction<boolean>>;
    setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
    setIsStarredOnly: Dispatch<SetStateAction<boolean>>;
    setPage: Dispatch<SetStateAction<number>>;
    setSearchValue: Dispatch<SetStateAction<string>>;
    setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>;
    setSelectedJourneyIds: Dispatch<SetStateAction<string[]>>;
    setSelectedMarkerId: Dispatch<SetStateAction<number | null>>;
    setView: Dispatch<SetStateAction<AtlasView>>;
    totalCount: number;
    view: AtlasView;
}

const DEFAULT_VIEW = 'map';
const EDITABLE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const EMPTY_STATUS = 'No markers match';
const HIGHLIGHT_DURATION = 2_600;

const ViewMap = lazy(() => import('@components/ViewMap'));

function compareCardMarkers(first: AtlasMarker, second: AtlasMarker, journeysById: Record<string, AtlasJourney>) {
    const firstJourney = findJourney(first, journeysById);
    const secondJourney = findJourney(second, journeysById);

    if (!firstJourney || !secondJourney) {
        const journeyOrder = Number(!firstJourney) - Number(!secondJourney);

        return journeyOrder === 0 ? first.id - second.id : journeyOrder;
    }

    if (firstJourney.year !== secondJourney.year) return secondJourney.year - firstJourney.year;
    if (firstJourney.order !== secondJourney.order) return secondJourney.order - firstJourney.order;

    return first.id - second.id;
}

function findJourney(marker: AtlasMarker, journeysById: Record<string, AtlasJourney>) {
    return marker.journeyId === null ? null : journeysById[marker.journeyId] ?? null;
}

function foldText(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getKnownIds(storedIds: string[], knownItems: { id: string }[]) {
    return storedIds.filter(id => knownItems.some(item => item.id === id));
}

function toggleValue(values: string[], value: string) {
    return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

function useAtlasState(data: AtlasData): AtlasState {
    const [flyTarget, setFlyTarget] = useState<AtlasFlyTarget | null>(null);
    const [highlightedMarkerId, setHighlightedMarkerId] = useState<number | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isStarredOnly, setIsStarredOnly] = useState(false);
    const journeysById = useMemo(() => getJourneysById(data.journeys), [data.journeys]);
    const [page, setPage] = useState(0);
    const [searchValue, setSearchValue] = useState('');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
    const [selectedJourneyIds, setSelectedJourneyIds] = useState<string[]>([]);
    const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);
    const [view, setView] = useState<AtlasView>(DEFAULT_VIEW);

    const filteredMarkers = useMemo(() => {
        const query = foldText(searchValue.trim());

        return data.markers.filter((marker) => {
            if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(marker.categoryId)) return false;
            if (selectedJourneyIds.length > 0 && (marker.journeyId === null || !selectedJourneyIds.includes(marker.journeyId))) return false;
            if (isStarredOnly && !marker.isStarred) return false;
            if (!foldText(marker.name).includes(query) && query.length > 0) return false;

            return true;
        });
    }, [data.markers, isStarredOnly, searchValue, selectedCategoryIds, selectedJourneyIds]);

    const cardMarkers = useMemo(() => [...filteredMarkers]
        .sort((first, second) => compareCardMarkers(first, second, journeysById)), [filteredMarkers, journeysById]);

    const hasSearch = searchValue.trim().length > 0;
    const pageCount = getPageCount(cardMarkers.length);

    const currentPage = Math.min(page, pageCount - 1);
    const filterCount = selectedCategoryIds.length + selectedJourneyIds.length + (isStarredOnly ? 1 : 0);
    const isSearchExpanded = hasSearch || isSearchOpen;
    const totalCount = data.markers.length;

    useEffect(() => {
        const storedState = loadAtlasState();

        if (storedState?.isStarredOnly) setIsStarredOnly(true);
        if (storedState?.page !== undefined) setPage(storedState.page);
        if (storedState?.searchValue !== undefined) setSearchValue(storedState.searchValue);
        if (storedState?.selectedCategoryIds) setSelectedCategoryIds(getKnownIds(storedState.selectedCategoryIds, data.categories));
        if (storedState?.selectedJourneyIds) setSelectedJourneyIds(getKnownIds(storedState.selectedJourneyIds, data.journeys));

        setIsHydrated(true);
        setView(storedState?.view ?? DEFAULT_VIEW);
    }, []);

    useEffect(() => {
        if (!isHydrated) return;

        saveAtlasState({ isStarredOnly, page: currentPage, searchValue, selectedCategoryIds, selectedJourneyIds, view });
    }, [currentPage, isHydrated, isStarredOnly, searchValue, selectedCategoryIds, selectedJourneyIds, view]);

    useEffect(() => {
        setPage(current => Math.min(current, pageCount - 1));
    }, [pageCount]);

    useEffect(() => {
        if (highlightedMarkerId === null) return;

        const timer = setTimeout(() => setHighlightedMarkerId(null), HIGHLIGHT_DURATION);

        return () => clearTimeout(timer);
    }, [highlightedMarkerId]);

    return {
        cardMarkers,
        currentPage,
        filterCount,
        filteredMarkers,
        flyTarget,
        hasSearch,
        highlightedMarkerId,
        isModalOpen,
        isSearchExpanded,
        isSearchOpen,
        isStarredOnly,
        pageCount,
        searchValue,
        selectedCategoryIds,
        selectedJourneyIds,
        selectedMarkerId,
        setFlyTarget,
        setHighlightedMarkerId,
        setIsModalOpen,
        setIsSearchOpen,
        setIsStarredOnly,
        setPage,
        setSearchValue,
        setSelectedCategoryIds,
        setSelectedJourneyIds,
        setSelectedMarkerId,
        setView,
        totalCount,
        view,
    };
}

function AtlasInner({ data }: { data: AtlasData }) {
    const atlas = useAtlasState(data);
    const filterButtonRef = useRef<HTMLButtonElement>(null);
    const isKeyboardPagingRef = useRef(false);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const wasModalOpenRef = useRef(false);

    const pageSuffix = atlas.pageCount > 1 && atlas.view === 'cards' ? `, page ${atlas.currentPage + 1} of ${atlas.pageCount}` : '';
    const shownCount = atlas.filteredMarkers.length;

    const statusMessage = shownCount === 0 ? EMPTY_STATUS : `${shownCount} of ${atlas.totalCount} markers shown${pageSuffix}`;

    function handleClearAll() {
        atlas.setIsStarredOnly(false);
        atlas.setSelectedCategoryIds([]);
        atlas.setSelectedJourneyIds([]);
        resetAfterFilterChange();
    }

    function handleClearSearch() {
        atlas.setSearchValue('');
        resetAfterFilterChange();
    }

    function handleCloseModal() {
        atlas.setIsModalOpen(false);
    }

    function handleEscape() {
        if (atlas.isModalOpen) {
            handleCloseModal();

            return;
        }

        if (atlas.selectedMarkerId !== null) {
            atlas.setSelectedMarkerId(null);

            return;
        }

        if (atlas.hasSearch) {
            handleClearSearch();

            if (document.activeElement !== searchInputRef.current) atlas.setIsSearchOpen(false);

            return;
        }

        if (!atlas.isSearchOpen) return;

        atlas.setIsSearchOpen(false);
        searchButtonRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.isComposing) return;

        if (event.key === 'Escape') {
            handleEscape();

            return;
        }

        const target = event.target;

        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (atlas.isModalOpen) return;
        if (target instanceof HTMLElement && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)) return;

        const step = ARROW_PAGE_STEPS[event.key];

        if (step !== undefined) {
            handlePageStep(event, step);

            return;
        }

        if (event.key !== SEARCH_SHORTCUT) return;

        atlas.setIsSearchOpen(true);
        event.preventDefault();
        searchInputRef.current?.focus();
    }

    function handlePageStep(event: KeyboardEvent, step: number) {
        if (atlas.view !== 'cards' || event.defaultPrevented || event.shiftKey) return;

        const targetPage = Math.max(0, Math.min(atlas.pageCount - 1, atlas.currentPage + step));

        if (targetPage === atlas.currentPage) return;

        isKeyboardPagingRef.current = true;
        atlas.setPage(targetPage);
        event.preventDefault();
    }

    function handleSearchChange(value: string) {
        atlas.setIsSearchOpen(true);
        atlas.setSearchValue(value);
        resetAfterFilterChange();
    }

    function handleShowInCards(marker: AtlasMarker) {
        const index = atlas.cardMarkers.findIndex(item => item.id === marker.id);

        atlas.setFlyTarget(null);
        atlas.setHighlightedMarkerId(marker.id);
        atlas.setPage(Math.max(0, Math.floor(index / CARDS_PER_PAGE)));
        atlas.setSelectedMarkerId(null);
        atlas.setView('cards');
    }

    function handleShowOnMap(marker: AtlasMarker) {
        atlas.setFlyTarget({ markerId: marker.id });
        atlas.setHighlightedMarkerId(null);
        atlas.setSelectedMarkerId(null);
        atlas.setView('map');
    }

    function handleToggleCategory(id: string) {
        atlas.setSelectedCategoryIds(current => toggleValue(current, id));
        resetAfterFilterChange();
    }

    function handleToggleJourney(id: string) {
        atlas.setSelectedJourneyIds(current => toggleValue(current, id));
        resetAfterFilterChange();
    }

    function handleToggleStarred() {
        atlas.setIsStarredOnly(current => !current);
        resetAfterFilterChange();
    }

    function handleToggleView() {
        atlas.setFlyTarget(null);
        atlas.setSelectedMarkerId(null);
        atlas.setView(current => (current === 'cards' ? 'map' : 'cards'));
    }

    function resetAfterFilterChange() {
        atlas.setFlyTarget(null);
        atlas.setPage(0);
        atlas.setSelectedMarkerId(null);
    }

    useEffect(() => {
        if (!atlas.isModalOpen && wasModalOpenRef.current) filterButtonRef.current?.focus();

        wasModalOpenRef.current = atlas.isModalOpen;
    }, [atlas.isModalOpen]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [atlas.currentPage, atlas.hasSearch, atlas.isModalOpen, atlas.isSearchOpen, atlas.pageCount, atlas.selectedMarkerId, atlas.view]);

    return (
        <div className="atlas-plot fixed inset-0 overflow-hidden bg-paper text-ink">
            <div className="contents" inert={atlas.isModalOpen || undefined}>
                {atlas.view !== 'cards' && (
                    <h1 className="sr-only">{ATLAS_TITLE}</h1>
                )}
                {atlas.view === 'map'
                    ? (
                            <Suspense fallback={<Skeleton />}>
                                <ViewMap
                                    categories={data.categories}
                                    flyTarget={atlas.flyTarget}
                                    journeys={data.journeys}
                                    markers={atlas.filteredMarkers}
                                    onSelectMarker={atlas.setSelectedMarkerId}
                                    onShowInCards={handleShowInCards}
                                    regions={data.regions}
                                    selectedMarkerId={atlas.selectedMarkerId}
                                />
                            </Suspense>
                        )
                    : (
                            <ViewCards
                                data={data}
                                highlightedMarkerId={atlas.highlightedMarkerId}
                                isKeyboardPagingRef={isKeyboardPagingRef}
                                markers={atlas.cardMarkers}
                                onPageChange={atlas.setPage}
                                onShowOnMap={handleShowOnMap}
                                page={atlas.currentPage}
                            />
                        )}
                <Overlay
                    filterButtonRef={filterButtonRef}
                    filterCount={atlas.filterCount}
                    isSearchExpanded={atlas.isSearchExpanded}
                    onClearSearch={handleClearSearch}
                    onOpenFilters={() => atlas.setIsModalOpen(true)}
                    onSearchBlur={() => { if (!atlas.hasSearch) atlas.setIsSearchOpen(false); }}
                    onSearchChange={handleSearchChange}
                    onSearchFocus={() => atlas.setIsSearchOpen(true)}
                    onToggleView={handleToggleView}
                    searchButtonRef={searchButtonRef}
                    searchInputRef={searchInputRef}
                    searchValue={atlas.searchValue}
                    view={atlas.view}
                />
                <div className="atlas-grain z-[90]" aria-hidden="true" />
            </div>
            <p
                className="sr-only"
                role="status"
            >
                {statusMessage}
            </p>
            {atlas.isModalOpen && (
                <ModalFilters
                    categories={data.categories}
                    filterCount={atlas.filterCount}
                    isStarredOnly={atlas.isStarredOnly}
                    journeys={data.journeys}
                    onClearAll={handleClearAll}
                    onClose={handleCloseModal}
                    onToggleCategory={handleToggleCategory}
                    onToggleJourney={handleToggleJourney}
                    onToggleStarred={handleToggleStarred}
                    selectedCategoryIds={atlas.selectedCategoryIds}
                    selectedJourneyIds={atlas.selectedJourneyIds}
                    shownCount={shownCount}
                    totalCount={atlas.totalCount}
                />
            )}
        </div>
    );
}

function Skeleton() {
    return (
        <div
            className="atlas-fade absolute grid inset-0 place-items-center"
            role="status"
        >
            <div className="flex flex-col items-center gap-[16px]">
                <div className="atlas-pulse grid place-items-center h-[64px] w-[64px] border border-dashed border-storm rounded-full text-storm">
                    <IconNorth size={22} strokeWidth={1.6} />
                </div>
                <p className="font-serif text-[clamp(20px,calc(18px+0.625vw),26px)] text-storm select-none">Loading</p>
            </div>
        </div>
    );
}

export default function Atlas({ data }: { data: AtlasData }) {
    return (
        <ErrorBoundary>
            <AtlasInner data={data} />
        </ErrorBoundary>
    );
}
