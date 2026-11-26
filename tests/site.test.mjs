import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const origin = process.env.VERIFY_URL || 'http://127.0.0.1:8787';
const get = (path, options) => fetch(new URL(path, origin), options);
const site = 'https://danilostoletovic.com';

test('sitemap URLs are static canonical pages with validated identity', async () => {
  const response = await get('/sitemap.xml');
  assert.equal(response.status, 200);
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
  assert.ok(paths.length >= 25);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(!paths.some(path => /404|\.json|mcp\/$/.test(path)));
  const profile = await (await get('/profile.json')).json();
  for (const path of paths) {
    const page = await get(path, { redirect: 'manual' });
    assert.equal(page.status, 200, path);
    assert.ok(page.headers.get('content-security-policy')?.includes("default-src 'none'"));
    const html = await page.text();
    assert.ok(html.includes(`<link rel="canonical" href="${site + path}">`), path);
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, path);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1])['@graph'];
    const identity = graph.find(node => node['@id'] === site + '/#person');
    assert.equal(identity.name, profile.name);
    assert.equal(identity.telephone, profile.telephone);
    assert.deepEqual(identity.sameAs, profile.profiles.filter(item => item.identity === 'personal').map(item => item.url));
    assert.ok(!html.includes('landscape.avif'));
  }
});

test('professional telephone is consistent across public formats', async () => {
  const profile = await (await get('/profile.json')).json();
  assert.match(profile.telephone, /^\+381\d{9}$/);
  assert.equal(profile.contact.telephone, profile.telephone);
  assert.equal((await (await get('/contact.json')).json()).telephone, profile.telephone);
  for (const path of ['/', '/commerce/', '/cv/']) {
    const html = await (await get(path)).text();
    assert.ok(html.includes(`href="tel:${profile.telephone}"`), path);
    assert.ok(html.includes(profile.telephone.replace(/^(\+381)(\d{2})(\d{3})(\d{4})$/, '$1 $2 $3 $4')), path);
  }
  for (const path of ['/profile.md', '/llms.txt', '/llms-full.txt']) {
    assert.ok((await (await get(path)).text()).includes(profile.telephone), path);
  }
  const ana = await (await get('/ana-knowledge.json')).json();
  assert.ok(ana.profile.includes(profile.telephone));
  const pdf = Buffer.from(await (await get('/cv.pdf')).arrayBuffer()).toString('latin1');
  assert.ok(pdf.includes(`tel:${profile.telephone}`));
});

test('the SmartVehicle paper is citable across the catalogue, website, and downloads', async () => {
  const profile = await (await get('/profile.json')).json();
  const works = await (await get('/publications.json')).json();
  assert.deepEqual(profile.publications, works);
  const work = works.find(item => item.project === 'smart-vehicle' && item.status === 'Published');
  assert.ok(work);
  assert.equal(work.authors[0], profile.name);
  assert.equal(work.authorDetails[0].orcidUrl, profile.orcidUrl);
  const path = new URL(work.url).pathname;
  const response = await get(path, { redirect: 'manual' });
  assert.equal(response.status, 200);
  const html = await response.text();
  const head = html.slice(0, html.indexOf('</head>'));
  assert.deepEqual([...head.matchAll(/name="citation_author" content="([^"]+)"/g)].map(match => match[1]), work.authors);
  for (const [name, value] of [
    ['title', work.title], ['publication_date', work.date], ['conference_title', work.venue],
    ['isbn', work.proceedings.isbn], ['firstpage', work.proceedings.firstPage], ['doi', work.doi],
  ]) assert.ok(head.includes(`name="citation_${name}" content="${value}"`), name);
  assert.ok(html.includes(`href="${work.doiUrl}"`));
  assert.doesNotMatch(head, /citation_lastpage|citation_publisher|citation_pdf_url/);
  const graph = JSON.parse(head.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1])['@graph'];
  const identity = graph.find(node => node['@type'] === 'Person');
  const article = graph.find(node => node['@type'] === 'ScholarlyArticle');
  assert.equal(identity.identifier.value, profile.orcid);
  assert.equal(identity.identifier.url, profile.orcidUrl);
  assert.deepEqual(article.author[0], { '@id': identity['@id'] });
  assert.equal(article.author[1].name, work.authors[1]);
  assert.equal(article.identifier.url, work.doiUrl);
  assert.equal(article.isPartOf.isbn, work.proceedings.isbn);
  assert.equal(article.pageStart, work.proceedings.firstPage);
  assert.equal(article.pageEnd, undefined);
  assert.deepEqual(article.isPartOf.about.organizer.map(item => item.name), work.proceedings.organizers);
  assert.equal(article.isPartOf.publisher, undefined);
  for (const target of ['/academia/', '/side-projects/smart-vehicle/', '/cv/']) {
    assert.ok((await (await get(target)).text()).includes(work.title), target);
  }
  for (const target of ['/profile.md', '/llms.txt', '/llms-full.txt']) {
    const text = await (await get(target)).text();
    for (const token of [work.title, work.doiUrl, work.proceedings.isbn, profile.orcidUrl]) assert.ok(text.includes(token), target);
  }
  assert.ok((await (await get('/ana-knowledge.json')).json()).profile.includes(work.doiUrl));
  for (const [file, mime] of [['citation.bib', 'application/x-bibtex'], ['citation.ris', 'application/x-research-info-systems']]) {
    const download = await get(path + file, { redirect: 'manual' });
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-type'), new RegExp('^' + mime));
    const text = await download.text();
    for (const token of [work.title, work.doi, work.proceedings.isbn, String(work.proceedings.firstPage)]) assert.ok(text.includes(token), file);
    const firstAuthor = work.authorDetails[0].familyName + ', ' + work.authorDetails[0].givenName;
    const secondAuthor = work.authorDetails[1].familyName + ', ' + work.authorDetails[1].givenName;
    assert.ok(text.indexOf(firstAuthor) >= 0 && text.indexOf(firstAuthor) < text.indexOf(secondAuthor), file);
  }
});

test('artifacts, redirects, and missing paths return the right HTTP responses', async () => {
  for (const [path, prefix] of [
    ['/profile.json', 'application/json'], ['/profile.md', 'text/markdown'], ['/llms.txt', 'text/plain'],
    ['/cv.pdf', 'application/pdf'], ['/rss.xml', 'application/rss+xml'], ['/site.webmanifest', 'application/manifest+json'],
    ['/robots.txt', 'text/plain'],
  ]) {
    const response = await get(path, { redirect: 'manual' });
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type')?.startsWith(prefix), path);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile('dist' + path));
  }
  const robots = await (await get('/robots.txt')).text();
  assert.ok(robots.includes('Allow: /'));
  assert.ok(robots.includes(site + '/sitemap.xml'));
  for (const [previous, next] of [
    ['/en/', '/'], ['/sr/', '/'], ['/blog', '/news/'], ['/favicon.ico', '/brand/favicon.png'],
    ['/en/case-studies/smart-vehicle/', '/case/smart-vehicle/'],
    ['/sr/services/ai-integrations', '/commerce/ai-integrations/'],
  ]) {
    const response = await get(previous, { redirect: 'manual' });
    assert.equal(response.status, 301, previous);
    assert.equal(new URL(response.headers.get('location'), origin).pathname, next);
    assert.equal((await get(next)).status, 200);
  }
  const missing = await get('/no-such-professional-page/');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Page not found/);
});
