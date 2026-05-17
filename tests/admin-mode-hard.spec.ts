import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import * as nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const baseURL = process.env.ALOPOP_BASE_URL || 'http://127.0.0.1:3099';

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'ALO_POP_SESSION_SECRET_DEFAULT';
}

function createSessionToken(userId: string) {
  const payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

test.describe('admin mode hard QA', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('member management renders stats, filters, and protects raw private fields', async ({ page, context, request }) => {
    const admin = await prisma.user.findFirst({
      where: { isAdmin: true },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        statusMessage: true,
        walletBalance: true,
        isAdmin: true,
      },
    });
    expect(admin, 'admin user must exist for admin mode QA').toBeTruthy();

    const token = createSessionToken(admin!.id);
    await context.addCookies([{
      name: 'alo_session',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }]);

    await page.addInitScript((storedUser) => {
      localStorage.setItem('alo_user', JSON.stringify(storedUser));
    }, admin);

    const apiResponse = await request.get(`${baseURL}/api/admin/users?pageSize=10`, {
      headers: { cookie: `alo_session=${token}` },
    });
    expect(apiResponse.status()).toBe(200);
    const apiBody = await apiResponse.json();
    const serialized = JSON.stringify(apiBody);
    expect(serialized).not.toContain('googleId');
    expect(serialized).not.toContain('openaiKey');
    expect(serialized).not.toContain('geminiKey');
    expect(serialized).not.toContain('anthropicKey');
    expect(serialized).not.toContain('aiPrompt');
    expect(serialized).not.toContain('agentToken');
    expect(serialized).not.toContain('inviteCode');
    expect(apiBody.stats.access.googleAccounts).toBeGreaterThanOrEqual(0);

    await page.goto(`${baseURL}/admin`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /회원 관리/ })).toBeVisible();
    await expect(page.getByText('전체 회원', { exact: true })).toBeVisible();
    await expect(page.getByText('구글 가입', { exact: true })).toBeVisible();
    await expect(page.getByText('개인 API 키 보유', { exact: true })).toBeVisible();
    await expect(page.getByText('코인 조정', { exact: true })).toBeVisible();
    await expect(page.getByText('최근 코인 조정 로그', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('닉네임, 구글 이메일, ID 검색')).toBeVisible();

    await page.getByRole('combobox').nth(0).selectOption('ai');
    await expect(page.getByText('AI', { exact: true }).first()).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: /회원 관리/ })).toBeVisible();
    await expect(page.getByPlaceholder('닉네임, 구글 이메일, ID 검색')).toBeVisible();
  });

  test('admin APIs reject unauthenticated requests and existing GET routes remain guarded', async ({ request }) => {
    for (const path of [
      '/api/admin/users',
      '/api/admin/announcements',
      '/api/admin/events',
      '/api/admin/system',
      '/api/admin/chaos',
    ]) {
      const response = await request.get(`${baseURL}${path}`);
      expect([401, 403], `${path} should reject unauthenticated access`).toContain(response.status());
    }

    const publicAnnouncements = await request.get(`${baseURL}/api/announcements`);
    expect(publicAnnouncements.status()).toBe(200);
    const publicEvents = await request.get(`${baseURL}/api/events`);
    expect(publicEvents.status()).toBe(200);
  });
});
