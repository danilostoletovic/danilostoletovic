import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('.research', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
for (const [name, width, height] of [['desktop',1536,1024],['mobile',390,844],['small',320,740]]) {
 await page.setViewportSize({ width, height });
 await page.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle' });
 await page.screenshot({ path: `.research/${name}.png`, fullPage: true });
 const result = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  brokenImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src),
  invalidAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
  language: document.documentElement.lang,
  titleCount: document.querySelectorAll('h1').length,
 }));
 console.log(name, JSON.stringify(result));
 if (result.overflow || result.brokenImages.length || result.invalidAnchors.length || result.language !== 'en' || result.titleCount !== 1) throw Error(`${name} failed`);
 await page.getByRole('link', { name: 'View my work' }).click();
 await page.waitForTimeout(650);
 if (!page.url().endsWith('#projects')) throw Error('Project navigation failed');
}
console.log('contact', await page.locator('.email').getAttribute('href'));
if (await page.locator('.project-links a').count() !== 4) throw Error('Missing project links');
if (await page.locator('.socials a').count() !== 3) throw Error('Missing contact links');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(650);
const headerTop = await page.locator('.header').evaluate(el => el.getBoundingClientRect().top);
if (headerTop < 0 || headerTop > 20) throw Error('Header is not sticky');
if (await page.locator('#blog').innerText() !== 'Blog') throw Error('Blog must remain empty');
console.log('browserErrors', errors);
await browser.close();
if (errors.length) process.exit(1);
