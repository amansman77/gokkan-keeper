import { test, expect } from '@playwright/test';

const googleScript = (credential) => `window.google = { accounts: { id: {
  initialize(options) { this.options = options; },
  renderButton(container) {
    const button = document.createElement('button');
    button.textContent = 'Fixture Google login';
    button.onclick = () => this.options.callback({ credential: ${JSON.stringify(credential)} });
    container.appendChild(button);
  }
} } };`;

const browserErrors = new WeakMap();
test.beforeEach(async ({ page, request }) => {
  const { credential } = await (await request.get('http://127.0.0.1:18788/credential')).json();
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => { errors.push(error.message); });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.href === 'https://accounts.google.com/gsi/client') return route.fulfill({ contentType: 'application/javascript', body: googleScript(credential) });
    if (url.origin === 'https://static.cloudflareinsights.com') return route.fulfill({ contentType: 'application/javascript', body: `window.fixtureBeaconLoaded = true; fetch('https://cloudflareinsights.com/cdn-cgi/rum', { method: 'POST', body: 'fixture' }).then(() => { window.fixtureBeaconSent = true; });` });
    if (url.origin === 'https://cloudflareinsights.com') return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    if (url.origin === 'https://challenges.cloudflare.com') return route.fulfill({ contentType: 'application/javascript', body: `window.turnstile = { render(container, options) { const text = document.createElement('span'); text.textContent = 'Fixture bot check'; container.appendChild(text); queueMicrotask(() => options.callback('fixture-challenge-token')); return 'fixture-widget'; }, remove() {} };` });
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    return route.abort('blockedbyclient');
  });
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), 'Unexpected browser runtime errors').toEqual([]);
});
async function login(page, next = '/granaries/new') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole('button', { name: 'Fixture Google login' }).click();
  await expect(page).toHaveURL(new RegExp(next+'$'));
}
test('anonymous visitors see public portfolio and are redirected from owner pages', async ({ page }) => {
  await page.goto('/archive');
  await expect(page.getByRole('heading', { name: '공개 포트폴리오', exact: true })).toBeVisible();
  await page.goto('/granaries/new');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
});
test('login cookie supports create, reload, edit and logout through the real isolated API', async ({ page }) => {
  await login(page);
  await page.getByLabel('곳간 이름').fill('Browser reserve');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page).toHaveURL(/\/granaries\/[0-9a-f-]+$/);
  const detail = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Browser reserve', exact: true })).toBeVisible();
  await page.goto(detail+'/edit');
  await page.getByLabel('곳간 이름').fill('Updated browser reserve');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updated browser reserve', exact: true })).toBeVisible();
  const persisted = await page.request.get('http://localhost:18787/granaries/'+detail.split('/').pop());
  expect((await persisted.json()).name).toBe('Updated browser reserve');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.goto('/granaries/new');
  await expect(page).toHaveURL(/\/login\?next=/);
});
test('failed save keeps the form and displays the API error', async ({ page }) => {
  await login(page);
  await page.route('http://localhost:18787/granaries', async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 500, json: { error: 'Fixture save failure' } });
    return route.continue();
  });
  await page.getByLabel('곳간 이름').fill('Failed reserve');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page.getByText('Fixture save failure', { exact: true })).toBeVisible();
  await expect(page.getByLabel('곳간 이름')).toHaveValue('Failed reserve');
  await expect(page.getByRole('button', { name: '만들기', exact: true })).toBeEnabled();
});

test('production bundle and real Pages CSP allow analytics, Google login and a verified consulting submission', async ({ page }) => {
  await page.addInitScript("window.fixtureCspViolations = []; document.addEventListener('securitypolicyviolation', (event) => window.fixtureCspViolations.push(event.violatedDirective));");
  const response = await page.goto('https://localhost:18887/login?next=/granaries/new');
  await page.waitForFunction('window.fixtureBeaconLoaded && window.fixtureBeaconSent');
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response.headers()['x-frame-options']).toBe('DENY');
  await page.getByRole('button', { name: 'Fixture Google login' }).click();
  await expect(page).toHaveURL(/\/granaries\/new$/);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  expect(await page.evaluate('window.fixtureCspViolations')).toEqual([]);
  await page.goto('https://localhost:18887/consulting');
  await page.waitForFunction('window.fixtureBeaconLoaded && window.fixtureBeaconSent');
  await page.getByLabel('답변 받을 이메일').fill('fixture@example.com');
  await page.getByRole('textbox', { name: /고민/ }).fill('Fixture consulting concern');
  await page.locator('input[type="file"]').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64') });
  await expect(page.getByRole('button', { name: '무료 구조 점검 요청 보내기' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '무료 구조 점검 요청 보내기' }).click();
  await expect(page.getByText(/요청이 접수/)).toBeVisible();
  expect(await page.evaluate('window.fixtureCspViolations')).toEqual([]);
});
