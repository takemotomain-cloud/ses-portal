import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const adminEmail = 'k.yamamoto@example.com';
const employeeEmail = 'ses-staff@example.com';
const password = 'ChangeMe123!';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
}

test.describe('authentication and seeded screens', () => {
  test('admin can log in and land on the dashboard', async ({ page }) => {
    await login(page, adminEmail);

    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
  });

  test('employee can log in and land on mypage', async ({ page }) => {
    await login(page, employeeEmail);

    await expect(page).toHaveURL(/\/mypage$/);
    await expect(page.getByRole('heading', { name: 'お知らせ' })).toBeVisible();
  });

  test('admin clients page shows seeded data from docker db', async ({ page }) => {
    await login(page, adminEmail);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.goto('/admin/clients');

    await expect(page).toHaveURL(/\/admin\/clients$/);
    await expect(page.getByRole('heading', { name: 'クライアント' })).toBeVisible();
    await expect(page.getByText('データはありません')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(21);
    await expect(page.getByText('21社')).toBeVisible();
    await expect(page.getByRole('button', { name: '詳細' }).first()).toBeVisible();
  });

  test('session survives a reload for employee users', async ({ page }) => {
    await login(page, employeeEmail);
    await expect(page).toHaveURL(/\/mypage$/);

    await page.reload();

    await expect(page).toHaveURL(/\/mypage$/);
    await expect(page.getByRole('heading', { name: 'お知らせ' })).toBeVisible();
  });
});
