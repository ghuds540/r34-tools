# R34 Tools

Firefox extension for rule34.xxx - download media, save pages, AMOLED dark theme.

## Install

`about:debugging` → Load Temporary Add-on → `extension/manifest.json`

Enable private browsing: `about:addons` → R34 Tools → Allow in Private Windows

## Features

- **Download media** with `Ctrl+Q` or hover buttons (post pages & thumbnails)
- **Save pages** with `Ctrl+Shift+S` or 🔖 icons next to tags/artists
- **AMOLED dark theme** - Pure black backgrounds with green accents (enabled by default)
- **High-quality previews** - Upgrades thumbnails to sample quality for better image clarity (enabled by default)
  - Green download button on hover to download full resolution
  - Blue full-resolution button loads /images/ quality inline
- **Smart filenames** - `r34_{id}_{hash}_{artists}.ext`
- **JSON metadata** - Saves as `{timestamp}_r34.json` with URL, artists, post ID

## Settings

Extension icon → Settings
- Configure keyboard shortcuts
- Set download conflict behavior (overwrite/uniquify)
- Toggle AMOLED theme
- Toggle compact header mode (hides header, moves logo to sidebar with toggle button)
- Toggle high-quality previews (sample quality)
- Toggle always use full resolution (overrides high-quality, slower but max quality)

## Build

```bash
npm run build
# Creates dist/r34-tools-v{version}.xpi
```

## Future Ideas

- Troubleshoot why not every image is showing in force full res (404s)
- Override pagination to load more results at once
- Seen/hidden post filter to avoid seeing things already reviewed (requires host integration)
