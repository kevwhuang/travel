import BrandMark from '@components/BrandMark';
import IconClose from '@components/IconClose';
import IconFilters from '@components/IconFilters';
import IconGrid from '@components/IconGrid';
import IconMapPin from '@components/IconMapPin';
import IconSearch from '@components/IconSearch';
import { SEARCH_KEY, SEARCH_LENGTH_LIMIT } from '@lib/constants';

import type { KeyboardEvent, RefObject } from 'react';

const CONTROL_ICON_SIZE = 17;
const CONTROL_ICON_STROKE_WIDTH = 1.7;
const COPYRIGHT_MARK = '\u00a9';
const CREDIT_MAP = 'OpenStreetMap';
const CREDIT_OWNER = 'Aephonics';
const CREDIT_SUFFIX = '. All rights reserved.';
const HOME_URL = 'https://aephonics.com';
const SEARCH_LABEL = 'Search places by name';
const SEARCH_PLACEHOLDER = 'Search the atlas\u2026';

const creditYear = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric' }).format(new Date());

export default function AtlasControls({ filterCount, filtersRef, isSearchOpen, onClearSearch, onOpenFilters, onSearchBlur, onSearchChange, onSearchFocus, onToggleView, search, searchButtonRef, searchRef, view }: {
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
    searchButtonRef: RefObject<HTMLButtonElement | null>;
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
        if (event.key === SEARCH_KEY) {
            event.preventDefault();

            return;
        }

        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;

        event.preventDefault();
        event.currentTarget.blur();
    }

    return (
        <>
            <button
                className={`atlas-control ${hasFilters ? 'atlas-control--active' : 'border-flint'} fixed left-[18px] top-[18px] z-40 p-0 border`}
                aria-haspopup="dialog"
                aria-label={hasFilters ? `Open filter, ${filterCount} active` : 'Open filter'}
                onClick={onOpenFilters}
                ref={filtersRef}
                type="button"
            >
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">
                    <IconFilters size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />
                </span>
                <span className="flex items-center gap-[8px] pr-[16px]">
                    {hasFilters && (
                        <span className="px-[8px] py-[2px] rounded-full font-mono text-[10px] bg-paper text-ink">{filterCount}</span>
                    )}
                    <span className="font-medium text-[13px] whitespace-nowrap">Filter</span>
                </span>
            </button>
            <search className={`atlas-control ${isSearchOpen ? 'atlas-control--open' : ''} fixed flex-row-reverse right-[18px] top-[18px] z-[41] gap-[8px] border ${hasSearch ? 'border-ink' : 'border-flint'}`}>
                <button
                    className="active:scale-[0.96] hover:text-ink grid place-items-center shrink-0 h-[48px] w-[48px] p-0 border-none rounded-full bg-transparent text-storm duration-[var(--duration-fast)] ease-[ease] transition-[color,scale]"
                    aria-label={hasSearch ? 'Clear search' : 'Search places'}
                    onClick={hasSearch ? handleClearSearch : handleFocusSearch}
                    ref={searchButtonRef}
                    type="button"
                >
                    {hasSearch ? <IconClose size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} /> : <IconSearch size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />}
                </button>
                <label className="flex flex-1 min-w-[220px] max-md:min-w-0">
                    <span className="sr-only">{SEARCH_LABEL}</span>
                    <input
                        className="h-[48px] w-full pl-[16px] pr-0 border-none text-[13px] bg-transparent text-ink"
                        autoComplete="off"
                        maxLength={SEARCH_LENGTH_LIMIT}
                        onBlur={onSearchBlur}
                        onChange={event => onSearchChange(event.target.value.replaceAll(SEARCH_KEY, ''))}
                        onFocus={onSearchFocus}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={SEARCH_PLACEHOLDER}
                        ref={searchRef}
                        value={search}
                    />
                </label>
            </search>
            <div className="atlas-control atlas-control--wide hover:border-storm bottom-[18px] fixed left-[18px] z-40 border border-dashed border-flint">
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">
                    <BrandMark />
                </span>
                <span className="pr-[16px] font-mono text-[10px] tracking-[0.1em] whitespace-nowrap text-storm max-md:whitespace-normal">
                    <span className="block">
                        <span className="relative top-[0.14em] text-[12px]">{COPYRIGHT_MARK}</span>
                        {` ${CREDIT_MAP}`}
                    </span>
                    <span className="block">
                        <span className="relative top-[0.14em] text-[12px]">{COPYRIGHT_MARK}</span>
                        {' '}
                        <time dateTime={creditYear}>{creditYear}</time>
                        {' '}
                        <a
                            className="active:scale-[0.96] hover:text-ink inline-block decoration-dotted underline underline-offset-[2px] text-storm duration-[var(--duration-fast)] ease-[ease] transition-[color,scale]"
                            href={HOME_URL}
                            rel="noreferrer"
                            target="_blank"
                        >
                            {CREDIT_OWNER}
                        </a>
                        {CREDIT_SUFFIX}
                    </span>
                </span>
            </div>
            <button
                className="atlas-control hover:border-storm bottom-[18px] fixed flex-row-reverse right-[18px] z-40 p-0 border border-flint"
                aria-label={isCardView ? 'Switch to map' : 'Switch to cards'}
                onClick={onToggleView}
                type="button"
            >
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">{isCardView ? <IconMapPin size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} /> : <IconGrid size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />}</span>
                <span className="pl-[16px] font-medium text-[13px] whitespace-nowrap">{isCardView ? 'Map' : 'Cards'}</span>
            </button>
        </>
    );
}
