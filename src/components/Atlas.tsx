import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';

import AtlasControls from '@components/AtlasControls';
import CardView from '@components/CardView';
import ErrorBoundary from '@components/ErrorBoundary';
import IconNorthArrow from '@components/IconNorthArrow';
import ModalFilter from '@components/ModalFilter';
import { CARDS_PER_PAGE, SEARCH_KEY, TITLE, TITLE_ID } from '@lib/constants';
import { loadAtlasState, saveAtlasState } from '@lib/store';
import { pageCountOf, tripsByIdOf } from '@lib/utils';

import type { Dispatch, SetStateAction } from 'react';

interface AtlasStateValue {
    cardPlaces: AtlasPlace[];
    currentPage: number;
    filterCount: number;
    filteredPlaces: AtlasPlace[];
    flyTarget: AtlasFlyTarget | null;
    hasSearch: boolean;
    highlightId: number | null;
    isModalOpen: boolean;
    isSearchExpanded: boolean;
    isSearchOpen: boolean;
    isStarredOnly: boolean;
    pageCount: number;
    search: string;
    selectedCategories: string[];
    selectedPlaceId: number | null;
    selectedTrips: string[];
    setFlyTarget: Dispatch<SetStateAction<AtlasFlyTarget | null>>;
    setHighlightId: Dispatch<SetStateAction<number | null>>;
    setIsModalOpen: Dispatch<SetStateAction<boolean>>;
    setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
    setIsStarredOnly: Dispatch<SetStateAction<boolean>>;
    setPage: Dispatch<SetStateAction<number>>;
    setSearch: Dispatch<SetStateAction<string>>;
    setSelectedCategories: Dispatch<SetStateAction<string[]>>;
    setSelectedPlaceId: Dispatch<SetStateAction<number | null>>;
    setSelectedTrips: Dispatch<SetStateAction<string[]>>;
    setView: Dispatch<SetStateAction<AtlasState['view']>>;
    totalCount: number;
    view: AtlasState['view'];
}

const DEFAULT_VIEW = 'map';
const EDITABLE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const EMPTY_STATUS = 'No places match';
const HIGHLIGHT_DURATION = 2_600;
const PAGE_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

const MapView = lazy(() => import('@components/MapView'));

function compareCardPlaces(first: AtlasPlace, second: AtlasPlace, tripsById: Record<string, AtlasTrip>) {
    const tripOrder = compareTrips(first, second, tripsById);

    if (tripOrder !== 0) return tripOrder;

    return first.id - second.id;
}

function compareTrips(first: AtlasPlace, second: AtlasPlace, tripsById: Record<string, AtlasTrip>) {
    const firstTrip = tripOf(first, tripsById);
    const secondTrip = tripOf(second, tripsById);

    if (!firstTrip || !secondTrip) return Number(!firstTrip) - Number(!secondTrip);
    if (firstTrip.year !== secondTrip.year) return secondTrip.year - firstTrip.year;

    return secondTrip.order - firstTrip.order;
}

function foldedText(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;

    return EDITABLE_TAGS.has(target.tagName);
}

function knownIdsOf(stored: string[], known: { id: string }[]) {
    return stored.filter(id => known.some(item => item.id === id));
}

