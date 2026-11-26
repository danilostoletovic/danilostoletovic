import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.VERIFY_URL || 'http://127.0.0.1:8787';
const expectedSite = 'https://danilostoletovic.com';
const publications = await (await fetch(origin + '/publications.json')).json();
const publicationPaths = publications.map(work => new URL(work.url).pathname);
const destinations = ['/', '/commerce/', '/academia/', ...publicationPaths, '/side-projects/', '/side-projects/smart-vehicle/', '/case/', '/case/secretary/', '/cv/', '/news/', '/links/', '/mcp-info/'];
const checks = [];
await mkdir('.research/screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  for (const [mode, width, height, colorScheme] of [
    ['desktop-light', 1440, 900, 'light'], ['mobile-dark', 390, 844, 'dark'], ['small-light', 320, 740, 'light'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: 'reduce' });
    await context.route('https://cloud.umami.is/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await context.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(event.violatedDirective));
    });
    const page = await context.newPage();
    const errors = [];
    const linked = new Map();
    page.on('pageerror', error => errors.push(error.message));
    for (const path of mode === 'small-light' ? ['/', '/commerce/'] : destinations) {
      await page.goto(origin + path, { waitUntil: 'load' });
      const result = await page.evaluate(({ origin, expectedSite }) => {
        const links = [...document.querySelectorAll('a[href]')]
          .map(link => new URL(link.href))
          .filter(url => url.origin === origin || url.origin === expectedSite)
          .map(url => url.pathname + url.hash);
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          brokenImages: [...document.images].filter(img => img.complete && img.naturalWidth === 0).map(img => img.src),
          headings: document.querySelectorAll('h1').length,
          language: document.documentElement.lang,
          csp: window.cspViolations,
          links,
        };
      }, { origin, expectedSite });
      assert.equal(result.overflow, false, `${mode} ${path} has horizontal overflow`);
      assert.deepEqual(result.brokenImages, [], `${mode} ${path} image errors`);
      assert.equal(result.headings, 1, path);
      assert.equal(result.language, 'en');
      assert.deepEqual(result.csp, [], `${mode} ${path} CSP`);
      if (mode === 'desktop-light') for (const url of result.links) linked.set(url, path);
      const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      checks.push({ mode, path, passed: report.passes.length, violations: report.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })) });
      if (path === '/' || path === '/commerce/' || publicationPaths.includes(path) || (path === '/side-projects/smart-vehicle/' && mode === 'desktop-light')) {
        await page.screenshot({ path: `.research/screenshots/${mode}-${path.split('/').filter(Boolean).join('-') || 'home'}.png`, fullPage: true });
      }
    }
    if (mode === 'desktop-light') {
      for (const [href, source] of linked) {
        const [path, hash] = href.split('#');
        const response = await context.request.get(origin + path, { maxRedirects: 0 });
        assert.equal(response.status(), 200, `${source} links to ${href}`);
        if (hash) assert.ok((await response.text()).includes(`id="${decodeURIComponent(hash)}"`), `${href} anchor missing`);
        await response.dispose();
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const context = await browser.newContext({ colorScheme: 'dark' });
  await context.route('https://cloud.umami.is/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  let chats = 0;
  await context.route('https://secretary.danilostoletovic.com/chat', async route => {
    const replyHeaders = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: replyHeaders });
    const payload = route.request().postDataJSON();
    assert.equal(payload.history.length, chats ? 2 : 0);
    chats++;
    return route.fulfill({
      status: chats === 1 ? 200 : 503,
      headers: replyHeaders,
      json: { reply: 'Danilo offers web development and deployment. https://danilostoletovic.com/#offers' },
    });
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Skip to content');
  assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).colorScheme), 'dark');
  await page.getByRole('button', { name: 'Theme: system. Switch to light.' }).click();
  await page.getByRole('link', { name: 'Commerce', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.locator('#project-budget').fill('1000');
  assert.match(await page.locator('#budget-example').textContent(), /€1,000 planning budget/);
  assert.match(decodeURIComponent(await page.locator('#budget-inquiry').getAttribute('href')), /Planning budget: €1,000/);
  await page.locator('#project-budget').fill('1');
  assert.match(await page.locator('#budget-example').textContent(), /Enter a budget/);

  await page.getByLabel('Your question').fill('What services are available?');
  await page.getByRole('button', { name: 'Ask Ana' }).click();
  await page.getByText('Danilo offers web development and deployment.').waitFor();
  assert.equal(await page.getByRole('link', { name: 'https://danilostoletovic.com/#offers' }).getAttribute('href'), origin + '/commerce/');
  await page.getByLabel('Your question').fill('Can you share an example?');
  await page.getByRole('button', { name: 'Ask Ana' }).click();
  await page.getByRole('status').filter({ hasText: 'Ana is unavailable' }).waitFor();
  assert.equal(chats, 2);
  await context.close();

  const plainContext = await browser.newContext({ javaScriptEnabled: false });
  const plainPage = await plainContext.newPage();
  await plainPage.goto(origin);
  await plainPage.getByRole('link', { name: 'Commerce', exact: true }).click();
  assert.equal(await plainPage.locator('h1').textContent(), 'Commercial work');
  assert.ok(await plainPage.getByRole('link', { name: 'Discuss a project' }).isVisible());
  await plainContext.close();
} finally {
  await browser.close();
  await writeFile('.research/accessibility.json', JSON.stringify(checks, null, 2));
}
const failures = checks.filter(check => check.violations.length);
assert.deepEqual(failures, []);
console.log(`${checks.length} accessibility and layout checks passed. Navigation, links, themes, budget, and mocked Ana checked.`);
