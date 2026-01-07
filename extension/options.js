// Options page logic

let isRecording = false;
let currentRecordingInput = null;

// Apply theme to options page based on AMOLED setting
async function applyOptionsTheme() {
  const settings = await browser.storage.local.get({ amoledTheme: true });

  if (settings.amoledTheme) {
    document.body.classList.add('amoled-theme');
    document.body.classList.remove('default-theme');
  } else {
    document.body.classList.add('default-theme');
    document.body.classList.remove('amoled-theme');
  }
}

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  await applyOptionsTheme();
  await loadSettings();
  setupEventListeners();
  await loadCurrentShortcuts();
});

// Load settings from storage
async function loadSettings() {
  const settings = await browser.storage.local.get({
    conflictAction: 'overwrite',
    downloadKey: '',
    savePageKey: '',
    amoledTheme: true,
    compactHeader: true,
    duplicatePagination: false,
    hideTagWiki: false,
    hideTagAdd: false,
    hideTagRemove: false,
    hideTagBookmark: false,
    highQualityPreviews: true,
    alwaysUseFullResolution: false,
    autoLoadVideoEmbeds: true,
    autoStartEmbedVideos: true,
    maxAutoplayVideos: 5,
    thumbnailScale: 1.0,
    showMediaDimensions: true,
    autoPlayPostVideos: false,
    autoPauseOnTabLeave: false,
    autoUnmuteOnInteraction: false,
    defaultVideoVolume: 0.5,
    theaterMode: false,
    centerAlignContent: false,
    centerAlignListContent: false,
    autoRetryDownloads: true,
    maxDownloadRetries: 5,
    initialRetryDelay: 1000
  });

  document.getElementById('conflictAction').value = settings.conflictAction;
  document.getElementById('autoRetryDownloads').checked = settings.autoRetryDownloads;
  document.getElementById('maxDownloadRetries').value = settings.maxDownloadRetries;
  document.getElementById('amoledTheme').checked = settings.amoledTheme;
  document.getElementById('compactHeader').checked = settings.compactHeader;
  document.getElementById('duplicatePagination').checked = settings.duplicatePagination;
  document.getElementById('hideTagWiki').checked = settings.hideTagWiki;
  document.getElementById('hideTagAdd').checked = settings.hideTagAdd;
  document.getElementById('hideTagRemove').checked = settings.hideTagRemove;
  document.getElementById('hideTagBookmark').checked = settings.hideTagBookmark;
  document.getElementById('highQualityPreviews').checked = settings.highQualityPreviews;
  document.getElementById('alwaysUseFullResolution').checked = settings.alwaysUseFullResolution;
  document.getElementById('autoLoadVideoEmbeds').checked = settings.autoLoadVideoEmbeds;
  document.getElementById('autoStartEmbedVideos').checked = settings.autoStartEmbedVideos;
  document.getElementById('maxAutoplayVideos').value = settings.maxAutoplayVideos;
  document.getElementById('thumbnailScale').value = settings.thumbnailScale;
  document.getElementById('showMediaDimensions').checked = settings.showMediaDimensions;
  document.getElementById('autoPlayPostVideos').checked = settings.autoPlayPostVideos;
  document.getElementById('autoPauseOnTabLeave').checked = settings.autoPauseOnTabLeave;
  document.getElementById('autoUnmuteOnInteraction').checked = settings.autoUnmuteOnInteraction;
  document.getElementById('defaultVideoVolume').value = Math.round(settings.defaultVideoVolume * 100);
  document.getElementById('volumeValue').textContent = Math.round(settings.defaultVideoVolume * 100) + '%';
  document.getElementById('theaterMode').checked = settings.theaterMode;
  document.getElementById('centerAlignContent').checked = settings.centerAlignContent;
  document.getElementById('centerAlignListContent').checked = settings.centerAlignListContent;

  if (settings.downloadKey) {
    document.getElementById('currentDownloadKey').textContent = settings.downloadKey;
  }
  if (settings.savePageKey) {
    document.getElementById('currentPageKey').textContent = settings.savePageKey;
  }
}

