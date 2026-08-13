import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';

import AtlasControls from '@components/AtlasControls';
import CardView from '@components/CardView';
import ErrorBoundary from '@components/ErrorBoundary';
import IconNorthArrow from '@components/IconNorthArrow';
import ModalFilter from '@components/ModalFilter';
import StatusStrip from '@components/StatusStrip';
import { CARDS_PER_PAGE } from '@lib/constants';
import { clearAtlasState, loadAtlasState, saveAtlasState } from '@lib/store';
import { pageCountOf, tripsByIdOf } from '@lib/utils';

import type { Dispatch, SetStateAction } from 'react';

interface AtlasStateValue {
    cardPlaces: AtlasPlace[];
    cardTotal: number;
    currentPage: number;
    filterCount: number;
    filteredPlaces: AtlasPlace[];
    flyTarget: AtlasFlyTarget | null;
    hasSearch: boolean;
    highlightId: number | null;
    hoverPlace: AtlasPlace | null;
    isEmpty: boolean;
    isModalOpen: boolean;
    isSearchExpanded: boolean;
    isSearchOpen: boolean;
    search: string;
    selectedCategories: string[];
    selectedPlaceId: number | null;
    selectedTrips: string[];
    setFlyTarget: Dispatch<SetStateAction<AtlasFlyTarget | null>>;
    setHighlightId: Dispatch<SetStateAction<number | null>>;
    setHoverPlace: Dispatch<SetStateAction<AtlasPlace | null>>;
    setIsModalOpen: Dispatch<SetStateAction<boolean>>;
    setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
    setPage: Dispatch<SetStateAction<number>>;
    setSearch: Dispatch<SetStateAction<string>>;
    setSelectedCategories: Dispatch<SetStateAction<string[]>>;
    setSelectedPlaceId: Dispatch<SetStateAction<number | null>>;
    setSelectedTrips: Dispatch<SetStateAction<string[]>>;
    setView: Dispatch<SetStateAction<AtlasState['view']>>;
    shownPlaces: AtlasPlace[];
    totalCount: number;
    view: AtlasState['view'];
}

const DEFAULT_VIEW = 'map';
const DUPLICATE_TOLERANCE = 0.02;
const EDITABLE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const HIGHLIGHT_DURATION = 2_600;
const SEARCH_KEY = '/';
const TITLE = 'Atlas';
const TITLE_ID = 'atlas-title';

const MapView = lazy(() => import('@components/MapView'));

function compareCardPlaces(first: AtlasPlace, second: AtlasPlace, tripsById: Record<string, AtlasTrip>) {
    const starOrder = compareStarred(first, second);

    if (starOrder !== 0) return starOrder;

    const nameOrder = normalizedName(first).localeCompare(normalizedName(second));

    if (nameOrder !== 0) return nameOrder;

    return compareTrips(first, second, tripsById);
}

function compareDuplicates(first: AtlasPlace, second: AtlasPlace, tripsById: Record<string, AtlasTrip>) {
    const starOrder = compareStarred(first, second);

    if (starOrder !== 0) return starOrder;

    return compareTrips(first, second, tripsById);
}

function compareStarred(first: AtlasPlace, second: AtlasPlace) {
    return Number(second.starred === true) - Number(first.starred === true);
}

function compareTrips(first: AtlasPlace, second: AtlasPlace, tripsById: Record<string, AtlasTrip>) {
    const firstTrip = tripOf(first, tripsById);
    const secondTrip = tripOf(second, tripsById);

    if (!firstTrip || !secondTrip) return Number(!firstTrip) - Number(!secondTrip);
    if (firstTrip.year !== secondTrip.year) return firstTrip.year - secondTrip.year;

    return firstTrip.order - secondTrip.order;
}

function composeSurvivor(place: AtlasPlace, duplicates: AtlasPlace[], tripsById: Record<string, AtlasTrip>) {
    const earliest = firstTripPlace(duplicates, tripsById);

    if (!earliest || earliest.trip === place.trip) return place;

    return { ...place, order: earliest.order, trip: earliest.trip };
}

function dedupeCardPlaces(places: AtlasPlace[], tripsById: Record<string, AtlasTrip>) {
    const placesByName = new Map<string, AtlasPlace[]>();
    const survivors: AtlasPlace[] = [];

    for (const place of places) {
        const name = normalizedName(place);

        const sharedPlaces = placesByName.get(name);

        if (sharedPlaces) sharedPlaces.push(place);
        else placesByName.set(name, [place]);
    }

    for (const place of places) {
        const duplicates = (placesByName.get(normalizedName(place)) ?? []).filter(other => isSameLocation(other, place));

        if (duplicates.some(other => compareDuplicates(other, place, tripsById) < 0 && other.trip !== place.trip)) continue;

        survivors.push(composeSurvivor(place, duplicates, tripsById));
    }

    return survivors;
}

