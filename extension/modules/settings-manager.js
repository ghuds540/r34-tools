// Settings Manager module for R34 Tools extension
// Centralized settings management with caching to avoid repeated browser.storage calls

(function() {
  'use strict';

  // Get constants
  const { DEFAULT_SETTINGS } = window.R34Tools;

  /**
   * SettingsManager class - Singleton for managing extension settings
   * Provides caching to reduce browser.storage.local.get() calls
   */
  class SettingsManager {
    constructor() {
      this.cache = null;
      this.cacheTime = null;
      this.cacheDuration = 5000; // 5 seconds cache
      this.listeners = new Set();
    }

    /**
     * Get all settings with caching
     * @returns {Promise<Object>} All settings
     */
    async getAll() {
      // Return cached settings if still valid
      if (this.cache && this.cacheTime && (Date.now() - this.cacheTime < this.cacheDuration)) {
        return this.cache;
      }

      // Fetch fresh settings from storage
      try {
        this.cache = await browser.storage.local.get(DEFAULT_SETTINGS);
        this.cacheTime = Date.now();
        return this.cache;
      } catch (error) {
        console.error('[R34 Tools] Error loading settings:', error);
        // Return defaults on error
        return { ...DEFAULT_SETTINGS };
      }
    }

    /**
     * Get a single setting value
     * @param {string} key - Setting key
     * @returns {Promise<*>} Setting value
     */
    async get(key) {
      const all = await this.getAll();
      return all[key];
    }

    /**
     * Set one or more settings
     * @param {Object} settings - Settings object to save
     * @returns {Promise<void>}
     */
    async set(settings) {
      try {
        await browser.storage.local.set(settings);
        this.invalidateCache();
        this.notifyListeners(settings);
      } catch (error) {
        console.error('[R34 Tools] Error saving settings:', error);
        throw error;
      }
    }

    /**
     * Invalidate the cache to force refresh on next get()
     */
    invalidateCache() {
      this.cache = null;
      this.cacheTime = null;
    }

    /**
     * Add a listener for setting changes
     * @param {Function} callback - Called when settings change
     */
    addListener(callback) {
      this.listeners.add(callback);
    }

    /**
     * Remove a listener
     * @param {Function} callback - Listener to remove
     */
    removeListener(callback) {
      this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of setting changes
     * @param {Object} changedSettings - Settings that changed
     */
    notifyListeners(changedSettings) {
      this.listeners.forEach(callback => {
        try {
          callback(changedSettings);
        } catch (error) {
          console.error('[R34 Tools] Error in settings listener:', error);
        }
      });
    }

    /**
     * Reset all settings to defaults
     * @returns {Promise<void>}
     */
    async reset() {
      await this.set(DEFAULT_SETTINGS);
    }

    // Helper methods for common setting checks

    /**
     * Check if video auto-loading is enabled
     * @returns {Promise<boolean>}
     */
    async shouldAutoLoadVideos() {
      return await this.get('autoLoadVideoEmbeds');
    }

    /**
     * Check if videos should auto-start when loaded
     * @returns {Promise<boolean>}
     */
    async shouldAutoStartVideos() {
      return await this.get('autoStartEmbedVideos');
    }

    /**
     * Check if high-quality previews are enabled
     * @returns {Promise<boolean>}
     */
    async shouldUseHighQuality() {
      return await this.get('highQualityPreviews');
    }

    /**
     * Check if full resolution should always be used
     * @returns {Promise<boolean>}
     */
    async shouldUseFullResolution() {
      return await this.get('alwaysUseFullResolution');
    }

    /**
     * Check if AMOLED theme is enabled
     * @returns {Promise<boolean>}
     */
    async isAmoledThemeEnabled() {
      return await this.get('amoledTheme');
    }

    /**
     * Check if compact header mode is enabled
     * @returns {Promise<boolean>}
     */
    async isCompactHeaderEnabled() {
      return await this.get('compactHeader');
    }

    /**
     * Get the download conflict action setting
     * @returns {Promise<string>} 'overwrite' or 'uniquify'
     */
    async getConflictAction() {
      return await this.get('conflictAction');
    }
  }

  // Create singleton instance
  const settingsManager = new SettingsManager();

  // Listen for storage changes from other contexts (options page, popup, etc.)
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      // Invalidate cache when settings change externally
      settingsManager.invalidateCache();

      // Extract changed settings
      const changedSettings = {};
      for (const [key, { newValue }] of Object.entries(changes)) {
        changedSettings[key] = newValue;
      }

      // Notify internal listeners
      settingsManager.notifyListeners(changedSettings);
    }
  });

  // Export singleton instance to global namespace
  window.R34Tools.settingsManager = settingsManager;
  window.R34Tools.SettingsManager = SettingsManager; // Export class for potential other instances

})();
