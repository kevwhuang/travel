import { afterEach, describe, expect, test, vi } from 'vitest';

import { prefersReducedMotion } from '../../src/lib/motion';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function createMatchMedia(matches: boolean) {
    const matchMedia = vi.fn(() => ({ matches }));

    vi.stubGlobal('window', { matchMedia });

    return matchMedia;
}

describe('prefersReducedMotion', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('matches the reduced-motion media query', () => {
        const matchMedia = createMatchMedia(false);

        prefersReducedMotion();

        expect(matchMedia).toHaveBeenCalledExactlyOnceWith(REDUCED_MOTION_QUERY);
    });

    test('returns true when the media query matches', () => {
        createMatchMedia(true);

        expect(prefersReducedMotion()).toBe(true);
    });

    test('returns false when the media query does not match', () => {
        createMatchMedia(false);

        expect(prefersReducedMotion()).toBe(false);
    });
});
