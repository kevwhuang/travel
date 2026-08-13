import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { MapLibreMap, Marker, Popup, addProtocol, setWorkerUrl } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { createRoot } from 'react-dom/client';
import { layers } from '@protomaps/basemaps';
import { useEffect, useRef, useState } from 'react';

import CategoryBadge from '@components/CategoryBadge';
import IconCategory from '@components/IconCategory';
import IconClose from '@components/IconClose';
import StarMark from '@components/StarMark';
import { CARD_COORDINATES_CLASS, CARD_DESCRIPTION_CLASS, CARD_META_CLASS, CARD_NAME_CLASS, CARD_TRIP_NAME_CLASS, CARD_TRIP_YEAR_CLASS, STAR_COLOR, STAR_LABEL, STAR_PATH, STAR_SIZE } from '@lib/constants';
import { categoryColor, formatCoordinates } from '@lib/utils';
import { prefersReducedMotion } from '@lib/motion';

import type { ExpressionSpecification, FitBoundsOptions, FlyToOptions, GeoJSONSource, LayerSpecification, RequestParameters, StyleSpecification } from 'maplibre-gl';
import type { Flavor } from '@protomaps/basemaps';
import type { Root } from 'react-dom/client';

type SourceData = Parameters<GeoJSONSource['setData']>[0];

interface MapFeature {
    geometry: { coordinates: [number, number] };
    properties: Record<string, boolean | number | string>;
}

interface PinHandlers {
    onEnter: () => void;
    onLeave: () => void;
    onSelect: () => void;
}

interface PinMarker {
    button: HTMLButtonElement;
    color: string;
    isOrdered: boolean;
    isStarred: boolean;
    marker: Marker;
    root: Root | null;
}

interface ScaleBar {
    label: string;
    width: number;
}

const BASEMAP_SOURCE_ID = 'basemap';
const CLUSTER_BASE_SIZE = 34;
const CLUSTER_CLASS = 'atlas-fade atlas-marker active:scale-100 before:absolute before:content-[""] before:inset-[-7px] hover:scale-[1.09] relative p-0 border-none shadow-[0_3px_10px_var(--color-ink-20)] duration-[var(--duration-fast)] ease-[ease] transition-transform';
const CLUSTER_DISC_CLASS = 'absolute grid inset-[3px] place-items-center rounded-full font-serif text-[13px] bg-snow text-ink';
const CLUSTER_GROWTH_FACTOR = 3;
const CLUSTER_KEY_PREFIX = 'cluster-';
const CLUSTER_MAX_GROWTH = 24;
const CLUSTER_MAX_ZOOM = 12;
const CLUSTER_RADIUS = 36;
const CLUSTER_RING_CLASS = 'absolute inset-[-5px] border border-dashed border-ink-30 rounded-full';
const DEFAULT_CENTER = { lat: 33, lng: -100 } as const;
const DEFAULT_ZOOM = 2.4;
const DEGREES_PER_HALF_TURN = 180;
const EARTH_CIRCUMFERENCE = 40_075_016.686;
const FEET_PER_MILE = 5_280;
const FIT_MAX_ZOOM = 13;
const FIT_PADDING = 72;
const FLY_ZOOM = 13;
const FULL_CIRCLE_DEGREES = 360;
const HIDDEN_LAYER_IDS = ['roads_oneway', 'roads_shields'] as const;
const LAYER_ID = 'atlas-places-anchor';
const MAGNITUDE_BASE = 10;
const MAP_ATTRIBUTION = '\u00a9 OpenStreetMap';

