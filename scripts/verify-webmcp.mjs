import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { discovery } from '../src/config/discovery.ts';
import { analytics, ana } from '../src/config/security.ts';

const origin = process.env.VERIFY_URL || 'http://127.0.0.1:8787';
const manifest = await (await fetch(new URL(discovery.webmcp.path, origin))).json();
const names = manifest.tools.map(tool => tool.name);
const browser = await chromium.launch({ args: [
  '--enable-features=WebMCP', '--enable-blink-features=WebMCP,DeclarativeWebMCP,WebMCPWaitForToolsUntil',
] });
try {
  const context = await browser.newContext();
  await context.route(analytics.script, route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  let submitted = 0;
  await context.route(ana.endpoint, async route => {
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type,accept-language', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    submitted++;
    return route.fulfill({ headers, json: { reply: 'The public portfolio lists software development services.' } });
  });
  const page = await context.newPage();
  await page.goto(origin + '/commerce/');
  for (const form of Object.values(manifest.forms)) {
    const element = page.locator(`form[toolname="${form.name}"]`);
    assert.equal(await element.getAttribute('tooldescription'), form.description);
    assert.equal(await element.evaluate(node => node.hasAttribute('toolautosubmit')), form.autoSubmit);
    for (const [field, description] of Object.entries(form.fields)) {
      assert.equal(await element.locator(`[name="${field}"]`).getAttribute('toolparamdescription'), description);
    }
  }

  // CDP lets a scripted submit run without Playwright's default evaluation user gesture.
  const session = await context.newCDPSession(page);
  const scripted = 'document.querySelector("#ana-message").value = "What services are available?"; document.querySelector("#ana-form").requestSubmit()';
  await session.send('Runtime.evaluate', { expression: scripted, userGesture: false });
  await page.getByText('Review the question and click Ask Ana to send it.').waitFor();
  assert.equal(submitted, 0);
  await page.getByRole('button', { name: 'Ask Ana' }).click();
  await page.getByText('The public portfolio lists software development services.').waitFor();
  assert.equal(submitted, 1);

  const native = await page.evaluate(() => typeof (document.modelContext ?? navigator.modelContext)?.getTools === 'function');
  if (!native) {
    console.log('Native WebMCP tool enumeration unavailable in this browser. Running registration contract with a stub.');
    await context.addInitScript(() => {
      window.testTools = new Map();
      Object.defineProperty(document, 'modelContext', {
        value: {
          registerTool: tool => window.testTools.set(tool.name, tool),
          getTools: async () => [...window.testTools.values()],
          executeTool: async (tool, input) => tool.execute(input),
        },
      });
    });
    await page.reload();
  }
  await page.waitForFunction(async expected => {
    const tools = await (document.modelContext ?? navigator.modelContext).getTools();
    return expected.every(name => tools.some(tool => tool.name === name));
  }, native ? [...names, ...Object.values(manifest.forms).map(form => form.name)] : names);
  const results = await page.evaluate(async () => {
    const api = document.modelContext ?? navigator.modelContext;
    const list = await api.getTools();
    const run = async (name, input) => {
      const tool = list.find(tool => tool.name === name);
      const result = await api.executeTool(tool, input);
      return typeof result === 'string' ? JSON.parse(result) : result;
    };
    return {
      estimate: await run('estimate_budget', { scope: 'Website', budget: 1000 }),
      projects: await run('list_projects', { category: 'Apps', limit: 1 }),
      services: await run('list_services', { limit: 1 }),
      contact: await run('get_contact', {}),
      profile: await run('get_profile', {}),
    };
  });
  assert.equal(results.estimate.budget, 1000);
  assert.equal(results.projects.items[0].category, 'Apps');
  assert.equal(results.projects.items.length, 1);
  assert.equal(results.services.items.length, 1);
  assert.equal(results.contact.email, (await (await fetch(origin + '/contact.json')).json()).email);
  assert.equal(results.profile.name, (await (await fetch(origin + '/profile.json')).json()).name);
  if (native) {
    const preview = await page.evaluate(async name => {
      const api = document.modelContext ?? navigator.modelContext;
      const tool = (await api.getTools()).find(tool => tool.name === name);
      const result = await api.executeTool(tool, { scope: 'Website', budget: 1000 });
      return typeof result === 'string' ? JSON.parse(result) : result;
    }, manifest.forms.budget.name);
    assert.equal(preview.budget, 1000);
    assert.match(await page.locator('#budget-example').textContent(), /€1,000 planning budget/);
    assert.equal(submitted, 1, 'Local estimation never contacts Ana');
  }
  console.log(`Verified ${names.length} imperative tools, both declarative form contracts, and Ana’s submission gate in ${native ? 'native Chromium' : 'the registration stub'}.`);
} finally {
  await browser.close();
}