// Load current shortcuts from browser commands
async function loadCurrentShortcuts() {
  try {
    const commands = await browser.commands.getAll();

    for (const command of commands) {
      if (command.name === 'download-media' && command.shortcut) {
        document.getElementById('currentDownloadKey').textContent = command.shortcut;
      } else if (command.name === 'save-page' && command.shortcut) {
        document.getElementById('currentPageKey').textContent = command.shortcut;
      }
    }
  } catch (error) {
    console.error('Failed to load shortcuts:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Shortcut setting buttons
  document.getElementById('setDownloadKey').addEventListener('click', () => {
    startRecording('downloadKey', 'download-media');
  });

  document.getElementById('setPageKey').addEventListener('click', () => {
    startRecording('savePageKey', 'save-page');
  });

  // Clear buttons
  document.getElementById('clearDownloadKey').addEventListener('click', () => {
    clearShortcut('downloadKey', 'download-media');
  });

  document.getElementById('clearPageKey').addEventListener('click', () => {
    clearShortcut('savePageKey', 'save-page');
  });

  // Reset settings button
  document.getElementById('resetSettings').addEventListener('click', resetSettings);

  // Auto-save on change for all settings
  document.getElementById('conflictAction').addEventListener('change', autoSaveSettings);
  document.getElementById('amoledTheme').addEventListener('change', async () => {
    await autoSaveSettings();
    await applyOptionsTheme();
  });
  document.getElementById('compactHeader').addEventListener('change', autoSaveSettings);
  document.getElementById('duplicatePagination').addEventListener('change', autoSaveSettings);
  document.getElementById('hideTagWiki').addEventListener('change', autoSaveSettings);
  document.getElementById('hideTagAdd').addEventListener('change', autoSaveSettings);
  document.getElementById('hideTagRemove').addEventListener('change', autoSaveSettings);
  document.getElementById('hideTagBookmark').addEventListener('change', autoSaveSettings);
  document.getElementById('highQualityPreviews').addEventListener('change', autoSaveSettings);
  document.getElementById('alwaysUseFullResolution').addEventListener('change', autoSaveSettings);
  document.getElementById('autoLoadVideoEmbeds').addEventListener('change', autoSaveSettings);
  document.getElementById('autoStartEmbedVideos').addEventListener('change', autoSaveSettings);
  document.getElementById('maxAutoplayVideos').addEventListener('change', autoSaveSettings);
  document.getElementById('thumbnailScale').addEventListener('change', autoSaveSettings);
  document.getElementById('showMediaDimensions').addEventListener('change', autoSaveSettings);
  document.getElementById('autoPlayPostVideos').addEventListener('change', autoSaveSettings);
  document.getElementById('autoPauseOnTabLeave').addEventListener('change', autoSaveSettings);
  document.getElementById('autoUnmuteOnInteraction').addEventListener('change', autoSaveSettings);
  document.getElementById('theaterMode').addEventListener('change', autoSaveSettings);
  document.getElementById('centerAlignContent').addEventListener('change', autoSaveSettings);
  document.getElementById('centerAlignListContent').addEventListener('change', autoSaveSettings);
  document.getElementById('autoRetryDownloads').addEventListener('change', autoSaveSettings);
  document.getElementById('maxDownloadRetries').addEventListener('change', autoSaveSettings);

  // Volume slider - update display and save
  document.getElementById('defaultVideoVolume').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('volumeValue').textContent = value + '%';
    
    // Update slider gradient for webkit browsers (Chrome, Edge, Safari)
    const percent = value;
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    const borderLight = getComputedStyle(document.body).getPropertyValue('--border-light').trim();
    e.target.style.background = `linear-gradient(to right, ${accent} 0%, ${accent} ${percent}%, ${borderLight} ${percent}%, ${borderLight} 100%)`;
  });
  document.getElementById('defaultVideoVolume').addEventListener('change', autoSaveSettings);

  // Set initial gradient on load
  const volumeSlider = document.getElementById('defaultVideoVolume');
  const initialValue = volumeSlider.value;
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
  const borderLight = getComputedStyle(document.body).getPropertyValue('--border-light').trim();
  volumeSlider.style.background = `linear-gradient(to right, ${accent} 0%, ${accent} ${initialValue}%, ${borderLight} ${initialValue}%, ${borderLight} 100%)`;

  // Preview quality checkboxes - disable first when second is checked
  const highQualityCheckbox = document.getElementById('highQualityPreviews');
  const fullResCheckbox = document.getElementById('alwaysUseFullResolution');

  fullResCheckbox.addEventListener('change', () => {
    if (fullResCheckbox.checked) {
      highQualityCheckbox.disabled = true;
      highQualityCheckbox.parentElement.style.opacity = '0.5';
    } else {
      highQualityCheckbox.disabled = false;
      highQualityCheckbox.parentElement.style.opacity = '1';
    }
  });

  // Set initial state
  if (fullResCheckbox.checked) {
    highQualityCheckbox.disabled = true;
    highQualityCheckbox.parentElement.style.opacity = '0.5';
  }

  // Video embed checkboxes - disable autostart and max videos when auto load is unchecked
  const autoLoadVideoCheckbox = document.getElementById('autoLoadVideoEmbeds');
  const autoStartVideoCheckbox = document.getElementById('autoStartEmbedVideos');
  const maxAutoplaySelect = document.getElementById('maxAutoplayVideos');

  function updateVideoAutoplayDependents() {
    const autoLoadEnabled = autoLoadVideoCheckbox.checked;
    const autoStartEnabled = autoStartVideoCheckbox.checked;
    
    // Disable autostart when auto load is off
    if (!autoLoadEnabled) {
      autoStartVideoCheckbox.disabled = true;
      autoStartVideoCheckbox.parentElement.style.opacity = '0.5';
      maxAutoplaySelect.disabled = true;
      maxAutoplaySelect.parentElement.style.opacity = '0.5';
    } else {
      autoStartVideoCheckbox.disabled = false;
      autoStartVideoCheckbox.parentElement.style.opacity = '1';
      
      // Disable max autoplay when autostart is off
      if (!autoStartEnabled) {
        maxAutoplaySelect.disabled = true;
        maxAutoplaySelect.parentElement.style.opacity = '0.5';
      } else {
        maxAutoplaySelect.disabled = false;
        maxAutoplaySelect.parentElement.style.opacity = '1';
      }
    }
  }

  autoLoadVideoCheckbox.addEventListener('change', updateVideoAutoplayDependents);
  autoStartVideoCheckbox.addEventListener('change', updateVideoAutoplayDependents);

  // Set initial state
  updateVideoAutoplayDependents();
}

