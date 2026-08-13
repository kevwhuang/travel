import IconClose from '@components/IconClose';
import IconFilters from '@components/IconFilters';
import IconGrid from '@components/IconGrid';
import IconMapPin from '@components/IconMapPin';
import IconSearch from '@components/IconSearch';

import type { KeyboardEvent, RefObject } from 'react';

const BRAND_HEIGHT = 18;
const BRAND_WIDTH = 12;
const COPYRIGHT_MARK = '\u00a9';
const CREDIT_MAP = 'OpenStreetMap';
const CREDIT_OWNER = 'Kevin Huang \u00b7 aephonics.com';
const CREDIT_TITLE = `${COPYRIGHT_MARK} ${CREDIT_OWNER} \u00b7 ${COPYRIGHT_MARK} ${CREDIT_MAP}`;
const HOME_URL = 'https://aephonics.com';
const SEARCH_LABEL = 'Search places by name or description';
const SEARCH_PLACEHOLDER = 'Search the atlas\u2026';

function BrandMark() {
    return (
        <svg
            className="text-pink"
            aria-hidden="true"
            fill="currentColor"
            height={BRAND_HEIGHT}
            viewBox="8 4 16 24"
            width={BRAND_WIDTH}
        >
            <polygon points="16,6 22,26 16,21 10,26" />
        </svg>
    );
}

function CreditLine({ credit }: { credit: string }) {
    return (
        <span className="block">
            <span className="relative top-[0.21em]">{COPYRIGHT_MARK}</span>
            {` ${credit}`}
        </span>
    );
}

export default function AtlasControls({ filterCount, filtersRef, isSearchOpen, onClearSearch, onOpenFilters, onSearchBlur, onSearchChange, onSearchFocus, onToggleView, search, searchRef, view }: {
    filterCount: number;
    filtersRef: RefObject<HTMLButtonElement | null>;
    isSearchOpen: boolean;
    onClearSearch: () => void;
    onOpenFilters: () => void;
    onSearchBlur: () => void;
    onSearchChange: (value: string) => void;
    onSearchFocus: () => void;
    onToggleView: () => void;
    search: string;
    searchRef: RefObject<HTMLInputElement | null>;
    view: AtlasState['view'];
}) {
    const hasFilters = filterCount > 0;
    const hasSearch = search.trim().length > 0;
    const isCardView = view === 'cards';

    function handleClearSearch() {
        onClearSearch();
        searchRef.current?.focus();
    }

    function handleFocusSearch() {
        onSearchFocus();
        searchRef.current?.focus();
    }

    function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;

        event.preventDefault();
        event.currentTarget.blur();
    }

    return (
        <>
            <button
                className={`atlas-control ${hasFilters ? 'atlas-control--active' : ''} fixed left-[18px] top-[18px] z-40 p-0 border ${hasFilters ? 'border-ink' : 'border-flint'}`}
                aria-haspopup="dialog"
                aria-label="Open filters"
                onClick={onOpenFilters}
                ref={filtersRef}
                type="button"
            >
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">
                    <IconFilters size={17} strokeWidth={1.7} />
                </span>
                <span className="flex items-center gap-[8px] pr-[16px]">
                    {hasFilters && (
                        <span className="px-[8px] py-[2px] rounded-full font-mono text-[9.5px] bg-paper text-ink">{filterCount}</span>
                    )}
                    <span className="font-medium text-[12.5px] whitespace-nowrap">Filters</span>
                </span>
            </button>
            <search className={`atlas-control ${isSearchOpen ? 'atlas-control--open' : ''} fixed flex-row-reverse right-[18px] top-[18px] z-[41] gap-[8px] border ${hasSearch ? 'border-ink' : 'border-flint'}`}>
                <button
                    className="active:scale-[0.96] hover:text-storm grid place-items-center shrink-0 h-[48px] w-[48px] p-0 border-none bg-transparent text-ink duration-[var(--duration-fast)] ease-[ease] transition-[color,transform]"
                    aria-label={hasSearch ? 'Clear search' : 'Search places'}
                    onClick={hasSearch ? handleClearSearch : handleFocusSearch}
                    type="button"
                >
                    {hasSearch ? <IconClose size={17} /> : <IconSearch size={17} strokeWidth={1.7} />}
                </button>
                <label className="flex flex-1 min-w-[220px] max-md:min-w-0">
                    <span className="sr-only">{SEARCH_LABEL}</span>
                    <input
                        className="h-[48px] w-full pl-[16px] pr-0 border-none text-[13px] bg-transparent text-ink"
                        autoComplete="off"
                        onBlur={onSearchBlur}
                        onChange={event => onSearchChange(event.target.value)}
                        onFocus={onSearchFocus}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={SEARCH_PLACEHOLDER}
                        ref={searchRef}
                        value={search}
                    />
                </label>
            </search>
            <a
                className="atlas-control hover:border-storm bottom-[18px] fixed left-[18px] z-40 border border-dashed border-flint no-underline text-ink"
                href={HOME_URL}
                rel="noreferrer"
                target="_blank"
                title={CREDIT_TITLE}
            >
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">
                    <BrandMark />
                </span>
                <span className="pr-[16px] font-mono text-[9.5px] tracking-[0.1em] whitespace-nowrap text-storm">
                    <CreditLine credit={CREDIT_OWNER} />
                    <CreditLine credit={CREDIT_MAP} />
                </span>
            </a>
            <button
                className="atlas-control hover:border-storm bottom-[18px] fixed flex-row-reverse right-[18px] z-40 p-0 border border-flint"
                aria-label={isCardView ? 'Switch to map view' : 'Switch to card view'}
                onClick={onToggleView}
                type="button"
            >
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">{isCardView ? <IconMapPin size={17} strokeWidth={1.7} /> : <IconGrid size={17} strokeWidth={1.7} />}</span>
                <span className="pl-[16px] font-medium text-[12.5px] whitespace-nowrap">{isCardView ? 'Map view' : 'Card view'}</span>
            </button>
        </>
    );
}
