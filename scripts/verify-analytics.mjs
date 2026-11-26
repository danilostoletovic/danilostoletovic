import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { site } from '../src/data/public.ts';
import { analytics } from '../src/config/security.ts';

const url = new URL(process.env.VERIFY_URL || site);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  const issues = [];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Audits.enable');
  cdp.on('Audits.issueAdded', ({ issue }) => issues.push(issue.code));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.url()} ${request.failure()?.errorText}`));
  const incoming = page.waitForResponse(response => response.url() === analytics.collector + '/api/send' && response.request().method() === 'POST');
  // A failed navigation can end this run before the response promise is awaited.
  incoming.catch(() => {});
  const document = await page.goto(url.href, { waitUntil: 'load' });
  assert.equal(document?.status(), 200);
  const event = await incoming;
  assert.ok(event.ok(), `Umami collection returned HTTP ${event.status()}`);
  assert.equal(event.request().postDataJSON().payload.website, analytics.websiteId);
  console.log(`Umami accepted a ${url.hostname} page view with HTTP ${event.status()}.`);
  assert.deepEqual(errors, [], 'Browser console or network errors');
  assert.deepEqual(issues, [], 'Chrome DevTools Issues');
} finally {
  await browser.close();
}
