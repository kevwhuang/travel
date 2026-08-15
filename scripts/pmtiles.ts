import { chmod, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';

import { CONTENT_DIR, COVERAGE_REGIONS, MAP_FONT_STACKS, TILE_EXTENSION, WORLD_SOURCE_ID } from '../src/lib/constants';

import type { AstroIntegration } from 'astro';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Position = [number, number];

interface AssetManifest {
    build?: string;
    fonts?: string[];
    specs?: Record<string, TileSpec>;
    version?: number;
}

interface ContentJourney {
    markers: ContentMarker[];
}

interface ContentMarker {
    lat: number;
    lng: number;
    name: string;
}

interface ContentRegion {
    boundary: Position[][][];
    country: string;
    state: string;
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
const BASEMAP_BUILD = '20260812';
const BASEMAP_URL = `https://build.protomaps.com/${BASEMAP_BUILD}.pmtiles`;
const BINARY_MODE = 0o755;
const COVERAGE_DECIMALS = 1;
const COVERAGE_MARGIN = 1;
const COVERAGE_STEP = 0.1;
const COVERAGE_TILE_MAX_ZOOM = 12;
const EXTRACTOR_VERSION = '1.31.2';

const EXTRACTOR_ARCHIVES: Record<string, string> = {
    'darwin-arm64': `go-pmtiles-${EXTRACTOR_VERSION}_Darwin_arm64.zip`,
    'darwin-x64': `go-pmtiles-${EXTRACTOR_VERSION}_Darwin_x86_64.zip`,
    'linux-arm64': `go-pmtiles_${EXTRACTOR_VERSION}_Linux_arm64.tar.gz`,
    'linux-x64': `go-pmtiles_${EXTRACTOR_VERSION}_Linux_x86_64.tar.gz`,
};

const EXTRACTOR_FILE = 'pmtiles';
const EXTRACTOR_URL = `https://github.com/protomaps/go-pmtiles/releases/download/v${EXTRACTOR_VERSION}`;
const FETCH_IDLE_TIMEOUT = 30_000;
const FETCH_WORKERS = 12;
const FONTS_DIR = 'fonts';
const FONT_STACKS = Object.values(MAP_FONT_STACKS);
const GLYPH_CONTENT_TYPE = 'application/x-protobuf';
const GLYPH_EXTENSION = '.pbf';
const GLYPH_SPAN = 256;
const GLYPH_URL = 'https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts';
const JOURNEYS_DIR = 'journeys';
const JSON_EXTENSION = '.json';
const MANIFEST_FILE = '.local.json';
const POLYGON_DEPTH = 2;
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;
const REGION_FILES = ['active.json', 'explored.json'];
const REQUEST_ORIGIN = 'http://localhost';
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF = 500;
const STAGING_EXTENSION = '.part';
const STARRED_FILE = 'starred.json';
const TILES_DIR = 'tiles';
const TILE_CONTENT_TYPE = 'application/octet-stream';
const UNICODE_PLANE_SIZE = 65_536;
const WORLD_TILE_MAX_ZOOM = 7;

const GLYPH_RANGE_COUNT = UNICODE_PLANE_SIZE / GLYPH_SPAN;

const ROUTE_DIRECTORIES: Record<string, string> = {
    '/fonts/map/': FONTS_DIR,
    '/tiles/': TILES_DIR,
};

const TILE_SETS: TileSet[] = [
    ...COVERAGE_REGIONS.map(region => ({
        bbox: `${region.west},${region.south},${region.east},${region.north}`,
        maxZoom: COVERAGE_TILE_MAX_ZOOM,
        name: region.name,
    })),
    { maxZoom: WORLD_TILE_MAX_ZOOM, name: WORLD_SOURCE_ID },
];

const rootDir = fileURLToPath(new URL('..', import.meta.url));

const assetsDir = join(rootDir, '.local');
const cacheDir = join(rootDir, 'node_modules', '.cache', 'atlas');

async function assertCoverage() {
    const contentDir = join(rootDir, CONTENT_DIR);

    const journeysDir = join(contentDir, JOURNEYS_DIR);

    const entries = await readdir(journeysDir, { recursive: true });

    for (const file of entries.filter(entry => entry.endsWith(JSON_EXTENSION))) {
        const journey = await readJson<ContentJourney>(join(journeysDir, file));

        for (const marker of journey.markers) {
            assertPoint(marker.lat, marker.lng, `marker '${marker.name}'`);
        }
    }

    const starred = await readJson<ContentMarker[]>(join(contentDir, STARRED_FILE));

    for (const marker of starred) {
        assertPoint(marker.lat, marker.lng, `marker '${marker.name}'`);
    }

    for (const file of REGION_FILES) {
        const regions = await readJson<ContentRegion[]>(join(contentDir, file));

        for (const region of regions) {
            const label = `border vertex '${region.country} / ${region.state}'`;

            for (const [lng, lat] of region.boundary.flat(POLYGON_DEPTH)) {
                assertPoint(lat, lng, label);
            }
        }
    }
}

function assertPoint(lat: number, lng: number, label: string) {
    const gap = findCoverageGap(lat, lng);

    if (!gap) return;

    throw new Error(`atlas: ${label} (${lat}, ${lng}) outside coverage margin \u2014 extend region '${gap.region}' ${gap.edge} to ${gap.target} or add a region`);
}

async function copyTree(source: string, destination: string) {
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { filter: entry => !entry.endsWith(STAGING_EXTENSION), force: true, recursive: true });
}

async function download(url: string, destination: string) {
    const stagingFile = getStagingPath(destination);

    await retry(async () => {
        const controller = new AbortController();

        let timer: ReturnType<typeof setTimeout> | undefined;

        function arm() {
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(new Error(`atlas: transfer idle for ${FETCH_IDLE_TIMEOUT}ms`)), FETCH_IDLE_TIMEOUT);
        }

        arm();

        try {
            const response = await fetch(url, { signal: controller.signal });

            if (!response.ok) throw new Error(`atlas: ${url} answered ${response.status} ${response.statusText}`);
            if (!response.body) throw new Error(`atlas: ${url} answered without a body`);

            await writeFile(stagingFile, response.body.pipeThrough(new TransformStream({
                transform(chunk, target) {
                    arm();
                    target.enqueue(chunk);
                },
            })));
        } finally {
            clearTimeout(timer);
        }
    }, () => rm(stagingFile, { force: true }), `atlas: download failed ${url}`);

    await rename(stagingFile, destination);
}

