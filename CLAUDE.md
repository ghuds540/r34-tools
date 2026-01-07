# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

R34 Tools is a Firefox extension for rule34.xxx that provides download functionality, page saving, AMOLED theming, and image quality upgrades.

## Development Commands

For development, the developer is loading the extension for testing like so:

```text
# Load extension for testing
# 1. Open Firefox → about:debugging
# 2. Load Temporary Add-on → extension/manifest.json
# 3. Enable private browsing: about:addons → R34 Tools → Allow in Private Windows
```

## Architecture

### Manifest V2 Constraints
This extension uses **Manifest V2** (not V3), which has critical implications:

- **No ES6 modules** in content scripts - Cannot use `import/export`
- **Global namespace pattern** - All modules use `window.R34Tools = {}` for sharing code
- **Script load order matters** - Modules must be loaded in dependency order in manifest.json

### Module Load Order (Critical)

Content scripts in `manifest.json` **must** load in this order:
1. `modules/constants.js` - All hard-coded values (colors, selectors, timings)
2. `modules/settings-manager.js` - Centralized settings cache
3. `modules/dom-utils.js` - DOM helpers (positioning, finding elements)
4. `modules/video-loader.js` - Video detection and loading
5. `modules/image-quality.js` - Image quality upgrades (thumbnail → sample → full)
6. `modules/media-extractor.js` - Enhanced Rule34Extractor class
7. `modules/ui-components.js` - Notifications, buttons, panels
8. `modules/download-handler.js` - Download coordination
9. `content.js` - Main orchestration (uses all modules)

### Module Export Pattern

Every module uses this pattern:
```javascript
(function() {
  'use strict';

  window.R34Tools = window.R34Tools || {};

  // Module code here

  window.R34Tools.functionName = functionName;
  window.R34Tools.ClassName = ClassName;
})();
```

### Module Import Pattern (content.js)

```javascript
const {
  COLORS, TIMINGS, SELECTORS,
  settingsManager,
  positionButtonsForMedia,
  showNotification
} = window.R34Tools;
```

### Key Architectural Decisions

**Settings Management:**
- `settingsManager` caches settings for 5 seconds to reduce I/O
- Always use `await settingsManager.getAll()` instead of direct `browser.storage.local.get()`

**Image Quality Tracking:**
- Uses `WeakMap` to track quality levels: 'T' (thumbnail), 'S' (sample), 'F' (full), 'V' (video)
- Uses `WeakSet` to track processed images (prevents duplicate upgrades)
- Optimistic loading with error handlers (no pre-validation to avoid CORS console spam)

**Video Detection:**
- Multiple detection methods: CSS classes (`webm-thumb`), title/alt attributes
- Tries multiple CDN domains and extensions when constructing video URLs
- Uses `checkedPostIds` WeakSet to prevent duplicate fetches

**AMOLED Theme:**
- Pure black (#000000) backgrounds with green (#00ff66) accents
- Applied via `<style>` tag injection in `<head>`
- Special handling for awesomplete dropdown (search autocomplete)

**Button Positioning:**
- Circular buttons positioned absolutely within thumbnail wrappers
- Show on hover, hidden by default (opacity: 0, pointer-events: none)
- Icons use green color (#00ff66) for visibility on dark backgrounds

## File Structure

```
extension/
├── modules/               # 8 specialized modules (must load in order)
│   ├── constants.js       # Colors, selectors, timings, gradients
│   ├── settings-manager.js # Cached settings with 5s TTL
│   ├── dom-utils.js       # positionButtonsForMedia, findPostLink, hover handlers
│   ├── video-loader.js    # isVideoThumbnail, getVideoUrl, createVideoElement
│   ├── image-quality.js   # upgradeImageUrl, upgradeImageWithFallback
│   ├── media-extractor.js # Rule34Extractor class
│   ├── ui-components.js   # showNotification, createCircularIconButton
│   └── download-handler.js # downloadFromThumbnail, downloadFromCurrentPage
├── content.js             # Main orchestration (~658 lines, was 2,293)
├── background.js          # Download handling with retry logic
├── popup.js               # Extension popup UI
├── options.js             # Settings page
└── manifest.json          # Manifest V2 with module load order
```

## Important Implementation Notes

### Adding New Modules
1. Create module file in `extension/modules/`
2. Use the standard module export pattern (see above)
3. Add to `manifest.json` content_scripts in correct dependency order
4. Import in `content.js` from `window.R34Tools`

### Modifying Constants
- **Never** hard-code colors, timings, or selectors in content.js or modules
- All values belong in `constants.js`
- Export to `window.R34Tools.CONSTANT_NAME`

### Image Quality Upgrades
- Use optimistic loading (set img.src directly, handle errors with onerror/onload)
- **Do not** pre-validate URLs with fetch or Image() constructor (causes CORS console spam)
- Always update quality tracking: `setImageQuality(img, 'F')`

### Styling Changes
- AMOLED theme rules are in `constants.js` → `AMOLED_THEME_RULES`
- Applied in `content.js` → `applyAmoledTheme()`
- Use pure black (#000000) and green (#00ff66) palette
- Button icons should use green (#00ff66) for visibility

### Download Filenames
Format: `r34_{id}_{hash}_{artists}.ext`
- Constructed in `Rule34Extractor.buildFilename()`
- Artists joined with underscores
- Extension preserved from original URL

### Keyboard Shortcuts
- Ctrl+Q: Download media
- Ctrl+Shift+S: Save page
- Defined in `manifest.json` commands section
- Handled in `background.js` → forwarded to content script

## Testing After Changes

1. Load extension in Firefox: `about:debugging` → Load Temporary Add-on
2. Navigate to rule34.xxx
3. Check console for errors
4. Test on both list pages (`page=post&s=list`) and post pages (`page=post&s=view`)
5. Verify AMOLED theme applies (pure black backgrounds)
6. Test thumbnail buttons appear on hover (green icons)
7. Test quality badges show correct letters (T/S/F/V)
8. Test downloads use correct filenames

## Common Pitfalls

- **Don't add ES6 import/export** - Manifest V2 doesn't support it in content scripts
- **Don't change module load order** - Dependencies will break
- **Don't pre-validate image URLs** - Causes OpaqueResponseBlocking console spam
- **Don't hard-code values** - Use constants.js
- **Don't use gray in AMOLED theme** - Pure black (#000000) only, green (#00ff66) accents
- **Don't create new wrapper elements** - Check if `.r34-thumb-wrapper` exists first
