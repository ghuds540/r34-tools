// Background script for handling downloads and commands
// Enhanced with retry logic and improved error handling

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const DOWNLOAD_TIMEOUT_MS = 5000;

// Native messaging constants
const NATIVE_HOST_NAME = 'com.r34tools.native_host';
const NATIVE_TIMEOUT_MS = 3000;

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

// =============================================================================
// NATIVE MESSAGING
// =============================================================================

/**
 * Send message to native host with timeout
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} Response from host
 */
async function sendNativeMessage(message) {
  // Check if native messaging is enabled
  const settings = await browser.storage.local.get({ enableNativeHost: false });

  if (!settings.enableNativeHost) {
    console.log('[R34 Tools] Native host disabled in settings');
    return { success: false, error: 'Native host disabled' };
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Native host timeout')), NATIVE_TIMEOUT_MS)
    );

    const messagePromise = browser.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      message
    );

    const response = await Promise.race([messagePromise, timeoutPromise]);
    console.log('[R34 Tools] Native host response:', response);
    return response;
  } catch (error) {
    console.error('[R34 Tools] Native host error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test native host connection
 * @returns {Promise<boolean>} True if host is available
 */
async function testNativeHost() {
  try {
    const response = await sendNativeMessage({
      action: 'getStats',
      data: {}
    });
    return response.success === true;
  } catch (error) {
    return false;
  }
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
  // Check duplicate via native host
  if (message.action === 'checkDuplicate') {
    try {
      const response = await sendNativeMessage({
        action: 'checkDuplicate',
        data: { postId: message.postId }
      });
      return response;
    } catch (error) {
      console.error('[R34 Tools] Duplicate check failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Record download via native host
  if (message.action === 'recordDownload') {
    try {
      const response = await sendNativeMessage({
        action: 'recordDownload',
        data: message.data
      });
      return response;
    } catch (error) {
      console.error('[R34 Tools] Record download failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Test native host connection
  if (message.action === 'testNativeHost') {
    const isAvailable = await testNativeHost();
    return { success: true, available: isAvailable };
  }

  // Download media file
  if (message.action === 'download') {
    try {
      // Get user's conflict action preference
      const settings = await browser.storage.local.get({ conflictAction: 'overwrite' });
      const conflictAction = settings.conflictAction;

      console.log('[R34 Tools] Download request:', message.filename);

      // Download with retry logic
      const result = await downloadWithRetry(
        message.url,
        message.filename,
        conflictAction
      );

      if (result.success) {
        console.log(`[R34 Tools] Download successful after ${result.attempts} attempt(s)`);
      } else {
        console.error(`[R34 Tools] Download failed after ${result.attempts} attempt(s)`);
      }

      return result;
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