async function ensureAssets() {
    await assertCoverage();

    if (await isComplete(assetsDir)) return;

    await ensureCache();
    await Promise.all(Object.values(ROUTE_DIRECTORIES).map(directory => copyTree(join(cacheDir, directory), join(assetsDir, directory))));
    await writeManifest(assetsDir, Object.fromEntries(TILE_SETS.map(set => [set.name, toTileSpec(set)] as const)));
}

async function ensureCache() {
    const manifest = await readManifest(cacheDir);

    const specs: Record<string, TileSpec> = manifest?.build === BASEMAP_BUILD && manifest.version === ASSETS_VERSION ? { ...manifest.specs } : {};

    for (const set of TILE_SETS) {
        await extractTiles(set, specs[set.name]);

        specs[set.name] = toTileSpec(set);

        await writeManifest(cacheDir, specs);
    }

    for (const stack of FONT_STACKS) {
        await fetchStack(stack);
    }
}

async function ensureExtractor() {
    const extractor = join(cacheDir, `${EXTRACTOR_FILE}-${EXTRACTOR_VERSION}`);

    if (existsSync(extractor)) return extractor;

    const archiveName = EXTRACTOR_ARCHIVES[`${process.platform}-${process.arch}`];

    if (!archiveName) throw new Error(`atlas: no go-pmtiles ${EXTRACTOR_VERSION} build for ${process.platform}-${process.arch}`);

    const archive = join(cacheDir, archiveName);

    await mkdir(cacheDir, { recursive: true });
    await download(`${EXTRACTOR_URL}/${archiveName}`, archive);
    await unpack(archive, extractor);
    await rm(archive, { force: true });

    return extractor;
}

