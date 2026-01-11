# PiGlyphs

A shared icon vault for PiSpace.dev and PiDEAS Studio.

## Structure

- `icons/microsoft-365/<category>/` - Microsoft 365 app and service icons
- `icons/azure/<category>/` - Azure service icons
- `icons/security/<category>/` - Microsoft security and compliance icons
- `icons/ai/<category>/` - AI brands, tools, and models
- `icons/sap/<category>/` - SAP platform/service icons
- `icons/third-party/<category>/` - Third-party brand collections
- `icons/ui/<set>/<shard>/` - UI icon packs (tabler, lucide, mdi, etc.)
- `icons/uncategorized/<shard>/` - Anything not mapped yet
- `icons/pideas/` - PiDEAS brand marks

## CDN Usage

This repo is currently private, so public CDNs will not work.
When/if it becomes public, a jsDelivr base URL would look like:

```
https://cdn.jsdelivr.net/gh/anthonyrhopkins/PiGlyphs@main/icons
```

Example:

```
https://cdn.jsdelivr.net/gh/anthonyrhopkins/PiGlyphs@main/icons/microsoft-365/core-office/Word.svg
```

## Metadata

Generated metadata lives in `metadata/`:

- `metadata/catalog.json` - per-icon entries with category, library, collection, tags, file size, path, source, license, style
- `metadata/categories.json` - category definitions with collection + icon counts

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
