export const markdownPages = ['cv', 'links', 'mcp-info', 'news'] as const;
export const markdownCollections = ['academia', 'case', 'commerce', 'side-projects'] as const;
export const markdownAssetPath = (section: string, id?: string) => `/markdown/${section}${id ? '/' + id : ''}.md`;

export function markdownPath(page: string) {
  if (page === '/') return '/profile.md';
  const match = /^\/([a-z-]+)(?:\/([a-z0-9-]+))?\/$/.exec(page);
  if (!match) return undefined;
  const [, section, id] = match;
  if (markdownCollections.some(name => name === section) || (!id && markdownPages.some(name => name === section))) {
    return markdownAssetPath(section, id);
  }
}

export const markdownWorkerRoutes = [
  '/', ...markdownPages.map(page => `/${page}/`), ...markdownCollections.map(section => `/${section}/*`),
];
