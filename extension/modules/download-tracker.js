// Download Tracker module for R34 Tools extension
// Tracks downloaded post IDs and provides visual indicators

(function() {
  'use strict';

  // Storage key for downloaded posts
  const STORAGE_KEY = 'r34_downloaded_posts';
  const MAX_STORED_IDS = 10000; // Limit to prevent storage bloat

  /**
   * Get all downloaded post IDs from storage
   * @returns {Promise<Set<string>>} Set of downloaded post IDs
   */
  async function getDownloadedPosts() {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const ids = result[STORAGE_KEY] || [];
      return new Set(ids);
    } catch (error) {
      console.error('[R34 Tools] Failed to load downloaded posts:', error);
      return new Set();
    }
  }

  /**
   * Mark a post as downloaded
   * @param {string} postId - Post ID to mark as downloaded
   */
  async function markAsDownloaded(postId) {
    if (!postId) return;

    try {
      const downloaded = await getDownloadedPosts();
      downloaded.add(postId);

      // Trim if too many
      let ids = Array.from(downloaded);
      if (ids.length > MAX_STORED_IDS) {
        // Keep most recent (assuming higher IDs are newer)
        ids.sort((a, b) => parseInt(b) - parseInt(a));
        ids = ids.slice(0, MAX_STORED_IDS);
      }

      await browser.storage.local.set({
        [STORAGE_KEY]: ids
      });

      console.log(`[R34 Tools] Marked post ${postId} as downloaded (total: ${ids.length})`);
    } catch (error) {
      console.error('[R34 Tools] Failed to mark post as downloaded:', error);
    }
  }

  /**
   * Check if a post has been downloaded
   * @param {string} postId - Post ID to check
   * @returns {Promise<boolean>} True if downloaded
   */
  async function isDownloaded(postId) {
    if (!postId) return false;

    try {
      const downloaded = await getDownloadedPosts();
      return downloaded.has(postId);
    } catch (error) {
      console.error('[R34 Tools] Failed to check download status:', error);
      return false;
    }
  }

  /**
   * Check multiple post IDs at once
   * @param {string[]} postIds - Array of post IDs to check
   * @returns {Promise<Object>} Map of postId -> boolean (downloaded status)
   */
  async function checkMultiple(postIds) {
    if (!postIds || postIds.length === 0) return {};

    try {
      const downloaded = await getDownloadedPosts();
      const results = {};
      postIds.forEach(id => {
        results[id] = downloaded.has(id);
      });
      return results;
    } catch (error) {
      console.error('[R34 Tools] Failed to check multiple posts:', error);
      return {};
    }
  }

  /**
   * Clear all download history
   */
  async function clearHistory() {
    try {
      await browser.storage.local.remove(STORAGE_KEY);
      console.log('[R34 Tools] Cleared download history');
    } catch (error) {
      console.error('[R34 Tools] Failed to clear history:', error);
    }
  }

  /**
   * Future: Check with host API for download status
   * @param {string} postId - Post ID to check
   * @returns {Promise<boolean>} True if downloaded (from API)
   */
  async function checkWithHostAPI(postId) {
    // TODO: Implement API call to host tool
    // For now, return false (not implemented)
    return false;
  }

  /**
   * Check download status with fallback to API
   * @param {string} postId - Post ID to check
   * @returns {Promise<boolean>} True if downloaded (local or API)
   */
  async function isDownloadedWithAPI(postId) {
    // Check local storage first
    const localResult = await isDownloaded(postId);
    if (localResult) return true;

    // Fall back to API check (when implemented)
    return await checkWithHostAPI(postId);
  }

  // Export to global namespace
  window.R34Tools = window.R34Tools || {};
  Object.assign(window.R34Tools.DownloadTracker = {
    markAsDownloaded,
    isDownloaded,
    checkMultiple,
    clearHistory,
    isDownloadedWithAPI,
    getDownloadedPosts
  });

})();
