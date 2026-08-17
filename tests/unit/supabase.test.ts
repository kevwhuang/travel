import { afterEach, describe, expect, test, vi } from 'vitest';

describe('supabase', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    test('importing the module yields a client without any network call', async () => {
        const fetchStub = vi.fn();

        vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-anon-key');
        vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
        vi.stubGlobal('fetch', fetchStub);

        const { supabase } = await import('../../src/lib/supabase');

        const builder = supabase.from('journeys');

        expect(typeof builder.insert).toBe('function');
        expect(typeof builder.select).toBe('function');
        expect(typeof supabase.auth.getSession).toBe('function');
        expect(typeof supabase.auth.signInWithPassword).toBe('function');
        expect(fetchStub).not.toHaveBeenCalled();
    });
});
