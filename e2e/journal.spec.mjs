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

async function createGranary(page, name) {
  await login(page);
  await page.getByLabel('곳간 이름').fill(name);
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page).toHaveURL(/\/granaries\/[0-9a-f-]+$/);
  return page.url().split('/').pop();
}
test('snapshot create calculations and edit removal persist through real API and detail sections', async ({ page }) => {
  const granaryId = await createGranary(page, 'Snapshot form reserve');
  let releaseGranaries;
  const granariesReady = new Promise(resolve => { releaseGranaries = resolve; });
  await page.route('http://localhost:18787/granaries', async route => {
    if (route.request().method() === 'GET') await granariesReady;
    await route.continue();
  });
  await page.goto(`/snapshots/new?granaryId=${granaryId}`);
  await expect(page.getByText('로딩 중...', { exact: true })).toBeVisible();
  await expect(page.locator('#availableBalance')).toHaveCount(0);
  releaseGranaries();
  await page.locator('#availableBalance').fill('100');
  await page.locator('#profitLoss').fill('20');
  await expect(page.locator('#totalAmount')).toHaveValue('120');
  await page.locator('#totalAmount').fill('150');
  await expect(page.locator('#profitLoss')).toHaveValue('50');
  await page.getByRole('button', { name: '자동 계산으로 되돌리기', exact: true }).click();
  await page.locator('#profitLoss').fill('25');
  await expect(page.locator('#totalAmount')).toHaveValue('125');
  await page.getByLabel('메모 (선택)').fill('Snapshot fixture');
  await page.getByRole('button', { name: '추가하기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/granaries/${granaryId}$`));
  await page.getByRole('button', { name: /^스냅샷 기록/ }).click();
  await expect(page.getByText('Snapshot fixture', { exact: true })).toBeVisible();
  const snapshots = await (await page.request.get(`http://localhost:18787/snapshots?granary_id=${granaryId}`)).json();
  expect(snapshots[0].totalAmount).toBe(125);
  await page.goto(`/snapshots/${snapshots[0].id}/edit`);
  await expect(page.locator('#totalAmount')).toHaveValue('125');
  await page.getByRole('button', { name: '예수금 제거', exact: true }).click();
  await page.getByRole('button', { name: '평가 손익 제거', exact: true }).click();
  await page.getByRole('button', { name: '메모 제거', exact: true }).click();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/granaries/${granaryId}$`));
  const edited = await (await page.request.get(`http://localhost:18787/snapshots/${snapshots[0].id}`)).json();
  expect(edited.totalAmount).toBe(125);
  expect(edited.availableBalance).toBeNull();
  expect(edited.profitLoss).toBeNull();
  expect(edited.memo).toBeNull();
});
test('position quote autofill preserves a typed name and manual fields save, expand and delete', async ({ page }) => {
  const granaryId = await createGranary(page, 'Position form reserve');
  await page.route('**/positions/quote?*', route => route.fulfill({ json: {
    name: 'Provider name', market: 'NASDAQ', assetType: 'STOCK', currentUnitPrice: 120,
    currentPriceAsOf: '2026-01-01', currentPriceSource: 'YAHOO_FINANCE',
  } }));
  await page.goto(`/positions/new?granaryId=${granaryId}`);
  await page.getByLabel('종목명', { exact: true }).fill('Owner name');
  await page.getByLabel('심볼', { exact: true }).fill('AAPL');
  await expect(page.getByText(/자동 입력 완료/)).toBeVisible();
  await expect(page.getByLabel('종목명', { exact: true })).toHaveValue('Owner name');
  // Disable provider lookup to keep this deterministic browser fixture offline.
  await page.locator('#assetType').selectOption('BOND');
  await page.locator('#quantity').fill('2');
  await page.locator('#avgCost').fill('100');
  await page.locator('#currentValue').fill('120');
  await page.getByRole('button', { name: '추가하기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/granaries/${granaryId}$`));
  await page.getByRole('button', { name: /^포지션/ }).click();
  await expect(page.getByText('Owner name', { exact: true })).toBeVisible();
  const positions = await (await page.request.get(`http://localhost:18787/positions?granary_id=${granaryId}`)).json();
  expect(positions[0].quantity).toBe(2);
  expect(positions[0].currentValue).toBe(120);
  await page.route('**/positions/indicators?*', route => route.fulfill({ status: 404, json: { error: 'Fixture unsupported symbol' } }));
  await page.getByRole('button', { name: '지표 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '지표 닫기', exact: true })).toBeVisible();
  await expect(page.getByText('지표 조회 불가 (Yahoo Finance 미지원 종목)', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByText('등록된 포지션이 없습니다.', { exact: true })).toBeVisible();
});
test('asset goal editor saves milestone and assumptions then reloads persisted settings', async ({ page }) => {
  await login(page, '/dashboard');
  await page.getByRole('button', { name: '목표 수정', exact: true }).click();
  const editor = page.locator('form').filter({ has: page.getByRole('button', { name: '경로 기준점을 오늘로' }) });
  await editor.locator('input[type="number"]').nth(1).fill('2');
  await page.getByRole('button', { name: '+ 목표 추가', exact: true }).click();
  const numbers = editor.locator('input[type="number"]');
  await numbers.nth(4).fill('2050');
  await numbers.nth(5).fill('15');
  await numbers.nth(6).fill('150');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '목표 수정', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('2050년 말 15.00억원', { exact: true })).toBeVisible();
  const settings = await (await page.request.get('http://localhost:18787/settings')).json();
  const plan = JSON.parse(settings.asset_goal_plan);
  expect(plan.monthlyContribution).toBe(1500000);
  expect(plan.milestones[0].amount).toBe(200000000);
});
test('screenshot import uploads, waits for the OCR worker, shows checks and applies the reviewed result', async ({ page }) => {
  await login(page, '/dashboard');
  const api = 'http://localhost:18787';
  const granary = await (await page.request.post(`${api}/granaries`, { headers: { Origin: 'http://localhost:5173' }, data: { name: 'Screenshot fixture', purpose: '가계', currency: 'KRW' } })).json();
  await page.request.post(`${api}/positions`, { headers: { Origin: 'http://localhost:5173' }, data: { granaryId: granary.id, name: '파두', symbol: '440110', quantity: 1, avgCost: 10460 } });
  await page.goto(`/granaries/${granary.id}/import`);
  await page.getByLabel(/스크린샷/).setInputFiles({ name: 'balance.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64') });
  await page.getByRole('button', { name: '판독 시작', exact: true }).click();
  await expect(page.getByRole('heading', { name: '판독을 기다리는 중이에요' })).toBeVisible();

  // play the Mac OCR worker with its scoped key
  const worker = { 'X-API-Secret': 'fixture-only-ocr-worker-key-32-bytes-min' };
  const leased = await (await page.request.get(`${api}/imports/next`, { headers: worker })).json();
  const l = (box, text) => ({ box, text, conf: 0.99 });
  const chrome = [l([106, 362, 857, 405], '0000001234-01 [종합(비대면)] 고객'), l([80, 493, 530, 540], '주식잔고 실현손익')];
  const holdings = { seq: 1, width: 1206, height: 2622, lines: [...chrome,
    l([78, 795, 260, 854], '평가손익'), l([511, 782, 1123, 857], '73.080원 349.33%'),
    l([168, 1072, 287, 1110], '종목명'), l([588, 1113, 707, 1152], '수익률'), l([946, 1111, 1097, 1152], '평가금액'),
    l([34, 1217, 197, 1264], '파두'), l([645, 1225, 810, 1263], '73,080'), l([1157, 1221, 1184, 1261], '2'),
    l([630, 1288, 809, 1322], '349.33%'), l([1013, 1284, 1184, 1327], '94,000'), l([77, 2311, 199, 2343], 'KOSPI')] };
  const cash = { seq: 2, width: 1206, height: 2622, lines: [...chrome, l([141, 868, 320, 915], '당일현금'), l([142, 1243, 329, 1286], 'D+2 현금'), l([797, 1240, 1057, 1289], '6,000원')] };
  expect((await page.request.post(`${api}/imports/${leased.id}/ocr`, { headers: worker, data: { pages: [holdings, cash] } })).status()).toBe(204);

  await expect(page.getByText(/종목 1개의 손익 합계가 화면 합계/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('cell', { name: '파두' })).toBeVisible();
  await page.getByRole('button', { name: '곳간에 반영', exact: true }).click();
  await expect(page.getByText('곳간에 반영했어요.')).toBeVisible();
  const snapshots = await (await page.request.get(`${api}/snapshots?granaryId=${granary.id}`)).json();
  expect(snapshots[0]).toMatchObject({ totalAmount: 100000, availableBalance: 6000, profitLoss: 73080 });
});
