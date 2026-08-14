import { chmod, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';

import { COVERAGE_REGIONS } from '../src/lib/constants';

import type { AstroIntegration } from 'astro';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Position = [number, number];

interface AssetMarker {
    build?: string;
    fonts?: string[];
    sets?: Record<string, TileSpec>;
    version?: number;
}

interface ContentPin {
    lat: number;
    lng: number;
    name: string;
}

interface ContentShape {
    boundary: Position[][][];
    country: string;
    state: string;
}

interface ContentTrip {
    markers: ContentPin[];
}

interface CoverageGap {
    edge: string;
    region: string;
    shortfall: number;
    target: string;
}

interface TileSet extends TileSpec {
    name: string;
}

interface TileSpec {
    bbox?: string;
    maxZoom: number;
}

const ASSETS_VERSION = 1;
const BINARY_MODE = 0o755;
const BUILD = '20260812';
const BUILD_URL = `https://build.protomaps.com/${BUILD}.pmtiles`;
const CONTENT_DIR = join('src', 'content');
const COVERAGE_DECIMALS = 1;
const COVERAGE_MARGIN = 1;
const COVERAGE_STEP = 0.1;
const EXTRACTOR_VERSION = '1.31.2';

const EXTRACTOR_ASSETS: Record<string, string> = {
    'darwin-arm64': `go-pmtiles-${EXTRACTOR_VERSION}_Darwin_arm64.zip`,
    'darwin-x64': `go-pmtiles-${EXTRACTOR_VERSION}_Darwin_x86_64.zip`,
    'linux-arm64': `go-pmtiles_${EXTRACTOR_VERSION}_Linux_arm64.tar.gz`,
    'linux-x64': `go-pmtiles_${EXTRACTOR_VERSION}_Linux_x86_64.tar.gz`,
};

const EXTRACTOR_URL = `https://github.com/protomaps/go-pmtiles/releases/download/v${EXTRACTOR_VERSION}`;
const FETCH_IDLE_TIMEOUT = 30_000;
const FETCH_WORKERS = 12;
const FONTS_DIR = 'fonts';
const FONT_STACKS = ['Noto Sans Italic', 'Noto Sans Medium', 'Noto Sans Regular'];
const GLYPH_SPAN = 256;
const GLYPH_TYPE = 'application/x-protobuf';
const GLYPH_URL = 'https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts';
const JOURNEYS_DIR = 'journeys';
const JSON_EXTENSION = '.json';
const MARKER = '.local.json';
const POLYGON_DEPTH = 2;
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;
const REGION_MAX_ZOOM = 12;
const REQUEST_ORIGIN = 'http://localhost';
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF = 500;
const SHAPE_FILES = ['active.json', 'explored.json'];
const STARRED_FILE = 'starred.json';
const TILES_DIR = 'tiles';
const TILE_EXTENSION = '.pmtiles';
const TILE_TYPE = 'application/octet-stream';
const UNICODE_PLANE = 65_536;
const WORLD_MAX_ZOOM = 7;

const GLYPH_RANGE_COUNT = UNICODE_PLANE / GLYPH_SPAN;

const ROUTES: Record<string, string> = {
    '/fonts/map/': FONTS_DIR,
    '/tiles/': TILES_DIR,
};

const TILE_SETS: TileSet[] = [
    ...COVERAGE_REGIONS.map(region => ({
        bbox: `${region.west},${region.south},${region.east},${region.north}`,
        maxZoom: REGION_MAX_ZOOM,
        name: region.name,
    })),
    { maxZoom: WORLD_MAX_ZOOM, name: 'world' },
];

const rootDir = fileURLToPath(new URL('..', import.meta.url));

const assetsDir = join(rootDir, '.local');
const cacheDir = join(rootDir, 'node_modules', '.cache', 'atlas');

async function assertCoverage() {
    const contentDir = join(rootDir, CONTENT_DIR);
    const journeysDir = join(contentDir, JOURNEYS_DIR);

    const entries = await readdir(journeysDir, { recursive: true });

    for (const entry of entries.filter(file => file.endsWith(JSON_EXTENSION))) {
        const trip = await readJson<ContentTrip>(join(journeysDir, entry));

        for (const marker of trip.markers) assertPoint(`marker '${marker.name}'`, marker.lat, marker.lng);
    }

    const starred = await readJson<ContentPin[]>(join(contentDir, STARRED_FILE));

    for (const pin of starred) assertPoint(`marker '${pin.name}'`, pin.lat, pin.lng);

    for (const file of SHAPE_FILES) {
        const shapes = await readJson<ContentShape[]>(join(contentDir, file));

        for (const shape of shapes) {
            const label = `border vertex '${shape.country} / ${shape.state}'`;

            for (const [lng, lat] of shape.boundary.flat(POLYGON_DEPTH)) assertPoint(label, lat, lng);
        }
    }
}

function assertPoint(label: string, lat: number, lng: number) {
    const gap = coverageGap(lat, lng);

    if (!gap) return;

    throw new Error(`atlas: ${label} (${lat}, ${lng}) outside coverage margin \u2014 extend region '${gap.region}' ${gap.edge} to ${gap.target} or add a region`);
}

async function copyTree(source: string, destination: string) {
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { force: true, recursive: true });
}

