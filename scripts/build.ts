import { chmod, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';

import type { AstroIntegration } from 'astro';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface TileSet {
    bbox?: string;
    maxzoom: number;
    name: string;
}

const ASSETS_VERSION = 4;
const BUILD = '20260812';
const BUILD_URL = `https://build.protomaps.com/${BUILD}.pmtiles`;
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
const FONT_STACKS = ['Noto Sans Italic', 'Noto Sans Medium', 'Noto Sans Regular'];
const GLYPH_SPAN = 256;
const GLYPH_TYPE = 'application/x-protobuf';
const GLYPH_URL = 'https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts';
const MARKER = '.local.json';
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;
const REQUEST_ORIGIN = 'http://localhost';
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF = 500;

const ROUTES: Record<string, string> = {
    '/fonts/map/': 'fonts',
    '/tiles/': 'tiles',
};

const TILE_SETS: TileSet[] = [
    { bbox: '-125.7,15.0,-81.5,51.3', maxzoom: 12, name: 'atlas' },
    { maxzoom: 5, name: 'world' },
];

const TILE_TYPE = 'application/octet-stream';
const UNICODE_PLANE = 65_536;

const GLYPH_RANGE_COUNT = UNICODE_PLANE / GLYPH_SPAN;

const rootDir = fileURLToPath(new URL('..', import.meta.url));

const assetsDir = join(rootDir, '.local');
const cacheDir = join(rootDir, 'node_modules', '.cache', 'atlas');

async function copyTree(source: string, destination: string) {
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { force: true, recursive: true });
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
    if (!(await isCurrent(cacheDir))) {
        await Promise.all(Object.values(ROUTES).map(directory => rm(join(cacheDir, directory), { force: true, recursive: true })));
    }

    for (const set of TILE_SETS) {
        await extractTiles(set);
    }

    for (const stack of FONT_STACKS) {
        await fetchStack(stack);
    }

    await writeMarker(cacheDir);
}

async function ensureExtractor() {
    const binary = join(cacheDir, `pmtiles-${EXTRACTOR_VERSION}`);

    if (existsSync(binary)) return binary;

    const asset = EXTRACTOR_ASSETS[`${process.platform}-${process.arch}`];

    if (!asset) throw new Error(`atlas: no go-pmtiles ${EXTRACTOR_VERSION} build for ${process.platform}-${process.arch}`);

    const archive = join(cacheDir, asset);

    await mkdir(cacheDir, { recursive: true });
    await download(`${EXTRACTOR_URL}/${asset}`, archive);
    await unpack(archive, binary);
    await rm(archive, { force: true });

    return binary;
}

async function extractTiles(set: TileSet) {
    const file = join(cacheDir, 'tiles', `${set.name}.pmtiles`);

    if (existsSync(file)) return;

    const extractor = await ensureExtractor();
    const flags = [`--maxzoom=${set.maxzoom}`];
    const partial = staging(file);

    if (set.bbox) flags.push(`--bbox=${set.bbox}`);

    await mkdir(join(cacheDir, 'tiles'), { recursive: true });
    await retry(
        () => run([extractor, 'extract', BUILD_URL, partial, ...flags]),
        () => rm(partial, { force: true }),
        `atlas: extract failed ${set.name}`,
    );
    await rename(partial, file);
}

async function fetchStack(stack: string) {
    const directory = join(cacheDir, 'fonts', stack);

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
    if (!(await isCurrent(root))) return false;

    for (const set of TILE_SETS) {
        if (!existsSync(join(root, 'tiles', `${set.name}.pmtiles`))) return false;
    }

    for (const stack of FONT_STACKS) {
        if (await glyphCount(join(root, 'fonts', stack)) < GLYPH_RANGE_COUNT) return false;
    }

    return true;
}

async function isCurrent(root: string) {
    try {
        const marker: { build?: string; version?: number } = JSON.parse(await readFile(join(root, MARKER), 'utf-8'));

        return marker.build === BUILD && marker.version === ASSETS_VERSION;
    } catch {
        return false;
    }
}

function parseRange(header: string, size: number) {
    const match = RANGE_PATTERN.exec(header);

    if (!match) return null;

    const [, first, last] = match;

    if (!first && !last) return null;
    if (!first) return { end: size - 1, start: Math.max(0, size - Number(last)) };

    return { end: last ? Math.min(Number(last), size - 1) : size - 1, start: Number(first) };
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

function staging(file: string) {
    return `${file}.${process.pid}.part`;
}

async function unpack(archive: string, binary: string) {
    const isZipped = archive.endsWith('.zip');

    const command = isZipped ? ['unzip', '-qo', archive, 'pmtiles', '-d', cacheDir] : ['tar', '-xzf', archive, '-C', cacheDir, 'pmtiles'];

    await run(command);
    await rename(join(cacheDir, 'pmtiles'), binary);
    await chmod(binary, 0o755);
}

async function writeMarker(root: string) {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, MARKER), `${JSON.stringify({ build: BUILD, version: ASSETS_VERSION }, null, 4)}\n`);
}

if (import.meta.main) await ensureAssets();

export default function atlasAssets(): AstroIntegration {
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
        name: 'atlas-assets',
    };
}

export async function ensureAssets(): Promise<void> {
    if (await isComplete(assetsDir)) return;

    await ensureCache();
    await Promise.all(Object.values(ROUTES).map(directory => copyTree(join(cacheDir, directory), join(assetsDir, directory))));
    await writeMarker(assetsDir);
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
