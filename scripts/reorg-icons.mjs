import {
  readdirSync,
  statSync,
  renameSync,
  mkdirSync,
  existsSync,
  rmSync,
  readFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(REPO_ROOT, 'icons');
const LEGACY_DIR = path.join(ICONS_DIR, 'm365');

const DRY_RUN = process.argv.includes('--dry-run');

const resolveSourcePath = () => {
  const candidates = [
    process.env.PIGLYPHS_SOURCE,
    path.resolve(REPO_ROOT, '../pi-space/app/src/components/dashboard/ProLogoManagerWidget.jsx'),
    '/Users/I741344/GitHub/anthonyrhopkins/pi-space/app/src/components/dashboard/ProLogoManagerWidget.jsx'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate ProLogoManagerWidget.jsx. Set PIGLYPHS_SOURCE to the file path.');
};

const slugify = (value) => {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
};

const LIBRARY_SLUG_MAP = {
  'Microsoft 365': 'microsoft-365',
  'AI': 'ai',
  'Third Party': 'third-party',
  'SAP': 'sap',
  'Security': 'security',
  'Azure': 'azure',
  'PiDEAS': 'pideas'
};

const extractCategories = (sourcePath) => {
  const content = readFileSync(sourcePath, 'utf8');
  const marker = 'const ALL_ICON_CATEGORIES';
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Could not find ALL_ICON_CATEGORIES in ${sourcePath}`);
  }

  const braceStart = content.indexOf('{', markerIndex);
  if (braceStart === -1) {
    throw new Error('Could not locate opening brace for ALL_ICON_CATEGORIES');
  }

  let depth = 0;
  let inString = null;
  let escaped = false;
  let endIndex = -1;

  for (let i = braceStart; i < content.length; i += 1) {
    const char = content[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error('Failed to parse ALL_ICON_CATEGORIES block');
  }

  const objectLiteral = content.slice(braceStart, endIndex + 1);
  return vm.runInNewContext(`(${objectLiteral})`, {});
};

const getShard = (name, length = 1) => {
  const safe = (name || '').replace(/[^a-zA-Z0-9]/g, '');
  const shard = safe.slice(0, length).toLowerCase();
  if (!shard) {
    return '_';
  }
  return shard.padEnd(length, '_');
};

const uiFamilyFromFile = (fileName) => {
  if (/^tabler[_-]/i.test(fileName)) return 'tabler';
  if (/^fa_solid_/i.test(fileName)) return 'fontawesome-solid';
  if (/^fa_brand_/i.test(fileName)) return 'fontawesome-brand';
  if (/^fa[_-]/i.test(fileName)) return 'fontawesome-other';
  if (/^mdi[_-]/i.test(fileName)) return 'mdi';
  if (/^lucide[_-]/i.test(fileName)) return 'lucide';
  if (/^phosphor[_-]/i.test(fileName)) return 'phosphor';
  if (/^cssgg[_-]/i.test(fileName)) return 'cssgg';
  if (/^heroicons[_-]/i.test(fileName)) return 'heroicons';
  if (/^feather[_-]/i.test(fileName)) return 'feather';
  if (/^ionicons[_-]/i.test(fileName)) return 'ionicons';
  if (/^octicons[_-]/i.test(fileName)) return 'octicons';
  if (/^eva[_-]/i.test(fileName)) return 'eva';
  if (/^bootstrap[_-]/i.test(fileName)) return 'bootstrap';
  if (/^remix[_-]/i.test(fileName)) return 'remix';
  if (/^brand[_-]/i.test(fileName)) return 'brand';
  return null;
};

const uiShardFromFile = (fileName, family) => {
  if (family === 'tabler') {
    const rest = fileName.replace(/^tabler[_-]/i, '');
    return getShard(rest, 1);
  }

  if (family === 'fontawesome-solid') {
    const rest = fileName.replace(/^fa_solid_/i, '');
    return path.join('solid', getShard(rest, 1));
  }

  if (family === 'fontawesome-brand') {
    const rest = fileName.replace(/^fa_brand_/i, '');
    return path.join('brand', getShard(rest, 1));
  }

  if (family === 'fontawesome-other') {
    const rest = fileName.replace(/^fa[_-]/i, '');
    return path.join('other', getShard(rest, 1));
  }

  const patterns = [
    [/^mdi[_-]/i, 'mdi'],
    [/^lucide[_-]/i, 'lucide'],
    [/^phosphor[_-]/i, 'phosphor'],
    [/^cssgg[_-]/i, 'cssgg'],
    [/^heroicons[_-]/i, 'heroicons'],
    [/^feather[_-]/i, 'feather'],
    [/^ionicons[_-]/i, 'ionicons'],
    [/^octicons[_-]/i, 'octicons'],
    [/^eva[_-]/i, 'eva'],
    [/^bootstrap[_-]/i, 'bootstrap'],
    [/^remix[_-]/i, 'remix'],
    [/^brand[_-]/i, 'brand']
  ];

  for (const [regex] of patterns) {
    if (regex.test(fileName)) {
      const rest = fileName.replace(regex, '');
      return getShard(rest, 1);
    }
  }

  return getShard(fileName, 1);
};

const moveFile = (src, dest) => {
  if (src === dest) return;
  const destDir = path.dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  if (existsSync(dest)) {
    return;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] ${src} -> ${dest}`);
    return;
  }
  renameSync(src, dest);
};

