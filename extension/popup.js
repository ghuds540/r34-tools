// Popup script for quick actions
// Enhanced with loading states and better error handling

// Apply theme to popup based on AMOLED setting
async function applyPopupTheme() {
  const settings = await browser.storage.local.get({ amoledTheme: true });

  if (settings.amoledTheme) {
    document.body.classList.add('amoled-theme');
    document.body.classList.remove('default-theme');
  } else {
    document.body.classList.add('default-theme');
    document.body.classList.remove('amoled-theme');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await applyPopupTheme();
  document.getElementById('downloadBtn').addEventListener('click', downloadMedia);
  document.getElementById('savePageBtn').addEventListener('click', savePage);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
});

async function downloadMedia() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab.url.includes('rule34.xxx')) {
    showStatus('Please navigate to a rule34.xxx post page', 'error');
    return;
  }

  const button = document.getElementById('downloadBtn');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Downloading...';

    await browser.tabs.sendMessage(tab.id, { action: 'downloadMedia' });
    showStatus('Download started!', 'success');
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function savePage() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab.url.includes('rule34.xxx')) {
    showStatus('Please navigate to a rule34.xxx post page', 'error');
    return;
  }

  const button = document.getElementById('savePageBtn');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Saving...';

    await browser.tabs.sendMessage(tab.id, { action: 'savePage' });
    showStatus('Page saved for later!', 'success');
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    button.disabled = false;
    button.textContent = originalText;
  }
}

function openSettings() {
  browser.runtime.openOptionsPage();
  window.close();
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  status.style.display = 'block';
}
