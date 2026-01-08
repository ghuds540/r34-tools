// Download Handler module for R34 Tools extension
// Coordinate downloads from thumbnails and post pages

(function() {
  'use strict';

  // Get dependencies
  const { Rule34Extractor, showNotification, extractPostId, playClickSound } = window.R34Tools;

  // Global rate limit state for HTML fetches
  const fetchRateLimitState = {
    isRateLimited: false,
    backoffLevel: 0,
    backoffEndTime: null,
    pendingFetches: [], // {postUrl, resolve, reject}
    testFetchData: null,
    backoffTimeoutId: null
  };

  // Track all fetch activity
  const activeFetches = new Set(); // Set of postUrls currently being fetched
  const pendingDownloads = new Set(); // Set of postUrls waiting to start

  // Progress tracking
  let totalDownloads = 0; // Total number of downloads initiated
  let completedDownloads = 0; // Number completed (success or failure)
  let batchMode = false; // Whether total was pre-set for batch operation

  /**
   * Get HTML fetch queue stats
   * @returns {Object} Stats object with fetchingHtml count
   */
  function getFetchQueueStats() {
    return {
      fetchingHtml: activeFetches.size,
      rateLimited: fetchRateLimitState.pendingFetches.length,
      pending: pendingDownloads.size,
      total: totalDownloads,
      completed: completedDownloads
    };
  }

  /**
   * Reset progress tracking
   */
  function resetProgress() {
    totalDownloads = 0;
    completedDownloads = 0;
    batchMode = false;
    triggerStatsUpdate();
  }

  /**
   * Set total download count (for batch operations)
   * @param {number} count - Total number of downloads
   */
  function setTotalDownloads(count) {
    totalDownloads = count;
    completedDownloads = 0;
    batchMode = true; // Mark as batch mode
    triggerStatsUpdate();
  }

  /**
   * Start tracking a new download
   */
  function startDownload() {
    // If batch is complete and user starts a new download, reset to individual mode
    if (batchMode && completedDownloads >= totalDownloads) {
      resetProgress();
    }
    
    // Only increment total if not in batch mode
    if (!batchMode) {
      totalDownloads++;
    }
    triggerStatsUpdate();
  }

  /**
   * Mark a download as completed
   */
  function completeDownload() {
    completedDownloads++;
    triggerStatsUpdate();

    // Auto-reset when all done
    if (completedDownloads >= totalDownloads && totalDownloads > 0) {
      setTimeout(() => {
        if (completedDownloads >= totalDownloads) {
          resetProgress();
        }
      }, 60000); // Reset after 60s
    }
  }

  /**
   * Trigger queue stats update in content script
   */
  function triggerStatsUpdate() {
    // Dispatch custom event to notify content script
    window.dispatchEvent(new CustomEvent('r34tools-fetch-stats-updated', {
      detail: getFetchQueueStats()
    }));
  }

  /**
   * Trigger global rate limit backoff for HTML fetches
   */
  function triggerFetchRateLimitBackoff() {
    // Calculate backoff delay: 10s, 20s, 30s, 30s, 30s...
    const delays = [10000, 20000, 30000];
    const delay = delays[Math.min(fetchRateLimitState.backoffLevel, delays.length - 1)];
    const delaySeconds = (delay / 1000).toFixed(1);

    console.log(`[R34 Tools] HTML fetch rate limit triggered, pausing for ${delaySeconds}s (level ${fetchRateLimitState.backoffLevel})`);

    fetchRateLimitState.isRateLimited = true;
    fetchRateLimitState.backoffEndTime = Date.now() + delay;

    showNotification(
      `Rate limited - paused ${fetchRateLimitState.pendingFetches.length} fetch${fetchRateLimitState.pendingFetches.length !== 1 ? 'es' : ''}\nResuming in ${delaySeconds}s...`,
      'info'
    );

    triggerStatsUpdate();

    // Schedule resumption
    fetchRateLimitState.backoffTimeoutId = setTimeout(() => {
      resumeFetchQueueAfterBackoff();
    }, delay);
  }

  /**
   * Resume HTML fetch queue after backoff
   */
  async function resumeFetchQueueAfterBackoff() {
    console.log('[R34 Tools] Fetch backoff period ended, testing with single fetch');

    if (fetchRateLimitState.pendingFetches.length === 0) {
      resetFetchRateLimitState();
      return;
    }

    // Take ONE fetch to test if rate limit cleared
    const testFetch = fetchRateLimitState.pendingFetches.shift();
    fetchRateLimitState.testFetchData = testFetch;

    try {
      const response = await fetch(testFetch.postUrl);

      if (response.status === 429) {
        // Still rate limited - escalate and try again
        console.log('[R34 Tools] Test fetch still rate limited, escalating backoff');
        fetchRateLimitState.pendingFetches.unshift(testFetch); // Put it back
        fetchRateLimitState.testFetchData = null;
        fetchRateLimitState.backoffLevel++;
        triggerFetchRateLimitBackoff();
        return;
      }

      // Success! Resume gradually
      console.log('[R34 Tools] Test fetch succeeded, resuming queue gradually');
      testFetch.resolve(response);
      fetchRateLimitState.testFetchData = null;
      onTestFetchSuccess();

    } catch (error) {
      console.error('[R34 Tools] Test fetch failed:', error);
      testFetch.reject(error);
      fetchRateLimitState.testFetchData = null;

      // Try next one if available
      if (fetchRateLimitState.pendingFetches.length > 0) {
        setTimeout(() => resumeFetchQueueAfterBackoff(), 1000);
      } else {
        resetFetchRateLimitState();
      }
    }
  }

  /**
   * Handle successful test fetch - resume queue gradually
   */
  function onTestFetchSuccess() {
    fetchRateLimitState.backoffLevel = 0; // Reset since we're successful
    fetchRateLimitState.isRateLimited = false;

    const STAGGER_DELAY = 300; // 300ms between each fetch
    const totalCount = fetchRateLimitState.pendingFetches.length;

    fetchRateLimitState.pendingFetches.forEach((pendingFetch, index) => {
      setTimeout(async () => {
        try {
          console.log(`[R34 Tools] Resuming fetch ${index + 1}/${totalCount}:`, pendingFetch.postUrl);
          const response = await fetch(pendingFetch.postUrl);

          if (response.status === 429) {
            // Rate limited again - re-queue
            console.log('[R34 Tools] Rate limited again during resume');
            fetchRateLimitState.pendingFetches = [pendingFetch];
            fetchRateLimitState.backoffLevel = 0;
            triggerFetchRateLimitBackoff();
          } else {
            pendingFetch.resolve(response);
          }
        } catch (error) {
          pendingFetch.reject(error);
        }
      }, index * STAGGER_DELAY);
    });

    // Clear the pending queue (items will be processed by timeouts above)
    fetchRateLimitState.pendingFetches = [];
    triggerStatsUpdate();
  }

  /**
   * Reset fetch rate limit state
   */
  function resetFetchRateLimitState() {
    if (fetchRateLimitState.backoffTimeoutId) {
      clearTimeout(fetchRateLimitState.backoffTimeoutId);
    }
    fetchRateLimitState.isRateLimited = false;
    fetchRateLimitState.backoffLevel = 0;
    fetchRateLimitState.backoffEndTime = null;
    fetchRateLimitState.testFetchData = null;
    fetchRateLimitState.backoffTimeoutId = null;
    fetchRateLimitState.pendingFetches = [];
    triggerStatsUpdate();
  }

  /**
   * Fetch with coordinated rate limit backoff
   * @param {string} url - URL to fetch
   * @returns {Promise<Response>} Fetch response
   */
  async function fetchWithCoordinatedBackoff(url) {
    // Track as active fetch
    activeFetches.add(url);
    triggerStatsUpdate();

    try {
      // If currently rate limited, queue this fetch
      if (fetchRateLimitState.isRateLimited) {
        console.log('[R34 Tools] Rate limited - queueing fetch:', url);
        return new Promise((resolve, reject) => {
          fetchRateLimitState.pendingFetches.push({ postUrl: url, resolve, reject });
          triggerStatsUpdate();
        });
      }

      // Not rate limited - try fetch
      const response = await fetch(url);

      if (response.status === 429) {
        console.log('[R34 Tools] HTML fetch rate limited:', url);

        // Queue this fetch and trigger backoff
        return new Promise((resolve, reject) => {
          fetchRateLimitState.pendingFetches.push({ postUrl: url, resolve, reject });
          if (!fetchRateLimitState.isRateLimited) {
            triggerFetchRateLimitBackoff();
          }
        });
      }

      return response;
    } catch (error) {
      throw error;
    } finally {
      // Remove from active fetches when done
      activeFetches.delete(url);
      triggerStatsUpdate();
    }
  }

  /**
   * Fetch with exponential backoff retry for rate limits
   * @param {string} url - URL to fetch
   * @param {number} maxAttempts - Maximum retry attempts (default 5)
   * @param {number} initialDelay - Initial retry delay in ms (default 1000)
   * @returns {Promise<Response>} Fetch response
   */
  async function fetchWithRetry(url, maxAttempts = 5, initialDelay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url);

        // If successful or non-retryable error, return response
        if (response.ok || (response.status !== 429 && response.status !== 503)) {
          return response;
        }

        // Rate limited or service unavailable - retry with backoff
        if (attempt < maxAttempts) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          const delaySeconds = (delay / 1000).toFixed(1);
          console.log(`[R34 Tools] Fetch failed (${response.status}), retrying in ${delaySeconds}s... (attempt ${attempt + 1}/${maxAttempts})`);
          showNotification(`Rate limited, retrying in ${delaySeconds}s...\n(attempt ${attempt + 1}/${maxAttempts})`, 'info');
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Max attempts reached
          return response;
        }
      } catch (error) {
        // Network error - retry if not last attempt
        if (attempt < maxAttempts) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          const delaySeconds = (delay / 1000).toFixed(1);
          console.log(`[R34 Tools] Fetch error, retrying in ${delaySeconds}s... (attempt ${attempt + 1}/${maxAttempts}):`, error.message);
          showNotification(`Network error, retrying in ${delaySeconds}s...\n(attempt ${attempt + 1}/${maxAttempts})`, 'info');
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Download media from thumbnail
   * Used by thumbnail download button click handler
   * @param {string} postUrl - Post page URL
   * @returns {Promise<boolean>} True if successful
   */
  async function downloadFromThumbnail(postUrl) {
    console.log('[R34 Tools] Starting download from thumbnail:', postUrl);
    startDownload();

    try {
      console.log('[R34 Tools] Fetching post page HTML...');
      const response = await fetchWithCoordinatedBackoff(postUrl);

      if (!response.ok) {
        console.error('[R34 Tools] Fetch failed:', response.status, response.statusText);
        showNotification(`Failed to fetch page: ${response.status}`, 'error');
        return false;
      }

      const html = await response.text();
      console.log('[R34 Tools] Received HTML, length:', html.length);

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const postId = extractPostId(postUrl);
      console.log('[R34 Tools] Post ID:', postId);

      const extractor = new Rule34Extractor();

      const mediaUrl = extractor.extractMediaFromDocument(doc);
      console.log('[R34 Tools] Extracted media URL:', mediaUrl);

      const artists = extractor.extractArtistsFromDocument(doc);
      console.log('[R34 Tools] Extracted artists:', artists);

      if (!mediaUrl) {
        console.error('[R34 Tools] No media URL found in document');
        showNotification('Could not extract media URL', 'error');
        return false;
      }

      const filename = extractor.buildFilename(mediaUrl, postId, artists);
      console.log('[R34 Tools] Generated filename:', filename);

      console.log('[R34 Tools] Sending download request to background script...');
      const dlResponse = await browser.runtime.sendMessage({
        action: 'download',
        url: mediaUrl,
        filename: filename
      });

      if (dlResponse.success) {
        console.log('[R34 Tools] Download queued successfully');
        completeDownload();
        // Notification will be sent by background script queue system
        return true;
      } else {
        console.error('[R34 Tools] Download failed:', dlResponse.error);
        completeDownload();
        showNotification(`Download failed: ${dlResponse.error}`, 'error');
        return false;
      }
    } catch (error) {
      console.error('[R34 Tools] Exception in downloadFromThumbnail:', error);      completeDownload();      showNotification(`Error: ${error.message}`, 'error');
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

    // Use retry mechanism to wait for page to fully load
    const mediaUrl = await extractor.extractMediaUrlWithRetry();
    extractor.extractMetadata();

    if (!mediaUrl) {
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
        console.log('[R34 Tools] Download queued successfully');
        // Notification will be sent by background script queue system
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

  // Track ongoing downloads to prevent duplicate requests
  const activeDownloads = new Set();

  /**
   * Handle thumbnail download button click
   * @param {Event} e - Click event
   * @param {string} postUrl - Post page URL
   * @returns {Promise<void>}
   */
  async function handleThumbnailDownloadClick(e, postUrl) {
    playClickSound(); // Immediate feedback
    console.log('[R34 Tools] Download button clicked for:', postUrl);
    e.preventDefault();
    e.stopPropagation();

    // Validate post URL
    if (!postUrl || typeof postUrl !== 'string') {
      console.error('[R34 Tools] Invalid post URL:', postUrl);
      showNotification('Invalid post URL', 'error');
      return;
    }

    // Ensure it's a valid URL
    try {
      new URL(postUrl);
    } catch (error) {
      console.error('[R34 Tools] Malformed post URL:', postUrl, error);
      showNotification('Invalid post URL format', 'error');
      return;
    }

    // Prevent duplicate downloads for the same URL
    if (activeDownloads.has(postUrl)) {
      console.log('[R34 Tools] Download already in progress for this URL, ignoring click');
      return;
    }

    activeDownloads.add(postUrl);
    try {
      await downloadFromThumbnail(postUrl);
    } finally {
      activeDownloads.delete(postUrl);
      console.log('[R34 Tools] Download completed, removed from active set');
    }
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
    playClickSound(); // Immediate feedback
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

  // Listen for download notifications from background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'downloadNotification') {
      const { type, filename, delay, attempts, maxAttempts, pausedCount, backoffSeconds } = message;

      switch (type) {
        case 'retrying':
          showNotification(
            `Download failed, retrying in ${delay}s...\n(attempt ${attempts}/${maxAttempts})`,
            'info'
          );
          break;

        case 'success':
          showNotification(
            attempts > 1
              ? `Downloaded: ${filename}\n(succeeded after ${attempts} attempts)`
              : `Downloaded: ${filename}`,
            'success'
          );
          break;

        case 'failed':
          showNotification(
            `Download failed after ${attempts} attempts:\n${filename}`,
            'error'
          );
          break;

        case 'rateLimitPause':
          showNotification(
            `Rate limited - paused ${pausedCount} download${pausedCount !== 1 ? 's' : ''}\nResuming in ${backoffSeconds}s...`,
            'info'
          );
          break;
      }
    }
  });

  // Export all functions to global namespace
  window.R34Tools.downloadFromThumbnail = downloadFromThumbnail;
  window.R34Tools.downloadFromCurrentPage = downloadFromCurrentPage;
  window.R34Tools.savePageData = savePageData;
  window.R34Tools.handleThumbnailDownloadClick = handleThumbnailDownloadClick;
  window.R34Tools.handleThumbnailFullResClick = handleThumbnailFullResClick;
  window.R34Tools.setTotalDownloads = setTotalDownloads;

})();