const MAP_FLAVOR: Flavor = {
    address_label: '#6f7d80',
    address_label_halo: '#f6f4e9',
    aerodrome: '#e7eae7',
    background: '#cbddd8',
    beach: '#eee6cd',
    bold: 'Noto Sans Medium',
    boundaries: '#5a6a6e',
    bridges_highway: '#dce5e4',
    bridges_highway_casing: '#afbebd',
    bridges_link: '#fbf9f1',
    bridges_link_casing: '#dddaca',
    bridges_major: '#e3eae9',
    bridges_major_casing: '#c3cfcd',
    bridges_minor: '#fdfcf5',
    bridges_minor_casing: '#e2dfce',
    bridges_other: '#f7f5ea',
    bridges_other_casing: '#e5e2d1',
    buildings: '#e3e0cd',
    city_label: '#212b2e',
    city_label_halo: '#f4f2e5',
    country_label: '#5a6a6e',
    earth: '#f1efdf',
    glacier: '#edf2f1',
    highway: '#dce5e4',
    highway_casing_early: '#afbebd',
    highway_casing_late: '#afbebd',
    hospital: '#efe7e1',
    industrial: '#e6e9e3',
    italic: 'Noto Sans Italic',
    landcover: {
        barren: '#eee9d7',
        farmland: '#e8ead3',
        forest: '#d9e5cf',
        glacier: '#f1f5f3',
        grassland: '#e5ebd6',
        scrub: '#e7e9d3',
        urban_area: '#ece8d9',
    },
    link: '#fbf9f1',
    link_casing: '#dddaca',
    major: '#e3eae9',
    major_casing_early: '#c3cfcd',
    major_casing_late: '#c3cfcd',
    military: '#e8e7dc',
    minor_a: '#faf8ef',
    minor_b: '#fdfcf5',
    minor_casing: '#e2dfce',
    minor_service: '#f7f5ea',
    minor_service_casing: '#e5e2d1',
    ocean_label: '#6e8c86',
    other: '#f7f5ea',
    park_a: '#e2e8d3',
    park_b: '#c9dcc0',
    pedestrian: '#ebe9da',
    pier: '#e6e3d2',
    railway: '#b4bfbd',
    regular: 'Noto Sans Regular',
    roads_label_major: '#5a6a6e',
    roads_label_major_halo: '#f8f6ec',
    roads_label_minor: '#6f7d80',
    roads_label_minor_halo: '#f6f4e9',
    runway: '#f6f4ec',
    sand: '#efebd9',
    school: '#eeeadc',
    scrub_a: '#e4e9d4',
    scrub_b: '#ceddc5',
    state_label: '#7c8b8e',
    state_label_halo: '#f1efdf',
    subplace_label: '#5f6e72',
    subplace_label_halo: '#f1efdf',
    tunnel_highway: '#ebe8d9',
    tunnel_highway_casing: '#e4e1d0',
    tunnel_link: '#ebe8d9',
    tunnel_link_casing: '#e4e1d0',
    tunnel_major: '#ebe8d9',
    tunnel_major_casing: '#e4e1d0',
    tunnel_minor: '#ebe8d9',
    tunnel_minor_casing: '#e4e1d0',
    tunnel_other: '#ebe8d9',
    tunnel_other_casing: '#e4e1d0',
    water: '#cbddd8',
    wood_a: '#dee6d0',
    wood_b: '#c3d8bb',
    zoo: '#dce6d7',
};

const MAP_GLYPHS = '/fonts/map/{fontstack}/{range}.pbf';
const MAP_LANGUAGE = 'en';
const MAP_MAX_ZOOM = 15;
const MAP_TILES_URL = 'pmtiles:///tiles/atlas.pmtiles';
const MAP_WORLD_URL = 'pmtiles:///tiles/world.pmtiles';
const MARKER_SELECTOR = 'button.atlas-marker';
const METERS_PER_MILE = 1_609.344;
const MILE_MINIMUM = 0.5;
const PIN_DOT_CLASS = 'atlas-fade atlas-marker active:scale-100 before:absolute before:content-[""] before:inset-[-18px] hover:scale-[1.3] block relative h-[13px] w-[13px] p-0 border-2 border-snow duration-[var(--duration-fast)] ease-[ease] transition-[background-color,border-color,box-shadow,color,transform]';
const PIN_ICON_CLASS = 'atlas-fade atlas-marker active:scale-100 before:absolute before:content-[""] before:inset-[-12px] hover:scale-[1.3] grid place-items-center relative h-[24px] w-[24px] p-0 border-2 duration-[var(--duration-fast)] ease-[ease] transition-[background-color,border-color,box-shadow,color,transform]';
const PIN_ICON_SIZE = 11;
const PIN_STAR_CLASS = 'absolute right-[-7px] top-[-7px] leading-none pointer-events-none';
const PLACE_KEY_PREFIX = 'place-';
const POPUP_OFFSET = 18;

const REGION_COLORS = {
    explored: '#9b72cf',
    visiting: '#e2725b',
} as const;

const REGION_EXPLORED_FILL_OPACITY = 0.14;
const REGION_EXPLORED_LINE_OPACITY = 0.35;
const REGION_FILL_LAYER_ID = 'atlas-regions-fill';
const REGION_LINE_LAYER_ID = 'atlas-regions-line';
const REGION_LINE_WIDTH = 1;
const REGION_SOURCE_ID = 'atlas-regions';
const REGION_VISITING_FILL_OPACITY = 0.22;
const REGION_VISITING_LINE_OPACITY = 0.5;
const SCALE_STEP_LARGE = 5;
const SCALE_STEP_MEDIUM = 2;
const SCALE_TARGET_WIDTH = 120;
const SELECTED_PIN_Z_INDEX = '9';
const SOURCE_ID = 'atlas-places';
const STAR_OUTLINE_WIDTH = 2.6;
const STAR_RING_WIDTH = 2;
const TILE_CACHE_LIMIT = 96;
const TILE_ZOOM_OFFSET = 9;
const WORLD_LAYER_PREFIX = 'w-';
const WORLD_SOURCE_ID = 'world';
const WORLD_ZOOM_CUTOFF = 6;
const ZOOM_BASE = 2;

const LABEL_TEXT_FIELD: ExpressionSpecification = ['coalesce', ['get', `name:${MAP_LANGUAGE}`], ['get', 'name']];