function toggleValue(values: string[], value: string) {
    return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

function tripOf(place: AtlasPlace, tripsById: Record<string, AtlasTrip>) {
    return place.trip === null ? null : tripsById[place.trip] ?? null;
}

function useAtlasState(data: AtlasData): AtlasStateValue {
    const [flyTarget, setFlyTarget] = useState<AtlasFlyTarget | null>(null);
    const [highlightId, setHighlightId] = useState<number | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isStarredOnly, setIsStarredOnly] = useState(false);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
    const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
    const tripsById = useMemo(() => tripsByIdOf(data.trips), [data.trips]);
    const [view, setView] = useState<AtlasState['view']>(DEFAULT_VIEW);

    const filteredPlaces = useMemo(() => {
        const query = foldedText(search.trim());

        return data.places.filter((place) => {
            if (selectedCategories.length > 0 && !selectedCategories.includes(place.category)) return false;
            if (selectedTrips.length > 0 && (place.trip === null || !selectedTrips.includes(place.trip))) return false;
            if (isStarredOnly && place.starred !== true) return false;
            if (!foldedText(place.name).includes(query) && query.length > 0) return false;

            return true;
        });
    }, [data.places, isStarredOnly, search, selectedCategories, selectedTrips]);

    const cardPlaces = useMemo(() => [...filteredPlaces].sort((first, second) => compareCardPlaces(first, second, tripsById)), [filteredPlaces, tripsById]);

    const hasSearch = search.trim().length > 0;
    const pageCount = pageCountOf(cardPlaces.length);

    const currentPage = Math.min(page, pageCount - 1);
    const filterCount = selectedCategories.length + selectedTrips.length + (isStarredOnly ? 1 : 0);
    const isSearchExpanded = hasSearch || isSearchOpen;
    const totalCount = data.places.length;

    useEffect(() => {
        const stored = loadAtlasState();

        if (stored?.categories) setSelectedCategories(knownIdsOf(stored.categories, data.categories));
        if (stored?.page !== undefined) setPage(stored.page);
        if (stored?.search !== undefined) setSearch(stored.search);
        if (stored?.starredOnly) setIsStarredOnly(true);
        if (stored?.trips) setSelectedTrips(knownIdsOf(stored.trips, data.trips));

        setIsHydrated(true);
        setView(stored?.view ?? DEFAULT_VIEW);
    }, []);

    useEffect(() => {
        if (!isHydrated) return;

        saveAtlasState({ categories: selectedCategories, page, search, starredOnly: isStarredOnly, trips: selectedTrips, view });
    }, [isHydrated, isStarredOnly, page, search, selectedCategories, selectedTrips, view]);

    useEffect(() => {
        setPage(current => Math.min(current, pageCount - 1));
    }, [pageCount]);

    useEffect(() => {
        if (highlightId === null) return;

        const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_DURATION);

        return () => clearTimeout(timer);
    }, [highlightId]);

    return {
        cardPlaces,
        currentPage,
        filterCount,
        filteredPlaces,
        flyTarget,
        hasSearch,
        highlightId,
        isModalOpen,
        isSearchExpanded,
        isSearchOpen,
        isStarredOnly,
        pageCount,
        search,
        selectedCategories,
        selectedPlaceId,
        selectedTrips,
        setFlyTarget,
        setHighlightId,
        setIsModalOpen,
        setIsSearchOpen,
        setIsStarredOnly,
        setPage,
        setSearch,
        setSelectedCategories,
        setSelectedPlaceId,
        setSelectedTrips,
        setView,
        totalCount,
        view,
    };
}

