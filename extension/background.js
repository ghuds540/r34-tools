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
      const settings = await browser.storage.local.get({ conflictAction: 'overwrite' });
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

  if (message.action === 'savePageJson') {
    try {
      // Create filename with full timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
      const filename = `${timestamp}_r34.json`;

      const blob = new Blob([JSON.stringify(message.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const downloadId = await browser.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      });

      // Wait for download to complete
      const waitForDownload = new Promise((resolve) => {
        const listener = (delta) => {
          if (delta.id === downloadId && delta.state) {
            if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
              browser.downloads.onChanged.removeListener(listener);
              resolve(delta.state.current);
            }
          }
        };
        browser.downloads.onChanged.addListener(listener);
        setTimeout(() => {
          browser.downloads.onChanged.removeListener(listener);
          resolve('timeout');
        }, 5000);
      });

      const finalState = await waitForDownload;
      URL.revokeObjectURL(url);

      if (finalState === 'complete') {
        return { success: true, downloadId, filename };
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
