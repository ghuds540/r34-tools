// Background script for handling downloads and commands

// Listen for keyboard commands
browser.commands.onCommand.addListener(async (command) => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab || !tab.url.includes('rule34.xxx')) {
    console.log('Not on rule34.xxx page');
    return;
  }

  if (command === 'download-media') {
    browser.tabs.sendMessage(tab.id, { action: 'downloadMedia' });
  } else if (command === 'save-page') {
    browser.tabs.sendMessage(tab.id, { action: 'savePage' });
  }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === 'download') {
    try {
      // Get user's conflict action preference
      const settings = await browser.storage.local.get({ conflictAction: 'uniquify' });
      const conflictAction = settings.conflictAction;

      const downloadId = await browser.downloads.download({
        url: message.url,
        filename: message.filename,
        conflictAction: conflictAction,
        saveAs: false
      });

      return { success: true, downloadId, conflictAction };
    } catch (error) {
      console.error('Download failed:', error);
      return { success: false, error: error.message };
    }
  }

  if (message.action === 'appendToFile') {
    try {
      console.log('Saving file with content length:', message.content?.length);

      // Get settings for file path
      const settings = await browser.storage.local.get(['tagsFilePath']);
      const baseFilename = settings.tagsFilePath || 'rule34_saved_pages.txt';

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const finalFilename = baseFilename.replace('.txt', `_${timestamp}.txt`);

      const blob = new Blob([message.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      console.log('Starting download:', finalFilename);

      const downloadId = await browser.downloads.download({
        url: url,
        filename: finalFilename,
        saveAs: false
      });

      console.log('Download started with ID:', downloadId);

      // Wait for download to complete before revoking URL
      const waitForDownload = new Promise((resolve) => {
        const listener = (delta) => {
          if (delta.id === downloadId && delta.state) {
            console.log('Download state changed:', delta.state.current);
            if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
              browser.downloads.onChanged.removeListener(listener);
              resolve(delta.state.current);
            }
          }
        };
        browser.downloads.onChanged.addListener(listener);

        // Fallback timeout after 5 seconds
        setTimeout(() => {
          browser.downloads.onChanged.removeListener(listener);
          resolve('timeout');
        }, 5000);
      });

      const finalState = await waitForDownload;
      console.log('Download finished with state:', finalState);

      URL.revokeObjectURL(url);

      if (finalState === 'complete') {
        return { success: true, downloadId, filename: finalFilename };
      } else {
        return { success: false, error: `Download ${finalState}` };
      }
    } catch (error) {
      console.error('File save failed:', error);
      return { success: false, error: error.message };
    }
  }
});

// Show notification on install
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    browser.tabs.create({
      url: browser.runtime.getURL('options.html')
    });
  }
});
