# PiGlyphs

A shared icon vault for PiSpace.dev and PiDEAS Studio.

## Structure

- `icons/m365/` - Full Microsoft 365 + third-party icon set
- `icons/pideas/` - PiDEAS brand marks

## CDN Usage

Recommended base URL (GitHub-backed via jsDelivr):

```
https://cdn.jsdelivr.net/gh/anthonyrhopkins/PiGlyphs@main/icons
```

Example:

```
https://cdn.jsdelivr.net/gh/anthonyrhopkins/PiGlyphs@main/icons/m365/Word.svg
```

## Metadata

Generated metadata lives in `metadata/`:

- `metadata/catalog.json` - per-icon entries with category, library, tags, file size, and path
- `metadata/categories.json` - category definitions with library and icon counts

Regenerate from the PiSpace logo manager source:

```
PIGLYPHS_SOURCE=/absolute/path/to/ProLogoManagerWidget.jsx node scripts/build-catalog.mjs
```

## Notes

- Keep file names stable; downstream apps reference them by name.
- Prefer SVG where available, PNG when required.

## Disclaimer

Logos and trademarks remain the property of their respective owners.
This repository is a convenience mirror for internal tooling and demos.
