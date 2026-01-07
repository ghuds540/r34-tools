// Options page logic

let isRecording = false;
let currentRecordingInput = null;

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
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
    highQualityPreviews: true,
    alwaysUseFullResolution: false,
    autoLoadVideoEmbeds: true,
    autoStartEmbedVideos: true,
    thumbnailScale: 1.0
  });

  document.getElementById('conflictAction').value = settings.conflictAction;
  document.getElementById('amoledTheme').checked = settings.amoledTheme;
  document.getElementById('compactHeader').checked = settings.compactHeader;
  document.getElementById('duplicatePagination').checked = settings.duplicatePagination;
  document.getElementById('highQualityPreviews').checked = settings.highQualityPreviews;
  document.getElementById('alwaysUseFullResolution').checked = settings.alwaysUseFullResolution;
  document.getElementById('autoLoadVideoEmbeds').checked = settings.autoLoadVideoEmbeds;
  document.getElementById('autoStartEmbedVideos').checked = settings.autoStartEmbedVideos;
  document.getElementById('thumbnailScale').value = settings.thumbnailScale.toString();

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
  document.getElementById('amoledTheme').addEventListener('change', autoSaveSettings);
  document.getElementById('compactHeader').addEventListener('change', autoSaveSettings);
  document.getElementById('duplicatePagination').addEventListener('change', autoSaveSettings);
  document.getElementById('highQualityPreviews').addEventListener('change', autoSaveSettings);
  document.getElementById('alwaysUseFullResolution').addEventListener('change', autoSaveSettings);
  document.getElementById('autoLoadVideoEmbeds').addEventListener('change', autoSaveSettings);
  document.getElementById('autoStartEmbedVideos').addEventListener('change', autoSaveSettings);
  document.getElementById('thumbnailScale').addEventListener('change', autoSaveSettings);

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

  // Video embed checkboxes - disable autostart when auto load is unchecked
  const autoLoadVideoCheckbox = document.getElementById('autoLoadVideoEmbeds');
  const autoStartVideoCheckbox = document.getElementById('autoStartEmbedVideos');

  autoLoadVideoCheckbox.addEventListener('change', () => {
    if (!autoLoadVideoCheckbox.checked) {
      autoStartVideoCheckbox.disabled = true;
      autoStartVideoCheckbox.parentElement.style.opacity = '0.5';
    } else {
      autoStartVideoCheckbox.disabled = false;
      autoStartVideoCheckbox.parentElement.style.opacity = '1';
    }
  });

  // Set initial state
  if (!autoLoadVideoCheckbox.checked) {
    autoStartVideoCheckbox.disabled = true;
    autoStartVideoCheckbox.parentElement.style.opacity = '0.5';
  }
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
    highQualityPreviews: document.getElementById('highQualityPreviews').checked,
    alwaysUseFullResolution: document.getElementById('alwaysUseFullResolution').checked,
    autoLoadVideoEmbeds: document.getElementById('autoLoadVideoEmbeds').checked,
    autoStartEmbedVideos: document.getElementById('autoStartEmbedVideos').checked,
    thumbnailScale: parseFloat(document.getElementById('thumbnailScale').value)
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
    highQualityPreviews: true,
    alwaysUseFullResolution: false,
    autoLoadVideoEmbeds: true,
    autoStartEmbedVideos: true,
    thumbnailScale: 1.0
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
