// Background script for handling downloads and commands
// Enhanced with retry logic and improved error handling

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const DOWNLOAD_TIMEOUT_MS = 5000;
const QUEUE_CLEANUP_DELAY = 60000; // Clean up completed/failed downloads after 1 minute

// =============================================================================
// DOWNLOAD QUEUE MANAGER
// =============================================================================

// Download queue: downloadId → QueueItem
const downloadQueue = new Map();

// Global rate limit state for coordinated backoff
const rateLimitState = {
  isRateLimited: false,           // Global flag
  backoffLevel: 0,                // Escalates with consecutive failures (0, 1, 2, 3...)
  backoffEndTime: null,           // Timestamp when backoff expires
  pausedDownloads: [],            // Downloads waiting to resume
  testDownloadId: null,           // ID of the download testing if rate limit cleared
  backoffTimeoutId: null          // Timeout ID for backoff period
};

/**
 * Calculate exponential backoff delay
 * @param {number} attempts - Current attempt number (starts at 1)
 * @param {number} initialDelay - Initial retry delay in ms
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempts, initialDelay = 1000) {
  // Exponential backoff: initialDelay * 2^(attempts-1)
  // Example: 1s, 2s, 4s, 8s, 16s
  return initialDelay * Math.pow(2, attempts - 1);
}

/**
 * Add download to queue
 * @param {number} downloadId - Browser download ID
 * @param {string} url - Media URL
 * @param {string} filename - Target filename
 * @param {string} conflictAction - 'overwrite' or 'uniquify'
 * @param {number} maxAttempts - Max retry attempts from settings
 * @param {number} tabId - Content script tab ID (for notifications)
 */
function addToQueue(downloadId, url, filename, conflictAction, maxAttempts, tabId) {
  const queueItem = {
    downloadId,
    url,
    filename,
    conflictAction,
    attempts: 1,
    maxAttempts,
    tabId,
    state: 'downloading',
    error: null,
    retryTimeoutId: null
  };

  downloadQueue.set(downloadId, queueItem);
  console.log(`[R34 Tools Queue] Added to queue:`, filename, `(attempt 1/${maxAttempts})`);

  // No initial notification - only notify on retry/success/failure to reduce spam

  // Broadcast stats update
  broadcastQueueStats();
}

/**
 * Remove download from queue with cleanup delay
 * @param {number} downloadId - Browser download ID
 */
function removeFromQueue(downloadId) {
  const item = downloadQueue.get(downloadId);
  if (!item) return;

  console.log(`[R34 Tools Queue] Removing from queue:`, item.filename);

  // Clear any pending retry timeout
  if (item.retryTimeoutId) {
    clearTimeout(item.retryTimeoutId);
  }

  // Remove after delay to allow final state processing
  setTimeout(() => {
    downloadQueue.delete(downloadId);
    broadcastQueueStats();
  }, QUEUE_CLEANUP_DELAY);
}

/**
 * Retry download with exponential backoff
 * @param {Object} queueItem - Queue item to retry
 */
async function retryDownload(queueItem) {
  queueItem.attempts++;
  queueItem.state = 'retrying';

  const settings = await browser.storage.local.get({
    autoRetryDownloads: true,
    initialRetryDelay: 1000
  });

  const delay = calculateBackoffDelay(queueItem.attempts - 1, settings.initialRetryDelay);
  const delaySeconds = (delay / 1000).toFixed(1);

  console.log(`[R34 Tools Queue] Retrying download in ${delaySeconds}s (attempt ${queueItem.attempts}/${queueItem.maxAttempts}):`, queueItem.filename);

  // Send retry notification to content script
  if (queueItem.tabId) {
    browser.tabs.sendMessage(queueItem.tabId, {
      action: 'downloadNotification',
      type: 'retrying',
      filename: queueItem.filename,
      delay: delaySeconds,
      attempts: queueItem.attempts,
      maxAttempts: queueItem.maxAttempts
    }).catch(err => console.log('[R34 Tools Queue] Tab closed, cannot send notification'));
  }

  // Schedule retry after backoff delay
  queueItem.retryTimeoutId = setTimeout(async () => {
    try {
      console.log(`[R34 Tools Queue] Executing retry attempt ${queueItem.attempts}:`, queueItem.filename);

      const newDownloadId = await browser.downloads.download({
        url: queueItem.url,
        filename: queueItem.filename,
        conflictAction: queueItem.conflictAction,
        saveAs: false
      });

      // Update queue with new download ID
      downloadQueue.delete(queueItem.downloadId);
      queueItem.downloadId = newDownloadId;
      queueItem.state = 'downloading';
      queueItem.retryTimeoutId = null;
      downloadQueue.set(newDownloadId, queueItem);

      console.log(`[R34 Tools Queue] Retry started with new download ID ${newDownloadId}`);
    } catch (error) {
      console.error(`[R34 Tools Queue] Retry attempt failed:`, error);
      queueItem.error = error.message;
      queueItem.state = 'failed';

      // Send final failure notification
      if (queueItem.tabId) {
        browser.tabs.sendMessage(queueItem.tabId, {
          action: 'downloadNotification',
          type: 'failed',
          filename: queueItem.filename,
          attempts: queueItem.attempts
        }).catch(err => console.log('[R34 Tools Queue] Tab closed, cannot send notification'));
      }

      removeFromQueue(queueItem.downloadId);
    }
  }, delay);
}

