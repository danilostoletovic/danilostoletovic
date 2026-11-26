import { discovery } from '../src/config/discovery';
import { markdownPath } from '../src/config/markdown';

const htmlType = 'text/html';

export function chooseRepresentation(accept: string | null) {
  if (!accept?.trim() || accept.length > 4096) return 'html';
  const ranges = accept.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((range, order) => {
    const [type, ...parameters] = range.toLowerCase().split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(part => part.trim());
    const qualityIndex = parameters.findIndex(part => /^q\s*=/.test(part));
    const quality = qualityIndex < 0 ? '1' : parameters[qualityIndex].replace(/^q\s*=\s*/, '');
    const mediaParams = parameters.slice(0, qualityIndex < 0 ? undefined : qualityIndex);
    return {
      type, order,
      specificity: type === '*/*' ? 0 : type === 'text/*' ? 1 : 2,
      q: /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality) ? Number(quality) : 0,
      mediaParams: mediaParams.length,
      compatible: mediaParams.every(part => /^charset\s*=\s*(?:"utf-8"|utf-8)$/.test(part)),
    };
  });
  const best = (type: string) => ranges
    .filter(range => range.compatible && [type, 'text/*', '*/*'].includes(range.type))
    .sort((a, b) => b.specificity - a.specificity || b.mediaParams - a.mediaParams || a.order - b.order)[0];
  const markdown = best(discovery.markdownType);
  const html = best(htmlType);
  if (markdown?.q && (!html?.q || markdown.q > html.q || (markdown.q === html.q &&
      (markdown.specificity > html.specificity || (markdown.type === discovery.markdownType && markdown.order < html.order))))) {
    return 'markdown';
  }
  return html?.q ? 'html' : 'unacceptable';
}

type Assets = { fetch(request: Request): Promise<Response> };

export async function servePage(request: Request, assets: Assets) {
  const url = new URL(request.url);
  const file = markdownPath(url.pathname);
  if (!file || (request.method !== 'GET' && request.method !== 'HEAD')) return assets.fetch(request);
  const selection = chooseRepresentation(request.headers.get('Accept'));
  if (selection === 'html') return assets.fetch(request);

  // Select between distinct asset keys. Never store a negotiated response at the HTML URL.
  const assetUrl = new URL(file, url);
  const markdown = await assets.fetch(new Request(assetUrl, { method: selection === 'unacceptable' ? 'HEAD' : request.method }));
  if (!markdown.ok) {
    await markdown.body?.cancel();
    return assets.fetch(request);
  }
  const headers = new Headers(markdown.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.append('Vary', 'Accept');
  if (selection === 'unacceptable') {
    return new Response(null, { status: 406, headers: {
      Vary: 'Accept', 'Cache-Control': 'private, no-store', Link: headers.get('Link') ?? '',
    } });
  }
  return new Response(markdown.body, { status: markdown.status, headers });
}
