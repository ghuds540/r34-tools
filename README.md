# R34 Tools

Firefox extension for rule34.xxx - download media, save pages, AMOLED dark theme.

## Install

`about:debugging` → Load Temporary Add-on → `extension/manifest.json`

Enable private browsing: `about:addons` → R34 Tools → Allow in Private Windows

## Features

- **Download media** with `Ctrl+Q` or hover buttons (post pages & thumbnails)
- **Save pages** with `Ctrl+Shift+S` or 🔖 icons next to tags/artists
- **AMOLED dark theme** - Pure black backgrounds with green accents (enabled by default)
- **Smart filenames** - `r34_{id}_{hash}_{artists}.ext`
- **JSON metadata** - Saves as `{timestamp}_r34.json` with URL, artists, post ID

## Settings

Extension icon → Settings
- Configure keyboard shortcuts
- Set download conflict behavior (overwrite/uniquify)
- Toggle AMOLED theme

## Build

```bash
npm run build
# Creates dist/r34-tools-v{version}.xpi
```