async function extractTiles(set: TileSet, spec: TileSpec | undefined) {
    const file = getTileFile(cacheDir, set.name);

    if (existsSync(file) && isSpecMatched(set, spec)) return;

    const extractor = await ensureExtractor();
    const flags = [`--maxzoom=${set.maxZoom}`];
    const stagingFile = getStagingPath(file);

    if (set.bbox) flags.push(`--bbox=${set.bbox}`);

    await mkdir(join(cacheDir, TILES_DIR), { recursive: true });
    await rm(file, { force: true });

    await retry(
        () => run([extractor, 'extract', BASEMAP_URL, stagingFile, ...flags]),
        () => rm(stagingFile, { force: true }),
        `atlas: extract failed ${set.name}`,
    );

    await rename(stagingFile, file);
}

async function fetchStack(stack: string) {
    const directory = join(cacheDir, FONTS_DIR, stack);

    if (await getGlyphRangeCount(directory) >= GLYPH_RANGE_COUNT) return;

    const glyphRanges = Array.from({ length: GLYPH_RANGE_COUNT }, (_, index) => `${index * GLYPH_SPAN}-${(index + 1) * GLYPH_SPAN - 1}`);

    const pendingRanges = glyphRanges.values();

    async function fetchPendingRanges() {
        for (const glyphRange of pendingRanges) {
            const file = join(directory, `${glyphRange}${GLYPH_EXTENSION}`);

            if (!existsSync(file)) await download(`${GLYPH_URL}/${encodeURIComponent(stack)}/${glyphRange}${GLYPH_EXTENSION}`, file);
        }
    }

    await mkdir(directory, { recursive: true });
    await Promise.all(Array.from({ length: FETCH_WORKERS }, fetchPendingRanges));
}

function findCoverageGap(lat: number, lng: number) {
    let nearest: CoverageGap | null = null;

    for (const region of COVERAGE_REGIONS) {
        const gaps: CoverageGap[] = [
            { edge: 'east', region: region.name, shortfall: lng + COVERAGE_MARGIN - region.east, target: getMarginEdge(lng, true) },
            { edge: 'north', region: region.name, shortfall: lat + COVERAGE_MARGIN - region.north, target: getMarginEdge(lat, true) },
            { edge: 'south', region: region.name, shortfall: region.south + COVERAGE_MARGIN - lat, target: getMarginEdge(lat, false) },
            { edge: 'west', region: region.name, shortfall: region.west + COVERAGE_MARGIN - lng, target: getMarginEdge(lng, false) },
        ];

        const widest = gaps.reduce((first, second) => (second.shortfall > first.shortfall ? second : first));

        if (widest.shortfall <= 0) return null;

        if (!nearest || widest.shortfall < nearest.shortfall) nearest = widest;
    }

    return nearest;
}

async function getGlyphRangeCount(directory: string) {
    const entries = await readdir(directory).catch(() => []);

    return entries.filter(file => file.endsWith(GLYPH_EXTENSION)).length;
}

function getMarginEdge(value: number, isUpper: boolean) {
    const bound = isUpper ? value + COVERAGE_MARGIN : value - COVERAGE_MARGIN;

    const steps = isUpper ? Math.ceil(bound / COVERAGE_STEP) : Math.floor(bound / COVERAGE_STEP);

    return (steps * COVERAGE_STEP).toFixed(COVERAGE_DECIMALS);
}

function getStagingPath(file: string) {
    return `${file}.${process.pid}${STAGING_EXTENSION}`;
}

function getTileFile(root: string, name: string) {
    return join(root, TILES_DIR, `${name}${TILE_EXTENSION}`);
}