/**
 * Download with retry logic and exponential backoff
 * @param {string} url - URL to download
 * @param {string} filename - Filename for download
 * @param {string} conflictAction - 'overwrite' or 'uniquify'
 * @param {number} attempt - Current attempt number (for recursion)
 * @returns {Promise<Object>} Download result
 */
async function downloadWithRetry(url, filename, conflictAction, attempt = 1) {
  try {
    const downloadId = await browser.downloads.download({
      url: url,
      filename: filename,
      conflictAction: conflictAction,
      saveAs: false
    });

    console.log(`[R34 Tools] Download started (attempt ${attempt}):`, filename);
    return { success: true, downloadId, conflictAction, attempts: attempt };
  } catch (error) {
    console.error(`[R34 Tools] Download attempt ${attempt} failed:`, error.message);

    // Retry if we haven't exceeded max attempts
    if (attempt < MAX_RETRY_ATTEMPTS) {
      const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
      console.log(`[R34 Tools] Retrying in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return downloadWithRetry(url, filename, conflictAction, attempt + 1);
    }

    // All retries failed
    return {
      success: false,
      error: error.message,
      attempts: attempt
    };
  }
}

/**
 * Reset rate limit state
 */
function resetRateLimitState() {
  if (rateLimitState.backoffTimeoutId) {
    clearTimeout(rateLimitState.backoffTimeoutId);
  }
  rateLimitState.isRateLimited = false;
  rateLimitState.backoffLevel = 0;
  rateLimitState.backoffEndTime = null;
  rateLimitState.testDownloadId = null;
  rateLimitState.backoffTimeoutId = null;
  rateLimitState.pausedDownloads = [];
}

/**
 * Calculate queue statistics
 */
function getQueueStats() {
  const stats = {
    downloading: 0,
    paused: 0,
    completed: 0,
    failed: 0
  };

  // Count items in download queue
  downloadQueue.forEach(item => {
    if (item.state === 'downloading' || item.state === 'retrying') {
      stats.downloading++;
    } else if (item.state === 'completed') {
      stats.completed++;
    } else if (item.state === 'failed') {
      stats.failed++;
    }
    // Note: Don't count 'paused' items here - they're in rateLimitState.pausedDownloads
  });

  // Add items from paused downloads array (these are the rate-limited ones)
  stats.paused = rateLimitState.pausedDownloads.length;

  return stats;
}

/**
 * Broadcast queue stats to all tabs
 */
async function broadcastQueueStats() {
  const stats = getQueueStats();

  try {
    const tabs = await browser.tabs.query({ url: '*://rule34.xxx/*' });
    tabs.forEach(tab => {
      browser.tabs.sendMessage(tab.id, {
        action: 'queueStatsUpdate',
        stats: stats
      }).catch(() => {}); // Ignore errors from closed tabs
    });
  } catch (error) {
    console.error('[R34 Tools Queue] Failed to broadcast stats:', error);
  }
}

/**
 * Trigger global rate limit backoff
 */
function triggerRateLimitBackoff() {
  // Calculate backoff delay: 10s, 20s, 30s, 30s, 30s...
  const delays = [10000, 20000, 30000];
  const delay = delays[Math.min(rateLimitState.backoffLevel, delays.length - 1)];
  const delaySeconds = (delay / 1000).toFixed(1);

  console.log(`[R34 Tools Queue] Rate limit triggered, pausing queue for ${delaySeconds}s (level ${rateLimitState.backoffLevel})`);

  rateLimitState.isRateLimited = true;
  rateLimitState.backoffEndTime = Date.now() + delay;

  // Cancel all pending retry timeouts
  downloadQueue.forEach(item => {
    if (item.retryTimeoutId) {
      clearTimeout(item.retryTimeoutId);
      item.retryTimeoutId = null;
    }
  });

  // Notify content script about the pause
  const pausedCount = rateLimitState.pausedDownloads.length;
  if (pausedCount > 0) {
    const firstItem = rateLimitState.pausedDownloads[0];
    if (firstItem.tabId) {
      browser.tabs.sendMessage(firstItem.tabId, {
        action: 'downloadNotification',
        type: 'rateLimitPause',
        pausedCount: pausedCount,
        backoffSeconds: Math.round(delay / 1000)
      }).catch(() => {});
    }
  }

  // Schedule resumption
  rateLimitState.backoffTimeoutId = setTimeout(() => {
    resumeQueueAfterBackoff();
  }, delay);
}

/**
 * Resume queue after backoff period
 */
async function resumeQueueAfterBackoff() {
  console.log('[R34 Tools Queue] Backoff period ended, testing with single download');

  // Check if there are paused downloads
  if (rateLimitState.pausedDownloads.length === 0) {
    resetRateLimitState();
    return;
  }

  // Take ONE download to test if rate limit cleared
  const testDownload = rateLimitState.pausedDownloads.shift();
  rateLimitState.testDownloadId = testDownload.downloadId;

  try {
    // Attempt the test download
    const downloadId = await browser.downloads.download({
      url: testDownload.url,
      filename: testDownload.filename,
      conflictAction: testDownload.conflictAction,
      saveAs: false
    });

    console.log(`[R34 Tools Queue] Test download started with ID ${downloadId}`);

    // Update tracking
    downloadQueue.delete(testDownload.downloadId);
    testDownload.downloadId = downloadId;
    testDownload.state = 'downloading';
    rateLimitState.testDownloadId = downloadId;
    downloadQueue.set(downloadId, testDownload);

    // Don't resume queue yet - wait for this download to succeed/fail
    // The onChanged listener will handle next steps

  } catch (error) {
    console.error('[R34 Tools Queue] Test download failed to start:', error);
    // Re-trigger backoff with escalation
    rateLimitState.backoffLevel++;
    triggerRateLimitBackoff();
  }
}

/**
 * Handle successful test download - resume queue gradually
 */
function onTestDownloadSuccess() {
  console.log('[R34 Tools Queue] Test download succeeded, resuming queue gradually');

  rateLimitState.testDownloadId = null;

  // Reset backoff level since we're successful again
  rateLimitState.backoffLevel = 0;

  // Resume paused downloads with staggered timing
  const STAGGER_DELAY = 300; // 300ms between each download
  const totalCount = rateLimitState.pausedDownloads.length;

  rateLimitState.pausedDownloads.forEach((pausedItem, index) => {
    setTimeout(async () => {
      try {
        console.log(`[R34 Tools Queue] Resuming download ${index + 1}/${totalCount}:`, pausedItem.filename);

        const downloadId = await browser.downloads.download({
          url: pausedItem.url,
          filename: pausedItem.filename,
          conflictAction: pausedItem.conflictAction,
          saveAs: false
        });

        // Update queue tracking
        downloadQueue.delete(pausedItem.downloadId);
        pausedItem.downloadId = downloadId;
        pausedItem.state = 'downloading';
        downloadQueue.set(downloadId, pausedItem);

      } catch (error) {
        console.error('[R34 Tools Queue] Failed to resume download:', error);
        pausedItem.error = error.message;
        pausedItem.state = 'failed';

        // Send failure notification
        if (pausedItem.tabId) {
          browser.tabs.sendMessage(pausedItem.tabId, {
            action: 'downloadNotification',
            type: 'failed',
            filename: pausedItem.filename,
            attempts: pausedItem.attempts
          }).catch(() => {});
        }
      }
    }, index * STAGGER_DELAY);
  });

  // Clear the paused queue
  rateLimitState.pausedDownloads = [];

  // Clear rate limit flag
  rateLimitState.isRateLimited = false;

  // Broadcast stats update
  broadcastQueueStats();
}

// =============================================================================
// KEYBOARD COMMAND HANDLERS
// =============================================================================

// Listen for keyboard commands (Ctrl+Q, Ctrl+Shift+S)
browser.commands.onCommand.addListener(async (command) => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    // Only activate on rule34.xxx pages
    if (!tab || !tab.url.includes('rule34.xxx')) {
      console.log('[R34 Tools] Not on rule34.xxx, ignoring command');
      return;
    }

    // Forward command to content script
    if (command === 'download-media') {
      console.log('[R34 Tools] Download media command triggered');
      await browser.tabs.sendMessage(tab.id, { action: 'downloadMedia' });
    } else if (command === 'save-page') {
      console.log('[R34 Tools] Save page command triggered');
      await browser.tabs.sendMessage(tab.id, { action: 'savePage' });
    }
  } catch (error) {
    console.error('[R34 Tools] Command handler error:', error);
  }
});

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

// Listen for messages from content script
browser.runtime.onMessage.addListener(async (message, sender) => {
  // Download media file
  if (message.action === 'download') {
    try {
      // Get user's preferences
      const settings = await browser.storage.local.get({
        conflictAction: 'overwrite',
        autoRetryDownloads: true,
        maxDownloadRetries: 5
      });

      console.log('[R34 Tools] Download request:', message.filename);

      const tabId = sender.tab ? sender.tab.id : null;

      // Check if we're currently rate limited
      if (rateLimitState.isRateLimited) {
        console.log('[R34 Tools Queue] Rate limited - adding to paused queue:', message.filename);

        // Create a queue item without starting the download
        const queueItem = {
          downloadId: null, // Will be assigned when actually started
          url: message.url,
          filename: message.filename,
          conflictAction: settings.conflictAction,
          attempts: 1,
          maxAttempts: Math.min(settings.maxDownloadRetries, 10),
          tabId: tabId,
          state: 'paused',
          error: null,
          retryTimeoutId: null
        };

        // Add to paused queue
        rateLimitState.pausedDownloads.push(queueItem);

        // Broadcast stats update
        broadcastQueueStats();

        return { success: true, paused: true };
      }

      // Not rate limited - start download normally
      const downloadId = await browser.downloads.download({
        url: message.url,
        filename: message.filename,
        conflictAction: settings.conflictAction,
        saveAs: false
      });

      // Add to queue if auto-retry enabled
      if (settings.autoRetryDownloads) {
        addToQueue(
          downloadId,
          message.url,
          message.filename,
          settings.conflictAction,
          Math.min(settings.maxDownloadRetries, 10), // Cap at 10
          tabId
        );
      }

      console.log(`[R34 Tools] Download started with ID ${downloadId}`);
      return { success: true, downloadId };
    } catch (error) {
      console.error('[R34 Tools] Download error:', error);
      return { success: false, error: error.message };
    }
  }

  // Save page metadata as JSON
  if (message.action === 'savePageJson') {
    try {
      // Create filename with full timestamp
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
      const filename = `${timestamp}_r34.json`;

      console.log('[R34 Tools] Saving page metadata:', filename);

      // Create blob and object URL
      const blob = new Blob([JSON.stringify(message.data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);

      // Download JSON file
      const downloadId = await browser.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      });

      // Wait for download to complete
      const waitForDownload = new Promise((resolve) => {
        const listener = (delta) => {
          if (delta.id === downloadId && delta.state) {
            const state = delta.state.current;
            if (state === 'complete' || state === 'interrupted') {
              browser.downloads.onChanged.removeListener(listener);
              resolve(state);
            }
          }
        };

        browser.downloads.onChanged.addListener(listener);

        // Timeout after 5 seconds
        setTimeout(() => {
          browser.downloads.onChanged.removeListener(listener);
          resolve('timeout');
        }, DOWNLOAD_TIMEOUT_MS);
      });

      const finalState = await waitForDownload;

      // Clean up object URL
      URL.revokeObjectURL(url);

      if (finalState === 'complete') {
        console.log('[R34 Tools] Page metadata saved successfully');
        return { success: true, downloadId, filename };
      } else {
        console.error(`[R34 Tools] Page metadata save ${finalState}`);
        return { success: false, error: `Download ${finalState}` };
      }
    } catch (error) {
      console.error('[R34 Tools] File save failed:', error);
      return { success: false, error: error.message };
    }
  }
});

// =============================================================================
// DOWNLOAD STATE MONITORING
// =============================================================================

// Monitor download state changes for queue management
browser.downloads.onChanged.addListener(async (downloadDelta) => {
  const downloadId = downloadDelta.id;
  const queueItem = downloadQueue.get(downloadId);

  // Ignore downloads not in our queue
  if (!queueItem) return;

  // Handle state changes
  if (downloadDelta.state) {
    const newState = downloadDelta.state.current;

    // Download completed successfully
    if (newState === 'complete') {
      console.log(`[R34 Tools Queue] Download complete:`, queueItem.filename);

      queueItem.state = 'completed';

      // Check if this was the test download
      if (queueItem.downloadId === rateLimitState.testDownloadId) {
        onTestDownloadSuccess();
      }

      // Send success notification to content script
      if (queueItem.tabId) {
        browser.tabs.sendMessage(queueItem.tabId, {
          action: 'downloadNotification',
          type: 'success',
          filename: queueItem.filename,
          attempts: queueItem.attempts
        }).catch(err => console.log('[R34 Tools Queue] Tab closed, cannot send notification'));
      }

      // Broadcast stats update
      broadcastQueueStats();

      // Remove from queue after delay
      removeFromQueue(downloadId);
    }

    // Download failed/interrupted
    else if (newState === 'interrupted') {
      const errorMsg = downloadDelta.error ? downloadDelta.error.current : 'Unknown error';
      console.error(`[R34 Tools Queue] Download interrupted:`, queueItem.filename, errorMsg);

      queueItem.error = errorMsg;

      // Check if this is a rate limit error
      const isRateLimitError =
        errorMsg.includes('429') ||
        errorMsg.toLowerCase().includes('rate') ||
        errorMsg.toLowerCase().includes('too many requests');

      if (isRateLimitError) {
        console.log('[R34 Tools Queue] Rate limit error detected');

        // Add this download to paused queue
        queueItem.state = 'paused';
        rateLimitState.pausedDownloads.push(queueItem);

        // Trigger global backoff if not already active
        if (!rateLimitState.isRateLimited) {
          triggerRateLimitBackoff();
        }

        // Broadcast stats update
        broadcastQueueStats();

        // Don't process normal retry logic for rate-limited downloads
        return;
      }

      // Non-rate-limit error - use normal retry logic
      const settings = await browser.storage.local.get({
        autoRetryDownloads: true
      });

      if (settings.autoRetryDownloads && queueItem.attempts < queueItem.maxAttempts) {
        // Retry with exponential backoff
        console.log(`[R34 Tools Queue] Attempting retry (${queueItem.attempts + 1}/${queueItem.maxAttempts})`);
        await retryDownload(queueItem);
      } else {
        // Max retries reached or auto-retry disabled
        console.error(`[R34 Tools Queue] Download failed after ${queueItem.attempts} attempt(s):`, queueItem.filename);

        queueItem.state = 'failed';

        // Send final failure notification
        if (queueItem.tabId) {
          browser.tabs.sendMessage(queueItem.tabId, {
            action: 'downloadNotification',
            type: 'failed',
            filename: queueItem.filename,
            attempts: queueItem.attempts
          }).catch(err => console.log('[R34 Tools Queue] Tab closed, cannot send notification'));
        }

        // Broadcast stats update
        broadcastQueueStats();

        // Remove from queue
        removeFromQueue(downloadId);
      }
    }
  }
});

// =============================================================================
// INSTALLATION HANDLER
// =============================================================================

// Show options page on first install
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[R34 Tools] Extension installed, opening options page');
    browser.tabs.create({
      url: browser.runtime.getURL('options.html')
    });
  } else if (details.reason === 'update') {
    console.log('[R34 Tools] Extension updated to version', browser.runtime.getManifest().version);
  }
});

console.log('[R34 Tools] Background script loaded');
