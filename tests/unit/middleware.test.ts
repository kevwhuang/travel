import { describe, expect, test, vi } from 'vitest';

import { onRequest } from '../../src/middleware';

import type { APIContext, MiddlewareNext } from 'astro';

function createContext(pathname: string) {
    const rewritten = new Response('rewritten');

    const rewrite = vi.fn(async () => rewritten);

    const context = { rewrite, url: new URL(`http://localhost:8888${pathname}`) } as unknown as APIContext;

    return { context, rewrite, rewritten };
}

describe('onRequest', () => {
    test('passes the /500 path straight through even with a 5xx response', async () => {
        const { context, rewrite } = createContext('/500');
        const errorPage = new Response(null, { status: 503 });

        const next: MiddlewareNext = vi.fn(async () => errorPage);

        const response = await onRequest(context, next);

        expect(response).toBe(errorPage);
        expect(rewrite).not.toHaveBeenCalled();
    });

    test('propagates a throw from next on the /500 path without rewriting', async () => {
        const { context, rewrite } = createContext('/500');

        const next: MiddlewareNext = vi.fn(async () => {
            throw new Error('boom');
        });

        await expect(onRequest(context, next)).rejects.toThrow('boom');
        expect(rewrite).not.toHaveBeenCalled();
    });

    test('passes page responses under 500 through', async () => {
        const { context, rewrite } = createContext('/');
        const page = new Response('ok', { status: 200 });

        const next: MiddlewareNext = vi.fn(async () => page);

        const response = await onRequest(context, next);

        expect(response).toBe(page);
        expect(rewrite).not.toHaveBeenCalled();
    });

    test('rewrites page responses with status 500 or above to /500', async () => {
        const { context, rewrite, rewritten } = createContext('/');
        const next: MiddlewareNext = vi.fn(async () => new Response(null, { status: 500 }));

        const response = await onRequest(context, next);

        expect(rewrite).toHaveBeenCalledWith('/500');
        expect(response).toBe(rewritten);
    });

    test('passes api 500 responses through without rewriting', async () => {
        const { context, rewrite } = createContext('/api/markers');
        const failure = new Response(null, { status: 500 });

        const next: MiddlewareNext = vi.fn(async () => failure);

        const response = await onRequest(context, next);

        expect(response).toBe(failure);
        expect(rewrite).not.toHaveBeenCalled();
    });

    test('returns a json 500 when next throws on an api path', async () => {
        const { context, rewrite } = createContext('/api/markers');

        const next: MiddlewareNext = vi.fn(async () => {
            throw new Error('boom');
        });

        const response = await onRequest(context, next) as Response;

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Internal server error' });
        expect(rewrite).not.toHaveBeenCalled();
    });

    test('rewrites to /500 when next throws on a page path', async () => {
        const { context, rewrite, rewritten } = createContext('/');

        const next: MiddlewareNext = vi.fn(async () => {
            throw new Error('boom');
        });

        const response = await onRequest(context, next);

        expect(rewrite).toHaveBeenCalledWith('/500');
        expect(response).toBe(rewritten);
    });
});
