export const indexNowManifestPath = '/indexnow-manifest.json';
export const deploymentVersionPath = '/deployment-version.txt';

export type IndexNowManifest = {
  version: 1;
  release: string;
  urls: Record<string, string>;
};

export function deploymentVersion() {
  return process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.INDEXNOW_DEPLOY_SHA || 'local';
}

export function indexNowKey() {
  const key = process.env.INDEXNOW_KEY;
  if (key && !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    throw new Error('INDEXNOW_KEY must contain 8–128 letters, digits or hyphens.');
  }
  return key || undefined;
}

export const indexNowKeyPath = (key: string) => `/${key}.txt`;
