# R34 Tools

Firefox extension for rule34.xxx - download media, save pages, AMOLED theme.

## Install

`about:debugging` → Load Temporary Add-on → `extension/manifest.json`

Enable private browsing: `about:addons` → R34 Tools → Allow in Private Windows

## Usage

**On rule34.xxx:**
- Click floating download button or press `Ctrl+Q` - downloads highest quality media with artist names
- Click floating save button or press `Ctrl+Shift+S` - saves URL and metadata

**Settings:** Extension icon → Settings
- Configure shortcuts
- Set download conflict behavior (uniquify/overwrite/prompt)

## Files

- Downloads: `r34_{id}_{hash}_{artists}.ext`
- Saved pages: `rule34_saved_pages_{timestamp}.txt`

## Build

```bash
npm run build
# Creates dist/r34-tools-v{version}.xpi
```
