import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(REPO_ROOT, 'icons');
const OUTPUT_DIR = path.join(REPO_ROOT, 'metadata');

const DEFAULT_FOLDER = 'm365';
const PIDEAS_FOLDER = 'pideas';

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

const GENERATED_AT = new Date().toISOString();

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

    if (char === '"' || char === '\'') {
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
  const categories = vm.runInNewContext(`(${objectLiteral})`, {});

  return categories;
};

const main = () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const sourcePath = resolveSourcePath();
  const categories = extractCategories(sourcePath);

  const pideasPath = path.join(ICONS_DIR, PIDEAS_FOLDER);
  if (existsSync(pideasPath)) {
    const pideasIcons = readdirSync(pideasPath)
      .filter((file) => !file.startsWith('.'))
      .sort((a, b) => a.localeCompare(b));

    if (pideasIcons.length > 0) {
      categories.PiDEAS = {
        description: 'PiDEAS Studio brand marks and core symbols',
        library: 'PiDEAS',
        folder: PIDEAS_FOLDER,
        icons: pideasIcons
      };
    }
  }

  const catalog = [];
  const categoryIndex = {};

  Object.entries(categories).forEach(([categoryName, categoryData]) => {
    const folder = categoryData.folder || DEFAULT_FOLDER;
    const iconList = Array.isArray(categoryData.icons) ? categoryData.icons : [];

    categoryIndex[categoryName] = {
      description: categoryData.description || '',
      library: categoryData.library || 'Uncategorized',
      isNew: Boolean(categoryData.isNew),
      folder,
      iconCount: iconList.length
    };

    iconList.forEach((iconFile) => {
      const extension = path.extname(iconFile).replace('.', '').toLowerCase();
      const baseName = iconFile.replace(/\.[^/.]+$/, '');
      const relativePath = `${folder}/${iconFile}`;
      const fullPath = path.join(ICONS_DIR, relativePath);
      const exists = existsSync(fullPath);
      const sizeBytes = exists ? statSync(fullPath).size : 0;
      const tags = Array.from(new Set([
        ...toTokens(baseName),
        ...toTokens(categoryName),
        ...toTokens(categoryData.library)
      ]));

      catalog.push({
        id: relativePath,
        name: baseName,
        title: toTitle(baseName),
        fileName: iconFile,
        extension,
        category: categoryName,
        description: categoryData.description || '',
        library: categoryData.library || 'Uncategorized',
        isNew: Boolean(categoryData.isNew),
        folder,
        path: relativePath,
        sizeBytes,
        tags,
        source: 'pi-space-logo-manager',
        exists
      });
    });
  });

  const output = {
    version: 1,
    generatedAt: GENERATED_AT,
    defaultFolder: DEFAULT_FOLDER,
    source: path.basename(sourcePath),
    totalIcons: catalog.length,
    icons: catalog
  };

  const categoryOutput = {
    version: 1,
    generatedAt: GENERATED_AT,
    defaultFolder: DEFAULT_FOLDER,
    source: path.basename(sourcePath),
    categories: categoryIndex
  };

  writeFileSync(path.join(OUTPUT_DIR, 'catalog.json'), JSON.stringify(output, null, 2));
  writeFileSync(path.join(OUTPUT_DIR, 'categories.json'), JSON.stringify(categoryOutput, null, 2));

  console.log(`Generated ${catalog.length} icon entries.`);
};

main();
