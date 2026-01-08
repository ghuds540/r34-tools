// Saved Pages Tracker module for R34 Tools extension
// Tracks saved/bookmarked pages (tags, artists, etc) and provides lookup hooks

(function() {
  'use strict';

  const STORAGE_KEY = 'r34_saved_pages';
  const MAX_STORED_ITEMS = 10000;

  function normalizeUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      u.hash = '';
      // Normalize common variations
      if (u.hostname) u.hostname = u.hostname.toLowerCase();
      return u.toString();
    } catch {
      return (url || '').toString();
    }
  }

  function getPageKey(url) {
    // Today the key is simply the normalized URL.
    // Future: key can incorporate page type, canonical tag IDs, or host DB keys.
    return normalizeUrl(url);
  }

  async function getSavedPagesMap() {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] || {};
      // stored is an object keyed by pageKey
      return stored && typeof stored === 'object' ? stored : {};
    } catch (error) {
      console.error('[R34 Tools] Failed to load saved pages:', error);
      return {};
    }
  }

  async function setSavedPagesMap(map) {
    try {
      await browser.storage.local.set({
        [STORAGE_KEY]: map
      });
    } catch (error) {
      console.error('[R34 Tools] Failed to persist saved pages:', error);
    }
  }

  function trimIfNeeded(map) {
    const keys = Object.keys(map);
    if (keys.length <= MAX_STORED_ITEMS) return map;

    // Remove oldest first (based on savedAt, defaulting to 0)
    keys.sort((a, b) => {
      const aAt = Date.parse(map[a]?.savedAt || '') || 0;
      const bAt = Date.parse(map[b]?.savedAt || '') || 0;
      return aAt - bAt;
    });

    const toRemove = keys.length - MAX_STORED_ITEMS;
    for (let i = 0; i < toRemove; i++) {
      delete map[keys[i]];
    }

    return map;
  }

  async function markSaved(urlOrKey, meta = {}) {
    const key = urlOrKey?.startsWith?.('http') ? getPageKey(urlOrKey) : (urlOrKey || '');
    if (!key) return;

    const map = await getSavedPagesMap();
    map[key] = {
      key,
      url: meta.url ? normalizeUrl(meta.url) : (urlOrKey?.startsWith?.('http') ? normalizeUrl(urlOrKey) : meta.url),
      label: meta.label || null,
      pageType: meta.pageType || null,
      savedAt: meta.savedAt || new Date().toISOString()
    };

    trimIfNeeded(map);
    await setSavedPagesMap(map);
  }

  async function unmarkSaved(urlOrKey) {
    const key = urlOrKey?.startsWith?.('http') ? getPageKey(urlOrKey) : (urlOrKey || '');
    if (!key) return;

    const map = await getSavedPagesMap();
    if (map[key]) {
      delete map[key];
      await setSavedPagesMap(map);
    }
  }

  async function isSaved(urlOrKey) {
    const key = urlOrKey?.startsWith?.('http') ? getPageKey(urlOrKey) : (urlOrKey || '');
    if (!key) return false;

    const map = await getSavedPagesMap();
    return Boolean(map[key]);
  }

  async function checkMultiple(urlsOrKeys) {
    if (!Array.isArray(urlsOrKeys) || urlsOrKeys.length === 0) return {};

    const map = await getSavedPagesMap();
    const result = {};

    for (const item of urlsOrKeys) {
      const key = item?.startsWith?.('http') ? getPageKey(item) : (item || '');
      if (!key) continue;
      result[key] = Boolean(map[key]);
    }

    return result;
  }

  async function clearSavedPages() {
    try {
      await browser.storage.local.remove(STORAGE_KEY);
      console.log('[R34 Tools] Cleared saved pages');
    } catch (error) {
      console.error('[R34 Tools] Failed to clear saved pages:', error);
    }
  }

  // Future: Check with host filesystem/local DB for saved state
  async function checkWithHostAPI(_key) {
    return false;
  }

  async function isSavedWithAPI(urlOrKey) {
    const local = await isSaved(urlOrKey);
    if (local) return true;
    return await checkWithHostAPI(urlOrKey);
  }

  window.R34Tools = window.R34Tools || {};
  Object.assign(window.R34Tools.SavedPagesTracker = {
    getPageKey,
    normalizeUrl,
    markSaved,
    unmarkSaved,
    isSaved,
    checkMultiple,
    clearSavedPages,
    isSavedWithAPI,
    getSavedPagesMap
  });
})();
