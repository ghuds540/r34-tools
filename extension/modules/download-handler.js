// Download Handler module for R34 Tools extension
// Coordinate downloads from thumbnails and post pages

(function() {
  'use strict';

  // Get dependencies
  const { Rule34Extractor, showNotification, extractPostId } = window.R34Tools;

  /**
   * Download media from thumbnail
   * Used by thumbnail download button click handler
   * @param {string} postUrl - Post page URL
   * @returns {Promise<boolean>} True if successful
   */
  async function downloadFromThumbnail(postUrl) {
    showNotification('Fetching media...', 'info');

    try {
      const response = await fetch(postUrl);
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const postId = extractPostId(postUrl);
      const extractor = new Rule34Extractor();

      const mediaUrl = extractor.extractMediaFromDocument(doc);
      const artists = extractor.extractArtistsFromDocument(doc);

      if (!mediaUrl) {
        showNotification('Could not extract media URL', 'error');
        return false;
      }

      const filename = extractor.buildFilename(mediaUrl, postId, artists);

      const dlResponse = await browser.runtime.sendMessage({
        action: 'download',
        url: mediaUrl,
        filename: filename
      });

      if (dlResponse.success) {
        const artistInfo = artists.length > 0
          ? `\nArtists: ${artists.join(', ')}`
          : '';
        showNotification(`Downloaded: ${filename}${artistInfo}`, 'success');
        return true;
      } else {
        showNotification(`Download failed: ${dlResponse.error}`, 'error');
        return false;
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Download media from current page
   * Used by Ctrl+Q keyboard shortcut and popup button
   * @returns {Promise<boolean>} True if successful
   */
  async function downloadFromCurrentPage() {
    const extractor = new Rule34Extractor();
    extractor.extractPostId();
    extractor.extractMediaUrl();
    extractor.extractMetadata();

    if (!extractor.mediaUrl) {
      showNotification('No media found on this page', 'error');
      return false;
    }

    const filename = extractor.getFilename();

    try {
      const response = await browser.runtime.sendMessage({
        action: 'download',
        url: extractor.mediaUrl,
        filename: filename
      });

      if (response.success) {
        const artistInfo = extractor.artists.length > 0
          ? `\nArtists: ${extractor.artists.join(', ')}`
          : '';
        showNotification(`Downloaded: ${filename}${artistInfo}`, 'success');
        return true;
      } else {
        showNotification(`Download failed: ${response.error}`, 'error');
        return false;
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Save page data as JSON
   * Used by Ctrl+Shift+S keyboard shortcut and sidebar button
   * @returns {Promise<boolean>} True if successful
   */
  async function savePageData() {
    const extractor = new Rule34Extractor();
    extractor.extractPostId();
    extractor.extractMetadata();

    const data = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      postId: extractor.postId || null,
      artists: extractor.artists
    };

    try {
      const response = await browser.runtime.sendMessage({
        action: 'savePageJson',
        data: data
      });

      if (response && response.success) {
        const info = extractor.postId ? `Post ${extractor.postId}` : 'Page';
        showNotification(`Saved ${info}\n→ ${response.filename}`, 'success');
        return true;
      } else {
        showNotification(`Save failed: ${response?.error || 'Unknown error'}`, 'error');
        return false;
      }
    } catch (error) {
      console.error('[R34 Tools] Save error:', error);
      showNotification(`Error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Handle thumbnail download button click
   * @param {Event} e - Click event
   * @param {string} postUrl - Post page URL
   * @returns {Promise<void>}
   */
  async function handleThumbnailDownloadClick(e, postUrl) {
    e.preventDefault();
    e.stopPropagation();
    await downloadFromThumbnail(postUrl);
  }

  /**
   * Handle thumbnail full-res button click
   * @param {Event} e - Click event
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {string} postUrl - Post page URL
   * @param {HTMLElement} wrapper - Container wrapper
   * @returns {Promise<void>}
   */
  async function handleThumbnailFullResClick(e, img, postUrl, wrapper) {
    e.preventDefault();
    e.stopPropagation();

    const { isVideoThumbnail, loadVideoInThumbnail } = window.R34Tools;
    const { loadFullResInThumbnail } = window.R34Tools;
    const { settingsManager } = window.R34Tools;

    const isVideo = isVideoThumbnail(img);
    const settings = await settingsManager.getAll();

    if (isVideo) {
      await loadVideoInThumbnail(img, postUrl, wrapper, settings);
    } else {
      await loadFullResInThumbnail(img, postUrl);
    }
  }

  // Export all functions to global namespace
  window.R34Tools.downloadFromThumbnail = downloadFromThumbnail;
  window.R34Tools.downloadFromCurrentPage = downloadFromCurrentPage;
  window.R34Tools.savePageData = savePageData;
  window.R34Tools.handleThumbnailDownloadClick = handleThumbnailDownloadClick;
  window.R34Tools.handleThumbnailFullResClick = handleThumbnailFullResClick;

})();