// Start recording keyboard shortcut
function startRecording(inputId, commandName) {
  const input = document.getElementById(inputId);
  currentRecordingInput = { inputId, commandName };
  isRecording = true;

  input.value = 'Press key combination...';
  input.style.background = '#fff3cd';

  // Listen for keydown (without { once: true } so we can keep listening for modifiers)
  document.addEventListener('keydown', recordKeyPress);
  document.addEventListener('keyup', cancelRecordingOnEscape);
}

// Cancel recording with Escape
function cancelRecordingOnEscape(event) {
  if (event.key === 'Escape' && isRecording) {
    const input = document.getElementById(currentRecordingInput.inputId);
    input.value = '';
    input.style.background = '';

    isRecording = false;
    currentRecordingInput = null;

    document.removeEventListener('keydown', recordKeyPress);
    document.removeEventListener('keyup', cancelRecordingOnEscape);

    showStatus('Shortcut recording cancelled', 'info');
  }
}

// Record key press
function recordKeyPress(event) {
  event.preventDefault();

  if (!isRecording) return;

  // Check if this is only a modifier key
  const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'];
  if (modifierKeys.includes(event.key)) {
    // Just a modifier - keep waiting for the actual key
    const input = document.getElementById(currentRecordingInput.inputId);
    const mods = [];
    if (event.ctrlKey) mods.push('Ctrl');
    if (event.altKey) mods.push('Alt');
    if (event.shiftKey) mods.push('Shift');
    if (event.metaKey) mods.push('Meta');
    input.value = mods.join('+') + '+...';
    return;
  }

  // We have a non-modifier key - build the full shortcut
  const keys = [];

  if (event.ctrlKey) keys.push('Ctrl');
  if (event.altKey) keys.push('Alt');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Meta');

  // Add the main key
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  keys.push(key);

  const shortcut = keys.join('+');

  const input = document.getElementById(currentRecordingInput.inputId);
  input.value = shortcut;
  input.style.background = '';

  // Update the current shortcut display
  const currentSpan = document.getElementById('current' + currentRecordingInput.inputId.charAt(0).toUpperCase() + currentRecordingInput.inputId.slice(1).replace('Key', ''));
  if (currentSpan) {
    currentSpan.textContent = shortcut;
  }

  // Save to storage
  const setting = {};
  setting[currentRecordingInput.inputId] = shortcut;
  browser.storage.local.set(setting);

  // Try to update the browser command (this may not work in all Firefox versions)
  try {
    browser.commands.update({
      name: currentRecordingInput.commandName,
      shortcut: shortcut
    }).catch(err => {
      console.log('Command update not supported, shortcut saved to storage');
    });
  } catch (error) {
    console.log('Commands API not fully supported');
  }

  showStatus('Shortcut updated successfully!', 'success');

  isRecording = false;
  currentRecordingInput = null;

  // Remove event listeners
  document.removeEventListener('keydown', recordKeyPress);
  document.removeEventListener('keyup', cancelRecordingOnEscape);
}