async function isComplete(root: string) {
    const manifest = await readManifest(root);

    if (!manifest || manifest.build !== BASEMAP_BUILD || manifest.version !== ASSETS_VERSION) return false;
    if (manifest.fonts?.length !== FONT_STACKS.length) return false;
    if (!FONT_STACKS.every(stack => manifest.fonts?.includes(stack))) return false;

    for (const set of TILE_SETS) {
        if (!existsSync(getTileFile(root, set.name)) || !isSpecMatched(set, manifest.specs?.[set.name])) return false;
    }

    for (const stack of FONT_STACKS) {
        if (await getGlyphRangeCount(join(root, FONTS_DIR, stack)) < GLYPH_RANGE_COUNT) return false;
    }

    return true;
}

function isSpecMatched(set: TileSet, spec: TileSpec | undefined) {
    return spec?.bbox === set.bbox && spec?.maxZoom === set.maxZoom;
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

async function readManifest(root: string) {
    try {
        return await readJson<AssetManifest>(join(root, MANIFEST_FILE));
    } catch {
        return null;
    }
}

function resolveAsset(url: string) {
    let path: string;

    try {
        path = decodeURIComponent(new URL(url, REQUEST_ORIGIN).pathname);
    } catch {
        return '';
    }

    const route = Object.keys(ROUTE_DIRECTORIES).find(prefix => path.startsWith(prefix));

    if (!route) return '';

    const directory = join(assetsDir, ROUTE_DIRECTORIES[route]);

    const file = resolve(directory, path.slice(route.length));

    return file.startsWith(`${directory}${sep}`) ? file : '';
}

async function retry<Result>(operation: () => Promise<Result>, recover: () => Promise<unknown>, message: string) {
    let failure: unknown;

    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
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
    return new Promise<void>((fulfill, reject) => {
        const [executable, ...commandArguments] = command;

        const child = spawn(executable, commandArguments, { stdio: ['ignore', 'inherit', 'inherit'] });

        child.on('close', (status) => {
            if (status === 0) fulfill();
            else reject(new Error(`atlas: ${command.join(' ')} exited with ${status}`));
        });

        child.on('error', reject);
    });
}

function serveAsset(request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) {
    const file = resolveAsset(request.url ?? '');

    if (!file || !existsSync(file)) {
        next();

        return;
    }

    const stats = statSync(file);

    if (!stats.isFile()) {
        next();

        return;
    }

    const { size } = stats;

    const range = parseRange(request.headers.range ?? '', size);

    response.setHeader('accept-ranges', 'bytes');
    response.setHeader('content-type', file.endsWith(GLYPH_EXTENSION) ? GLYPH_CONTENT_TYPE : TILE_CONTENT_TYPE);

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

function toTileSpec(set: TileSet) {
    return { bbox: set.bbox, maxZoom: set.maxZoom };
}

async function unpack(archive: string, extractor: string) {
    const isZipped = archive.endsWith('.zip');

    const command = isZipped ? ['unzip', '-qo', archive, EXTRACTOR_FILE, '-d', cacheDir] : ['tar', '-xzf', archive, '-C', cacheDir, EXTRACTOR_FILE];

    await run(command);
    await rename(join(cacheDir, EXTRACTOR_FILE), extractor);
    await chmod(extractor, BINARY_MODE);
}

async function writeManifest(root: string, specs: Record<string, TileSpec>) {
    const manifest = { build: BASEMAP_BUILD, fonts: FONT_STACKS, specs, version: ASSETS_VERSION };

    await mkdir(root, { recursive: true });
    await writeFile(join(root, MANIFEST_FILE), `${JSON.stringify(manifest, null, 4)}\n`);
}

if (import.meta.main) await ensureAssets();

export default function pmtiles(): AstroIntegration {
    return {
        hooks: {
            'astro:build:done': async ({ dir }) => {
                const output = fileURLToPath(dir);

                await Promise.all(Object.entries(ROUTE_DIRECTORIES)
                    .map(([route, directory]) => copyTree(join(assetsDir, directory), join(output, route))));
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