function coverageGap(lat: number, lng: number) {
    let nearest: CoverageGap | null = null;

    for (const region of COVERAGE_REGIONS) {
        const gaps: CoverageGap[] = [
            { edge: 'east', region: region.name, shortfall: lng + COVERAGE_MARGIN - region.east, target: marginEdge(lng, true) },
            { edge: 'north', region: region.name, shortfall: lat + COVERAGE_MARGIN - region.north, target: marginEdge(lat, true) },
            { edge: 'south', region: region.name, shortfall: region.south + COVERAGE_MARGIN - lat, target: marginEdge(lat, false) },
            { edge: 'west', region: region.name, shortfall: region.west + COVERAGE_MARGIN - lng, target: marginEdge(lng, false) },
        ];

        const widest = gaps.reduce((first, second) => (second.shortfall > first.shortfall ? second : first));

        if (widest.shortfall <= 0) return null;
        if (!nearest || widest.shortfall < nearest.shortfall) nearest = widest;
    }

    return nearest;
}

async function download(url: string, destination: string) {
    const partial = staging(destination);

    await retry(async () => {
        const monitor = idleMonitor();

        try {
            const response = await fetch(url, { signal: monitor.signal });

            if (!response.ok) throw new Error(`atlas: ${url} answered ${response.status} ${response.statusText}`);
            if (!response.body) throw new Error(`atlas: ${url} answered without a body`);

            await writeFile(partial, monitor.watch(response.body));
        } finally {
            monitor.stop();
        }
    }, () => rm(partial, { force: true }), `atlas: download failed ${url}`);

    await rename(partial, destination);
}

async function ensureCache() {
    const marker = await readMarker(cacheDir);

    const specs: Record<string, TileSpec> = marker?.build === BUILD && marker.version === ASSETS_VERSION ? { ...marker.sets } : {};

    for (const set of TILE_SETS) {
        await extractTiles(set, specs[set.name]);

        specs[set.name] = specOf(set);

        await writeMarker(cacheDir, specs);
    }

    for (const stack of FONT_STACKS) {
        await fetchStack(stack);
    }
}

async function ensureExtractor() {
    const binary = join(cacheDir, `pmtiles-${EXTRACTOR_VERSION}`);

    if (existsSync(binary)) return binary;

    const asset = EXTRACTOR_ASSETS[`${process.platform}-${process.arch}`];

    if (!asset) {
        throw new Error(`atlas: no go-pmtiles ${EXTRACTOR_VERSION} build for ${process.platform}-${process.arch}`);
    }

    const archive = join(cacheDir, asset);

    await mkdir(cacheDir, { recursive: true });
    await download(`${EXTRACTOR_URL}/${asset}`, archive);
    await unpack(archive, binary);
    await rm(archive, { force: true });

    return binary;
}

