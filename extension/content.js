// Content script for R34 Tools extension - Refactored with modular architecture
// This orchestrates all functionality using specialized modules

(function() {
  'use strict';

  // Import all dependencies from modules via global namespace
  const {
    COLORS, SELECTORS, PANEL_STYLES, AMOLED_THEME_RULES, COMPACT_HEADER_STYLES,
    SVG_ICONS, TIMINGS, CLASS_NAMES
  } = window.R34Tools;

  const { settingsManager } = window.R34Tools;

  const {
    findPostLink, extractPostId, isPostPage, isListPage, delay, debounce,
    safeQuerySelector, safeQuerySelectorAll
  } = window.R34Tools;

  const {
    isVideoThumbnail, processVideoThumbnail, processedVideos, checkedPostIds
  } = window.R34Tools;

  const {
    upgradeImageWithFallback, processMaxQualityUpgrade, processedImages
  } = window.R34Tools;

  const { Rule34Extractor } = window.R34Tools;

  const {
    showNotification, createStyledButton, setupThumbnailButtons, displayUpgradeResults
  } = window.R34Tools;

  const {
    downloadFromCurrentPage, savePageData, handleThumbnailDownloadClick, handleThumbnailFullResClick
  } = window.R34Tools;

  // =============================================================================
  // MESSAGE HANDLERS
  // =============================================================================

  // Listen for messages from background script
  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'downloadMedia') {
      await downloadFromCurrentPage();
    } else if (message.action === 'savePage') {
      await savePageData();
    }
  });

  // =============================================================================
  // SIDEBAR CONTROLS PANEL
  // =============================================================================

  /**
   * Create floating buttons for post pages (download, save)
   */
  function createFloatingButtons() {
    if (!isPostPage()) return;

    const existingPanel = document.getElementById('r34-tools-floating-buttons');
    if (existingPanel) return;

    const panel = document.createElement('div');
    panel.id = 'r34-tools-floating-buttons';
    panel.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 9998;
    `;

    // Download button
    const downloadBtn = createStyledButton(
      '⬇',
      'Download',
      'Download highest quality media (Ctrl+Q)',
      COLORS.accent.green,
      () => downloadFromCurrentPage()
    );

    // Save button
    const saveBtn = createStyledButton(
      '🔖',
      'Save Page',
      'Save page metadata (Ctrl+Shift+S)',
      COLORS.accent.blue,
      () => savePageData()
    );

    panel.appendChild(downloadBtn);
    panel.appendChild(saveBtn);
    document.body.appendChild(panel);
  }

  /**
   * Create extension controls panel in sidebar
   */
  function createExtensionControlsPanel() {
    if (!isListPage()) return;

    const existingPanel = document.getElementById('r34-extension-controls');
    if (existingPanel) return;

    const controlsPanel = document.createElement('div');
    controlsPanel.id = 'r34-extension-controls';
    controlsPanel.style.cssText = `
      background: ${PANEL_STYLES.background};
      border: ${PANEL_STYLES.border};
      border-bottom: ${PANEL_STYLES.borderBottom};
      padding: ${PANEL_STYLES.padding};
      margin: ${PANEL_STYLES.margin};
      border-radius: ${PANEL_STYLES.borderRadius};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${PANEL_STYLES.gap};
    `;

    // Add save page button
    buttonsContainer.appendChild(createStyledButton(
      '🔖',
      'Save Page',
      'Save current page URL and metadata',
      COLORS.accent.green,
      () => savePageData()
    ));

    // Add force max quality button
    buttonsContainer.appendChild(createStyledButton(
      '⚡',
      'Force Max Quality',
      'Load highest quality for all visible images',
      COLORS.accent.blue,
      () => forceLoadAllMaxQuality()
    ));

    // Add force load videos button
    buttonsContainer.appendChild(createStyledButton(
      '▶',
      'Force Load Videos',
      'Load all videos on page',
      COLORS.accent.pink,
      () => forceLoadAllVideos()
    ));

    controlsPanel.appendChild(buttonsContainer);

    // Insert panel into sidebar
    const searchForm = safeQuerySelector(SELECTORS.searchForm);
    const sidebar = safeQuerySelector(SELECTORS.sidebar);

    if (searchForm && searchForm.parentNode) {
      searchForm.parentNode.insertBefore(controlsPanel, searchForm.nextSibling);
    } else if (sidebar) {
      sidebar.insertBefore(controlsPanel, sidebar.firstChild);
    } else {
      // Fixed position fallback
      controlsPanel.style.position = 'fixed';
      controlsPanel.style.top = '10px';
      controlsPanel.style.left = '10px';
      controlsPanel.style.width = '200px';
      controlsPanel.style.zIndex = '9999';
      document.body.appendChild(controlsPanel);
    }
  }

  // =============================================================================
  // IMAGE/VIDEO DOWNLOAD BUTTON FOR POST PAGES
  // =============================================================================

  /**
   * Create download button that appears on image/video hover
   */
  function createImageDownloadButton() {
    const imageElement = safeQuerySelector(SELECTORS.imageElement);
    if (!imageElement) return;

    // Check if button already exists
    if (document.querySelector('.r34-post-download-btn')) return;

    let wrapper = imageElement.parentElement;
    if (!wrapper.classList.contains('r34-tools-wrapper')) {
      const newWrapper = document.createElement('div');
      newWrapper.className = 'r34-tools-wrapper';
      newWrapper.style.cssText = `
        position: relative;
        display: inline-block;
        line-height: 0;
      `;
      imageElement.parentNode.insertBefore(newWrapper, imageElement);
      newWrapper.appendChild(imageElement);
      wrapper = newWrapper;
    }

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'r34-post-download-btn';
    downloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${SVG_ICONS.download}
      </svg>
    `;
    downloadBtn.title = 'Download full resolution (Ctrl+Q)';
    downloadBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, ${COLORS.accent.green} 0%, ${COLORS.accent.greenDark} 100%);
      color: ${COLORS.accent.black};
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      transition: all ${TIMINGS.buttonTransition}ms ease;
      opacity: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    `;

    downloadBtn.onmouseover = () => {
      downloadBtn.style.transform = 'scale(1.1)';
      downloadBtn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.6)';
    };

    downloadBtn.onmouseout = () => {
      downloadBtn.style.transform = 'scale(1)';
      downloadBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
    };

    downloadBtn.onclick = () => downloadFromCurrentPage();

    wrapper.appendChild(downloadBtn);

    // Show/hide button on hover
    const showButton = () => {
      downloadBtn.style.opacity = '1';
      downloadBtn.style.pointerEvents = 'auto';
    };

    const hideButton = () => {
      downloadBtn.style.opacity = '0';
      downloadBtn.style.pointerEvents = 'none';
    };

    wrapper.addEventListener('mouseenter', showButton);
    wrapper.addEventListener('mouseleave', hideButton);
    imageElement.addEventListener('mouseenter', showButton);
  }

  // =============================================================================
  // FORCE LOAD ALL MAX QUALITY - REFACTORED
  // =============================================================================

  /**
   * Force load all thumbnails at maximum quality
   * Refactored from 220 lines to ~40 lines
   */
  async function forceLoadAllMaxQuality() {
    const settings = await settingsManager.getAll();
    const thumbnails = safeQuerySelectorAll(SELECTORS.thumbnails);

    if (thumbnails.length === 0) {
      showNotification('No thumbnails found on this page', 'info');
      return;
    }

    showNotification(`Loading max quality for ${thumbnails.length} images...`, 'info');

    const results = { success: 0, failed: 0, skippedVideos: 0 };

    for (const img of thumbnails) {
      await processMaxQualityUpgrade(img, settings, results);
      await delay(TIMINGS.serverRequestDelay);
    }

    displayUpgradeResults(results);
  }

  // =============================================================================
  // FORCE LOAD ALL VIDEOS - REFACTORED
  // =============================================================================

  /**
   * Force load all video thumbnails
   * Refactored from 180 lines to ~40 lines
   */
  async function forceLoadAllVideos() {
    const settings = await settingsManager.getAll();
    const thumbnails = safeQuerySelectorAll(SELECTORS.thumbnails);

    if (thumbnails.length === 0) {
      showNotification('No thumbnails found', 'info');
      return;
    }

    const videoThumbnails = Array.from(thumbnails).filter(isVideoThumbnail);

    if (videoThumbnails.length === 0) {
      showNotification('No video thumbnails found on this page', 'info');
      return;
    }

    showNotification(`Loading ${videoThumbnails.length} videos...`, 'info');

    let loaded = 0;
    for (const img of videoThumbnails) {
      await processVideoThumbnail(img, settings);
      loaded++;
      await delay(TIMINGS.videoRequestDelay);
    }

    showNotification(`Loaded ${loaded} videos`, 'success');
  }

  // =============================================================================
  // COMPACT HEADER MODE
  // =============================================================================

  /**
   * Remove right sidebar for cleaner layout
   */
  function removeRightSidebar() {
    const rightSidebar = safeQuerySelector(SELECTORS.rightSidebar);
    if (rightSidebar) {
      rightSidebar.remove();
    }
  }

  /**
   * Apply compact header mode (hide navbar/header)
   */
  async function applyCompactHeader() {
    const settings = await settingsManager.getAll();
    if (!settings.compactHeader) return;

    const navbar = safeQuerySelector(SELECTORS.navbar);
    const subnavbar = safeQuerySelector(SELECTORS.subnavbar);
    const header = safeQuerySelector(SELECTORS.header);
    const radios = safeQuerySelectorAll(SELECTORS.radios);

    // Hide elements
    [navbar, subnavbar, header].forEach(el => {
      if (el) el.style.display = 'none';
    });

    radios.forEach(el => {
      if (el) el.style.display = 'none';
    });

    // Create toggle panel in sidebar
    const sidebar = safeQuerySelector(SELECTORS.sidebar);
    if (!sidebar || document.getElementById('r34-compact-header-toggle')) return;

    const togglePanel = document.createElement('div');
    togglePanel.id = 'r34-compact-header-toggle';
    togglePanel.style.cssText = `
      background: ${COMPACT_HEADER_STYLES.panel.background};
      border: ${COMPACT_HEADER_STYLES.panel.border};
      padding: ${COMPACT_HEADER_STYLES.panel.padding};
      margin: 8px 0;
      border-radius: ${COMPACT_HEADER_STYLES.panel.borderRadius};
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    `;

    const logoImg = document.createElement('img');
    logoImg.src = 'https://rule34.xxx/layout/logo2020.png';
    logoImg.style.cssText = 'height: 24px; width: auto;';

    const arrowBtn = document.createElement('button');
    arrowBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${SVG_ICONS.arrowDown}
      </svg>
    `;
    arrowBtn.style.cssText = `
      background: none;
      border: 1px solid ${COMPACT_HEADER_STYLES.button.borderColorInactive};
      border-radius: 4px;
      color: ${COMPACT_HEADER_STYLES.panel.color};
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      margin-left: auto;
    `;

    let headerVisible = false;
    togglePanel.onclick = () => {
      headerVisible = !headerVisible;
      [navbar, subnavbar, header].forEach(el => {
        if (el) el.style.display = headerVisible ? 'block' : 'none';
      });

      arrowBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${headerVisible ? SVG_ICONS.arrowUp : SVG_ICONS.arrowDown}
        </svg>
      `;

      if (headerVisible) {
        arrowBtn.style.borderColor = COMPACT_HEADER_STYLES.button.borderColorActive;
        arrowBtn.style.background = COMPACT_HEADER_STYLES.button.backgroundActive;
      } else {
        arrowBtn.style.borderColor = COMPACT_HEADER_STYLES.button.borderColorInactive;
        arrowBtn.style.background = COMPACT_HEADER_STYLES.button.backgroundInactive;
      }
    };

    togglePanel.appendChild(logoImg);
    togglePanel.appendChild(arrowBtn);
    sidebar.insertBefore(togglePanel, sidebar.firstChild);
  }

  // =============================================================================
  // AMOLED DARK THEME
  // =============================================================================

  /**
   * Apply AMOLED dark theme (pure black with green accents)
   */
  async function applyAmoledTheme() {
    const settings = await settingsManager.getAll();
    if (!settings.amoledTheme) return;

    if (document.getElementById('r34-amoled-theme')) return;

    const style = document.createElement('style');
    style.id = 'r34-amoled-theme';
    style.textContent = `
      body { ${AMOLED_THEME_RULES.body} }
      #content, .content { ${AMOLED_THEME_RULES.content} }
      #leftmenu, .sidebar, aside { ${AMOLED_THEME_RULES.sidebar} }
      #navbar, #subnavbar, #header, header { ${AMOLED_THEME_RULES.navigation} }
      p, div, span, li { ${AMOLED_THEME_RULES.text} }
      input, select, textarea { ${AMOLED_THEME_RULES.inputs} }
      button { ${AMOLED_THEME_RULES.buttons} }
      a { ${AMOLED_THEME_RULES.links} }
      a:hover { ${AMOLED_THEME_RULES.linksHover} }
      .thumb, .thumbnail { ${AMOLED_THEME_RULES.panels} }
      .pagination, .paginator { ${AMOLED_THEME_RULES.cards} }
      table, th, td { ${AMOLED_THEME_RULES.borders} }
    `;

    document.head.appendChild(style);
  }

  // =============================================================================
  // SAVE ICONS ON TAG LINKS
  // =============================================================================

  /**
   * Add save icons to tag links (for quick saving)
   */
  function addSaveIconsToLinks() {
    const tagLinks = safeQuerySelectorAll(SELECTORS.allTags);

    tagLinks.forEach(link => {
      if (link.parentElement.querySelector(`.${CLASS_NAMES.saveLinkIcon}`)) return;

      const saveIcon = document.createElement('span');
      saveIcon.className = CLASS_NAMES.saveLinkIcon;
      saveIcon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${SVG_ICONS.bookmark}
        </svg>
      `;
      saveIcon.style.cssText = `
        margin-left: 4px;
        cursor: pointer;
        opacity: 0.5;
        transition: opacity ${TIMINGS.buttonTransition}ms;
        display: inline-block;
        vertical-align: middle;
      `;

      saveIcon.onmouseover = () => saveIcon.style.opacity = '1';
      saveIcon.onmouseout = () => saveIcon.style.opacity = '0.5';

      saveIcon.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        savePageData();
      };

      link.parentElement.appendChild(saveIcon);
    });
  }

  // =============================================================================
  // THUMBNAIL DOWNLOAD BUTTONS - REFACTORED
  // =============================================================================

  /**
   * Add download and full-res buttons to all thumbnails
   * Refactored from 647 lines to ~40 lines
   */
  function addThumbnailDownloadButtons() {
    const thumbnails = safeQuerySelectorAll(SELECTORS.thumbnails);

    thumbnails.forEach(img => {
      // Skip if already processed
      if (img.parentElement.querySelector(`.${CLASS_NAMES.thumbDownload}`)) return;

      const postLink = findPostLink(img);
      if (!postLink) return;

      // Setup buttons using ui-components module
      const { wrapper, downloadBtn, fullResBtn, qualityBadge } = setupThumbnailButtons(img, postLink);

      // Attach click handlers using download-handler module
      downloadBtn.onclick = (e) => handleThumbnailDownloadClick(e, postLink.href);
      fullResBtn.onclick = (e) => handleThumbnailFullResClick(e, img, postLink.href, wrapper);
    });
  }

  // =============================================================================
  // AUTO-LOAD VIDEO THUMBNAILS - REFACTORED
  // =============================================================================

  let isLoadingVideos = false;

  /**
   * Auto-load video thumbnails into playable embeds
   * Refactored from 285 lines to ~40 lines
   */
  async function autoLoadVideoThumbnails() {
    if (isLoadingVideos) return;

    const settings = await settingsManager.getAll();
    if (!settings.autoLoadVideoEmbeds) return;

    const images = safeQuerySelectorAll(SELECTORS.thumbnails);
    const unprocessedImages = Array.from(images).filter(img => !processedVideos.has(img));

    if (unprocessedImages.length === 0) return;

    console.log('[R34 Tools] Found', unprocessedImages.length, 'new thumbnails to check for videos');
    isLoadingVideos = true;

    for (const img of unprocessedImages) {
      await processVideoThumbnail(img, settings);
      await delay(TIMINGS.videoRequestDelay);
    }

    console.log('[R34 Tools] Finished processing thumbnails');
    isLoadingVideos = false;
  }

  // =============================================================================
  // UPGRADE TO SAMPLE QUALITY - REFACTORED
  // =============================================================================

  /**
   * Upgrade thumbnail images to sample quality
   * Refactored from 87 lines to ~30 lines
   */
  async function upgradeToSampleQuality() {
    const settings = await settingsManager.getAll();

    const shouldUpgrade = settings.highQualityPreviews || settings.alwaysUseFullResolution;
    if (!shouldUpgrade) return;

    const preferFullRes = settings.alwaysUseFullResolution;
    const thumbnails = safeQuerySelectorAll(SELECTORS.thumbnails);

    for (const img of thumbnails) {
      if (!processedImages.has(img)) {
        await upgradeImageWithFallback(img, preferFullRes);
      }
    }
  }

  // =============================================================================
  // WATCH FOR NEW IMAGES (PAGINATION/INFINITE SCROLL)
  // =============================================================================

  /**
   * Watch for new images added to the page
   */
  function watchForNewImages() {
    const debouncedUpgrade = debounce(() => {
      upgradeToSampleQuality();
      addThumbnailDownloadButtons();
      autoLoadVideoThumbnails();
    }, TIMINGS.mutationDebounce);

    const observer = new MutationObserver(debouncedUpgrade);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also poll periodically for dynamic content
    setInterval(() => {
      upgradeToSampleQuality();
      addThumbnailDownloadButtons();
    }, TIMINGS.imageCheckInterval);
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  /**
   * Initialize extension features
   */
  async function init() {
    console.log('[R34 Tools] Initializing extension...');

    // Apply theme and layout modifications first
    await applyAmoledTheme();
    await applyCompactHeader();
    removeRightSidebar();

    // Create UI elements
    createFloatingButtons();
    createExtensionControlsPanel();
    createImageDownloadButton();
    addSaveIconsToLinks();

    // Setup thumbnail features
    addThumbnailDownloadButtons();
    await upgradeToSampleQuality();

    // Watch for new content
    watchForNewImages();

    // Auto-load videos if enabled (delayed to let page settle)
    setTimeout(async () => {
      await autoLoadVideoThumbnails();
    }, TIMINGS.videoLoadDelay);

    console.log('[R34 Tools] Initialization complete');
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