const mapStyle: StyleSpecification = {
    glyphs: MAP_GLYPHS,
    layers: [
        ...flavorLayers(WORLD_SOURCE_ID).map(layer => ({
            ...layer,
            id: `${WORLD_LAYER_PREFIX}${layer.id}`,
            maxzoom: Math.min(WORLD_ZOOM_CUTOFF, layer.maxzoom ?? WORLD_ZOOM_CUTOFF),
        })),
        ...flavorLayers(BASEMAP_SOURCE_ID).map(layer => ({ ...layer, minzoom: Math.max(WORLD_ZOOM_CUTOFF, layer.minzoom ?? 0) })),
    ],
    sources: {
        [BASEMAP_SOURCE_ID]: {
            attribution: MAP_ATTRIBUTION,
            type: 'vector',
            url: MAP_TILES_URL,
        },
        [WORLD_SOURCE_ID]: {
            attribution: MAP_ATTRIBUTION,
            type: 'vector',
            url: MAP_WORLD_URL,
        },
    },
    version: 8,
};

const tileCache = new Map<string, Uint8Array>();
const tileProtocol = new Protocol();

function addRegionLayers(map: MapLibreMap, regions: SourceData) {
    const beforeId = map.getStyle().layers.find(layer => layer.type === 'symbol' && !layer.id.startsWith(WORLD_LAYER_PREFIX))?.id;
    const color: ExpressionSpecification = ['match', ['get', 'status'], 'visiting', REGION_COLORS.visiting, REGION_COLORS.explored];
    const fillOpacity: ExpressionSpecification = ['match', ['get', 'status'], 'visiting', REGION_VISITING_FILL_OPACITY, REGION_EXPLORED_FILL_OPACITY];
    const lineOpacity: ExpressionSpecification = ['match', ['get', 'status'], 'visiting', REGION_VISITING_LINE_OPACITY, REGION_EXPLORED_LINE_OPACITY];

    map.addSource(REGION_SOURCE_ID, { data: regions, type: 'geojson' });
    map.addLayer({
        id: REGION_FILL_LAYER_ID,
        paint: { 'fill-color': color, 'fill-opacity': fillOpacity },
        source: REGION_SOURCE_ID,
        type: 'fill',
    }, beforeId);
    map.addLayer({
        id: REGION_LINE_LAYER_ID,
        paint: { 'line-color': color, 'line-opacity': lineOpacity, 'line-width': REGION_LINE_WIDTH },
        source: REGION_SOURCE_ID,
        type: 'line',
    }, beforeId);
}

function applyPinState(pin: PinMarker, isSelected: boolean) {
    const halo = `color-mix(in oklab, ${pin.color} 26%, transparent)`;
    const orderedBackground = isSelected ? 'var(--color-ink)' : 'var(--color-snow)';
    const shadows: string[] = [];

    if (pin.isStarred) shadows.push(`0 0 0 ${STAR_RING_WIDTH}px ${STAR_COLOR}`);

    if (isSelected) shadows.push(`0 0 0 6px ${halo}`, '0 3px 8px var(--color-ink-30)');
    else shadows.push('0 2px 6px var(--color-ink-20)');

    pin.button.style.background = pin.isOrdered ? orderedBackground : pin.color;
    pin.button.style.borderColor = pin.isOrdered ? pin.color : 'var(--color-snow)';
    pin.button.style.boxShadow = shadows.join(', ');
    pin.button.style.color = isSelected ? 'var(--color-snow)' : pin.color;
    pin.marker.getElement().style.zIndex = isSelected ? SELECTED_PIN_Z_INDEX : '';
}

function boundsOf(places: AtlasPlace[]): [[number, number], [number, number]] | null {
    if (!places.length) return null;

    const latitudes = places.map(place => place.lat);
    const longitudes = places.map(place => place.lng);

    return [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
    ];
}

function buttonOf(marker: Marker) {
    return marker.getElement().querySelector<HTMLButtonElement>(MARKER_SELECTOR);
}

function clusterPropertiesOf(categories: AtlasCategory[]) {
    const properties: Record<string, unknown> = {};

    for (const category of categories) {
        properties[category.id] = ['+', ['case', ['==', ['get', 'category'], category.id], 1, 0]];
    }

    return properties;
}