function findCardIndex(cardPlaces: AtlasPlace[], place: AtlasPlace) {
    const exact = cardPlaces.findIndex(item => item.id === place.id);

    if (exact !== -1) return exact;

    return cardPlaces.findIndex(item => normalizedName(item) === normalizedName(place) && isSameLocation(item, place));
}

function firstTripPlace(duplicates: AtlasPlace[], tripsById: Record<string, AtlasTrip>) {
    let earliest: AtlasPlace | null = null;

    for (const place of duplicates) {
        if (place.trip === null) continue;
        if (!earliest || compareTrips(place, earliest, tripsById) < 0) earliest = place;
    }

    return earliest;
}

function hasModifier(event: KeyboardEvent) {
    return event.altKey || event.ctrlKey || event.metaKey;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;

    return EDITABLE_TAGS.has(target.tagName);
}

function isSameLocation(first: AtlasPlace, second: AtlasPlace) {
    return Math.abs(first.lat - second.lat) <= DUPLICATE_TOLERANCE && Math.abs(first.lng - second.lng) <= DUPLICATE_TOLERANCE;
}

function normalizedName(place: AtlasPlace) {
    return place.name.trim().toLowerCase();
}

function toggleValue(values: string[], value: string) {
    return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

function tripOf(place: AtlasPlace, tripsById: Record<string, AtlasTrip>): AtlasTrip | null {
    return place.trip === null ? null : tripsById[place.trip] ?? null;
}

function useAtlasState(data: AtlasData): AtlasStateValue {
    const [flyTarget, setFlyTarget] = useState<AtlasFlyTarget | null>(null);
    const [highlightId, setHighlightId] = useState<number | null>(null);
    const [hoverPlace, setHoverPlace] = useState<AtlasPlace | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
    const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
    const tripsById = useMemo(() => tripsByIdOf(data.trips), [data.trips]);
    const [view, setView] = useState<AtlasState['view']>(DEFAULT_VIEW);

    const filteredPlaces = useMemo(() => {
        const query = search.trim().toLowerCase();

        return data.places.filter((place) => {
            if (selectedCategories.length > 0 && !selectedCategories.includes(place.category)) return false;
            if (selectedTrips.length > 0 && (place.trip === null || !selectedTrips.includes(place.trip))) return false;
            if (!place.description.toLowerCase().includes(query) && !place.name.toLowerCase().includes(query) && query.length > 0) return false;

            return true;
        });
    }, [data.places, search, selectedCategories, selectedTrips]);

    const cardPlaces = useMemo(() => dedupeCardPlaces(filteredPlaces, tripsById).sort((first, second) => compareCardPlaces(first, second, tripsById)), [filteredPlaces, tripsById]);
    const cardTotal = useMemo(() => dedupeCardPlaces(data.places, tripsById).length, [data.places, tripsById]);

    const hasSearch = search.trim().length > 0;
    const isCardView = view === 'cards';
    const pageCount = pageCountOf(cardPlaces.length);

    const currentPage = Math.min(page, pageCount - 1);
    const filterCount = selectedCategories.length + selectedTrips.length;
    const isSearchExpanded = hasSearch || isSearchOpen;
    const shownPlaces = isCardView ? cardPlaces : filteredPlaces;
    const totalCount = isCardView ? cardTotal : data.places.length;

    const isEmpty = shownPlaces.length === 0;

    useEffect(() => {
        const stored = loadAtlasState();

        if (stored?.categories) setSelectedCategories(stored.categories);
        if (stored?.page !== undefined) setPage(stored.page);
        if (stored?.search !== undefined) setSearch(stored.search);
        if (stored?.trips) setSelectedTrips(stored.trips);

        setIsHydrated(true);
        setView(stored?.view ?? DEFAULT_VIEW);
    }, []);

    useEffect(() => {
        if (!isHydrated) return;

        saveAtlasState({ categories: selectedCategories, page, search, trips: selectedTrips, view });
    }, [isHydrated, page, search, selectedCategories, selectedTrips, view]);

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
        cardTotal,
        currentPage,
        filterCount,
        filteredPlaces,
        flyTarget,
        hasSearch,
        highlightId,
        hoverPlace,
        isEmpty,
        isModalOpen,
        isSearchExpanded,
        isSearchOpen,
        search,
        selectedCategories,
        selectedPlaceId,
        selectedTrips,
        setFlyTarget,
        setHighlightId,
        setHoverPlace,
        setIsModalOpen,
        setIsSearchOpen,
        setPage,
        setSearch,
        setSelectedCategories,
        setSelectedPlaceId,
        setSelectedTrips,
        setView,
        shownPlaces,
        totalCount,
        view,
    };
}