async function extractTiles(set: TileSet, spec: TileSpec | undefined) {
    const file = tileFile(cacheDir, set.name);

    if (existsSync(file) && isSpecMatched(set, spec)) return;

    const extractor = await ensureExtractor();
    const flags = [`--maxzoom=${set.maxZoom}`];
    const partial = staging(file);

    if (set.bbox) flags.push(`--bbox=${set.bbox}`);

    await mkdir(join(cacheDir, TILES_DIR), { recursive: true });
    await rm(file, { force: true });
    await retry(
        () => run([extractor, 'extract', BUILD_URL, partial, ...flags]),
        () => rm(partial, { force: true }),
        `atlas: extract failed ${set.name}`,
    );
    await rename(partial, file);
}

async function fetchStack(stack: string) {
    const directory = join(cacheDir, FONTS_DIR, stack);

    if (await glyphCount(directory) >= GLYPH_RANGE_COUNT) return;

    const ranges = Array.from({ length: GLYPH_RANGE_COUNT }, (_, index) => `${index * GLYPH_SPAN}-${(index + 1) * GLYPH_SPAN - 1}`);

    const pending = ranges[Symbol.iterator]();

    async function worker() {
        for (const range of pending) {
            const file = join(directory, `${range}.pbf`);

            if (!existsSync(file)) await download(`${GLYPH_URL}/${encodeURIComponent(stack)}/${range}.pbf`, file);
        }
    }

    await mkdir(directory, { recursive: true });
    await Promise.all(Array.from({ length: FETCH_WORKERS }, worker));
}

async function glyphCount(directory: string) {
    const present = await readdir(directory).catch(() => []);

    return present.filter(file => file.endsWith('.pbf')).length;
}

function idleMonitor() {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    function arm() {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(new Error(`atlas: transfer idle for ${FETCH_IDLE_TIMEOUT}ms`)), FETCH_IDLE_TIMEOUT);
    }

    function watch(body: NonNullable<Response['body']>) {
        return body.pipeThrough(new TransformStream({
            transform(chunk, target) {
                arm();
                target.enqueue(chunk);
            },
        }));
    }

    arm();

    return { signal: controller.signal, stop: () => clearTimeout(timer), watch };
}

async function isComplete(root: string) {
    const marker = await readMarker(root);

    if (!marker || marker.build !== BUILD || marker.version !== ASSETS_VERSION || !isFontsMatched(marker.fonts)) {
        return false;
    }

    for (const set of TILE_SETS) {
        if (!existsSync(tileFile(root, set.name)) || !isSpecMatched(set, marker.sets?.[set.name])) return false;
    }

    for (const stack of FONT_STACKS) {
        if (await glyphCount(join(root, FONTS_DIR, stack)) < GLYPH_RANGE_COUNT) return false;
    }

    return true;
}

function isFontsMatched(fonts: string[] | undefined) {
    return fonts?.length === FONT_STACKS.length && FONT_STACKS.every(stack => fonts.includes(stack));
}

function isSpecMatched(set: TileSet, spec: TileSpec | undefined) {
    return spec?.bbox === set.bbox && spec?.maxZoom === set.maxZoom;
}

function marginEdge(value: number, isUpper: boolean) {
    const bound = isUpper ? value + COVERAGE_MARGIN : value - COVERAGE_MARGIN;

    const steps = isUpper ? Math.ceil(bound / COVERAGE_STEP) : Math.floor(bound / COVERAGE_STEP);

    return (steps * COVERAGE_STEP).toFixed(COVERAGE_DECIMALS);
}

function parseRange(header: string, size: number) {
    const match = RANGE_PATTERN.exec(header);

    if (!match) return null;

    const [, first, last] = match;

    if (!first && !last) return null;
    if (!first) return { end: size - 1, start: Math.max(0, size - Number(last)) };

    return { end: last ? Math.min(Number(last), size - 1) : size - 1, start: Number(first) };
}

async function readJson<Value>(file: string) {
    return JSON.parse(await readFile(file, 'utf-8')) as Value;
}

async function readMarker(root: string) {
    try {
        return await readJson<AssetMarker>(join(root, MARKER));
    } catch {
        return null;
    }
}