const main = () => {
  if (!existsSync(LEGACY_DIR)) {
    throw new Error(`Legacy folder not found: ${LEGACY_DIR}`);
  }

  const sourcePath = resolveSourcePath();
  const categories = extractCategories(sourcePath);
  const iconMap = new Map();

  for (const [categoryName, categoryData] of Object.entries(categories)) {
    const icons = Array.isArray(categoryData.icons) ? categoryData.icons : [];
    for (const iconFile of icons) {
      if (!iconMap.has(iconFile)) {
        iconMap.set(iconFile, {
          categoryName,
          library: categoryData.library || 'Uncategorized',
          description: categoryData.description || ''
        });
      }
    }
  }

  const files = readdirSync(LEGACY_DIR)
    .filter((file) => statSync(path.join(LEGACY_DIR, file)).isFile());

  for (const fileName of files) {
    const src = path.join(LEGACY_DIR, fileName);
    const category = iconMap.get(fileName);

    if (category) {
      const librarySlug = LIBRARY_SLUG_MAP[category.library] || slugify(category.library);
      if (librarySlug === 'pideas') {
        moveFile(src, path.join(ICONS_DIR, 'pideas', fileName));
        continue;
      }

      const categorySlug = slugify(category.categoryName);
      moveFile(src, path.join(ICONS_DIR, librarySlug, categorySlug, fileName));
      continue;
    }

    if (/^sap/i.test(fileName)) {
      moveFile(src, path.join(ICONS_DIR, 'sap', 'legacy', fileName));
      continue;
    }

    const uiFamily = uiFamilyFromFile(fileName);
    if (uiFamily) {
      const shard = uiShardFromFile(fileName, uiFamily);
      const baseFamily = uiFamily.startsWith('fontawesome-') ? 'fontawesome' : uiFamily;
      moveFile(src, path.join(ICONS_DIR, 'ui', baseFamily, shard, fileName));
      continue;
    }

    const shard = path.join(getShard(fileName, 1), getShard(fileName, 2));
    moveFile(src, path.join(ICONS_DIR, 'uncategorized', shard, fileName));
  }

  const remaining = readdirSync(LEGACY_DIR).filter((file) =>
    statSync(path.join(LEGACY_DIR, file)).isFile()
  );

  if (remaining.length === 0 && !DRY_RUN) {
    rmSync(LEGACY_DIR, { recursive: true, force: true });
  }

  console.log(`Reorg complete. Remaining legacy files: ${remaining.length}`);
};

main();