function AtlasInner({ data }: { data: AtlasData }) {
    const atlas = useAtlasState(data);
    const filtersRef = useRef<HTMLButtonElement>(null);
    const isKeyboardPagingRef = useRef(false);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const statusMessage = atlas.filteredPlaces.length === 0 ? EMPTY_STATUS : `${atlas.filteredPlaces.length} of ${atlas.totalCount} places shown`;

    function handleClearAll() {
        atlas.setIsStarredOnly(false);
        atlas.setSelectedCategories([]);
        atlas.setSelectedTrips([]);
        resetAfterFilterChange();
    }

    function handleClearSearch() {
        atlas.setSearch('');
        resetAfterFilterChange();
    }

    function handleCloseModal() {
        atlas.setIsModalOpen(false);
        filtersRef.current?.focus();
    }

    function handleEscape() {
        if (atlas.isModalOpen) {
            handleCloseModal();

            return;
        }

        if (atlas.selectedPlaceId !== null) {
            atlas.setSelectedPlaceId(null);

            return;
        }

        if (atlas.hasSearch) {
            handleClearSearch();

            if (document.activeElement !== searchRef.current) atlas.setIsSearchOpen(false);

            return;
        }

        if (!atlas.isSearchOpen) return;

        atlas.setIsSearchOpen(false);
        searchButtonRef.current?.focus();
    }

    function handleFocusSearch() {
        atlas.setIsSearchOpen(true);
        searchRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.isComposing) return;

        if (event.key === 'Escape') {
            handleEscape();

            return;
        }

        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (atlas.isModalOpen || isEditableTarget(event.target)) return;

        const step = PAGE_STEPS[event.key];

        if (step !== undefined) {
            handlePageStep(event, step);

            return;
        }

        if (event.key !== SEARCH_KEY) return;

        event.preventDefault();
        handleFocusSearch();
    }

    function handlePageStep(event: KeyboardEvent, step: number) {
        if (atlas.view !== 'cards' || event.defaultPrevented || event.shiftKey) return;

        const target = Math.max(0, Math.min(atlas.pageCount - 1, atlas.currentPage + step));

        if (target === atlas.currentPage) return;

        event.preventDefault();
        isKeyboardPagingRef.current = true;
        atlas.setPage(target);
    }

    function handleSearchChange(value: string) {
        atlas.setIsSearchOpen(true);
        atlas.setSearch(value);
        resetAfterFilterChange();
    }

    function handleShowInCards(place: AtlasPlace) {
        const index = atlas.cardPlaces.findIndex(item => item.id === place.id);

        atlas.setFlyTarget(null);
        atlas.setHighlightId(place.id);
        atlas.setPage(Math.max(0, Math.floor(index / CARDS_PER_PAGE)));
        atlas.setSelectedPlaceId(null);
        atlas.setView('cards');
    }

    function handleShowOnMap(place: AtlasPlace) {
        atlas.setFlyTarget({ placeId: place.id });
        atlas.setHighlightId(null);
        atlas.setSelectedPlaceId(null);
        atlas.setView('map');
    }

    function handleToggleCategory(id: string) {
        atlas.setSelectedCategories(current => toggleValue(current, id));
        resetAfterFilterChange();
    }

    function handleToggleStarred() {
        atlas.setIsStarredOnly(current => !current);
        resetAfterFilterChange();
    }

    function handleToggleTrip(id: string) {
        atlas.setSelectedTrips(current => toggleValue(current, id));
        resetAfterFilterChange();
    }

    function handleToggleView() {
        atlas.setFlyTarget(null);
        atlas.setSelectedPlaceId(null);
        atlas.setView(current => (current === 'cards' ? 'map' : 'cards'));
    }

    function renderView() {
        if (atlas.view === 'map') {
            return (
                <Suspense fallback={<MapSkeleton />}>
                    <MapView
                        categories={data.categories}
                        flyTarget={atlas.flyTarget}
                        onSelectPlace={atlas.setSelectedPlaceId}
                        onShowInCards={handleShowInCards}
                        places={atlas.filteredPlaces}
                        regions={data.regions}
                        selectedPlaceId={atlas.selectedPlaceId}
                        trips={data.trips}
                    />
                </Suspense>
            );
        }

        return (
            <CardView
                data={data}
                highlightId={atlas.highlightId}
                isKeyboardPagingRef={isKeyboardPagingRef}
                onPageChange={atlas.setPage}
                onShowOnMap={handleShowOnMap}
                page={atlas.currentPage}
                places={atlas.cardPlaces}
            />
        );
    }

    function resetAfterFilterChange() {
        atlas.setFlyTarget(null);
        atlas.setPage(0);
        atlas.setSelectedPlaceId(null);
    }

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [atlas.currentPage, atlas.hasSearch, atlas.isModalOpen, atlas.isSearchOpen, atlas.pageCount, atlas.selectedPlaceId, atlas.view]);

    return (
        <div className="atlas-plot fixed inset-0 overflow-hidden bg-paper text-ink">
            <div className="contents" inert={atlas.isModalOpen || undefined}>
                {atlas.view !== 'cards' && (
                    <h1
                        id={TITLE_ID}
                        className="sr-only"
                    >
                        {TITLE}
                    </h1>
                )}
                {renderView()}
                <AtlasControls
                    filterCount={atlas.filterCount}
                    filtersRef={filtersRef}
                    isSearchOpen={atlas.isSearchExpanded}
                    onClearSearch={handleClearSearch}
                    onOpenFilters={() => atlas.setIsModalOpen(true)}
                    onSearchBlur={() => { if (!atlas.hasSearch) atlas.setIsSearchOpen(false); }}
                    onSearchChange={handleSearchChange}
                    onSearchFocus={() => atlas.setIsSearchOpen(true)}
                    onToggleView={handleToggleView}
                    search={atlas.search}
                    searchButtonRef={searchButtonRef}
                    searchRef={searchRef}
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
                <ModalFilter
                    canClear={atlas.filterCount > 0}
                    categories={data.categories}
                    isStarredOnly={atlas.isStarredOnly}
                    onClearAll={handleClearAll}
                    onClose={handleCloseModal}
                    onToggleCategory={handleToggleCategory}
                    onToggleStarred={handleToggleStarred}
                    onToggleTrip={handleToggleTrip}
                    selectedCategories={atlas.selectedCategories}
                    selectedTrips={atlas.selectedTrips}
                    shownCount={atlas.filteredPlaces.length}
                    totalCount={atlas.totalCount}
                    trips={data.trips}
                />
            )}
        </div>
    );
}

function MapSkeleton() {
    return (
        <div
            className="atlas-fade absolute grid inset-0 place-items-center"
            role="status"
        >
            <div className="flex flex-col items-center gap-[16px]">
                <div className="atlas-pulse grid place-items-center h-[64px] w-[64px] border border-dashed border-storm rounded-full text-storm">
                    <IconNorthArrow size={22} strokeWidth={1.6} />
                </div>
                <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-storm">Plotting the map</p>
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