function resolveAsset(url: string) {
    const path = decodeURIComponent(new URL(url, REQUEST_ORIGIN).pathname);

    const route = Object.keys(ROUTES).find(prefix => path.startsWith(prefix));

    if (!route) return '';

    const directory = join(assetsDir, ROUTES[route]);

    const file = resolve(directory, path.slice(route.length));

    return file.startsWith(`${directory}${sep}`) ? file : '';
}

async function retry<Result>(operation: () => Promise<Result>, recover: () => Promise<unknown>, message: string) {
    let failure: unknown;

    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
        if (attempt) await sleep(RETRY_BACKOFF * attempt);

        try {
            return await operation();
        } catch (error) {
            failure = error;
            await recover();
        }
    }

    throw new Error(`${message} after ${RETRY_ATTEMPTS} attempts`, { cause: failure });
}

function run(command: string[]) {
    return new Promise<void>((settle, reject) => {
        const [executable, ...flags] = command;

        const child = spawn(executable, flags, { stdio: ['ignore', 'inherit', 'inherit'] });

        child.on('close', (status) => {
            if (status === 0) settle();
            else reject(new Error(`atlas: ${command.join(' ')} exited with ${status}`));
        });

        child.on('error', reject);
    });
}

function specOf(set: TileSet) {
    return { bbox: set.bbox, maxZoom: set.maxZoom };
}

function staging(file: string) {
    return `${file}.${process.pid}.part`;
}

function tileFile(root: string, name: string) {
    return join(root, TILES_DIR, `${name}${TILE_EXTENSION}`);
}

function tileSpecs() {
    return Object.fromEntries(TILE_SETS.map(set => [set.name, specOf(set)] as const));
}

async function unpack(archive: string, binary: string) {
    const isZipped = archive.endsWith('.zip');

    const command = isZipped ? ['unzip', '-qo', archive, 'pmtiles', '-d', cacheDir] : ['tar', '-xzf', archive, '-C', cacheDir, 'pmtiles'];

    await run(command);
    await rename(join(cacheDir, 'pmtiles'), binary);
    await chmod(binary, BINARY_MODE);
}

async function writeMarker(root: string, sets: Record<string, TileSpec>) {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, MARKER), `${JSON.stringify({ build: BUILD, fonts: FONT_STACKS, sets, version: ASSETS_VERSION }, null, 4)}\n`);
}

if (import.meta.main) await ensureAssets();

export default function pmtiles(): AstroIntegration {
    return {
        hooks: {
            'astro:build:done': async ({ dir }) => {
                const output = fileURLToPath(dir);

                await Promise.all(Object.entries(ROUTES).map(([route, directory]) => copyTree(join(assetsDir, directory), join(output, route))));
            },
            'astro:build:start': ensureAssets,
            'astro:server:setup': async ({ server }) => {
                await ensureAssets();
                server.middlewares.use(serveAsset);
            },
        },
        name: 'pmtiles',
    };
}

export async function ensureAssets(): Promise<void> {
    await assertCoverage();

    if (await isComplete(assetsDir)) return;

    await ensureCache();
    await Promise.all(Object.values(ROUTES).map(directory => copyTree(join(cacheDir, directory), join(assetsDir, directory))));
    await writeMarker(assetsDir, tileSpecs());
}

export function serveAsset(request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void): void {
    const file = resolveAsset(request.url ?? '');

    if (!file || !existsSync(file)) {
        next();

        return;
    }

    const { size } = statSync(file);

    const range = parseRange(request.headers.range ?? '', size);

    response.setHeader('accept-ranges', 'bytes');
    response.setHeader('content-type', file.endsWith('.pbf') ? GLYPH_TYPE : TILE_TYPE);

    if (!range) {
        response.setHeader('content-length', size);
        response.writeHead(200);
        createReadStream(file).pipe(response);

        return;
    }

    if (range.start > range.end || range.start >= size) {
        response.setHeader('content-range', `bytes */${size}`);
        response.writeHead(416);
        response.end();

        return;
    }

    response.setHeader('content-length', range.end - range.start + 1);
    response.setHeader('content-range', `bytes ${range.start}-${range.end}/${size}`);
    response.writeHead(206);
    createReadStream(file, { end: range.end, start: range.start }).pipe(response);
}
