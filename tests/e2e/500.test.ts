import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('500 page', () => {
    test('renders the server error section on direct visit', async ({ page }) => {
        const response = await page.goto('/500');

        expect(response?.status()).toBe(500);

        await expect(page).toHaveTitle('Server Error \u2014 Travel');
        await expect(page.locator('#error-server-title')).toHaveText('500');
        await expect(page.getByRole('link', { name: 'Return to home' })).toBeVisible();
    });

    test('marks the page noindex for robots', async ({ page }) => {
        await page.goto('/500');

        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    });

    test('navigates home from the home pill', async ({ page }) => {
        await page.goto('/500');
        await page.getByRole('link', { name: 'Return to home' }).click();

        await expect(page).toHaveURL('/');
        await expect(page).toHaveTitle('Travel');
    });
});
