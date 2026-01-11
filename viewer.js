const CATALOG_URL = 'metadata/catalog.json';
const CATEGORIES_URL = 'metadata/categories.json';
const PAGE_SIZE = 180;
const STORAGE_BASE_URL = 'piglphs.baseUrl';
const STORAGE_SOURCE_MODE = 'piglphs.sourceMode';
const DEFAULT_CDN_BASE = 'https://cdn.jsdelivr.net/gh/anthonyrhopkins/PiGlyphs@main/icons';

const COLLECTION_LABELS = {
  'microsoft-365': 'Microsoft 365',
  azure: 'Azure',
  security: 'Security',
  ai: 'AI',
  sap: 'SAP',
  'third-party': 'Third Party',
  ui: 'UI',
  pideas: 'PiDEAS',
  uncategorized: 'Uncategorized'
};

const KNOWN_SIZES = new Set([16, 20, 24, 28, 32, 36, 40, 48, 64, 72, 96, 128, 256, 512, 1024]);

const state = {
  catalog: [],
  categories: [],
  filtered: [],
  page: 0,
  filters: {
    search: '',
    collection: 'all',
    category: 'all',
    svg: true,
    png: true
  }
};

const dom = {
  searchInput: document.getElementById('searchInput'),
  collectionSelect: document.getElementById('collectionSelect'),
  categorySelect: document.getElementById('categorySelect'),
  filterSvg: document.getElementById('filterSvg'),
  filterPng: document.getElementById('filterPng'),
  sizeRange: document.getElementById('sizeRange'),
  sourceMode: document.getElementById('sourceMode'),
  baseUrlInput: document.getElementById('baseUrlInput'),
  applyBaseUrl: document.getElementById('applyBaseUrl'),
  totalCount: document.getElementById('totalCount'),
  filteredCount: document.getElementById('filteredCount'),
  categoryList: document.getElementById('categoryList'),
  grid: document.getElementById('grid'),
  status: document.getElementById('status'),
  loadMoreButton: document.getElementById('loadMoreButton'),
  toast: document.getElementById('toast'),
  modal: document.getElementById('modal'),
  modalClose: document.getElementById('modalClose'),
  modalImage: document.getElementById('modalImage'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalMeta: document.getElementById('modalMeta'),
  modalTags: document.getElementById('modalTags'),
  modalActions: document.getElementById('modalActions'),
  modalPath: document.getElementById('modalPath')
};

const debounce = (fn, wait = 220) => {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

const toTitle = (value) => {
  if (!value) return '';
  const clean = value.replace(/-/g, ' ').trim();
  return clean.replace(/\b\w/g, (m) => m.toUpperCase());
};

const formatBytes = (value) => {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB'];
  let idx = 0;
  let size = value;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[idx]}`;
};

const getBaseName = (value) => {
  if (!value) return '';
  const parts = value.split('/');
  return parts[parts.length - 1] || value;
};

const parseSizeVariant = (value) => {
  const baseName = getBaseName(value);
  const base = baseName.replace(/\.[^/.]+$/, '');
  const match = base.match(/(?:^|[_-])(\d{2,4})(?:px)?$/);
  if (!match) return null;
  const size = Number(match[1]);
  return KNOWN_SIZES.has(size) ? size : null;
};

const buildFamilyKey = (value) => {
  const baseName = getBaseName(value);
  let base = baseName.replace(/\.[^/.]+$/, '');
  const match = base.match(/(?:^|[_-])(\d{2,4})(?:px)?$/);
  if (match && KNOWN_SIZES.has(Number(match[1]))) {
    base = base.slice(0, match.index);
  }
  return base.toLowerCase();
};

const normalizeBaseUrl = (url) => {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '');
};

const getCdnBaseUrl = () => {
  const direct = normalizeBaseUrl(dom.baseUrlInput?.value || '');
  if (direct) return direct;
  const stored = normalizeBaseUrl(localStorage.getItem(STORAGE_BASE_URL));
  return stored || DEFAULT_CDN_BASE;
};

const setThumbSize = (value) => {
  const numeric = Number(value) || 150;
  const imageSize = Math.max(70, numeric - 30);
  document.documentElement.style.setProperty('--thumb-size', `${numeric}px`);
  document.documentElement.style.setProperty('--thumb-image-size', `${imageSize}px`);
};

const showToast = (message) => {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    dom.toast.classList.remove('visible');
  }, 1400);
};

const isLocalHost = () => {
  const host = window.location.hostname;
  return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
};

const getBaseUrl = () => {
  if (dom.sourceMode.value === 'local') {
    return './icons';
  }
  return normalizeBaseUrl(dom.baseUrlInput.value);
};

const setStatus = (text) => {
  if (!text) {
    dom.status.textContent = '';
    dom.status.style.display = 'none';
    return;
  }
  dom.status.textContent = text;
  dom.status.style.display = 'block';
};

const applySourceMode = () => {
  const mode = dom.sourceMode.value;
  const storedBase = localStorage.getItem(STORAGE_BASE_URL) || '';

  if (mode === 'local') {
    dom.baseUrlInput.value = storedBase || DEFAULT_CDN_BASE;
    dom.baseUrlInput.disabled = true;
    dom.applyBaseUrl.disabled = true;
  } else {
    dom.baseUrlInput.disabled = false;
    dom.applyBaseUrl.disabled = false;
    dom.baseUrlInput.value = storedBase || dom.baseUrlInput.value || DEFAULT_CDN_BASE;
  }

  localStorage.setItem(STORAGE_SOURCE_MODE, mode);
  renderIcons(true);
};

const persistBaseUrl = () => {
  const url = normalizeBaseUrl(dom.baseUrlInput.value);
  if (url) {
    localStorage.setItem(STORAGE_BASE_URL, url);
  }
  renderIcons(true);
};

const buildMetaRows = (icon) => {
  const collectionLabel = COLLECTION_LABELS[icon.collection] || toTitle(icon.collection);
  const repoPath = icon.path ? `icons/${icon.path}` : '';
  const sizeList = Array.isArray(icon.sizeVariants) && icon.sizeVariants.length
    ? icon.sizeVariants.join(', ')
    : (icon.sizeVariant ? String(icon.sizeVariant) : 'Standard');
  const variantCount = icon.familyCount || 1;
  const rows = [
    icon.id ? ['ID', icon.id] : null,
    repoPath ? ['Repo Path', repoPath] : null,
    ['Collection', collectionLabel],
    ['Category', icon.category || 'Uncategorized'],
    ['Library', icon.library || 'Unknown'],
    icon.uiSet ? ['UI Set', icon.uiSet] : null,
    icon.description ? ['Description', icon.description] : null,
    ['Source', icon.source || 'Unknown'],
    icon.brandOwner ? ['Brand Owner', icon.brandOwner] : null,
    ['License', icon.license || 'Unknown'],
    icon.style ? ['Style', icon.style] : null,
    ['File type', icon.extension ? icon.extension.toUpperCase() : 'Unknown'],
    ['File size', formatBytes(icon.sizeBytes)],
    ['Sizes', sizeList],
    ['Variants', String(variantCount)]
  ].filter(Boolean);

  return rows
    .map(([label, value]) => `<div class="label">${label}</div><div>${value}</div>`)
    .join('');
};

const openModal = (icon) => {
  if (!dom.modal) return;
  const previewBaseUrl = getBaseUrl();
  const cdnBaseUrl = getCdnBaseUrl();
  const previewUrl = previewBaseUrl ? `${previewBaseUrl}/${icon.path}` : icon.path;
  const cdnUrl = cdnBaseUrl ? `${cdnBaseUrl}/${icon.path}` : previewUrl;
  const repoPath = `icons/${icon.path}`;
  const collectionLabel = COLLECTION_LABELS[icon.collection] || toTitle(icon.collection);

  dom.modalImage.src = previewUrl;
  dom.modalImage.alt = icon.name || icon.fileName || 'icon';
  dom.modalTitle.textContent = icon.title || icon.name || icon.fileName || 'Icon';
  dom.modalSubtitle.textContent = `${collectionLabel} / ${icon.category || 'Uncategorized'}`;
  dom.modalPath.textContent = cdnUrl;
  dom.modalMeta.innerHTML = buildMetaRows(icon);

  dom.modalTags.innerHTML = '';
  const tagSet = new Set();
  if (icon.isNew) tagSet.add('new');
  if (icon.style) tagSet.add(icon.style);
  if (icon.uiSet) tagSet.add(icon.uiSet);
  if (icon.library) tagSet.add(icon.library);
  (icon.tags || []).forEach((tag) => tagSet.add(tag));

  Array.from(tagSet).slice(0, 16).forEach((tag) => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tag;
    dom.modalTags.appendChild(tagEl);
  });

  dom.modalActions.innerHTML = '';

  const actions = [
    { label: 'Copy CDN URL', action: () => copyToClipboard(cdnUrl, 'CDN URL copied') },
    { label: 'Copy repo path', action: () => copyToClipboard(repoPath, 'Repo path copied'), secondary: true },
    dom.sourceMode.value === 'local'
      ? { label: 'Copy local URL', action: () => copyToClipboard(previewUrl, 'Local URL copied'), secondary: true }
      : null,
    { label: 'Copy name', action: () => copyToClipboard(icon.fileName || icon.name, 'Name copied'), secondary: true },
    { label: 'Copy tags', action: () => copyToClipboard((icon.tags || []).join(', '), 'Tags copied'), secondary: true },
    { label: 'Copy metadata', action: () => copyToClipboard(JSON.stringify(icon, null, 2), 'Metadata copied'), secondary: true },
    { label: 'Open file', action: () => window.open(cdnUrl, '_blank') }
  ].filter(Boolean);

  actions.forEach(({ label, action, secondary }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (secondary) button.classList.add('secondary');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      action();
    });
    dom.modalActions.appendChild(button);
  });

  dom.modal.classList.add('is-open');
  dom.modal.setAttribute('aria-hidden', 'false');
};

const closeModal = () => {
  if (!dom.modal) return;
  dom.modal.classList.remove('is-open');
  dom.modal.setAttribute('aria-hidden', 'true');
};

const buildSelectOptions = (select, values, formatter = (value) => value) => {
  const current = select.value;
  select.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = `All ${select === dom.collectionSelect ? 'collections' : 'categories'}`;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = formatter(value);
    select.appendChild(option);
  });

  if ([...select.options].some((opt) => opt.value === current)) {
    select.value = current;
  }
};

const buildCategoryList = () => {
  dom.categoryList.innerHTML = '';

  const allItem = document.createElement('button');
  allItem.type = 'button';
  allItem.className = `category-item ${state.filters.category === 'all' ? 'active' : ''}`;
  allItem.dataset.category = 'all';
  allItem.innerHTML = `<span>All categories</span><span class="category-count">${state.catalog.length}</span>`;
  dom.categoryList.appendChild(allItem);

  const categories = [...state.categories].sort((a, b) => {
    const colA = a.collection || '';
    const colB = b.collection || '';
    if (colA === colB) {
      return a.name.localeCompare(b.name);
    }
    return colA.localeCompare(colB);
  });

  categories.forEach((category) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `category-item ${state.filters.category === category.name ? 'active' : ''}`;
    item.dataset.category = category.name;
    item.innerHTML = `<span>${category.name}</span><span class="category-count">${category.iconCount}</span>`;
    dom.categoryList.appendChild(item);
  });
};

const updateCategoryActive = () => {
  const items = dom.categoryList.querySelectorAll('.category-item');
  items.forEach((item) => {
    item.classList.toggle('active', item.dataset.category === state.filters.category);
  });
};

const applyFilters = () => {
  const searchValue = state.filters.search.trim().toLowerCase();
  const tokens = searchValue ? searchValue.split(/\s+/).filter(Boolean) : [];
  const allowedExtensions = new Set();
  if (state.filters.svg) allowedExtensions.add('svg');
  if (state.filters.png) allowedExtensions.add('png');

  state.filtered = state.catalog.filter((icon) => {
    if (state.filters.collection !== 'all' && icon.collection !== state.filters.collection) {
      return false;
    }
    if (state.filters.category !== 'all' && icon.category !== state.filters.category) {
      return false;
    }
    if (!allowedExtensions.has(icon.extension)) {
      return false;
    }
    if (!tokens.length) {
      return true;
    }
    return tokens.every((token) => icon.search.includes(token));
  });

  dom.totalCount.textContent = `${state.catalog.length} icons`;
  dom.filteredCount.textContent = `${state.filtered.length} shown`;

  updateCategoryActive();
  renderIcons(true);
};

const renderIcons = (reset) => {
  if (!state.catalog.length) {
    return;
  }
  if (reset) {
    state.page = 0;
    dom.grid.innerHTML = '';
  }

  const baseUrl = getBaseUrl();
  if (dom.sourceMode.value === 'cdn' && !baseUrl) {
    setStatus('Set a CDN base URL to load icons.');
    dom.grid.innerHTML = '';
    dom.loadMoreButton.style.display = 'none';
    return;
  }
  const cdnBaseUrl = getCdnBaseUrl();
  const start = state.page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, state.filtered.length);
  const slice = state.filtered.slice(start, end);

  if (!slice.length && state.page === 0) {
    setStatus('No icons match the current filters.');
  } else {
    setStatus('');
  }

  slice.forEach((icon, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${index * 12}ms`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const img = document.createElement('img');
    const previewUrl = baseUrl ? `${baseUrl}/${icon.path}` : icon.path;
    const cdnUrl = cdnBaseUrl ? `${cdnBaseUrl}/${icon.path}` : previewUrl;
    img.src = previewUrl;
    img.alt = icon.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      img.style.display = 'none';
      thumb.textContent = icon.extension.toUpperCase();
    };

    thumb.appendChild(img);

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = icon.title || icon.name;
    title.title = icon.fileName;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const collectionLabel = COLLECTION_LABELS[icon.collection] || toTitle(icon.collection);
    const sizeLabel = icon.sizeVariants && icon.sizeVariants.length > 1
      ? `Sizes: ${icon.sizeVariants.join(' / ')}`
      : (icon.sizeVariant ? `Size: ${icon.sizeVariant}` : null);
    const variantLabel = icon.familyCount && icon.familyCount > 1
      ? `Variants: ${icon.familyCount}`
      : null;
    const metaLines = [
      `${collectionLabel} / ${icon.category}`,
      `Library: ${icon.library || 'Unknown'}${icon.uiSet ? ` · ${icon.uiSet}` : ''}`,
      `Source: ${icon.source || 'Unknown'}${icon.brandOwner ? ` · ${icon.brandOwner}` : ''}`,
      sizeLabel,
      variantLabel,
      icon.fileName,
      `License: ${icon.license || 'Unknown'} | ${formatBytes(icon.sizeBytes)}`
    ].filter(Boolean);
    meta.innerHTML = metaLines.map((line) => `<span>${line}</span>`).join('');

    const tags = document.createElement('div');
    tags.className = 'tags';
    const tagItems = [icon.isNew ? 'new' : null, icon.style, icon.uiSet].filter(Boolean).slice(0, 3);
    tagItems.forEach((tag) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.textContent = tag;
      tags.appendChild(tagEl);
    });

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const copyUrl = document.createElement('button');
    copyUrl.type = 'button';
    copyUrl.textContent = 'Copy URL';
    copyUrl.addEventListener('click', (event) => {
      event.stopPropagation();
      copyToClipboard(cdnUrl, 'CDN URL copied');
    });
    actions.appendChild(copyUrl);

    card.appendChild(thumb);
    card.appendChild(title);
    card.appendChild(meta);
    if (tagItems.length) card.appendChild(tags);
    card.appendChild(actions);

    card.addEventListener('click', () => openModal(icon));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(icon);
      }
    });

    dom.grid.appendChild(card);
  });

  state.page += 1;
  const hasMore = state.page * PAGE_SIZE < state.filtered.length;
  dom.loadMoreButton.style.display = hasMore ? 'inline-flex' : 'none';
};

