import { afterEach, describe, expect, test, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ErrorBoundary from '../../src/components/ErrorBoundary';

class FailingBoundary extends ErrorBoundary {
    state = { hasError: true };
}

describe('ErrorBoundary', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('renders its children while no error is caught', () => {
        const children = createElement('p', null, 'Atlas ready');

        const boundary = new ErrorBoundary({ children });

        expect(boundary.render()).toBe(children);
    });

    test('derives the error state from a caught error', () => {
        expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true });
    });

    test('renders nothing after an error is caught', () => {
        const html = renderToStaticMarkup(createElement(FailingBoundary, null, createElement('p', null, 'Atlas ready')));

        expect(html).toBe('');
        expect(html).not.toContain('Atlas ready');
    });

    test('redirects to the server error page from a caught error', () => {
        const replace = vi.fn();

        vi.stubGlobal('window', { location: { replace } });

        const boundary = new ErrorBoundary({ children: null });

        boundary.componentDidCatch();

        expect(replace).toHaveBeenCalledExactlyOnceWith('/500');
    });
});