function createClusterMarker(categories: AtlasCategory[], properties: MapFeature['properties'], onExpand: () => void) {
    const button = document.createElement('button');
    const count = Number(properties.point_count);
    const disc = document.createElement('span');
    const element = document.createElement('div');
    let offset = 0;
    const ring = document.createElement('span');
    const segments: string[] = [];

    const label = `${count} places \u2014 click to expand`;
    const size = CLUSTER_BASE_SIZE + Math.min(CLUSTER_MAX_GROWTH, Math.round(Math.sqrt(count) * CLUSTER_GROWTH_FACTOR));

    function handleClick(event: MouseEvent) {
        event.stopPropagation();
        onExpand();
    }

    for (const category of sortedCategoriesOf(categories)) {
        const value = Number(properties[category.id] ?? 0);

        if (!value) continue;

        const start = ((offset / count) * FULL_CIRCLE_DEGREES).toFixed(1);
        const end = (((offset + value) / count) * FULL_CIRCLE_DEGREES).toFixed(1);

        segments.push(`${categoryColor(category.id)} ${start}deg ${end}deg`);
        offset += value;
    }

    if (!segments.length) segments.push('var(--color-storm) 0deg 360deg');

    button.className = CLUSTER_CLASS;
    button.style.background = `conic-gradient(from 0deg, ${segments.join(', ')})`;
    button.style.height = `${size}px`;
    button.style.width = `${size}px`;
    button.tabIndex = -1;
    button.title = label;
    button.type = 'button';
    disc.className = CLUSTER_DISC_CLASS;
    disc.textContent = String(count);
    ring.className = CLUSTER_RING_CLASS;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', handleClick);
    button.append(disc, ring);
    element.append(button);

    return new Marker({ element });
}

function createPinMarker(place: AtlasPlace, trip: AtlasTrip | undefined, handlers: PinHandlers) {
    const button = document.createElement('button');
    const element = document.createElement('div');
    const isOrdered = Boolean(trip?.ordered);
    const isStarred = Boolean(place.starred);

    const label = isStarred ? `${place.name} \u2014 ${STAR_LABEL}` : place.name;
    const root = isOrdered || isStarred ? createRoot(button) : null;

    function handleClick(event: MouseEvent) {
        event.stopPropagation();
        handlers.onSelect();
    }

    button.className = isOrdered ? PIN_ICON_CLASS : PIN_DOT_CLASS;
    button.tabIndex = -1;
    button.title = label;
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', handleClick);
    button.addEventListener('mouseenter', handlers.onEnter);
    button.addEventListener('mouseleave', handlers.onLeave);
    element.append(button);
    root?.render(
        <PinMark
            category={place.category}
            isOrdered={isOrdered}
            isStarred={isStarred}
        />,
    );

    return {
        button,
        color: categoryColor(place.category),
        isOrdered,
        isStarred,
        marker: new Marker({ element }).setLngLat([place.lng, place.lat]),
        root,
    };
}

function flavorLayers(sourceId: string) {
    return layers(sourceId, MAP_FLAVOR, { lang: MAP_LANGUAGE })
        .filter(layer => !HIDDEN_LAYER_IDS.some(hiddenId => hiddenId === layer.id))
        .map(withoutIcons)
        .map(withEnglishLabels);
}