const copyToClipboard = async (text, message = 'Copied to clipboard') => {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast(message);
      return;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }

  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.style.position = 'fixed';
  fallback.style.left = '-9999px';
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand('copy');
  document.body.removeChild(fallback);
  showToast(message);
};

const loadData = async () => {
  try {
    const [catalogResponse, categoriesResponse] = await Promise.all([
      fetch(CATALOG_URL),
      fetch(CATEGORIES_URL)
    ]);

    if (!catalogResponse.ok) {
      throw new Error('Failed to load catalog.json');
    }
    if (!categoriesResponse.ok) {
      throw new Error('Failed to load categories.json');
    }

    const catalogData = await catalogResponse.json();
    const categoriesData = await categoriesResponse.json();

    const rawIcons = catalogData.icons || [];
    const enrichedIcons = rawIcons.map((icon) => {
      const sizeVariant = parseSizeVariant(icon.fileName || icon.path || '');
      const familyKey = buildFamilyKey(icon.fileName || icon.path || '');
      return {
        ...icon,
        sizeVariant,
        familyKey,
        search: [
          icon.title,
          icon.name,
          icon.fileName,
          icon.category,
          icon.collection,
          icon.library,
          icon.source,
          icon.brandOwner,
          icon.description,
          icon.license,
          icon.style,
          icon.uiSet,
          ...(icon.tags || [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      };
    });

    const familyIndex = new Map();
    enrichedIcons.forEach((icon) => {
      const key = icon.familyKey || icon.name || icon.fileName || icon.path || '';
      const entry = familyIndex.get(key) || { sizes: new Set(), count: 0 };
      if (icon.sizeVariant) {
        entry.sizes.add(icon.sizeVariant);
      }
      entry.count += 1;
      familyIndex.set(key, entry);
    });

    state.catalog = enrichedIcons.map((icon) => {
      const key = icon.familyKey || icon.name || icon.fileName || icon.path || '';
      const entry = familyIndex.get(key) || { sizes: new Set(), count: 1 };
      return {
        ...icon,
        sizeVariants: Array.from(entry.sizes).sort((a, b) => a - b),
        familyCount: entry.count
      };
    });

    state.categories = categoriesData.categories || [];

    state.catalog.sort((a, b) => a.name.localeCompare(b.name));

    const collections = Array.from(new Set(state.catalog.map((icon) => icon.collection))).sort();
    buildSelectOptions(dom.collectionSelect, collections, (value) => COLLECTION_LABELS[value] || toTitle(value));

    const categoryNames = state.categories.map((category) => category.name).sort();
    buildSelectOptions(dom.categorySelect, categoryNames, (value) => value);

    buildCategoryList();

    dom.totalCount.textContent = `${state.catalog.length} icons`;
    applyFilters();
  } catch (err) {
    console.error(err);
    setStatus('Failed to load metadata. Run a local server (npx serve) from the repo root, then open index.html.');
  }
};

const syncFiltersFromInputs = () => {
  state.filters.search = dom.searchInput.value || '';
  state.filters.collection = dom.collectionSelect.value || 'all';
  state.filters.category = dom.categorySelect.value || 'all';
  state.filters.svg = dom.filterSvg.checked;
  state.filters.png = dom.filterPng.checked;
  applyFilters();
};

const init = () => {
  if (!localStorage.getItem(STORAGE_BASE_URL)) {
    localStorage.setItem(STORAGE_BASE_URL, DEFAULT_CDN_BASE);
  }
  const allowLocalMode = isLocalHost();
  const storedMode = localStorage.getItem(STORAGE_SOURCE_MODE);
  const defaultMode = allowLocalMode ? 'local' : 'cdn';
  const initialMode = storedMode && (storedMode !== 'local' || allowLocalMode) ? storedMode : defaultMode;
  dom.sourceMode.value = initialMode;

  const localOption = dom.sourceMode.querySelector('option[value="local"]');
  if (!allowLocalMode && localOption) {
    localOption.disabled = true;
  }

  if (initialMode === 'cdn') {
    dom.baseUrlInput.value = localStorage.getItem(STORAGE_BASE_URL) || '';
  }

  setThumbSize(dom.sizeRange.value);
  applySourceMode();

  dom.searchInput.addEventListener('input', debounce(syncFiltersFromInputs, 180));
  dom.collectionSelect.addEventListener('change', syncFiltersFromInputs);
  dom.categorySelect.addEventListener('change', syncFiltersFromInputs);
  dom.filterSvg.addEventListener('change', syncFiltersFromInputs);
  dom.filterPng.addEventListener('change', syncFiltersFromInputs);
  dom.sizeRange.addEventListener('input', (event) => setThumbSize(event.target.value));
  dom.sourceMode.addEventListener('change', applySourceMode);
  dom.applyBaseUrl.addEventListener('click', persistBaseUrl);
  dom.loadMoreButton.addEventListener('click', () => renderIcons(false));

  dom.categoryList.addEventListener('click', (event) => {
    const target = event.target.closest('.category-item');
    if (!target) return;
    state.filters.category = target.dataset.category;
    dom.categorySelect.value = state.filters.category;
    applyFilters();
  });

  dom.modalClose.addEventListener('click', closeModal);
  dom.modal.addEventListener('click', (event) => {
    if (event.target === dom.modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  loadData();
};

init();
