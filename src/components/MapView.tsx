import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { MapLibreMap, Marker, Popup, addProtocol, setWorkerUrl } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { createRoot } from 'react-dom/client';
import { layers } from '@protomaps/basemaps';
import { useEffect, useRef, useState } from 'react';

import IconCategory from '@components/IconCategory';
import IconStar from '@components/IconStar';
import PlaceCard from '@components/PlaceCard';
import { CATEGORY_COLORS, COVERAGE_REGIONS, STAR_COLOR, STAR_LABEL } from '@lib/constants';
import { categoryColor, isModifiedEvent } from '@lib/utils';
import { loadAtlasState, saveAtlasState } from '@lib/store';
import { prefersReducedMotion } from '@lib/motion';

import type { ExpressionSpecification, FitBoundsOptions, FlyToOptions, GeoJSONFeature, GeoJSONSource, LayerSpecification, MapMouseEvent, MapWheelEvent, RequestParameters, StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import type { Flavor } from '@protomaps/basemaps';
import type { Root } from 'react-dom/client';

type SourceData = Parameters<GeoJSONSource['setData']>[0];

interface PinHandlers {
    onSelect: () => void;
}

interface PinMarker {
    button: HTMLButtonElement;
    category: string;
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

const CAMERA_COORDINATE_DECIMALS = 5;
const CAMERA_ZOOM_DECIMALS = 2;
const CATEGORY_PIN_Z_TOP = 16;
const CLUSTER_BASE_SIZE = 34;
const CLUSTER_CLASS = 'atlas-fade atlas-marker active:scale-100 before:absolute before:content-[""] before:inset-[-7px] hover:scale-[1.09] relative p-0 border-none duration-[var(--duration-fast)] ease-[ease] shadow-[0_3px_10px_var(--color-ink-20)] transition-transform';
const CLUSTER_DISC_CLASS = 'absolute grid inset-[3px] place-items-center rounded-full font-serif text-[13px] bg-snow text-ink';
const CLUSTER_GROWTH_FACTOR = 3;
const CLUSTER_KEY_PREFIX = 'cluster-';
const CLUSTER_MAX_GROWTH = 24;
const CLUSTER_MAX_ZOOM = 12;
const CLUSTER_RADIUS = 36;
const CLUSTER_RING_CLASS = 'absolute inset-[-5px] border border-dashed border-ink-30 rounded-full';
const DEFAULT_CENTER = { lat: 30.4, lng: -97.8 } as const;
const DEFAULT_ZOOM = 3;
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
const MAP_TILES_URL = 'pmtiles:///tiles';
const MARKER_SELECTOR = 'button.atlas-marker';
const METERS_PER_MILE = 1_609.344;
const MILE_MINIMUM = 0.5;
const MIN_ZOOM = 2;
const ORDINARY_PIN_Z_FLOOR = 11;
const PIN_DOT_CLASS = 'atlas-fade atlas-marker active:scale-100 before:absolute before:content-[""] before:inset-[-14px] hover:scale-[1.3] block relative h-[24px] w-[24px] p-0 border-2 border-snow duration-[var(--duration-fast)] ease-[ease] transition-[background-color,border-color,box-shadow,color,scale]';
const PIN_HALO_WIDTH = 6;
const PIN_ICON_CLASS = 'atlas-fade atlas-marker active:scale-100 before:absolute before:content-[""] before:inset-[-14px] hover:scale-[1.3] grid place-items-center relative h-[24px] w-[24px] p-0 border-2 duration-[var(--duration-fast)] ease-[ease] transition-[background-color,border-color,box-shadow,color,scale]';
const PIN_ICON_SIZE = 11;
const PIN_OUTLINE_COLOR = 'var(--color-storm)';
const PIN_OUTLINE_WIDTH = 1;
const PIN_STAR_CLASS = 'absolute right-[-9px] top-[-9px] leading-none pointer-events-none';
const PLACE_KEY_PREFIX = 'place-';
const POPUP_EASE_DURATION = 300;
const POPUP_OFFSET = 28;
const POPUP_Z_INDEX = '25';
const REGION_ACTIVE_FILL_OPACITY = 0.22;
const REGION_ACTIVE_LINE_OPACITY = 0.5;

const REGION_COLORS = {
    active: '#e2725b',
    explored: '#9b72cf',
} as const;

const REGION_EXPLORED_FILL_OPACITY = 0.14;
const REGION_EXPLORED_LINE_OPACITY = 0.35;
const REGION_FILL_LAYER_ID = 'atlas-regions-fill';
const REGION_LINE_LAYER_ID = 'atlas-regions-line';
const REGION_LINE_WIDTH = 1;
const REGION_MIN_ZOOM = 7.5;
const REGION_SOURCE_ID = 'atlas-regions';
const SCALE_STEP_LARGE = 5;
const SCALE_STEP_MEDIUM = 2;
const SCALE_TARGET_WIDTH = 120;
const SELECTED_PIN_Z_INDEX = '21';
const SOURCE_ID = 'atlas-places';
const STARRED_PIN_Z_INDEX = '20';
const STAR_RING_WIDTH = 2;
const TILE_CACHE_LIMIT = 96;
const TILE_ZOOM_OFFSET = 9;
const UNCOVERED_MAX_ZOOM = 7.9;
const WORLD_LAYER_PREFIX = 'w-';
const WORLD_SOURCE_ID = 'world';
const WORLD_ZOOM_CUTOFF = 8;
const ZOOM_BASE = 2;
const ZOOM_EPSILON = 0.01;

const CATEGORY_PIN_Z_INDEXES = new Map(Object.keys(CATEGORY_COLORS)
    .sort((first, second) => first.localeCompare(second))
    .map((id, rank) => [id, String(Math.max(ORDINARY_PIN_Z_FLOOR, CATEGORY_PIN_Z_TOP - rank))] as const));

const LABEL_TEXT_FIELD: ExpressionSpecification = ['coalesce', ['get', `name:${MAP_LANGUAGE}`], ['get', 'name']];

const mapStyle: StyleSpecification = {
    glyphs: MAP_GLYPHS,
    layers: [...worldLayers(), ...regionLayers()],
    sources: {
        ...Object.fromEntries(COVERAGE_REGIONS.map(region => [region.name, tileSourceOf(region.name)] as const)),
        [WORLD_SOURCE_ID]: tileSourceOf(WORLD_SOURCE_ID),
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

function applyPinState(pin: PinMarker, isSelected: boolean) {
    const halo = `color-mix(in oklab, ${pin.color} 26%, transparent)`;
    const orderedBackground = isSelected ? 'var(--color-ink)' : 'var(--color-snow)';
    const shadows = [`0 0 0 ${PIN_OUTLINE_WIDTH}px ${PIN_OUTLINE_COLOR}`];

    if (pin.isStarred) shadows.push(`0 0 0 ${PIN_OUTLINE_WIDTH + STAR_RING_WIDTH}px ${STAR_COLOR}`);

    if (isSelected) shadows.push(`0 0 0 ${PIN_OUTLINE_WIDTH + PIN_HALO_WIDTH}px ${halo}`, '0 3px 8px var(--color-ink-30)');
    else shadows.push('0 2px 6px var(--color-ink-20)');

    pin.button.setAttribute('aria-expanded', String(isSelected));
    pin.button.style.background = pin.isOrdered ? orderedBackground : pin.color;
    pin.button.style.borderColor = pin.isOrdered ? pin.color : 'var(--color-snow)';
    pin.button.style.boxShadow = shadows.join(', ');
    pin.button.style.color = isSelected ? 'var(--color-snow)' : pin.color;
    pin.marker.getElement().style.zIndex = pinZIndexOf(pin, isSelected);
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

function cameraOf(map: MapLibreMap) {
    const center = map.getCenter().wrap();

    return {
        lat: Number(center.lat.toFixed(CAMERA_COORDINATE_DECIMALS)),
        lng: Number(center.lng.toFixed(CAMERA_COORDINATE_DECIMALS)),
        zoom: Number(Math.min(map.getZoom(), maxZoomAt(center)).toFixed(CAMERA_ZOOM_DECIMALS)),
    };
}

function clusterPropertiesOf(categories: AtlasCategory[]) {
    const properties: Record<string, unknown> = {};

    for (const category of categories) {
        properties[category.id] = ['+', ['case', ['==', ['get', 'category'], category.id], 1, 0]];
    }

    return properties;
}

function createClusterMarker(categories: AtlasCategory[], properties: GeoJSONFeature['properties'], onExpand: (hasFocus: boolean) => void) {
    const button = document.createElement('button');
    const count = Number(properties.point_count);
    const disc = document.createElement('span');
    const element = document.createElement('div');
    let offset = 0;
    const ring = document.createElement('span');
    const segments: string[] = [];

    const label = `${count} places \u2014 expand`;
    const size = CLUSTER_BASE_SIZE + Math.min(CLUSTER_MAX_GROWTH, Math.round(Math.sqrt(count) * CLUSTER_GROWTH_FACTOR));

    function handleClick(event: MouseEvent) {
        event.stopPropagation();
        onExpand(button.contains(document.activeElement));
    }

    for (const category of [...categories].sort((first, second) => first.id.localeCompare(second.id))) {
        const value = Number(properties[category.id] ?? 0);

        if (!value) continue;

        const start = ((offset / count) * FULL_CIRCLE_DEGREES).toFixed(1);
        const end = (((offset + value) / count) * FULL_CIRCLE_DEGREES).toFixed(1);

        segments.push(`${categoryColor(category.id)} ${start}deg ${end}deg`);
        offset += value;
    }

    if (!segments.length) segments.push(`var(--color-storm) 0deg ${FULL_CIRCLE_DEGREES}deg`);

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
        category: place.category,
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

function isFocusIdle(map: MapLibreMap | null) {
    const active = document.activeElement;

    return active === null || active === document.body || active === map?.getCanvas();
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

function maxZoomAt(lngLat: { lat: number; lng: number }) {
    const region = COVERAGE_REGIONS.find(item => (
        lngLat.lat >= item.south && lngLat.lat <= item.north && lngLat.lng >= item.west && lngLat.lng <= item.east
    ));

    return region?.maxZoom ?? UNCOVERED_MAX_ZOOM;
}

function pinZIndexOf(pin: PinMarker, isSelected: boolean) {
    if (isSelected) return SELECTED_PIN_Z_INDEX;
    if (pin.isStarred) return STARRED_PIN_Z_INDEX;

    return CATEGORY_PIN_Z_INDEXES.get(pin.category) ?? String(ORDINARY_PIN_Z_FLOOR);
}

function regionLayers() {
    const generated = COVERAGE_REGIONS.flatMap((region, index) => flavorLayers(region.name).filter(layer => !index || layer.type !== 'background').map(layer => ({
        ...layer,
        id: `${region.name}-${layer.id}`,
        minzoom: Math.max(layer.type === 'background' ? WORLD_ZOOM_CUTOFF : REGION_MIN_ZOOM, layer.minzoom ?? 0),
    })));

    return [...generated.filter(layer => layer.type !== 'symbol'), ...generated.filter(layer => layer.type === 'symbol')];
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

    const step = scaleStepOf(raw / magnitude);

    const distance = magnitude * step;

    const meters = (isFeet ? distance / FEET_PER_MILE : distance) * METERS_PER_MILE;

    return {
        label: `${distance} ${isFeet ? 'ft' : 'mi'}`,
        width: Math.round(meters / metersPerPixel),
    };
}

function scaleStepOf(ratio: number) {
    if (ratio >= SCALE_STEP_LARGE) return SCALE_STEP_LARGE;
    if (ratio >= SCALE_STEP_MEDIUM) return SCALE_STEP_MEDIUM;

    return 1;
}

function tileSourceOf(name: string): VectorSourceSpecification {
    return {
        attribution: MAP_ATTRIBUTION,
        type: 'vector',
        url: `${MAP_TILES_URL}/${name}.pmtiles`,
    };
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

function worldLayers() {
    return flavorLayers(WORLD_SOURCE_ID).map(layer => ({
        ...layer,
        id: `${WORLD_LAYER_PREFIX}${layer.id}`,
        maxzoom: Math.min(WORLD_ZOOM_CUTOFF, layer.maxzoom ?? WORLD_ZOOM_CUTOFF),
    }));
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
                    <IconStar color={STAR_COLOR} hasOutline />
                </span>
            )}
        </>
    );
}

addProtocol('pmtiles', loadTile);
setWorkerUrl(mapWorkerUrl);

export default function MapView({ categories, flyTarget, onSelectPlace, onShowInCards, places, regions, selectedPlaceId, trips }: {
    categories: AtlasCategory[];
    flyTarget: AtlasFlyTarget | null;
    onSelectPlace: (placeId: number | null) => void;
    onShowInCards: (place: AtlasPlace) => void;
    places: AtlasPlace[];
    regions: AtlasRegions;
    selectedPlaceId: number | null;
    trips: AtlasTrip[];
}) {
    const boundsKey = (boundsOf(places) ?? []).flat().join(',');
    const containerRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef({ categories, onSelectPlace, onShowInCards, places, regions, selectedPlaceId, trips });
    const flownTargetRef = useRef<AtlasFlyTarget | null>(null);
    const hasSkippedInitialFitRef = useRef(false);
    const isCameraFreeRef = useRef(false);
    const isCorrectingRef = useRef(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markersRef = useRef(new Map<string, Marker>());
    const pendingClusterKeyRef = useRef<string | null>(null);
    const pendingFocusRef = useRef<number | null>(null);
    const pinsRef = useRef(new Map<number, PinMarker>());
    const pointerPointRef = useRef<{ x: number; y: number } | null>(null);
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

    function correctZoom() {
        const map = mapRef.current;

        if (!map || isCameraFreeRef.current || isCorrectingRef.current) return;
        if (map.dragPan.isActive() || map.scrollZoom.isActive() || map.touchZoomRotate.isActive()) return;

        const cap = zoomCapOf(map);

        if (map.getZoom() <= cap + ZOOM_EPSILON) return;

        isCorrectingRef.current = true;
        map.once('moveend', handleCorrectionEnd);
        map.easeTo(withMotion({ zoom: cap }));
    }

    function findPlace(placeId: number | null) {
        if (placeId === null) return null;

        return places.find(place => place.id === placeId) ?? null;
    }

    function fitToPlaces() {
        const bounds = boundsOf(contextRef.current.places);
        const map = mapRef.current;

        if (!bounds || !map) return;

        const [[west, south], [east, north]] = bounds;

        const center = { lat: (south + north) / 2, lng: (west + east) / 2 };

        const options: FitBoundsOptions = { maxZoom: Math.min(FIT_MAX_ZOOM, maxZoomAt(center)), padding: FIT_PADDING };

        freeCamera();
        map.fitBounds(bounds, withMotion(options));
    }

    function focusPendingCluster() {
        const expandedKey = pendingClusterKeyRef.current;

        if (expandedKey === null || markersRef.current.has(expandedKey)) return;

        if (!isFocusIdle(mapRef.current)) {
            pendingClusterKeyRef.current = null;

            return;
        }

        const key = rovingKeyOf();

        const marker = key === null ? undefined : markersRef.current.get(key);

        const button = marker === undefined ? null : buttonOf(marker);

        if (!button) return;

        pendingClusterKeyRef.current = null;
        button.focus();
    }

    function focusPendingPin() {
        const placeId = pendingFocusRef.current;

        if (placeId === null || !pinsRef.current.has(placeId)) return;

        if (!isFocusIdle(mapRef.current)) {
            pendingFocusRef.current = null;

            return;
        }

        focusPin(placeId);
    }

    function focusPin(placeId: number) {
        const pin = pinsRef.current.get(placeId);

        if (!pin) {
            pendingFocusRef.current = placeId;
            mapRef.current?.getCanvas().focus();

            return;
        }

        pendingFocusRef.current = null;
        pin.button.focus();
    }

    function freeCamera() {
        const map = mapRef.current;

        if (!map) return;

        isCameraFreeRef.current = true;
        map.setMaxZoom(MAP_MAX_ZOOM);
    }

    async function handleClusterExpand(clusterId: number, coordinates: [number, number], hasFocus: boolean) {
        const expandedKey = `${CLUSTER_KEY_PREFIX}${clusterId}`;
        const source = mapRef.current?.getSource<GeoJSONSource>(SOURCE_ID);

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

        map.easeTo(withMotion({ center: coordinates, zoom }));
    }

    function handleCorrectionEnd() {
        isCorrectingRef.current = false;
        correctZoom();
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
        handleMove();
        correctZoom();
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
        if (event.isComposing || isModifiedEvent(event)) return;

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
        syncMaxZoom();
    }

    function handleMoveEnd() {
        const map = mapRef.current;

        if (!map) return;

        isCameraFreeRef.current = false;
        syncMaxZoom();
        correctZoom();
        saveAtlasState({ camera: cameraOf(map) });
    }

    function handlePointerLeave() {
        pointerPointRef.current = null;
    }

    function handlePointerMove(event: MapMouseEvent) {
        pointerPointRef.current = { x: event.point.x, y: event.point.y };
        syncMaxZoom();
    }

    function handleSync() {
        const map = mapRef.current;

        if (!map || !map.getSource(SOURCE_ID) || !map.isSourceLoaded(SOURCE_ID)) return;

        const context = contextRef.current;
        const features = map.querySourceFeatures(SOURCE_ID);
        let hasChanges = false;
        const visibleKeys = new Set<string>();

        for (const feature of features) {
            if (feature.geometry.type !== 'Point') continue;

            const [lng, lat] = feature.geometry.coordinates;
            const properties = feature.properties;

            if (properties.cluster) {
                const clusterId = Number(properties.cluster_id);

                const key = `${CLUSTER_KEY_PREFIX}${clusterId}`;

                if (visibleKeys.has(key)) continue;

                visibleKeys.add(key);

                if (markersRef.current.has(key)) continue;

                const marker = createClusterMarker(context.categories, properties, hasFocus => handleClusterExpand(clusterId, [lng, lat], hasFocus));

                marker.setLngLat([lng, lat]).addTo(map);
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

            const pin = createPinMarker(place, context.trips.find(trip => trip.id === place.trip), { onSelect: () => contextRef.current.onSelectPlace(place.id) });

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

        focusPendingCluster();
        focusPendingPin();
    }

    function handleWheel(event: MapWheelEvent) {
        const map = mapRef.current;

        if (!map) return;

        const rect = map.getContainer().getBoundingClientRect();

        pointerPointRef.current = { x: event.originalEvent.clientX - rect.left, y: event.originalEvent.clientY - rect.top };
        syncMaxZoom();
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

    function reanchorPopup(popup: Popup, place: AtlasPlace) {
        function handleFrame() {
            if (popupRef.current !== popup || popupPlaceRef.current !== place.id) return;

            popup.setLngLat([place.lng, place.lat]);
        }

        requestAnimationFrame(() => requestAnimationFrame(handleFrame));
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

        element.style.zIndex = POPUP_Z_INDEX;

        if (content) {
            content.style.background = 'none';
            content.style.borderRadius = '0';
            content.style.boxShadow = 'none';
            content.style.padding = '0';
        }

        if (tip) tip.style.display = 'none';
    }

    function syncMaxZoom() {
        const map = mapRef.current;

        if (!map || isCameraFreeRef.current) return;

        const cap = zoomCapOf(map);

        if (map.getZoom() > cap + ZOOM_EPSILON || map.getMaxZoom() === cap) return;

        map.setMaxZoom(cap);
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

    function zoomCapOf(map: MapLibreMap) {
        const centerCap = maxZoomAt(map.getCenter().wrap());
        const pointer = pointerPointRef.current;

        if (!pointer) return centerCap;

        return Math.max(centerCap, maxZoomAt(map.unproject([pointer.x, pointer.y]).wrap()));
    }

    useEffect(() => {
        contextRef.current = { categories, onSelectPlace, onShowInCards, places, regions, selectedPlaceId, trips };
    });

    useEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const storedCamera = loadAtlasState()?.camera ?? null;

        const map = new MapLibreMap({
            attributionControl: false,
            center: storedCamera ?? DEFAULT_CENTER,
            container,
            dragRotate: false,
            maxZoom: MAP_MAX_ZOOM,
            minZoom: MIN_ZOOM,
            pitchWithRotate: false,
            style: mapStyle,
            touchPitch: false,
            zoom: storedCamera?.zoom ?? DEFAULT_ZOOM,
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
        map.on('mousemove', handlePointerMove);
        map.on('mouseout', handlePointerLeave);
        map.on('move', handleMove);
        map.on('moveend', handleMoveEnd);
        map.on('render', handleSync);
        map.on('sourcedata', handleSync);
        map.on('wheel', handleWheel);
        popupContainer.addEventListener('click', event => event.stopPropagation());
        container.addEventListener('focusin', handleMarkerFocus);
        container.addEventListener('keydown', handleMarkerKeyDown, true);
        mapRef.current = map;
        popupRef.current = popup;
        popupRootRef.current = createRoot(popupContainer);

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

        if (!hasSkippedInitialFitRef.current) {
            hasSkippedInitialFitRef.current = true;

            return;
        }

        fitToPlaces();
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
            setPopupPlaceId(selectedPlaceId);

            return;
        }

        flownTargetRef.current = target;
        pendingClusterKeyRef.current = null;
        pendingFocusRef.current = null;

        const place = findPlace(target.placeId);
        const placeId = target.placeId;

        if (!place) {
            setPopupPlaceId(selectedPlaceId);

            return;
        }

        function handleFlyEnd() {
            contextRef.current.onSelectPlace(placeId);
            setPopupPlaceId(placeId);
            focusPin(placeId);
        }

        setPopupPlaceId(null);
        map.stop();
        freeCamera();

        if (isFocusIdle(map)) map.getCanvas().focus();

        map.once('moveend', handleFlyEnd);
        map.flyTo(withMotion({ center: [place.lng, place.lat], zoom: Math.min(FLY_ZOOM, maxZoomAt(place)) }));

        return () => {
            map.off('moveend', handleFlyEnd);
        };
    }, [flyTarget, isMapReady, places, selectedPlaceId]);

    useEffect(() => {
        for (const [placeId, pin] of pinsRef.current) applyPinState(pin, placeId === selectedPlaceId);

        if (selectedPlaceId !== null && pinsRef.current.has(selectedPlaceId)) {
            rovingKeyRef.current = `${PLACE_KEY_PREFIX}${selectedPlaceId}`;
        }

        applyRoving();
    }, [selectedPlaceId]);

    useEffect(() => {
        const map = mapRef.current;
        const place = findPlace(popupPlaceId);
        const popup = popupRef.current;
        const previousPlaceId = popupPlaceRef.current;
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

        if (popup.isOpen() && previousPlaceId !== null && previousPlaceId !== place.id) {
            map.easeTo(withMotion({ center: [place.lng, place.lat], duration: POPUP_EASE_DURATION }));
        }

        root.render(
            <PlaceCard
                categoryLabel={category.name}
                isFloating
                key={place.id}
                onClose={() => contextRef.current.onSelectPlace(null)}
                onShowInCards={selected => contextRef.current.onShowInCards(selected)}
                place={place}
                trip={trip}
            />,
        );

        if (!popup.isOpen()) {
            popup.addTo(map);
            stylePopupChrome();
        }

        reanchorPopup(popup, place);
    }, [categories, places, popupPlaceId, trips]);

    return (
        <div className="atlas-fade atlas-fade--slow absolute inset-0 overflow-hidden">
            <div className="h-full w-full" ref={containerRef} />
            <div className="absolute bottom-[18px] flex flex-col inset-x-0 items-center z-30 w-fit gap-[4px] mx-auto pointer-events-none">
                <div style={{ width: scaleBar.width }}>
                    <div className="h-[5px] border-b border-l border-r border-storm" aria-hidden="true" />
                </div>
                <p className="px-[4px] py-[2px] rounded-[4px] font-mono leading-none text-[10px] tracking-[0.12em] uppercase bg-snow-90 text-storm backdrop-blur-[8px]">{scaleBar.label}</p>
            </div>
        </div>
    );
}