function isModifiedKey(event: KeyboardEvent) {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

async function loadTile(request: RequestParameters, abortController: AbortController) {
    const cached = tileCache.get(request.url);

    if (cached) return { data: new Uint8Array(cached) };

    const response = await tileProtocol.tile(request, abortController);

    if (response.data instanceof Uint8Array) {
        tileCache.set(request.url, new Uint8Array(response.data));

        if (tileCache.size > TILE_CACHE_LIMIT) {
            const oldest = tileCache.keys().next().value;

            if (oldest !== undefined) tileCache.delete(oldest);
        }
    }

    return response;
}

function markerButtonOf(node: EventTarget | null) {
    if (!(node instanceof Element)) return null;

    return node.closest<HTMLButtonElement>(MARKER_SELECTOR);
}

function rovingIndexOf(key: string, index: number, count: number) {
    if (count < 1) return -1;
    if (key === 'ArrowLeft') return (index - 1 + count) % count;
    if (key === 'ArrowRight') return (index + 1) % count;
    if (key === 'End') return count - 1;
    if (key === 'Home') return 0;

    return -1;
}

function scaleBarOf(zoom: number, latitude: number) {
    const metersPerPixel = (EARTH_CIRCUMFERENCE * Math.cos((latitude * Math.PI) / DEGREES_PER_HALF_TURN)) / ZOOM_BASE ** (zoom + TILE_ZOOM_OFFSET);

    const rawMiles = (metersPerPixel * SCALE_TARGET_WIDTH) / METERS_PER_MILE;

    const isFeet = rawMiles < MILE_MINIMUM;

    const raw = isFeet ? rawMiles * FEET_PER_MILE : rawMiles;

    const magnitude = MAGNITUDE_BASE ** Math.floor(Math.log10(raw));

    const ratio = raw / magnitude;

    const step = ratio >= SCALE_STEP_LARGE ? SCALE_STEP_LARGE : ratio >= SCALE_STEP_MEDIUM ? SCALE_STEP_MEDIUM : 1;

    const distance = magnitude * step;

    const meters = (isFeet ? distance / FEET_PER_MILE : distance) * METERS_PER_MILE;

    return {
        label: `${distance} ${isFeet ? 'ft' : 'mi'}`,
        width: Math.round(meters / metersPerPixel),
    };
}

function sortedCategoriesOf(categories: AtlasCategory[]) {
    return [...categories].sort((first, second) => first.id.localeCompare(second.id));
}

function toFeatureCollection(places: AtlasPlace[]) {
    return {
        features: places.map(place => ({
            geometry: {
                coordinates: [place.lng, place.lat],
                type: 'Point' as const,
            },
            properties: {
                category: place.category,
                id: place.id,
            },
            type: 'Feature' as const,
        })),
        type: 'FeatureCollection' as const,
    };
}

function unmountPin(pin: PinMarker | undefined) {
    const root = pin?.root;

    if (!root) return;

    queueMicrotask(() => root.unmount());
}

function withEnglishLabels(layer: LayerSpecification) {
    if (layer.type !== 'symbol' || !layer.layout) return layer;

    const textField = layer.layout['text-field'];

    if (!JSON.stringify(textField ?? null).includes(`name:${MAP_LANGUAGE}`)) return layer;

    return { ...layer, layout: { ...layer.layout, 'text-field': LABEL_TEXT_FIELD } };
}

function withMotion<Options extends FlyToOptions>(options: Options) {
    if (!prefersReducedMotion()) return options;

    return { ...options, duration: 0 };
}

function withoutIcons(layer: LayerSpecification) {
    if (layer.type !== 'symbol') return layer;

    const layout = { ...layer.layout };

    delete layout['icon-image'];
    delete layout['icon-size'];

    return { ...layer, layout };
}

function PinMark({ category, isOrdered, isStarred }: {
    category: string;
    isOrdered: boolean;
    isStarred: boolean;
}) {
    return (
        <>
            {isOrdered && (
                <IconCategory
                    category={category}
                    color="currentColor"
                    size={PIN_ICON_SIZE}
                />
            )}
            {isStarred && (
                <span className={PIN_STAR_CLASS}>
                    <svg
                        aria-hidden="true"
                        fill={STAR_COLOR}
                        height={STAR_SIZE}
                        paintOrder="stroke"
                        stroke="var(--color-snow)"
                        strokeLinejoin="round"
                        strokeWidth={STAR_OUTLINE_WIDTH}
                        viewBox="0 0 24 24"
                        width={STAR_SIZE}
                    >
                        <path d={STAR_PATH} />
                    </svg>
                </span>
            )}
        </>
    );
}

function PlacePopup({ category, onClose, onShowInCards, place, trip }: {
    category: AtlasCategory;
    onClose: () => void;
    onShowInCards: () => void;
    place: AtlasPlace;
    trip: AtlasTrip | null;
}) {
    const isStarred = Boolean(place.starred);

    return (
        <article className="atlas-rise atlas-rise--quick overflow-y-auto relative max-h-[calc(100dvh-72px)] max-w-[calc(100dvw-36px)] w-[var(--width-narrow)] pb-[12px] pt-[16px] px-[16px] border border-haze rounded-[12px] bg-snow shadow-[0_18px_44px_var(--color-ink-20)]">
            <button
                className="atlas-pill after:absolute after:content-[''] after:inset-[-8px] absolute right-[10px] top-[10px] h-[32px] w-[32px] p-0 bg-paper text-storm"
                aria-label="Close"
                onClick={onClose}
                type="button"
            >
                <IconClose size={11} />
            </button>
            <div className="mb-[8px]">
                <CategoryBadge
                    category={category.id}
                    label={category.name}
                />
            </div>
            <h2 className={`${CARD_NAME_CLASS} mb-[8px] pr-[28px]`}>
                {place.name}
                {isStarred && <StarMark />}
            </h2>
            <p className={`${CARD_DESCRIPTION_CLASS} mb-[12px]`}>{place.description}</p>
            {trip && (
                <PopupTrip
                    order={place.order}
                    trip={trip}
                />
            )}
            <div className={CARD_META_CLASS}>
                <span className={CARD_COORDINATES_CLASS}>{formatCoordinates(place)}</span>
                <button
                    className="atlas-pill atlas-pill--solid after:absolute after:content-[''] after:inset-x-0 after:inset-y-[-8px] relative px-[12px] py-[8px] font-medium text-[11px]"
                    onClick={onShowInCards}
                    type="button"
                >
                    Show in cards
                </button>
            </div>
        </article>
    );
}

function PopupTrip({ order, trip }: {
    order: number;
    trip: AtlasTrip;
}) {
    const stopLabel = `Stop ${order} of ${trip.count}`;

    return (
        <div className="flex flex-wrap items-baseline gap-[8px] mb-[12px]">
            <span className={`${CARD_TRIP_NAME_CLASS} min-w-0`}>{trip.name}</span>
            <time
                className={CARD_TRIP_YEAR_CLASS}
                dateTime={String(trip.year)}
            >
                {trip.year}
            </time>
            {trip.ordered && (
                <span className="atlas-label px-[8px] py-[2px] border border-haze rounded-full text-[10px] tracking-[0.08em] whitespace-nowrap text-storm">{stopLabel}</span>
            )}
        </div>
    );
}

addProtocol('pmtiles', loadTile);
setWorkerUrl(mapWorkerUrl);

export default function MapView({ categories, flyTarget, hasActiveFilters, hoverPlace, onHoverPlace, onSelectPlace, onShowInCards, places, regions, selectedPlaceId, trips }: {
    categories: AtlasCategory[];
    flyTarget: AtlasFlyTarget | null;
    hasActiveFilters: boolean;
    hoverPlace: AtlasPlace | null;
    onHoverPlace: (place: AtlasPlace | null) => void;
    onSelectPlace: (placeId: number | null) => void;
    onShowInCards: (place: AtlasPlace) => void;
    places: AtlasPlace[];
    regions: AtlasRegions;
    selectedPlaceId: number | null;
    trips: AtlasTrip[];
}) {
    const boundsKey = (boundsOf(places) ?? []).flat().join(',');
    const containerRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef({ categories, onHoverPlace, onSelectPlace, onShowInCards, places, regions, selectedPlaceId, trips });
    const flownTargetRef = useRef<AtlasFlyTarget | null>(null);
    const hasBottomStrip = hasActiveFilters || places.length === 0;
    const [isMapReady, setIsMapReady] = useState(false);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markersRef = useRef(new Map<string, Marker>());
    const pinsRef = useRef(new Map<number, PinMarker>());
    const [popupPlaceId, setPopupPlaceId] = useState<number | null>(null);
    const popupPlaceRef = useRef<number | null>(null);
    const popupRef = useRef<Popup | null>(null);
    const popupRootRef = useRef<Root | null>(null);
    const rovingKeyRef = useRef<string | null>(null);
    const [scaleBar, setScaleBar] = useState<ScaleBar>({ label: '', width: 0 });

    function applyRoving() {
        const target = rovingKeyOf();

        for (const [key, marker] of markersRef.current) {
            const button = buttonOf(marker);
            const tabIndex = key === target ? 0 : -1;

            if (!button || button.tabIndex === tabIndex) continue;

            button.tabIndex = tabIndex;
        }

        rovingKeyRef.current = target;
    }

    function clearClusterMarkers() {
        for (const [key, marker] of markersRef.current) {
            if (!key.startsWith(CLUSTER_KEY_PREFIX)) continue;

            marker.remove();
            markersRef.current.delete(key);
        }
    }

    function closePopup() {
        const element = popupRef.current?.getElement();
        const placeId = popupPlaceRef.current;

        const hadFocus = Boolean(element?.contains(document.activeElement));

        popupPlaceRef.current = null;
        popupRef.current?.remove();

        if (!hadFocus) return;

        const pin = placeId === null ? undefined : pinsRef.current.get(placeId);

        if (pin) {
            pin.button.focus();

            return;
        }

        mapRef.current?.getCanvas().focus();
    }

    function findPlace(placeId: number | null) {
        if (placeId === null) return null;

        return places.find(place => place.id === placeId) ?? null;
    }

    function fitToPlaces(isImmediate: boolean) {
        const bounds = boundsOf(contextRef.current.places);
        const map = mapRef.current;

        if (!bounds || !map) return;

        const options: FitBoundsOptions = { maxZoom: FIT_MAX_ZOOM, padding: FIT_PADDING };

        map.fitBounds(bounds, isImmediate ? { ...options, duration: 0 } : withMotion(options));
    }

    async function handleClusterExpand(clusterId: number, coordinates: [number, number]) {
        const source = mapRef.current?.getSource<GeoJSONSource>(SOURCE_ID);

        if (!source) return;

        const zoom = await source.getClusterExpansionZoom(clusterId);
        const map = mapRef.current;

        if (!map) return;

        map.easeTo(withMotion({ center: coordinates, zoom }));
    }

    function handleLoad() {
        const context = contextRef.current;
        const map = mapRef.current;

        if (!map) return;

        map.addSource(SOURCE_ID, {
            cluster: true,
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            clusterProperties: clusterPropertiesOf(context.categories),
            clusterRadius: CLUSTER_RADIUS,
            data: toFeatureCollection(context.places),
            type: 'geojson',
        });
        map.addLayer({
            id: LAYER_ID,
            paint: { 'circle-opacity': 0, 'circle-radius': 1 },
            source: SOURCE_ID,
            type: 'circle',
        });
        setIsMapReady(true);
        syncRegions();
    }

    function handleMarkerFocus(event: FocusEvent) {
        const button = markerButtonOf(event.target);

        const key = button === null ? null : markerKeyOf(button);

        if (key === null || key === rovingKeyRef.current) return;

        rovingKeyRef.current = key;
        applyRoving();
    }

    function handleMarkerKeyDown(event: KeyboardEvent) {
        if (event.isComposing || isModifiedKey(event)) return;

        const button = markerButtonOf(event.target);

        if (!button) return;

        const buttons = markerButtons();

        const from = buttons.indexOf(button);

        const to = rovingIndexOf(event.key, from, buttons.length);

        if (from === -1 || to === -1) return;

        event.preventDefault();
        event.stopPropagation();
        buttons[to].focus();
    }

    function handleMove() {
        const map = mapRef.current;

        if (!map) return;

        const next = scaleBarOf(map.getZoom(), map.getCenter().lat);

        setScaleBar(current => (current.label === next.label && current.width === next.width ? current : next));
    }

    function handleSync() {
        const map = mapRef.current;

        if (!map || !map.getSource(SOURCE_ID) || !map.isSourceLoaded(SOURCE_ID)) return;

        const context = contextRef.current;
        const features = map.querySourceFeatures(SOURCE_ID) as unknown as MapFeature[];
        let hasChanges = false;
        const visibleKeys = new Set<string>();

        for (const feature of features) {
            const coordinates = feature.geometry.coordinates;
            const properties = feature.properties;

            if (properties.cluster) {
                const clusterId = Number(properties.cluster_id);

                const key = `${CLUSTER_KEY_PREFIX}${clusterId}`;

                if (visibleKeys.has(key)) continue;

                visibleKeys.add(key);

                if (markersRef.current.has(key)) continue;

                const marker = createClusterMarker(context.categories, properties, () => handleClusterExpand(clusterId, coordinates));

                marker.setLngLat(coordinates).addTo(map);
                markersRef.current.set(key, marker);
                hasChanges = true;

                continue;
            }

            const placeId = Number(properties.id);

            const key = `${PLACE_KEY_PREFIX}${placeId}`;

            if (visibleKeys.has(key)) continue;

            visibleKeys.add(key);

            if (markersRef.current.has(key)) continue;

            const place = context.places.find(item => item.id === placeId);

            if (!place) continue;

            const pin = createPinMarker(place, context.trips.find(trip => trip.id === place.trip), {
                onEnter: () => contextRef.current.onHoverPlace(place),
                onLeave: () => contextRef.current.onHoverPlace(null),
                onSelect: () => contextRef.current.onSelectPlace(place.id),
            });

            applyPinState(pin, context.selectedPlaceId === place.id);
            markersRef.current.set(key, pin.marker);
            pin.marker.addTo(map);
            pinsRef.current.set(place.id, pin);
            hasChanges = true;
        }

        for (const [key, marker] of markersRef.current) {
            if (visibleKeys.has(key)) continue;

            marker.remove();
            markersRef.current.delete(key);
            hasChanges = true;

            if (!key.startsWith(PLACE_KEY_PREFIX)) continue;

            const placeId = Number(key.slice(PLACE_KEY_PREFIX.length));

            unmountPin(pinsRef.current.get(placeId));
            pinsRef.current.delete(placeId);
        }

        if (hasChanges) applyRoving();
    }

    function markerButtons() {
        const buttons: HTMLButtonElement[] = [];

        for (const marker of markersRef.current.values()) {
            const button = buttonOf(marker);

            if (button) buttons.push(button);
        }

        return buttons;
    }

    function markerKeyOf(button: HTMLButtonElement) {
        for (const [key, marker] of markersRef.current) if (buttonOf(marker) === button) return key;

        return null;
    }

    function rovingKeyOf() {
        const current = rovingKeyRef.current;
        const markers = markersRef.current;
        const selectedKey = `${PLACE_KEY_PREFIX}${contextRef.current.selectedPlaceId}`;

        if (current !== null && markers.has(current)) return current;
        if (markers.has(selectedKey)) return selectedKey;

        return markers.keys().next().value ?? null;
    }

    function stylePopupChrome() {
        const element = popupRef.current?.getElement();

        if (!element) return;

        const content = element.querySelector<HTMLElement>('.maplibregl-popup-content');
        const tip = element.querySelector<HTMLElement>('.maplibregl-popup-tip');

        if (content) {
            content.style.background = 'none';
            content.style.borderRadius = '0';
            content.style.boxShadow = 'none';
            content.style.padding = '0';
        }

        if (tip) tip.style.display = 'none';
    }

    function syncRegions() {
        const context = contextRef.current;
        const map = mapRef.current;

        if (!map) return;

        const data = context.regions as SourceData;
        const source = map.getSource<GeoJSONSource>(REGION_SOURCE_ID);

        if (!source) {
            addRegionLayers(map, data);

            return;
        }

        source.setData(data);
    }

    useEffect(() => {
        contextRef.current = { categories, onHoverPlace, onSelectPlace, onShowInCards, places, regions, selectedPlaceId, trips };
    });

    useEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const map = new MapLibreMap({
            attributionControl: false,
            center: DEFAULT_CENTER,
            container,
            dragRotate: false,
            maxZoom: MAP_MAX_ZOOM,
            pitchWithRotate: false,
            style: mapStyle,
            touchPitch: false,
            zoom: DEFAULT_ZOOM,
        });
        const popup = new Popup({
            closeButton: false,
            closeOnClick: false,
            focusAfterOpen: false,
            maxWidth: 'none',
            offset: POPUP_OFFSET,
        });
        const popupContainer = document.createElement('div');

        map.keyboard.disableRotation();
        map.touchZoomRotate.disableRotation();
        popup.setDOMContent(popupContainer);
        map.on('click', () => contextRef.current.onSelectPlace(null));
        map.on('load', handleLoad);
        map.on('move', handleMove);
        map.on('render', handleSync);
        map.on('sourcedata', handleSync);
        popupContainer.addEventListener('click', event => event.stopPropagation());
        container.addEventListener('focusin', handleMarkerFocus);
        container.addEventListener('keydown', handleMarkerKeyDown, true);
        mapRef.current = map;
        popupRef.current = popup;
        popupRootRef.current = createRoot(popupContainer);
        fitToPlaces(true);

        return () => {
            const root = popupRootRef.current;

            for (const marker of markersRef.current.values()) marker.remove();

            for (const pin of pinsRef.current.values()) unmountPin(pin);

            container.removeEventListener('focusin', handleMarkerFocus);
            container.removeEventListener('keydown', handleMarkerKeyDown, true);
            markersRef.current.clear();
            pinsRef.current.clear();
            popup.remove();
            map.remove();
            mapRef.current = null;
            popupRef.current = null;
            popupRootRef.current = null;

            if (root) queueMicrotask(() => root.unmount());
        };
    }, []);

    useEffect(() => {
        const source = mapRef.current?.getSource<GeoJSONSource>(SOURCE_ID);

        if (!isMapReady || !source) return;

        clearClusterMarkers();
        source.setData(toFeatureCollection(places));
    }, [isMapReady, places]);

    useEffect(() => {
        if (!isMapReady) return;

        syncRegions();
    }, [isMapReady, regions]);

    useEffect(() => {
        if (!isMapReady) return;

        fitToPlaces(false);
    }, [boundsKey, isMapReady]);

    useEffect(() => {
        const map = mapRef.current;

        if (!isMapReady || !map) return;

        const target = flyTarget;

        if (!target || target === flownTargetRef.current) {
            setPopupPlaceId(selectedPlaceId);

            return;
        }

        flownTargetRef.current = target;

        const place = findPlace(target.placeId);
        const placeId = target.placeId;

        if (!place) {
            setPopupPlaceId(selectedPlaceId);

            return;
        }

        function handleMoveEnd() {
            contextRef.current.onSelectPlace(placeId);
            setPopupPlaceId(placeId);
        }

        setPopupPlaceId(null);
        map.stop();
        map.once('moveend', handleMoveEnd);
        map.flyTo(withMotion({ center: [place.lng, place.lat], zoom: FLY_ZOOM }));

        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [flyTarget, isMapReady, places, selectedPlaceId]);

    useEffect(() => {
        for (const [placeId, pin] of pinsRef.current) applyPinState(pin, placeId === selectedPlaceId);

        if (selectedPlaceId !== null && pinsRef.current.has(selectedPlaceId)) rovingKeyRef.current = `${PLACE_KEY_PREFIX}${selectedPlaceId}`;

        applyRoving();
    }, [selectedPlaceId]);

    useEffect(() => {
        const map = mapRef.current;
        const place = findPlace(popupPlaceId);
        const popup = popupRef.current;
        const root = popupRootRef.current;

        if (!map || !popup || !root) return;

        const category = categories.find(item => item.id === place?.category);
        const trip = trips.find(item => item.id === place?.trip) ?? null;

        if (!category || !place) {
            closePopup();

            return;
        }

        popupPlaceRef.current = place.id;
        popup.setLngLat([place.lng, place.lat]);
        root.render(
            <PlacePopup
                category={category}
                onClose={() => contextRef.current.onSelectPlace(null)}
                onShowInCards={() => contextRef.current.onShowInCards(place)}
                place={place}
                trip={trip}
            />,
        );

        if (popup.isOpen()) return;

        popup.addTo(map);
        stylePopupChrome();
    }, [categories, places, popupPlaceId, trips]);

    return (
        <div className="atlas-fade atlas-fade--slow absolute inset-0 overflow-hidden">
            <div className="h-full w-full" ref={containerRef} />
            <div className={`absolute flex flex-col inset-x-0 items-center z-10 w-fit mx-auto gap-[4px] pointer-events-none ${hasBottomStrip ? 'bottom-[104px] max-md:bottom-[18px]' : 'bottom-[18px]'}`}>
                <div style={{ width: scaleBar.width }}>
                    <div className="h-[5px] border-b border-l border-r border-storm" aria-hidden="true" />
                </div>
                <p className="atlas-label px-[4px] py-[2px] rounded-[4px] leading-none text-[10px] tracking-[0.12em] bg-snow-90 text-storm backdrop-blur-[8px]">{scaleBar.label}</p>
            </div>
            <div className="absolute bottom-[86px] right-[18px] z-10 max-w-[calc(100%-36px)] min-h-[30px] text-right pointer-events-none">
                {hoverPlace && (
                    <div className="inline-block px-[8px] py-[4px] rounded-[10px] bg-snow-90 backdrop-blur-[8px]">
                        <p className="mb-[2px] font-medium text-[11px] wrap-anywhere text-slate">{hoverPlace.name}</p>
                        <p className="atlas-label text-[10px] tracking-[0.12em] text-storm">{formatCoordinates(hoverPlace)}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
