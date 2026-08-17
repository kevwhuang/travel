import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('404 page', () => {
    test('returns 404 and renders the error section for an unknown path', async ({ page }) => {
        const response = await page.goto('/this-page-does-not-exist');

        expect(response?.status()).toBe(404);

        await expect(page).toHaveTitle('Page Not Found \u2014 Travel');
        await expect(page.locator('#error-not-found-title')).toHaveText('404');
        await expect(page.getByRole('link', { name: 'Return to home' })).toBeVisible();
    });

    test('returns 404 for deep unknown paths', async ({ page }) => {
        const response = await page.goto('/journeys/nope/deep');

        expect(response?.status()).toBe(404);

        await expect(page.locator('#error-not-found-title')).toHaveText('404');
    });

    test('marks the page noindex for robots', async ({ page }) => {
        await page.goto('/this-page-does-not-exist');

        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    });

    test('navigates home from the home pill', async ({ page }) => {
        await page.goto('/this-page-does-not-exist');
        await page.getByRole('link', { name: 'Return to home' }).click();

        await expect(page).toHaveURL('/');
        await expect(page).toHaveTitle('Travel');
    });
});
