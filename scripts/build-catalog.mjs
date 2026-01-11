import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  existsSync,
  readdirSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(REPO_ROOT, 'icons');
const OUTPUT_DIR = path.join(REPO_ROOT, 'metadata');

const GENERATED_AT = new Date().toISOString();

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

const toTokens = (value) => {
  if (!value) return [];
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
};

const toTitle = (value) => {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

const slugify = (value) => {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
};

const COLLECTION_META = {
  'microsoft-365': { source: 'Microsoft', license: 'Trademark', brandOwner: 'Microsoft' },
  azure: { source: 'Microsoft', license: 'Trademark', brandOwner: 'Microsoft' },
  security: { source: 'Microsoft', license: 'Trademark', brandOwner: 'Microsoft' },
  sap: { source: 'SAP', license: 'Trademark', brandOwner: 'SAP' },
  ai: { source: 'Various', license: 'Trademark', brandOwner: 'Various' },
  'third-party': { source: 'Various', license: 'Trademark', brandOwner: 'Various' },
  ui: { source: 'Various', license: 'Varies', brandOwner: 'Various' },
  pideas: { source: 'PiDEAS Studio', license: 'Proprietary', brandOwner: 'PiDEAS Studio' },
  uncategorized: { source: 'Unknown', license: 'Unknown', brandOwner: 'Unknown' }
};

const UI_META = {
  tabler: { source: 'Tabler Icons', license: 'MIT', brandOwner: 'Tabler' },
  fontawesome: { source: 'Font Awesome Free', license: 'CC BY 4.0', brandOwner: 'Fonticons' },
  mdi: { source: 'Material Design Icons', license: 'Apache-2.0', brandOwner: 'Templarian' },
  lucide: { source: 'Lucide', license: 'ISC', brandOwner: 'Lucide' },
  phosphor: { source: 'Phosphor Icons', license: 'MIT', brandOwner: 'Phosphor' },
  cssgg: { source: 'css.gg', license: 'MIT', brandOwner: 'css.gg' },
  heroicons: { source: 'Heroicons', license: 'MIT', brandOwner: 'Tailwind Labs' },
  feather: { source: 'Feather', license: 'MIT', brandOwner: 'Feather' },
  ionicons: { source: 'Ionicons', license: 'MIT', brandOwner: 'Ionic' },
  octicons: { source: 'Octicons', license: 'MIT', brandOwner: 'GitHub' },
  eva: { source: 'Eva Icons', license: 'MIT', brandOwner: 'Akveo' },
  bootstrap: { source: 'Bootstrap Icons', license: 'MIT', brandOwner: 'Bootstrap' },
  remix: { source: 'Remix Icon', license: 'Apache-2.0', brandOwner: 'Remix Design' },
  brand: { source: 'Brand Icons', license: 'Trademark', brandOwner: 'Various' }
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

const walk = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const inferStyle = (fileName, extension, collection, uiSet) => {
  const lower = fileName.toLowerCase();
  if (lower.includes('color') || extension === 'png') return 'color';
  if (lower.includes('filled') || lower.includes('fill')) return 'filled';
  if (collection === 'ui') return 'line';
  if (uiSet) return 'line';
  return 'flat';
};

const main = () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const sourcePath = resolveSourcePath();
  const categories = extractCategories(sourcePath);
  const iconCategoryMap = new Map();
  const categoryMeta = new Map();

  for (const [categoryName, categoryData] of Object.entries(categories)) {
    const icons = Array.isArray(categoryData.icons) ? categoryData.icons : [];
    const library = categoryData.library || 'Uncategorized';
    const description = categoryData.description || '';
    const isNew = Boolean(categoryData.isNew);

    categoryMeta.set(categoryName, { library, description, isNew });

    for (const iconFile of icons) {
      if (!iconCategoryMap.has(iconFile)) {
        iconCategoryMap.set(iconFile, { categoryName, library, description, isNew });
      }
    }
  }

  const catalog = [];
  const categoryIndex = new Map();
  const files = walk(ICONS_DIR).filter((file) => !path.basename(file).startsWith('.'));

  for (const filePath of files) {
    const relativePath = path.relative(ICONS_DIR, filePath).split(path.sep).join('/');
    const segments = relativePath.split('/');
    const collection = segments[0] || 'uncategorized';
    const fileName = segments[segments.length - 1];
    const extension = path.extname(fileName).replace('.', '').toLowerCase();
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    const categoryInfo = iconCategoryMap.get(fileName);
    const inferredCategory = segments.length > 2 ? toTitle(segments[1]) : toTitle(collection);
    const categoryName = categoryInfo?.categoryName || inferredCategory;
    const library = categoryInfo?.library || toTitle(collection);
    const description = categoryInfo?.description || '';
    const isNew = Boolean(categoryInfo?.isNew);

    const uiSet = collection === 'ui' ? segments[1] : null;
    const collectionMeta = COLLECTION_META[collection] || { source: 'Unknown', license: 'Unknown', brandOwner: 'Unknown' };
    const uiMeta = uiSet ? UI_META[uiSet] : null;

    const source = uiMeta?.source || collectionMeta.source;
    const license = uiMeta?.license || collectionMeta.license;
    const brandOwner = uiMeta?.brandOwner || collectionMeta.brandOwner;
    const style = inferStyle(fileName, extension, collection, uiSet);

    const tags = Array.from(new Set([
      ...toTokens(baseName),
      ...toTokens(categoryName),
      ...toTokens(library),
      ...toTokens(collection),
      ...(uiSet ? toTokens(uiSet) : [])
    ]));

    const sizeBytes = statSync(filePath).size;

    catalog.push({
      id: relativePath,
      name: baseName,
      title: toTitle(baseName),
      fileName,
      extension,
      category: categoryName,
      description,
      library,
      collection,
      uiSet,
      isNew,
      path: relativePath,
      sizeBytes,
      tags,
      source,
      license,
      brandOwner,
      style
    });

    const categoryKey = `${collection}::${categoryName}`;
    const entry = categoryIndex.get(categoryKey) || {
      id: slugify(categoryKey),
      name: categoryName,
      library,
      collection,
      description,
      iconCount: 0,
      uiSet
    };
    entry.iconCount += 1;
    categoryIndex.set(categoryKey, entry);
  }

  catalog.sort((a, b) => a.path.localeCompare(b.path));

  const output = {
    version: 2,
    generatedAt: GENERATED_AT,
    source: path.basename(sourcePath),
    totalIcons: catalog.length,
    icons: catalog
  };

  const categoryOutput = {
    version: 2,
    generatedAt: GENERATED_AT,
    source: path.basename(sourcePath),
    totalCategories: categoryIndex.size,
    categories: Array.from(categoryIndex.values()).sort((a, b) => a.name.localeCompare(b.name))
  };

  writeFileSync(path.join(OUTPUT_DIR, 'catalog.json'), JSON.stringify(output, null, 2));
  writeFileSync(path.join(OUTPUT_DIR, 'categories.json'), JSON.stringify(categoryOutput, null, 2));

  console.log(`Generated ${catalog.length} icon entries across ${categoryIndex.size} categories.`);
};

main();