// Clear shortcut
function clearShortcut(inputId, commandName) {
  const input = document.getElementById(inputId);
  input.value = '';

  const setting = {};
  setting[inputId] = '';
  browser.storage.local.set(setting);

  // Reset to default
  try {
    browser.commands.reset(commandName).catch(err => {
      console.log('Command reset not supported');
    });
  } catch (error) {
    console.log('Commands API not fully supported');
  }

  showStatus('Shortcut cleared', 'info');
  loadCurrentShortcuts();
}

// Auto-save settings when changed
async function autoSaveSettings() {
  const settings = {
    conflictAction: document.getElementById('conflictAction').value,
    amoledTheme: document.getElementById('amoledTheme').checked,
    compactHeader: document.getElementById('compactHeader').checked,
    duplicatePagination: document.getElementById('duplicatePagination').checked,
    hideTagWiki: document.getElementById('hideTagWiki').checked,
    hideTagAdd: document.getElementById('hideTagAdd').checked,
    hideTagRemove: document.getElementById('hideTagRemove').checked,
    hideTagBookmark: document.getElementById('hideTagBookmark').checked,
    highQualityPreviews: document.getElementById('highQualityPreviews').checked,
    alwaysUseFullResolution: document.getElementById('alwaysUseFullResolution').checked,
    autoLoadVideoEmbeds: document.getElementById('autoLoadVideoEmbeds').checked,
    autoStartEmbedVideos: document.getElementById('autoStartEmbedVideos').checked,
    maxAutoplayVideos: parseInt(document.getElementById('maxAutoplayVideos').value),
    thumbnailScale: parseFloat(document.getElementById('thumbnailScale').value),
    showMediaDimensions: document.getElementById('showMediaDimensions').checked,
    autoPlayPostVideos: document.getElementById('autoPlayPostVideos').checked,
    autoPauseOnTabLeave: document.getElementById('autoPauseOnTabLeave').checked,
    autoUnmuteOnInteraction: document.getElementById('autoUnmuteOnInteraction').checked,
    defaultVideoVolume: parseInt(document.getElementById('defaultVideoVolume').value) / 100,
    theaterMode: document.getElementById('theaterMode').checked,
    centerAlignContent: document.getElementById('centerAlignContent').checked,
    centerAlignListContent: document.getElementById('centerAlignListContent').checked,
    autoRetryDownloads: document.getElementById('autoRetryDownloads').checked,
    maxDownloadRetries: parseInt(document.getElementById('maxDownloadRetries').value)
  };

  await browser.storage.local.set(settings);
  showStatus('Saved', 'success');
}

// Reset settings to defaults
async function resetSettings() {
  const defaults = {
    conflictAction: 'overwrite',
    downloadKey: '',
    savePageKey: '',
    amoledTheme: true,
    compactHeader: true,
    duplicatePagination: false,
    hideTagWiki: false,
    hideTagAdd: false,
    hideTagRemove: false,
    hideTagBookmark: false,
    highQualityPreviews: true,
    alwaysUseFullResolution: false,
    autoLoadVideoEmbeds: true,
    autoStartEmbedVideos: true,
    maxAutoplayVideos: 5,
    thumbnailScale: 1.0,
    showMediaDimensions: true,
    autoPlayPostVideos: false,
    autoPauseOnTabLeave: false,
    autoUnmuteOnInteraction: false,
    defaultVideoVolume: 0.5,
    theaterMode: false,
    centerAlignContent: false,
    centerAlignListContent: false,
    autoRetryDownloads: true,
    maxDownloadRetries: 5,
    initialRetryDelay: 1000
  };

  await browser.storage.local.set(defaults);

  // Reset command shortcuts
  try {
    await browser.commands.reset('download-media');
    await browser.commands.reset('save-page');
  } catch (error) {
    console.log('Commands API not fully supported');
  }

  await loadSettings();
  await loadCurrentShortcuts();

  document.getElementById('downloadKey').value = '';
  document.getElementById('savePageKey').value = '';

  showStatus('Settings reset to defaults', 'success');
}

// Show status message
function showStatus(message, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  status.style.display = 'block';

  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}
