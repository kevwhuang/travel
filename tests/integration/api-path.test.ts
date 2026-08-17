import { describe, expect, test } from 'vitest';

import { ALL } from '../../src/pages/api/[...path]';

type RouteContext = Parameters<typeof ALL>[0];

function createContext(method: string, path: string) {
    return {
        clientAddress: '127.0.0.1',
        request: new Request(`http://localhost/api/${path}`, { method }),
    } as RouteContext;
}

describe('api path', () => {
    test('responds 404 to any method and path', async () => {
        const response = await ALL(createContext('GET', 'unknown'));

        expect(response.status).toBe(404);
    });

    test('returns the json error body', async () => {
        const response = await ALL(createContext('POST', 'anything/nested'));

        const result: Record<string, unknown> = await response.json();

        expect(result).toEqual({ error: 'Not found' });
    });

    test('sets a json content type header', async () => {
        const response = await ALL(createContext('DELETE', 'x'));

        expect(response.headers.get('content-type')).toContain('application/json');
    });
});
