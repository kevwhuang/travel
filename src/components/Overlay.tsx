import IconClose from '@components/IconClose';
import IconFilters from '@components/IconFilters';
import IconGrid from '@components/IconGrid';
import IconLogo from '@components/IconLogo';
import IconPin from '@components/IconPin';
import IconSearch from '@components/IconSearch';
import { COPYRIGHT_MARK, CREDIT_MAP, SEARCH_LENGTH_LIMIT, SEARCH_SHORTCUT } from '@lib/constants';
import { sanitizeSearch } from '@lib/utils';

import type { KeyboardEvent, RefObject } from 'react';

const CLASS_SEARCH_TOGGLE = 'active:scale-[0.96] hover:text-ink grid place-items-center shrink-0 h-[48px] w-[48px] p-0 border-none rounded-full bg-transparent text-storm duration-[var(--duration-fast)] ease-[ease] transition-[color,scale]';
const CONTROL_ICON_SIZE = 16;
const CONTROL_ICON_STROKE_WIDTH = 1.7;
const CREDIT_OWNER = 'Aephonics';
const OWNER_URL = 'https://aephonics.com';
const SEARCH_LABEL = 'Search markers by name';
const SEARCH_PLACEHOLDER = 'Search\u2026';

const creditYear = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric' }).format(new Date());

export default function Overlay({ filterButtonRef, filterCount, isSearchExpanded, onClearSearch, onOpenFilters, onSearchBlur, onSearchChange, onSearchFocus, onToggleView, searchButtonRef, searchInputRef, searchValue, view }: {
    filterButtonRef: RefObject<HTMLButtonElement | null>;
    filterCount: number;
    isSearchExpanded: boolean;
    onClearSearch: () => void;
    onOpenFilters: () => void;
    onSearchBlur: () => void;
    onSearchChange: (value: string) => void;
    onSearchFocus: () => void;
    onToggleView: () => void;
    searchButtonRef: RefObject<HTMLButtonElement | null>;
    searchInputRef: RefObject<HTMLInputElement | null>;
    searchValue: string;
    view: AtlasView;
}) {
    const hasFilters = filterCount > 0;
    const hasSearch = searchValue.trim().length > 0;
    const isCardView = view === 'cards';

    function handleClearSearch() {
        onClearSearch();
        searchInputRef.current?.focus();
    }

    function handleFocusSearch() {
        onSearchFocus();
        searchInputRef.current?.focus();
    }

    function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === SEARCH_SHORTCUT) {
            event.preventDefault();

            return;
        }

        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;

        event.currentTarget.blur();
        event.preventDefault();
    }

    return (
        <>
            <button
                className={['atlas-control', hasFilters && 'atlas-control--active', 'fixed left-[18px] top-[18px] z-40 p-0 border', !hasFilters && 'border-flint'].filter(Boolean).join(' ')}
                aria-haspopup="dialog"
                aria-label={hasFilters ? `Open filters, ${filterCount} active` : 'Open filters'}
                onClick={onOpenFilters}
                ref={filterButtonRef}
                type="button"
            >
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">
                    <IconFilters size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />
                </span>
                <span className="flex items-center gap-[8px] pr-[16px]">
                    {hasFilters && (
                        <span className="px-[8px] py-[2px] rounded-full font-mono text-[10px] bg-paper text-ink">{filterCount}</span>
                    )}
                    <span className="font-medium text-[14px] whitespace-nowrap">Filters</span>
                </span>
            </button>
            <search className={`atlas-control ${isSearchExpanded ? 'atlas-control--open' : ''} fixed flex-row-reverse right-[18px] top-[18px] z-[41] gap-[8px] border ${hasSearch ? 'border-ink' : 'border-flint'}`}>
                <button
                    className={CLASS_SEARCH_TOGGLE}
                    aria-label={hasSearch ? 'Clear search' : 'Search markers'}
                    onClick={hasSearch ? handleClearSearch : handleFocusSearch}
                    ref={searchButtonRef}
                    type="button"
                >
                    {hasSearch
                        ? <IconClose size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />
                        : <IconSearch size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />}
                </button>
                <label className="flex flex-1 min-w-[220px] max-md:min-w-0">
                    <span className="sr-only">{SEARCH_LABEL}</span>
                    <input
                        className="h-[48px] w-full pl-[16px] pr-0 border-none text-[16px] bg-transparent text-ink"
                        autoComplete="off"
                        maxLength={SEARCH_LENGTH_LIMIT}
                        onBlur={onSearchBlur}
                        onChange={event => onSearchChange(sanitizeSearch(event.target.value))}
                        onFocus={onSearchFocus}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={SEARCH_PLACEHOLDER}
                        ref={searchInputRef}
                        value={searchValue}
                    />
                </label>
            </search>
            <div className="atlas-control atlas-control--wide hover:border-storm bottom-[18px] fixed left-[18px] z-40 border border-dashed border-flint">
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">
                    <IconLogo />
                </span>
                <span className="pr-[16px] font-mono leading-[16px] text-[10px] tracking-[0.1em] whitespace-nowrap text-storm">
                    <span className="block">
                        <span className="relative top-[0.14em] leading-none text-[12px]">{COPYRIGHT_MARK}</span>
                        {` ${CREDIT_MAP}`}
                    </span>
                    <span className="block">
                        <span className="relative top-[0.14em] leading-none text-[12px]">{COPYRIGHT_MARK}</span>
                        {' '}
                        <time dateTime={creditYear}>{creditYear}</time>
                        {' '}
                        <a
                            className="active:scale-[0.96] hover:text-ink inline-block decoration-dotted underline underline-offset-[2px] text-storm duration-[var(--duration-fast)] ease-[ease] transition-[color,scale]"
                            href={OWNER_URL}
                            rel="noreferrer"
                            target="_blank"
                        >
                            {CREDIT_OWNER}
                        </a>
                    </span>
                </span>
            </div>
            <button
                className="atlas-control hover:border-storm bottom-[18px] fixed flex-row-reverse right-[18px] z-40 p-0 border border-flint"
                aria-label={isCardView ? 'Switch to map' : 'Switch to cards'}
                onClick={onToggleView}
                type="button"
            >
                <span className="grid place-items-center shrink-0 h-[48px] w-[48px]">
                    {isCardView
                        ? <IconPin size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />
                        : <IconGrid size={CONTROL_ICON_SIZE} strokeWidth={CONTROL_ICON_STROKE_WIDTH} />}
                </span>
                <span className="pl-[16px] font-medium text-[14px] whitespace-nowrap">
                    {isCardView
                        ? 'Map'
                        : 'Cards'}
                </span>
            </button>
        </>
    );
}