function AtlasInner({ data }: { data: AtlasData }) {
    const atlas = useAtlasState(data);
    const filtersRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    function handleClearAll() {
        atlas.setSearch('');
        atlas.setSelectedCategories([]);
        atlas.setSelectedTrips([]);
        atlas.setView(DEFAULT_VIEW);
        clearAtlasState();
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

            return;
        }

        if (!atlas.isSearchOpen) return;

        atlas.setIsSearchOpen(false);
        searchRef.current?.blur();
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

        if (event.key !== SEARCH_KEY || hasModifier(event)) return;
        if (atlas.isModalOpen || isEditableTarget(event.target)) return;

        event.preventDefault();
        handleFocusSearch();
    }

    function handleSearchChange(value: string) {
        atlas.setIsSearchOpen(true);
        atlas.setSearch(value);
        resetAfterFilterChange();
    }

    function handleShowInCards(place: AtlasPlace) {
        const index = findCardIndex(atlas.cardPlaces, place);

        const target = index === -1 ? place : atlas.cardPlaces[index];

        atlas.setFlyTarget(null);
        atlas.setHighlightId(target.id);
        atlas.setHoverPlace(null);
        atlas.setPage(Math.max(0, Math.floor(index / CARDS_PER_PAGE)));
        atlas.setSelectedPlaceId(null);
        atlas.setView('cards');
    }

    function handleShowOnMap(place: AtlasPlace) {
        atlas.setFlyTarget({ placeId: place.id });
        atlas.setHighlightId(null);
        atlas.setHoverPlace(null);
        atlas.setSelectedPlaceId(null);
        atlas.setView('map');
    }

    function handleToggleCategory(id: string) {
        atlas.setSelectedCategories(current => toggleValue(current, id));
        resetAfterFilterChange();
    }

    function handleToggleTrip(id: string) {
        atlas.setSelectedTrips(current => toggleValue(current, id));
        resetAfterFilterChange();
    }

    function handleToggleView() {
        atlas.setFlyTarget(null);
        atlas.setHoverPlace(null);
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
                        hasActiveFilters={atlas.filterCount > 0}
                        hoverPlace={atlas.hoverPlace}
                        onHoverPlace={atlas.setHoverPlace}
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
                onPageChange={atlas.setPage}
                onShowOnMap={handleShowOnMap}
                page={atlas.currentPage}
                places={atlas.cardPlaces}
                totalCount={atlas.cardTotal}
            />
        );
    }

    function resetAfterFilterChange() {
        atlas.setFlyTarget(null);
        atlas.setHoverPlace(null);
        atlas.setPage(0);
        atlas.setSelectedPlaceId(null);
    }

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [atlas.hasSearch, atlas.isModalOpen, atlas.isSearchOpen, atlas.selectedPlaceId]);

    return (
        <div className="atlas-plot fixed inset-0 overflow-hidden bg-paper text-ink">
            {atlas.view !== 'cards' && <h1 className="sr-only" id={TITLE_ID}>{TITLE}</h1>}
            {renderView()}
            <StatusStrip
                categories={data.categories}
                isEmpty={atlas.isEmpty}
                onClearAll={handleClearAll}
                onRemoveCategory={handleToggleCategory}
                onRemoveTrip={handleToggleTrip}
                selectedCategories={atlas.selectedCategories}
                selectedTrips={atlas.selectedTrips}
                trips={data.trips}
            />
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
                searchRef={searchRef}
                view={atlas.view}
            />
            {atlas.isModalOpen && (
                <ModalFilter
                    categories={data.categories}
                    filterCount={atlas.filterCount}
                    onClearAll={handleClearAll}
                    onClose={handleCloseModal}
                    onToggleCategory={handleToggleCategory}
                    onToggleTrip={handleToggleTrip}
                    selectedCategories={atlas.selectedCategories}
                    selectedTrips={atlas.selectedTrips}
                    shownCount={atlas.shownPlaces.length}
                    totalCount={atlas.totalCount}
                    trips={data.trips}
                />
            )}
            <div className="atlas-grain z-[90]" aria-hidden="true" />
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
                <p className="atlas-label text-[9.5px] tracking-[0.14em] text-storm">Plotting the map</p>
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
