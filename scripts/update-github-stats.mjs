import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(REPO_ROOT, 'metadata', 'github-stats.json');

const repo = process.env.GITHUB_REPOSITORY || 'anthonyrhopkins/PiGlyphs';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: token ? `Bearer ${token}` : undefined,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API ${response.status}: ${message}`);
  }

  return response.json();
};

const main = async () => {
  const baseUrl = `https://api.github.com/repos/${repo}`;
  const [views, clones, releases] = await Promise.all([
    fetchJson(`${baseUrl}/traffic/views`),
    fetchJson(`${baseUrl}/traffic/clones`),
    fetchJson(`${baseUrl}/releases?per_page=100`)
  ]);

  const releaseDownloads = Array.isArray(releases)
    ? releases.reduce(
      (total, release) => total + (release.assets || []).reduce(
        (sum, asset) => sum + (asset.download_count || 0),
        0
      ),
      0
    )
    : 0;

  const payload = {
    generatedAt: new Date().toISOString(),
    periodDays: 14,
    views: {
      count: views.count || 0,
      uniques: views.uniques || 0
    },
    clones: {
      count: clones.count || 0,
      uniques: clones.uniques || 0
    },
    releaseDownloads: {
      total: releaseDownloads
    }
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
