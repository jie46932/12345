import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const url = process.env.VERIFY_URL || 'https://hefurniture.gsdmsj.cn/?bypass=1&viewer=1';
const cdp = process.env.BROWSER_CDP_URL || 'http://127.0.0.1:9222';
const timeout = Number(process.env.VERIFY_TIMEOUT_MS || 45000);
let browser;
let mode = 'chrome-cdp';
try { browser = await chromium.connectOverCDP(cdp); }
catch { mode = 'playwright'; console.warn('[verify:browser] Chrome CDP unavailable; using isolated headed Chromium'); browser = await chromium.launch({ headless: false }); }
const context = browser.contexts()[0] || await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
const failed = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
page.on('requestfailed', (request) => failed.push({ url: request.url(), error: request.failure()?.errorText }));
const started = Date.now();
let navigationError = '';
try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout }); }
catch (error) { navigationError = error.message; }
if (await page.getByText('账号密码登录', { exact: true }).count()) {
  const username = process.env.VERIFY_LOGIN_USERNAME;
  const password = process.env.VERIFY_LOGIN_PASSWORD;
  if (username && password) {
    await page.getByText('账号密码登录', { exact: true }).click();
    await page.locator('#login-user').fill(username);
    await page.locator('#login-pass').fill(password);
    await page.locator('form').filter({ has: page.locator('#login-user') }).locator('button[type=submit]').click();
  }
}
let waitError = '';
try { await page.waitForFunction(() => document.documentElement.dataset.viewerSceneReady === 'true' && window.__threeScene && window.__threeRenderer, null, { timeout }); }
catch (error) { waitError = error.message; }
const sceneReadySeconds = (Date.now() - started) / 1000;
const state = await page.evaluate(async () => {
  const info = window.__threeRenderer?.info;
  const sampled = { drawCalls: 0, triangles: 0 };
  const originalAutoReset = info?.autoReset;
  if (info) { info.autoReset = false; info.reset(); }
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  if (info) {
    sampled.drawCalls = Math.round(info.render.calls / 10);
    sampled.triangles = Math.round(info.render.triangles / 10);
    info.autoReset = originalAutoReset;
    info.reset();
  }
  return {
    readyState: document.readyState,
    loading92: document.body.innerText.includes('92%'),
    canvasCount: document.querySelectorAll('canvas').length,
    sceneReady: document.documentElement.dataset.viewerSceneReady,
    meshCount: Number(document.documentElement.dataset.viewerMeshCount || 0),
    scene: Boolean(window.__threeScene),
    renderer: Boolean(window.__threeRenderer),
    render: info ? { ...sampled, geometries: info.memory.geometries, textures: info.memory.textures } : null,
    resources: performance.getEntriesByType('resource').map((entry) => entry.name),
  };
});
const index = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const expectedBundle = index.match(/assets\/(index-[^"']+\.js)/)?.[1] || '';
const criticalErrors = consoleErrors.filter((item) => !/Texture .* unavailable/i.test(item));
const errors = [];
if (navigationError) errors.push(`navigation failed: ${navigationError}`);
if (waitError) errors.push(`sceneReady timeout: ${waitError}`);
if (!state.canvasCount || !state.scene || !state.renderer || state.meshCount <= 0 || state.loading92) errors.push('R3F runtime is not ready');
if (expectedBundle && !state.resources.some((item) => item.includes(expectedBundle))) errors.push(`online bundle does not match dist: ${expectedBundle}`);
if (criticalErrors.length || failed.length) errors.push('console or network contains critical errors');
if (sceneReadySeconds > 45) errors.push(`sceneReady ${sceneReadySeconds.toFixed(1)}s > 45s`);
else if (sceneReadySeconds > 20) console.warn(`[verify:browser] warning: sceneReady ${sceneReadySeconds.toFixed(1)}s > 20s`);
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'quality-budget.json'), 'utf8')).runtimeBaseline || {};
for (const [key, actual] of Object.entries(state.render || {})) {
  const expected = baseline[key];
  if (Number.isFinite(expected) && actual > expected * (1 + (baseline.growthPercent || 15) / 100)) errors.push(`${key} ${actual} grew more than ${baseline.growthPercent || 15}% from ${expected}`);
}
const report = { ok: errors.length === 0, url, mode, sceneReadySeconds, state, baseline, expectedBundle, consoleErrors, failed, errors };
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/browser-acceptance.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await page.close(); await browser.close();
if (errors.length) process.exitCode = 1;
