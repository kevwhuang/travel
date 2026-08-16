import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { MapLibreMap, Marker, Popup, addProtocol, setWorkerUrl } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { createRoot } from 'react-dom/client';
import { layers } from '@protomaps/basemaps';
import { useEffect, useRef, useState } from 'react';

import CardMarker from '@components/CardMarker';
import IconCategory from '@components/IconCategory';
import IconStar from '@components/IconStar';
import { CATEGORY_COLORS, COPYRIGHT_MARK, COVERAGE_REGIONS, CREDIT_MAP, MAP_FONT_STACKS, MAP_MAX_ZOOM, MAP_MIN_ZOOM, STAR_COLOR, STAR_LABEL, TILE_EXTENSION, WORLD_SOURCE_ID } from '@lib/constants';
import { getCategoryColor, isModifiedEvent } from '@lib/utils';
import { loadAtlasState, saveAtlasState } from '@lib/store';
import { prefersReducedMotion } from '@lib/motion';

import type { ExpressionSpecification, FitBoundsOptions, FlyToOptions, GeoJSONFeature, GeoJSONSource, LayerSpecification, MapMouseEvent, MapWheelEvent, RequestParameters, StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import type { Flavor } from '@protomaps/basemaps';
import type { Root } from 'react-dom/client';

type SourceData = Parameters<GeoJSONSource['setData']>[0];

interface Pin {
    anchor: Marker;
    button: HTMLButtonElement;
    categoryId: string;
    color: string;
    isOrdered: boolean;
    isStarred: boolean;
    root: Root | null;
}

interface ScaleBar {
    label: string;
    width: number;
}

const CAMERA_COORDINATE_DECIMALS = 5;
const CAMERA_ZOOM_DECIMALS = 2;
const CATEGORY_PIN_MAX_Z_INDEX = 16;
const CATEGORY_PIN_MIN_Z_INDEX = 11;
const CLASS_CLUSTER = 'atlas-fade atlas-marker active:scale-[0.96] before:absolute before:content-[""] before:inset-[-8px] hover:scale-[1.09] relative p-0 border-none rounded-full duration-[var(--duration-fast)] ease-[ease] shadow-[0_0_0_1px_var(--color-storm),0_4px_10px_var(--color-ink-20)] transition-[scale]';
const CLASS_PIN_DOT = 'atlas-fade atlas-marker active:scale-[0.96] before:absolute before:content-[""] before:inset-[-14px] hover:scale-[1.3] block relative h-[24px] w-[24px] p-0 border-2 border-snow rounded-full duration-[var(--duration-fast)] ease-[ease] transition-[background-color,border-color,box-shadow,scale]';
const CLASS_PIN_ICON = 'atlas-fade atlas-marker active:scale-[0.96] before:absolute before:content-[""] before:inset-[-14px] hover:scale-[1.3] grid place-items-center relative h-[24px] w-[24px] p-0 border-2 rounded-full duration-[var(--duration-fast)] ease-[ease] transition-[background-color,box-shadow,color,scale]';
const CLASS_SCALE_BAR = 'atlas-scale-bar absolute bottom-[18px] flex flex-col inset-x-0 items-center z-30 w-fit gap-[4px] mx-auto duration-[var(--duration-fast)] ease-[ease] transition-[opacity] pointer-events-none select-none';
const CLASS_SCALE_LABEL = 'px-[4px] py-[2px] rounded-[4px] font-mono leading-none text-[10px] tracking-[0.12em] uppercase bg-snow-90 text-storm backdrop-blur-[8px]';
const CLUSTER_BASE_SIZE = 34;
const CLUSTER_GROWTH_FACTOR = 3;
const CLUSTER_KEY_PREFIX = 'cluster-';
const CLUSTER_MAX_GROWTH = 24;
const CLUSTER_MAX_ZOOM = 12;
const CLUSTER_RADIUS = 36;
const CLUSTER_SEPARATOR_DEGREES = 1.5;
const CLUSTER_Z_INDEX = '10';
const COVERAGE_MIN_ZOOM = 7.5;
const DEFAULT_CENTER = { lat: 30.4, lng: -97.8 } as const;
const DEFAULT_ZOOM = 3;
const DEGREES_PER_FULL_TURN = 360;
const DEGREES_PER_HALF_TURN = 180;
const EARTH_CIRCUMFERENCE = 40_075_016.686;
const FEET_PER_MILE = 5_280;
const FIT_MAX_ZOOM = 13;
const FIT_PADDING = 72;
const FLY_ZOOM = 13;
const FOCUSED_MARKER_Z_INDEX = '22';
const HIDDEN_LAYER_IDS = ['roads_oneway', 'roads_shields'] as const;
const MAGNITUDE_BASE = 10;

const MAP_FLAVOR: Flavor = {
    address_label: '#6f7d80',
    address_label_halo: '#f6f4e9',
    aerodrome: '#e7eae7',
    background: '#cbddd8',
    beach: '#eee6cd',
    bold: MAP_FONT_STACKS.bold,
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
    italic: MAP_FONT_STACKS.italic,
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
    regular: MAP_FONT_STACKS.regular,
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

const MAP_GLYPHS_URL = '/fonts/map/{fontstack}/{range}.pbf';
const MAP_LANGUAGE = 'en';
const MAP_TILES_URL = 'pmtiles:///tiles';
const MARKER_GROUP_LABEL = 'Map markers';
const MARKER_KEY_PREFIX = 'marker-';
const MARKER_LAYER_ID = 'atlas-markers-anchor';
const MARKER_SELECTOR = 'button.atlas-marker';
const MARKER_SOURCE_ID = 'atlas-markers';
const METERS_PER_MILE = 1_609.344;
const MILE_MINIMUM = 0.5;
const OVERLAY_BAND = 66;
const PIN_HALO_WIDTH = 6;
const PIN_ICON_SIZE = 12;
const PIN_OUTLINE_COLOR = 'var(--color-storm)';
const PIN_OUTLINE_WIDTH = 1;
const POPUP_CONTAINER_ID = 'atlas-popup';
const POPUP_EASE_DURATION = 300;
const POPUP_OFFSET = 28;
const POPUP_PAN_ATTEMPTS = 3;
const POPUP_SETTLE_FRAMES = 12;
const POPUP_VIEW_MARGIN = 18;
const POPUP_Z_INDEX = '45';
const REGION_ACTIVE_FILL_OPACITY = 0.22;
const REGION_ACTIVE_LINE_OPACITY = 0.5;

const REGION_COLORS = {
    active: '#9b72cf',
    explored: '#e2725b',
} as const;

const REGION_EXPLORED_FILL_OPACITY = 0.14;
const REGION_EXPLORED_LINE_OPACITY = 0.35;
const REGION_FILL_LAYER_ID = 'atlas-regions-fill';
const REGION_LINE_LAYER_ID = 'atlas-regions-line';
const REGION_LINE_WIDTH = 1;
const REGION_SOURCE_ID = 'atlas-regions';
const SCALE_STEP_LARGE = 5;
const SCALE_STEP_MEDIUM = 2;
const SCALE_TARGET_WIDTH = 120;
const SELECTED_PIN_Z_INDEX = '21';
const STARRED_PIN_Z_INDEX = '20';
const STAR_RING_WIDTH = 2;
const TILE_CACHE_LIMIT = 96;
const TILE_ZOOM_OFFSET = 9;
const UNCOVERED_MAX_ZOOM = 7.9;
const WORLD_LAYER_MAX_ZOOM = 8;
const WORLD_LAYER_PREFIX = 'w-';
const ZOOM_BASE = 2;
const ZOOM_EPSILON = 0.01;

const CATEGORY_PIN_Z_INDEXES = new Map(Object.keys(CATEGORY_COLORS)
    .sort((first, second) => first.localeCompare(second))
    .map((id, rank) => [id, String(Math.max(CATEGORY_PIN_MIN_Z_INDEX, CATEGORY_PIN_MAX_Z_INDEX - rank))] as const));

const mapStyle: StyleSpecification = {
    glyphs: MAP_GLYPHS_URL,
    layers: [
        ...buildFlavorLayers(WORLD_SOURCE_ID).map(layer => ({
            ...layer,
            id: `${WORLD_LAYER_PREFIX}${layer.id}`,
            maxzoom: Math.min(WORLD_LAYER_MAX_ZOOM, layer.maxzoom ?? WORLD_LAYER_MAX_ZOOM),
        })),
        ...buildCoverageLayers(),
    ],
    sources: {
        ...Object.fromEntries(COVERAGE_REGIONS.map(region => [region.name, getTileSource(region.name)] as const)),
        [WORLD_SOURCE_ID]: getTileSource(WORLD_SOURCE_ID),
    },
    version: 8,
};

const tileCache = new Map<string, Uint8Array>();
const tileProtocol = new Protocol();

function addRegionLayers(map: MapLibreMap, regions: SourceData) {
    const beforeId = map.getStyle().layers.find(layer => layer.type === 'symbol' && !layer.id.startsWith(WORLD_LAYER_PREFIX))?.id;
    const color: ExpressionSpecification = ['match', ['get', 'status'], 'active', REGION_COLORS.active, REGION_COLORS.explored];
    const fillOpacity: ExpressionSpecification = ['match', ['get', 'status'], 'active', REGION_ACTIVE_FILL_OPACITY, REGION_EXPLORED_FILL_OPACITY];
    const lineOpacity: ExpressionSpecification = ['match', ['get', 'status'], 'active', REGION_ACTIVE_LINE_OPACITY, REGION_EXPLORED_LINE_OPACITY];

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

function applyPinState(pin: Pin, isSelected: boolean) {
    const halo = `color-mix(in oklab, ${pin.color} 26%, transparent)`;
    const shadows = [`0 0 0 ${PIN_OUTLINE_WIDTH}px ${PIN_OUTLINE_COLOR}`];
    const unselectedBackground = pin.isOrdered ? 'var(--color-snow)' : pin.color;
    const unselectedZIndex = pin.isStarred ? STARRED_PIN_Z_INDEX : CATEGORY_PIN_Z_INDEXES.get(pin.categoryId) ?? String(CATEGORY_PIN_MIN_Z_INDEX);

    if (pin.isStarred) shadows.push(`0 0 0 ${PIN_OUTLINE_WIDTH + STAR_RING_WIDTH}px ${STAR_COLOR}`);

    if (isSelected) shadows.push(`0 0 0 ${PIN_OUTLINE_WIDTH + PIN_HALO_WIDTH}px ${halo}`, '0 4px 8px var(--color-ink-30)');
    else shadows.push('0 2px 6px var(--color-ink-20)');

    pin.button.setAttribute('aria-expanded', String(isSelected));

    if (isSelected) pin.button.setAttribute('aria-controls', POPUP_CONTAINER_ID);
    else pin.button.removeAttribute('aria-controls');

    if (pin.button !== document.activeElement) pin.anchor.getElement().style.zIndex = isSelected ? SELECTED_PIN_Z_INDEX : unselectedZIndex;

    pin.button.style.background = isSelected ? 'var(--color-ink)' : unselectedBackground;
    pin.button.style.borderColor = isSelected || pin.isOrdered ? pin.color : 'var(--color-snow)';
    pin.button.style.boxShadow = shadows.join(', ');
    pin.button.style.color = isSelected ? 'var(--color-snow)' : pin.color;
}

function buildCoverageLayers() {
    const generated = COVERAGE_REGIONS.flatMap((region, index) => buildFlavorLayers(region.name)
        .filter(layer => !index || layer.type !== 'background')
        .map(layer => ({
            ...layer,
            id: `${region.name}-${layer.id}`,
            minzoom: Math.max(layer.type === 'background' ? WORLD_LAYER_MAX_ZOOM : COVERAGE_MIN_ZOOM, layer.minzoom ?? 0),
        })));

    return [...generated.filter(layer => layer.type !== 'symbol'), ...generated.filter(layer => layer.type === 'symbol')];
}

function buildFlavorLayers(sourceId: string) {
    return layers(sourceId, MAP_FLAVOR, { lang: MAP_LANGUAGE })
        .filter(layer => !HIDDEN_LAYER_IDS.some(hiddenId => hiddenId === layer.id))
        .map(withoutIcons)
        .map(withEnglishLabels);
}

function createClusterAnchor(properties: GeoJSONFeature['properties'], categories: AtlasCategory[], onExpand: (hasFocus: boolean) => void) {
    const button = document.createElement('button');
    const disc = document.createElement('span');
    const element = document.createElement('div');

    const filledCategories = categories
        .filter(category => Number(properties[category.id] ?? 0) > 0)
        .sort((first, second) => first.id.localeCompare(second.id));

    const halfSeparator = CLUSTER_SEPARATOR_DEGREES / 2;
    const markerCount = Number(properties.point_count);
    const ring = document.createElement('span');
    const stops: string[] = [];

    const label = `${markerCount} markers \u2014 expand`;
    const size = CLUSTER_BASE_SIZE + Math.min(CLUSTER_MAX_GROWTH, Math.round(Math.sqrt(markerCount) * CLUSTER_GROWTH_FACTOR));

    let cursorDegrees = 0;
    let offset = 0;

    function handleClick(event: MouseEvent) {
        event.stopPropagation();
        onExpand(button.contains(document.activeElement));
    }

    if (filledCategories.length === 1) stops.push(`${getCategoryColor(filledCategories[0].id)} 0deg ${DEGREES_PER_FULL_TURN}deg`);

    if (filledCategories.length > 1) {
        for (const category of filledCategories) {
            const categoryMarkerCount = Number(properties[category.id]);
            const start = (offset / markerCount) * DEGREES_PER_FULL_TURN;

            const end = ((offset + categoryMarkerCount) / markerCount) * DEGREES_PER_FULL_TURN;

            offset += categoryMarkerCount;

            const inkEnd = Math.max(cursorDegrees, start + halfSeparator);

            const colorEnd = Math.max(inkEnd, end - halfSeparator);

            stops.push(`var(--color-ink) ${cursorDegrees.toFixed(1)}deg ${inkEnd.toFixed(1)}deg`);
            stops.push(`${getCategoryColor(category.id)} ${inkEnd.toFixed(1)}deg ${colorEnd.toFixed(1)}deg`);
            cursorDegrees = colorEnd;
        }

        stops.push(`var(--color-ink) ${cursorDegrees.toFixed(1)}deg ${DEGREES_PER_FULL_TURN}deg`);
    }

    if (!stops.length) stops.push(`var(--color-storm) 0deg ${DEGREES_PER_FULL_TURN}deg`);

    button.className = CLASS_CLUSTER;
    button.style.background = `conic-gradient(from 0deg, ${stops.join(', ')})`;
    button.style.height = `${size}px`;
    button.style.width = `${size}px`;
    button.tabIndex = -1;
    button.title = label;
    button.type = 'button';
    disc.className = 'absolute grid inset-[4px] place-items-center rounded-full font-serif text-[14px] bg-snow text-ink';
    disc.textContent = String(markerCount);
    element.style.zIndex = CLUSTER_Z_INDEX;
    ring.className = 'absolute inset-[-6px] border border-dashed border-ink-30 rounded-full';
    button.addEventListener('click', handleClick);
    button.append(disc, ring);
    button.setAttribute('aria-label', label);
    element.append(button);

    return new Marker({ element });
}

function createPin(marker: AtlasMarker, journey: AtlasJourney | undefined, onSelect: () => void) {
    const button = document.createElement('button');
    const element = document.createElement('div');
    const isOrdered = Boolean(journey?.isOrdered);
    const isStarred = marker.isStarred;

    const label = isStarred ? `${marker.name} \u2014 ${STAR_LABEL}` : marker.name;
    const root = isOrdered || isStarred ? createRoot(button) : null;

    function handleClick(event: MouseEvent) {
        event.stopPropagation();
        onSelect();
    }

    button.className = isOrdered ? CLASS_PIN_ICON : CLASS_PIN_DOT;
    button.tabIndex = -1;
    button.title = label;
    button.type = 'button';
    button.addEventListener('click', handleClick);
    button.setAttribute('aria-label', label);
    element.append(button);

    root?.render(
        <PinMark categoryId={marker.categoryId} isOrdered={isOrdered} isStarred={isStarred} />,
    );

    return {
        anchor: new Marker({ element }).setLngLat([marker.lng, marker.lat]),
        button,
        categoryId: marker.categoryId,
        color: getCategoryColor(marker.categoryId),
        isOrdered,
        isStarred,
        root,
    };
}

function findMarkerButton(node: EventTarget | null) {
    if (!(node instanceof Element)) return null;

    return node.closest<HTMLButtonElement>(MARKER_SELECTOR);
}

function getMarkerBounds(markers: AtlasMarker[]): [[number, number], [number, number]] | null {
    if (!markers.length) return null;

    const latitudes = markers.map(marker => marker.lat);
    const longitudes = markers.map(marker => marker.lng);

    return [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
    ];
}

function getMarkerButton(anchor: Marker) {
    return anchor.getElement().querySelector<HTMLButtonElement>(MARKER_SELECTOR);
}

function getMaxZoomAt(lngLat: { lat: number; lng: number }) {
    const region = COVERAGE_REGIONS.find(coverageRegion => (
        lngLat.lat >= coverageRegion.south
        && lngLat.lat <= coverageRegion.north
        && lngLat.lng >= coverageRegion.west
        && lngLat.lng <= coverageRegion.east
    ));

    return region?.maxZoom ?? UNCOVERED_MAX_ZOOM;
}

function getRovingIndex(key: string, index: number, count: number) {
    if (count < 1) return -1;
    if (key === 'ArrowDown' || key === 'ArrowRight') return (index + 1) % count;
    if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
    if (key === 'End') return count - 1;
    if (key === 'Home') return 0;

    return -1;
}

function getScaleBar(zoom: number, latitude: number) {
    const metersPerPixel = (EARTH_CIRCUMFERENCE * Math.cos((latitude * Math.PI) / DEGREES_PER_HALF_TURN)) / ZOOM_BASE ** (zoom + TILE_ZOOM_OFFSET);

    const rawMiles = (metersPerPixel * SCALE_TARGET_WIDTH) / METERS_PER_MILE;

    const isFeet = rawMiles < MILE_MINIMUM;

    const rawDistance = isFeet ? rawMiles * FEET_PER_MILE : rawMiles;

    const magnitude = MAGNITUDE_BASE ** Math.floor(Math.log10(rawDistance));

    const ratio = rawDistance / magnitude;

    const step = ratio >= SCALE_STEP_LARGE ? SCALE_STEP_LARGE : ratio >= SCALE_STEP_MEDIUM ? SCALE_STEP_MEDIUM : 1;

    const distance = magnitude * step;

    return {
        label: `${distance} ${isFeet ? 'ft' : 'mi'}`,
        width: Math.round(((isFeet ? distance / FEET_PER_MILE : distance) * METERS_PER_MILE) / metersPerPixel),
    };
}

function getTileSource(name: string): VectorSourceSpecification {
    return {
        attribution: `${COPYRIGHT_MARK} ${CREDIT_MAP}`,
        type: 'vector',
        url: `${MAP_TILES_URL}/${name}${TILE_EXTENSION}`,
    };
}

function isFocusIdle(map: MapLibreMap | null) {
    const activeElement = document.activeElement;

    return activeElement === null || activeElement === document.body || activeElement === map?.getCanvas();
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

function toFeatureCollection(markers: AtlasMarker[]) {
    return {
        features: markers.map(marker => ({
            geometry: {
                coordinates: [marker.lng, marker.lat],
                type: 'Point' as const,
            },
            properties: {
                categoryId: marker.categoryId,
                id: marker.id,
            },
            type: 'Feature' as const,
        })),
        type: 'FeatureCollection' as const,
    };
}

function unmountPin(pin: Pin | undefined) {
    const root = pin?.root;

    if (!root) return;

    queueMicrotask(() => root.unmount());
}

function withEnglishLabels(layer: LayerSpecification) {
    if (layer.type !== 'symbol' || !layer.layout) return layer;

    const textField = layer.layout['text-field'];

    if (!JSON.stringify(textField ?? null).includes(`name:${MAP_LANGUAGE}`)) return layer;

    const labelField: ExpressionSpecification = ['coalesce', ['get', `name:${MAP_LANGUAGE}`], ['get', 'name']];

    return { ...layer, layout: { ...layer.layout, 'text-field': labelField } };
}

function withMotionPreference<Options extends FlyToOptions>(options: Options) {
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

function PinMark({ categoryId, isOrdered, isStarred }: {
    categoryId: string;
    isOrdered: boolean;
    isStarred: boolean;
}) {
    return (
        <>
            {isOrdered && (
                <IconCategory categoryId={categoryId} color="currentColor" size={PIN_ICON_SIZE} />
            )}
            {isStarred && (
                <span className="absolute right-[-8px] top-[-8px] leading-none pointer-events-none">
                    <IconStar color={STAR_COLOR} hasOutline />
                </span>
            )}
        </>
    );
}

addProtocol('pmtiles', loadTile);
setWorkerUrl(mapWorkerUrl);

export default function ViewMap({ categories, flyTarget, journeys, markers, onSelectMarker, onShowInCards, regions, selectedMarkerId }: {
    categories: AtlasCategory[];
    flyTarget: AtlasFlyTarget | null;
    journeys: AtlasJourney[];
    markers: AtlasMarker[];
    onSelectMarker: (markerId: number | null) => void;
    onShowInCards: (marker: AtlasMarker) => void;
    regions: AtlasRegions;
    selectedMarkerId: number | null;
}) {
    const anchorsRef = useRef(new Map<string, Marker>());
    const boundsKey = (getMarkerBounds(markers) ?? []).flat().join(',');
    const containerRef = useRef<HTMLDivElement>(null);
    const flownTargetRef = useRef<AtlasFlyTarget | null>(null);
    const hasSkippedInitialFitRef = useRef(false);
    const isCameraFreeRef = useRef(false);
    const isCorrectingRef = useRef(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const mapRef = useRef<MapLibreMap | null>(null);
    const pendingClusterKeyRef = useRef<string | null>(null);
    const pendingMarkerIdRef = useRef<number | null>(null);
    const pinsRef = useRef(new Map<number, Pin>());
    const pointerPointRef = useRef<{ x: number; y: number } | null>(null);
    const popupContainerRef = useRef<HTMLDivElement | null>(null);
    const [popupMarkerId, setPopupMarkerId] = useState<number | null>(null);
    const popupMarkerIdRef = useRef<number | null>(null);
    const popupPanAttemptsRef = useRef(0);
    const popupRef = useRef<Popup | null>(null);
    const popupRootRef = useRef<Root | null>(null);
    const propsRef = useRef({ categories, journeys, markers, onSelectMarker, onShowInCards, regions, selectedMarkerId });
    const rovingKeyRef = useRef<string | null>(null);
    const [scaleBar, setScaleBar] = useState<ScaleBar>({ label: '', width: 0 });

    function applyRoving() {
        const target = getRovingKey();

        for (const [key, anchor] of anchorsRef.current) {
            const button = getMarkerButton(anchor);
            const tabIndex = key === target ? 0 : -1;

            if (!button || button.tabIndex === tabIndex) continue;

            button.tabIndex = tabIndex;
        }

        rovingKeyRef.current = target;
    }

    function closePopup() {
        const element = popupRef.current?.getElement();
        const markerId = popupMarkerIdRef.current;

        const hadFocus = Boolean(element?.contains(document.activeElement));

        popupMarkerIdRef.current = null;
        popupRef.current?.remove();

        if (!hadFocus) return;

        const pin = markerId === null ? undefined : pinsRef.current.get(markerId);

        if (pin) {
            pin.button.focus();

            return;
        }

        mapRef.current?.getCanvas().focus();
    }

    function correctZoom() {
        const map = mapRef.current;

        if (!map || isCameraFreeRef.current || isCorrectingRef.current) return;
        if (map.dragPan.isActive() || map.scrollZoom.isActive() || map.touchZoomRotate.isActive()) return;

        const maxZoom = getMapMaxZoom(map);

        if (map.getZoom() <= maxZoom + ZOOM_EPSILON) return;

        isCorrectingRef.current = true;
        map.once('moveend', handleCorrectionEnd);
        map.easeTo(withMotionPreference({ zoom: maxZoom }));
    }

    function findAnchorKey(button: HTMLButtonElement) {
        return [...anchorsRef.current].find(([, anchor]) => getMarkerButton(anchor) === button)?.[0] ?? null;
    }

    function findMarker(markerId: number | null) {
        if (markerId === null) return null;

        return markers.find(marker => marker.id === markerId) ?? null;
    }

    function fitToMarkers() {
        const bounds = getMarkerBounds(propsRef.current.markers);
        const map = mapRef.current;

        if (!bounds || !map) return;

        const [[west, south], [east, north]] = bounds;

        const center = { lat: (south + north) / 2, lng: (west + east) / 2 };

        const options: FitBoundsOptions = { maxZoom: Math.min(FIT_MAX_ZOOM, getMaxZoomAt(center)), padding: FIT_PADDING };

        map.stop();
        freeCamera();
        map.fitBounds(bounds, withMotionPreference(options));
    }

    function focusPendingCluster() {
        const expandedKey = pendingClusterKeyRef.current;

        if (expandedKey === null || anchorsRef.current.has(expandedKey)) return;

        if (!isFocusIdle(mapRef.current)) {
            pendingClusterKeyRef.current = null;

            return;
        }

        const button = getRovingButton();

        if (!button) return;

        pendingClusterKeyRef.current = null;
        button.focus();
    }

    function focusPendingPin() {
        const markerId = pendingMarkerIdRef.current;

        if (markerId === null || !pinsRef.current.has(markerId)) return;

        if (!isFocusIdle(mapRef.current)) {
            pendingMarkerIdRef.current = null;

            return;
        }

        focusPin(markerId);
    }

    function focusPin(markerId: number) {
        const pin = pinsRef.current.get(markerId);

        if (!pin) {
            pendingMarkerIdRef.current = markerId;
            mapRef.current?.getCanvas().focus();

            return;
        }

        pendingMarkerIdRef.current = null;
        pin.button.focus();
    }

    function freeCamera() {
        const map = mapRef.current;

        if (!map) return;

        isCameraFreeRef.current = true;
        map.setMaxZoom(MAP_MAX_ZOOM);
    }

    function getMapMaxZoom(map: MapLibreMap) {
        const centerMaxZoom = getMaxZoomAt(map.getCenter().wrap());
        const pointer = pointerPointRef.current;

        if (!pointer) return centerMaxZoom;

        return Math.max(centerMaxZoom, getMaxZoomAt(map.unproject([pointer.x, pointer.y]).wrap()));
    }

    function getRovingButton() {
        const key = getRovingKey();

        const anchor = key === null ? undefined : anchorsRef.current.get(key);

        return anchor === undefined ? null : getMarkerButton(anchor);
    }

    function getRovingKey() {
        const anchors = anchorsRef.current;
        const current = rovingKeyRef.current;
        const selectedKey = `${MARKER_KEY_PREFIX}${propsRef.current.selectedMarkerId}`;

        if (current !== null && anchors.has(current)) return current;
        if (anchors.has(selectedKey)) return selectedKey;

        return anchors.keys().next().value ?? null;
    }

    async function handleClusterExpand(clusterId: number, coordinates: [number, number], hasFocus: boolean) {
        const expandedKey = `${CLUSTER_KEY_PREFIX}${clusterId}`;
        const source = mapRef.current?.getSource<GeoJSONSource>(MARKER_SOURCE_ID);

        function handleExpandEnd() {
            pendingClusterKeyRef.current = expandedKey;
            focusPendingCluster();
        }

        if (!source) return;

        const zoom = await source.getClusterExpansionZoom(clusterId);

        const map = mapRef.current;

        if (!map) return;

        pendingClusterKeyRef.current = null;

        if (hasFocus || isFocusIdle(map)) {
            map.getCanvas().focus();
            map.once('moveend', handleExpandEnd);
        }

        map.easeTo(withMotionPreference({ center: coordinates, zoom }));
    }

    function handleCorrectionEnd() {
        isCorrectingRef.current = false;
        correctZoom();
    }

    function handleFlyEnd() {
        const markerId = flownTargetRef.current?.markerId;

        if (markerId === undefined) return;

        focusPin(markerId);
        propsRef.current.onSelectMarker(markerId);
        setPopupMarkerId(markerId);
    }

    function handleLoad() {
        const map = mapRef.current;
        const props = propsRef.current;

        if (!map) return;

        const clusterProperties = Object.fromEntries(props.categories.map(category => [
            category.id,
            ['+', ['case', ['==', ['get', 'categoryId'], category.id], 1, 0]],
        ] as const));

        map.addSource(MARKER_SOURCE_ID, {
            cluster: true,
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            clusterProperties,
            clusterRadius: CLUSTER_RADIUS,
            data: toFeatureCollection(props.markers),
            type: 'geojson',
        });

        map.addLayer({
            id: MARKER_LAYER_ID,
            paint: { 'circle-opacity': 0, 'circle-radius': 1 },
            source: MARKER_SOURCE_ID,
            type: 'circle',
        });

        handleMove();
        correctZoom();
        setIsMapReady(true);
        syncRegions();
    }

    function handleMarkerBlur(event: FocusEvent) {
        const button = findMarkerButton(event.target);

        if (!button) return;

        const key = findAnchorKey(button);

        if (key === null) return;

        if (key.startsWith(CLUSTER_KEY_PREFIX)) {
            const anchor = anchorsRef.current.get(key);

            if (anchor) anchor.getElement().style.zIndex = CLUSTER_Z_INDEX;

            return;
        }

        const markerId = Number(key.slice(MARKER_KEY_PREFIX.length));

        const pin = pinsRef.current.get(markerId);

        if (pin) applyPinState(pin, markerId === propsRef.current.selectedMarkerId);
    }

    function handleMarkerFocus(event: FocusEvent) {
        const button = findMarkerButton(event.target);

        if (!button) return;

        const key = findAnchorKey(button);

        if (key === null) return;

        const anchor = anchorsRef.current.get(key);

        if (anchor) anchor.getElement().style.zIndex = FOCUSED_MARKER_Z_INDEX;

        if (key === rovingKeyRef.current) return;

        rovingKeyRef.current = key;
        applyRoving();
    }

    function handleMarkerKeyDown(event: KeyboardEvent) {
        if (event.isComposing || isModifiedEvent(event)) return;

        const button = findMarkerButton(event.target);
        const map = mapRef.current;

        if (!button || !map) return;

        const buttons = [...anchorsRef.current.values()]
            .flatMap((anchor) => {
                const item = getMarkerButton(anchor);

                if (!item) return [];

                return [{ button: item, point: map.project(anchor.getLngLat()) }];
            })
            .sort((first, second) => first.point.x - second.point.x || first.point.y - second.point.y)
            .map(entry => entry.button);

        const from = buttons.indexOf(button);

        const to = getRovingIndex(event.key, from, buttons.length);

        if (from === -1 || to === -1) return;

        buttons[to].focus();
        event.preventDefault();
        event.stopPropagation();
    }

    function handleMouseMove(event: MapMouseEvent) {
        pointerPointRef.current = { x: event.point.x, y: event.point.y };
        syncMaxZoom();
    }

    function handleMove() {
        const map = mapRef.current;

        if (!map) return;

        const next = getScaleBar(map.getZoom(), map.getCenter().lat);

        setScaleBar(current => (current.label === next.label && current.width === next.width ? current : next));
        syncMaxZoom();
    }

    function handleMoveEnd() {
        const map = mapRef.current;

        if (!map) return;

        isCameraFreeRef.current = false;
        syncMaxZoom();
        correctZoom();

        const center = map.getCenter().wrap();

        saveAtlasState({
            camera: {
                lat: Number(center.lat.toFixed(CAMERA_COORDINATE_DECIMALS)),
                lng: Number(center.lng.toFixed(CAMERA_COORDINATE_DECIMALS)),
                zoom: Number(Math.min(map.getZoom(), getMaxZoomAt(center)).toFixed(CAMERA_ZOOM_DECIMALS)),
            },
        });
    }

    function handleResize() {
        popupPanAttemptsRef.current = 0;
        requestAnimationFrame(() => requestAnimationFrame(panPopupIntoView));
    }

    function handleWheel(event: MapWheelEvent) {
        const map = mapRef.current;

        if (!map) return;

        const rect = map.getContainer().getBoundingClientRect();

        pointerPointRef.current = { x: event.originalEvent.clientX - rect.left, y: event.originalEvent.clientY - rect.top };
        syncMaxZoom();
    }

    function panPopupIntoView() {
        const map = mapRef.current;
        const markerId = popupMarkerIdRef.current;
        const popup = popupRef.current;

        const element = popup?.getElement();

        function handleFrame() {
            if (popupRef.current !== popup || popupMarkerIdRef.current !== markerId) return;

            panPopupIntoView();
        }

        function handlePanEnd() {
            requestAnimationFrame(() => requestAnimationFrame(handleFrame));
        }

        if (!element || !map) return;

        if (map.isMoving()) {
            map.once('moveend', handlePanEnd);

            return;
        }

        const containerRect = map.getContainer().getBoundingClientRect();
        const marginBlock = POPUP_VIEW_MARGIN + OVERLAY_BAND;
        const popupRect = element.getBoundingClientRect();

        const overflowBottom = Math.max(0, popupRect.bottom - (containerRect.bottom - marginBlock));
        const overflowLeft = Math.min(0, popupRect.left - (containerRect.left + POPUP_VIEW_MARGIN));
        const overflowRight = Math.max(0, popupRect.right - (containerRect.right - POPUP_VIEW_MARGIN));
        const overflowTop = Math.min(0, popupRect.top - (containerRect.top + marginBlock));

        const deltaX = overflowLeft || overflowRight;
        const deltaY = overflowBottom || overflowTop;

        if (!deltaX && !deltaY) {
            popupPanAttemptsRef.current = 0;

            return;
        }

        if (popupPanAttemptsRef.current >= POPUP_PAN_ATTEMPTS) return;

        popupPanAttemptsRef.current++;
        map.once('moveend', handlePanEnd);
        map.panBy([deltaX, deltaY], withMotionPreference({}));
    }

    function reanchorPopup(popup: Popup, marker: AtlasMarker) {
        let attempts = 0;
        let previousBox = '';

        function handleFrame() {
            if (popupRef.current !== popup || popupMarkerIdRef.current !== marker.id) return;

            if (mapRef.current?.isMoving()) {
                requestAnimationFrame(handleFrame);

                return;
            }

            attempts++;
            popup.setLngLat([marker.lng, marker.lat]);

            const element = popup.getElement();

            const rect = element?.getBoundingClientRect();

            const box = rect && element?.querySelector('article') ? `${rect.left},${rect.top},${rect.width},${rect.height}` : '';

            if (box && box === previousBox) {
                panPopupIntoView();

                return;
            }

            previousBox = box;

            if (attempts < POPUP_SETTLE_FRAMES) requestAnimationFrame(handleFrame);
        }

        popupPanAttemptsRef.current = 0;
        requestAnimationFrame(() => requestAnimationFrame(handleFrame));
    }

    function stylePopupChrome() {
        const element = popupRef.current?.getElement();

        if (!element) return;

        const content = element.querySelector<HTMLElement>('.maplibregl-popup-content');
        const tip = element.querySelector<HTMLElement>('.maplibregl-popup-tip');

        element.style.zIndex = POPUP_Z_INDEX;

        if (content) {
            content.style.background = 'none';
            content.style.borderRadius = '0';
            content.style.boxShadow = 'none';
            content.style.padding = '0';
        }

        if (tip) tip.style.display = 'none';
    }

    function syncMarkers() {
        const map = mapRef.current;

        if (!map || !map.getSource(MARKER_SOURCE_ID) || !map.isSourceLoaded(MARKER_SOURCE_ID)) return;

        const features = map.querySourceFeatures(MARKER_SOURCE_ID);
        const props = propsRef.current;
        const visibleKeys = new Set<string>();

        let hadFocusedRemoval = false;
        let hasChanges = false;

        for (const feature of features) {
            if (feature.geometry.type !== 'Point') continue;

            const [lng, lat] = feature.geometry.coordinates;
            const properties = feature.properties;

            if (properties.cluster) {
                const clusterId = Number(properties.cluster_id);

                const key = `${CLUSTER_KEY_PREFIX}${clusterId}`;

                if (visibleKeys.has(key)) continue;

                visibleKeys.add(key);

                if (anchorsRef.current.has(key)) continue;

                const anchor = createClusterAnchor(properties, props.categories, hasFocus => handleClusterExpand(clusterId, [lng, lat], hasFocus));

                hasChanges = true;
                anchor.setLngLat([lng, lat]).addTo(map);
                anchorsRef.current.set(key, anchor);

                continue;
            }

            const markerId = Number(properties.id);

            const key = `${MARKER_KEY_PREFIX}${markerId}`;

            if (visibleKeys.has(key)) continue;

            visibleKeys.add(key);

            if (anchorsRef.current.has(key)) continue;

            const marker = props.markers.find(item => item.id === markerId);

            if (!marker) continue;

            const journey = props.journeys.find(item => item.id === marker.journeyId);

            const pin = createPin(marker, journey, () => propsRef.current.onSelectMarker(marker.id));

            hasChanges = true;
            anchorsRef.current.set(key, pin.anchor);
            applyPinState(pin, props.selectedMarkerId === marker.id);
            pin.anchor.addTo(map);
            pinsRef.current.set(marker.id, pin);
        }

        for (const [key, anchor] of anchorsRef.current) {
            if (visibleKeys.has(key)) continue;

            if (getMarkerButton(anchor)?.contains(document.activeElement)) hadFocusedRemoval = true;

            hasChanges = true;
            anchor.remove();
            anchorsRef.current.delete(key);

            if (!key.startsWith(MARKER_KEY_PREFIX)) continue;

            const markerId = Number(key.slice(MARKER_KEY_PREFIX.length));

            unmountPin(pinsRef.current.get(markerId));
            pinsRef.current.delete(markerId);
        }

        if (hasChanges) applyRoving();

        if (hadFocusedRemoval) {
            const rovingButton = getRovingButton();

            if (rovingButton) rovingButton.focus();
            else mapRef.current?.getCanvas().focus();
        }

        focusPendingCluster();
        focusPendingPin();
    }

    function syncMaxZoom() {
        const map = mapRef.current;

        if (!map || isCameraFreeRef.current) return;

        const maxZoom = getMapMaxZoom(map);

        if (map.getZoom() > maxZoom + ZOOM_EPSILON || map.getMaxZoom() === maxZoom) return;

        map.setMaxZoom(maxZoom);
    }

    function syncRegions() {
        const map = mapRef.current;
        const props = propsRef.current;

        if (!map) return;

        const data = props.regions as SourceData;
        const source = map.getSource<GeoJSONSource>(REGION_SOURCE_ID);

        if (!source) {
            addRegionLayers(map, data);

            return;
        }

        source.setData(data);
    }

    useEffect(() => {
        propsRef.current = { categories, journeys, markers, onSelectMarker, onShowInCards, regions, selectedMarkerId };
    });

    useEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const popup = new Popup({
            closeButton: false,
            closeOnClick: false,
            focusAfterOpen: false,
            maxWidth: 'none',
            offset: POPUP_OFFSET,
        });

        const popupContainer = document.createElement('div');
        const storedCamera = loadAtlasState()?.camera ?? null;

        const map = new MapLibreMap({
            attributionControl: false,
            center: storedCamera ?? DEFAULT_CENTER,
            container,
            dragRotate: false,
            maxZoom: MAP_MAX_ZOOM,
            minZoom: MAP_MIN_ZOOM,
            pitchWithRotate: false,
            style: mapStyle,
            touchPitch: false,
            zoom: storedCamera?.zoom ?? DEFAULT_ZOOM,
        });

        const canvasContainer = map.getCanvasContainer();

        map.getCanvas().tabIndex = -1;
        mapRef.current = map;
        popupContainer.id = POPUP_CONTAINER_ID;
        popupContainerRef.current = popupContainer;
        popupRef.current = popup;
        popupRootRef.current = createRoot(popupContainer);
        canvasContainer.setAttribute('aria-label', MARKER_GROUP_LABEL);
        canvasContainer.setAttribute('role', 'group');
        container.addEventListener('focusin', handleMarkerFocus);
        container.addEventListener('focusout', handleMarkerBlur);
        container.addEventListener('keydown', handleMarkerKeyDown, true);
        map.keyboard.disableRotation();
        map.on('click', () => propsRef.current.onSelectMarker(null));
        map.on('load', handleLoad);
        map.on('mousemove', handleMouseMove);
        map.on('move', handleMove);
        map.on('moveend', handleMoveEnd);
        map.on('render', syncMarkers);
        map.on('resize', handleResize);
        map.on('sourcedata', syncMarkers);
        map.on('wheel', handleWheel);
        map.touchZoomRotate.disableRotation();
        popup.setDOMContent(popupContainer);
        popupContainer.addEventListener('click', event => event.stopPropagation());

        map.on('mouseout', () => {
            pointerPointRef.current = null;
        });

        return () => {
            const root = popupRootRef.current;

            for (const anchor of anchorsRef.current.values()) {
                anchor.remove();
            }

            for (const pin of pinsRef.current.values()) {
                unmountPin(pin);
            }

            mapRef.current = null;
            popupContainerRef.current = null;
            popupRef.current = null;
            popupRootRef.current = null;
            anchorsRef.current.clear();
            container.removeEventListener('focusin', handleMarkerFocus);
            container.removeEventListener('focusout', handleMarkerBlur);
            container.removeEventListener('keydown', handleMarkerKeyDown, true);
            pinsRef.current.clear();
            popup.remove();
            map.remove();

            if (root) queueMicrotask(() => root.unmount());
        };
    }, []);

    useEffect(() => {
        const source = mapRef.current?.getSource<GeoJSONSource>(MARKER_SOURCE_ID);

        if (!isMapReady || !source) return;

        for (const [key, anchor] of anchorsRef.current) {
            if (!key.startsWith(CLUSTER_KEY_PREFIX)) continue;

            anchor.remove();
            anchorsRef.current.delete(key);
        }

        source.setData(toFeatureCollection(markers));
    }, [isMapReady, markers]);

    useEffect(() => {
        if (!isMapReady) return;

        syncRegions();
    }, [isMapReady, regions]);

    useEffect(() => {
        if (!isMapReady) return;

        if (!hasSkippedInitialFitRef.current) {
            hasSkippedInitialFitRef.current = true;

            return;
        }

        fitToMarkers();
    }, [boundsKey, isMapReady]);

    useEffect(() => {
        const map = mapRef.current;

        if (!map) return;

        if (!isMapReady) {
            if (flyTarget && isFocusIdle(map)) map.getCanvas().focus();

            return;
        }

        const target = flyTarget;

        if (!target || target === flownTargetRef.current) {
            setPopupMarkerId(selectedMarkerId);

            return;
        }

        const marker = findMarker(target.markerId);

        flownTargetRef.current = target;
        pendingClusterKeyRef.current = null;
        pendingMarkerIdRef.current = null;

        if (!marker) {
            setPopupMarkerId(selectedMarkerId);

            return;
        }

        map.stop();
        freeCamera();
        setPopupMarkerId(null);

        if (isFocusIdle(map)) map.getCanvas().focus();

        map.once('moveend', handleFlyEnd);
        map.flyTo(withMotionPreference({ center: [marker.lng, marker.lat], zoom: Math.min(FLY_ZOOM, getMaxZoomAt(marker)) }));

        return () => {
            map.off('moveend', handleFlyEnd);
        };
    }, [flyTarget, isMapReady, markers, selectedMarkerId]);

    useEffect(() => {
        for (const [markerId, pin] of pinsRef.current) {
            applyPinState(pin, markerId === selectedMarkerId);
        }

        if (selectedMarkerId !== null && pinsRef.current.has(selectedMarkerId)) rovingKeyRef.current = `${MARKER_KEY_PREFIX}${selectedMarkerId}`;

        applyRoving();
    }, [selectedMarkerId]);

    useEffect(() => {
        const map = mapRef.current;
        const marker = findMarker(popupMarkerId);
        const popup = popupRef.current;
        const previousMarkerId = popupMarkerIdRef.current;
        const root = popupRootRef.current;

        if (!map || !popup || !root) return;

        const category = categories.find(item => item.id === marker?.categoryId);
        const journey = journeys.find(item => item.id === marker?.journeyId) ?? null;

        if (!category || !marker) {
            closePopup();

            return;
        }

        popupMarkerIdRef.current = marker.id;
        popup.setLngLat([marker.lng, marker.lat]);
        popupContainerRef.current?.setAttribute('aria-label', marker.name);

        if (popup.isOpen() && previousMarkerId !== null && previousMarkerId !== marker.id) {
            map.easeTo(withMotionPreference({ center: [marker.lng, marker.lat], duration: POPUP_EASE_DURATION }));
        }

        root.render(
            <CardMarker
                categoryLabel={category.name}
                isPopup
                journey={journey}
                key={marker.id}
                marker={marker}
                onClose={() => propsRef.current.onSelectMarker(null)}
                onShowInCards={() => propsRef.current.onShowInCards(marker)}
            />,
        );

        if (!popup.isOpen()) {
            popup.addTo(map);
            stylePopupChrome();
        }

        reanchorPopup(popup, marker);
    }, [categories, journeys, markers, popupMarkerId]);

    return (
        <div className="atlas-fade atlas-fade--slow absolute inset-0 overflow-hidden">
            <div className="h-full w-full" ref={containerRef} />
            <div
                className={CLASS_SCALE_BAR}
                aria-hidden="true"
            >
                <div style={{ width: scaleBar.width }}>
                    <div className="h-[4px] border-b border-ink border-l border-r" />
                </div>
                <p className={CLASS_SCALE_LABEL}>{scaleBar.label}</p>
            </div>
        </div>
    );
}
