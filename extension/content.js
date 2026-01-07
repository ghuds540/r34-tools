// Content script for R34 Tools extension - Refactored with modular architecture
// This orchestrates all functionality using specialized modules

(function() {
  'use strict';

  // Import all dependencies from modules via global namespace
  const {
    COLORS, SELECTORS, PANEL_STYLES, AMOLED_THEME_RULES, COMPACT_HEADER_STYLES,
    SVG_ICONS, TIMINGS, CLASS_NAMES, THUMBNAIL_SCALE_OPTIONS, BUTTON_STYLES,
    getThemeColors
  } = window.R34Tools;

  const { settingsManager } = window.R34Tools;

  const {
    findPostLink, extractPostId, isPostPage, isListPage, delay, debounce,
    safeQuerySelector, safeQuerySelectorAll
  } = window.R34Tools;

  const {
    isVideoThumbnail, processVideoThumbnail, processedVideos, checkedPostIds, resetAutoplayCounter
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
   * Create sidebar control panel for post/view pages (download, save)
   */
  async function createViewPageControlsPanel() {
    if (!isPostPage()) return;

    const existingPanel = document.getElementById('r34-view-controls');
    if (existingPanel) return;

    const settings = await settingsManager.getAll();

    const controlsPanel = document.createElement('div');
    controlsPanel.id = 'r34-view-controls';

    // Different styling for default theme
    if (settings.amoledTheme) {
      controlsPanel.style.cssText = `
        background: ${PANEL_STYLES.background};
        border: ${PANEL_STYLES.border};
        border-bottom: ${PANEL_STYLES.borderBottom};
        padding: ${PANEL_STYLES.padding};
        margin: ${PANEL_STYLES.margin};
        border-radius: ${PANEL_STYLES.borderRadius};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
    } else {
      controlsPanel.style.cssText = `
        background: hsl(114, 56%, 77%);
        border: none;
        padding: ${PANEL_STYLES.padding};
        margin: ${PANEL_STYLES.margin};
        border-radius: ${PANEL_STYLES.borderRadius};
      `;
    }

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${PANEL_STYLES.gap};
    `;

    // Save button
    buttonsContainer.appendChild(await createStyledButton(
      '🔖',
      'Save Page',
      'Save page metadata (Ctrl+Shift+S)',
      COLORS.accent.green,
      () => savePageData()
    ));

    // Download button
    buttonsContainer.appendChild(await createStyledButton(
      '⬇',
      'Download Media',
      'Download highest quality media (Ctrl+Q)',
      COLORS.accent.green,
      () => downloadFromCurrentPage()
    ));

    controlsPanel.appendChild(buttonsContainer);

    // Insert panel into sidebar
    const sidebar = safeQuerySelector(SELECTORS.sidebar);

    if (sidebar) {
      sidebar.insertBefore(controlsPanel, sidebar.firstChild);
    } else {
      // Fixed position fallback if no sidebar found
      controlsPanel.style.position = 'fixed';
      controlsPanel.style.top = '10px';
      controlsPanel.style.left = '10px';
      controlsPanel.style.width = '200px';
      controlsPanel.style.zIndex = '9999';
      document.body.appendChild(controlsPanel);
    }
  }

  /**
   * Create extension controls panel in sidebar
   */
  async function createExtensionControlsPanel() {
    if (!isListPage()) return;

    const existingPanel = document.getElementById('r34-extension-controls');
    if (existingPanel) return;

    const settings = await settingsManager.getAll();
    const theme = getThemeColors(settings);

    const controlsPanel = document.createElement('div');
    controlsPanel.id = 'r34-extension-controls';

    // Different styling for default theme
    if (settings.amoledTheme) {
      controlsPanel.style.cssText = `
        background: ${PANEL_STYLES.background};
        border: ${PANEL_STYLES.border};
        border-bottom: ${PANEL_STYLES.borderBottom};
        padding: ${PANEL_STYLES.padding};
        margin: ${PANEL_STYLES.margin};
        border-radius: ${PANEL_STYLES.borderRadius};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
    } else {
      controlsPanel.style.cssText = `
        background: hsl(114, 56%, 77%);
        border: none;
        padding: ${PANEL_STYLES.padding};
        margin: ${PANEL_STYLES.margin};
        border-radius: ${PANEL_STYLES.borderRadius};
      `;
    }

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${PANEL_STYLES.gap};
    `;

    // Add save page button
    buttonsContainer.appendChild(await createStyledButton(
      '🔖',
      'Save Page',
      'Save current page URL and metadata',
      COLORS.accent.green,
      () => savePageData()
    ));

    // Add force max quality button
    buttonsContainer.appendChild(await createStyledButton(
      '⚡',
      'Force Max Quality',
      'Load highest quality for all visible images',
      COLORS.accent.blue,
      () => forceLoadAllMaxQuality()
    ));

    // Add force load videos button
    buttonsContainer.appendChild(await createStyledButton(
      '▶',
      'Force Load Videos',
      'Load all videos on page',
      COLORS.accent.pink,
      () => forceLoadAllVideos()
    ));

    // Add thumbnail scale controls
    const scaleContainer = document.createElement('div');
    scaleContainer.style.cssText = `
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid ${COLORS.accent.grayDark};
    `;

    const scaleLabel = document.createElement('div');
    scaleLabel.textContent = 'Thumbnail Size:';
    scaleLabel.style.cssText = `
      color: ${settings.amoledTheme ? COLORS.accent.green : '#000000'};
      font-size: 11px;
      margin-bottom: 4px;
      font-weight: 600;
    `;
    scaleContainer.appendChild(scaleLabel);

    const scaleButtonsRow = document.createElement('div');
    scaleButtonsRow.style.cssText = `
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    `;

    // Create scale buttons
    THUMBNAIL_SCALE_OPTIONS.forEach(option => {
      const scaleBtn = document.createElement('button');
      scaleBtn.className = 'r34-scale-btn';
      scaleBtn.dataset.scale = option.value;
      scaleBtn.textContent = option.label;
      scaleBtn.title = `Set thumbnail scale to ${option.label}`;

      // Match sidebar button styling
      if (settings.amoledTheme) {
        scaleBtn.style.cssText = `
          flex: 1;
          min-width: 40px;
          padding: 4px 6px;
          border: 1px solid ${BUTTON_STYLES.panel.borderColor};
          border-radius: 2px;
          background: ${BUTTON_STYLES.panel.background};
          color: ${BUTTON_STYLES.panel.color};
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all ${TIMINGS.buttonTransition}ms ease;
        `;
      } else {
        scaleBtn.style.cssText = `
          flex: 1;
          min-width: 40px;
          padding: 4px 6px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.3);
          color: #333333;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all ${TIMINGS.buttonTransition}ms ease;
        `;
      }

      scaleBtn.onmouseover = () => {
        // Don't change hover state if button is active
        if (!scaleBtn.classList.contains('r34-scale-active')) {
          if (settings.amoledTheme) {
            scaleBtn.style.borderColor = BUTTON_STYLES.panel.borderColorHover;
            scaleBtn.style.background = BUTTON_STYLES.panel.backgroundHover;
          } else {
            scaleBtn.style.borderColor = 'rgba(0, 0, 0, 0.25)';
            scaleBtn.style.background = 'rgba(255, 255, 255, 0.5)';
          }
        }
      };

      scaleBtn.onmouseout = () => {
        // Don't change hover state if button is active
        if (!scaleBtn.classList.contains('r34-scale-active')) {
          if (settings.amoledTheme) {
            scaleBtn.style.borderColor = BUTTON_STYLES.panel.borderColor;
            scaleBtn.style.background = BUTTON_STYLES.panel.background;
          } else {
            scaleBtn.style.borderColor = 'rgba(0, 0, 0, 0.15)';
            scaleBtn.style.background = 'rgba(255, 255, 255, 0.3)';
          }
        }
      };

      scaleBtn.onclick = () => applyThumbnailScale(option.value);

      scaleButtonsRow.appendChild(scaleBtn);
    });

    scaleContainer.appendChild(scaleButtonsRow);
    buttonsContainer.appendChild(scaleContainer);

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
  async function createImageDownloadButton() {
    const imageElement = safeQuerySelector(SELECTORS.imageElement);
    if (!imageElement) return;

    // Check if button already exists
    if (document.querySelector('.r34-post-download-btn')) return;

    const settings = await settingsManager.getAll();
    const theme = getThemeColors(settings);

    const isVideo = imageElement.tagName === 'VIDEO';
    
    // For videos, use parent container; for images, create wrapper
    let wrapper = imageElement.parentElement;
    if (!isVideo && !wrapper.classList.contains('r34-tools-wrapper')) {
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
    
    // For videos, ensure parent has position relative
    if (isVideo && window.getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative';
    }

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'r34-post-download-btn';
    downloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${SVG_ICONS.download}
      </svg>
    `;
    downloadBtn.title = 'Download full resolution (Ctrl+Q)';

    // Different styling for AMOLED vs default theme
    if (settings.amoledTheme) {
      downloadBtn.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%);
        color: ${theme.background};
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
    } else {
      downloadBtn.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid ${theme.border};
        background: ${theme.backgroundLight};
        color: ${theme.text};
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all ${TIMINGS.buttonTransition}ms ease;
        opacity: 0;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      `;
    }

    downloadBtn.onmouseover = () => {
      downloadBtn.style.transform = 'scale(1.1)';
      if (settings.amoledTheme) {
        downloadBtn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.6)';
      } else {
        downloadBtn.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
        downloadBtn.style.borderColor = theme.primary;
      }
    };

    downloadBtn.onmouseout = () => {
      downloadBtn.style.transform = 'scale(1)';
      if (settings.amoledTheme) {
        downloadBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
      } else {
        downloadBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        downloadBtn.style.borderColor = theme.border;
      }
    };

    downloadBtn.onclick = () => downloadFromCurrentPage();

    wrapper.appendChild(downloadBtn);

    // Create resolution/sound info badge
    const infoBadge = document.createElement('div');
    infoBadge.className = 'r34-post-info-badge';
    
    // Get media dimensions and audio info
    const getMediaInfo = () => {
      if (isVideo) {
        const hasAudio = imageElement.mozHasAudio || 
                        Boolean(imageElement.webkitAudioDecodedByteCount) ||
                        Boolean(imageElement.audioTracks && imageElement.audioTracks.length);
        const width = imageElement.videoWidth || 0;
        const height = imageElement.videoHeight || 0;
        return { width, height, hasAudio, isVideo: true };
      } else {
        return { 
          width: imageElement.naturalWidth || 0, 
          height: imageElement.naturalHeight || 0, 
          hasAudio: false, 
          isVideo: false 
        };
      }
    };
    
    const updateInfoBadge = () => {
      const info = getMediaInfo();
      if (info.width && info.height) {
        const audioIcon = info.hasAudio ? '🔊' : (info.isVideo ? '🔇' : '');
        infoBadge.textContent = `${info.width}×${info.height}${audioIcon ? ' ' + audioIcon : ''}`;
        infoBadge.style.display = 'block';
      } else {
        infoBadge.style.display = 'none';
      }
    };
    
    // Style the info badge
    if (settings.amoledTheme) {
      infoBadge.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.8);
        color: ${theme.primary};
        font-size: 20px !important;
        font-weight: 600;
        font-family: monospace;
        pointer-events: none;
        z-index: 100;
        border: 1px solid ${theme.primary};
        display: none;
        line-height: 1.2;
      `;
    } else {
      infoBadge.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.9);
        color: ${theme.text};
        font-size: 20px !important;
        font-weight: 600;
        font-family: monospace;
        pointer-events: none;
        z-index: 100;
        border: 1px solid ${theme.border};
        display: none;
        line-height: 1.2;
      `;
    }
    
    wrapper.appendChild(infoBadge);
    
    // Update badge when metadata loads
    if (isVideo) {
      imageElement.addEventListener('loadedmetadata', updateInfoBadge);
      if (imageElement.readyState >= 1) {
        updateInfoBadge();
      }
    } else {
      if (imageElement.complete) {
        updateInfoBadge();
      }
      imageElement.addEventListener('load', updateInfoBadge);
    }

    // Show/hide button and badge on hover
    const showElements = () => {
      downloadBtn.style.opacity = '1';
      downloadBtn.style.pointerEvents = 'auto';
      infoBadge.style.display = 'block';
    };

    const hideElements = () => {
      downloadBtn.style.opacity = '0';
      downloadBtn.style.pointerEvents = 'none';
      infoBadge.style.display = 'none';
    };

    wrapper.addEventListener('mouseenter', showElements);
    wrapper.addEventListener('mouseleave', hideElements);
    imageElement.addEventListener('mouseenter', showElements);
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
  // THUMBNAIL SCALING
  // =============================================================================

  /**
   * Apply thumbnail scale to all thumbnails on the page
   * @param {number} scale - Scale multiplier (1.0, 1.25, 1.5, 1.75, 2.0)
   * @param {boolean} silent - If true, don't show notification
   */
  async function applyThumbnailScale(scale, silent = false) {
    // Save to settings (only if not silent, meaning user initiated)
    if (!silent) {
      await settingsManager.set({ thumbnailScale: scale });
    }

    // Apply scaling using CSS transform to maintain layout and prevent horizontal scroll
    const thumbnailContainers = document.querySelectorAll('.thumb, .thumbnail, span.thumb');

    thumbnailContainers.forEach(container => {
      if (scale !== 1.0) {
        // Get container dimensions if not already stored
        if (!container.dataset.originalWidth) {
          const computedStyle = window.getComputedStyle(container);
          container.dataset.originalWidth = parseFloat(computedStyle.width) || 150;
        }
        
        const originalWidth = parseFloat(container.dataset.originalWidth);
        
        // Use CSS transform to scale - maintains layout flow better than resizing
        container.style.transform = `scale(${scale})`;
        container.style.transformOrigin = 'top left';
        
        // Calculate margin needed to compensate for transform not affecting layout
        // We need to add spacing equal to (scale - 1) * originalWidth
        const extraSpace = (scale - 1) * originalWidth;
        
        container.style.marginRight = `${extraSpace}px`;
        container.style.marginBottom = `${extraSpace}px`;
        
        // Ensure inline-block display for proper wrapping
        container.style.display = 'inline-block';
        container.style.verticalAlign = 'top';
      } else {
        // Reset to original state
        container.style.transform = '';
        container.style.transformOrigin = '';
        container.style.marginRight = '';
        container.style.marginBottom = '';
        container.style.display = '';
        container.style.verticalAlign = '';
      }

      // Scale images and videos to fill container without cropping
      const img = container.querySelector('img');
      const video = container.querySelector('video');

      if (img) {
        // Use contain to scale up small images while preserving aspect ratio
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
      }

      if (video) {
        video.style.width = '100%';
        video.style.height = 'auto';
        video.style.objectFit = 'contain';
        video.style.display = 'block';
      }
    });

    // Update button highlights
    await updateScaleButtonHighlights(scale);

    if (!silent) {
      showNotification(`Thumbnail scale: ${scale}x`, 'success');
    }
  }

  /**
   * Update scale button highlights to show current scale
   * @param {number} currentScale - Current scale value
   */
  async function updateScaleButtonHighlights(currentScale) {
    const settings = await settingsManager.getAll();
    const theme = getThemeColors(settings);
    const scaleButtons = document.querySelectorAll('.r34-scale-btn');

    scaleButtons.forEach(btn => {
      const btnScale = parseFloat(btn.dataset.scale);
      if (btnScale === currentScale) {
        // Active button
        btn.classList.add('r34-scale-active');
        btn.style.background = theme.primary;
        btn.style.color = settings.amoledTheme ? theme.background : '#ffffff';
        btn.style.borderColor = theme.primary;
      } else {
        // Inactive button
        btn.classList.remove('r34-scale-active');
        if (settings.amoledTheme) {
          btn.style.background = theme.buttonBg;
          btn.style.color = theme.buttonText;
          btn.style.borderColor = theme.buttonBorder;
        } else {
          btn.style.background = 'rgba(255, 255, 255, 0.3)';
          btn.style.color = '#333333';
          btn.style.borderColor = 'rgba(0, 0, 0, 0.15)';
        }
      }
    });
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
   * Works on both list and view pages
   */
  async function applyCompactHeader() {
    const settings = await settingsManager.getAll();
    if (!settings.compactHeader) return;

    const theme = getThemeColors(settings);

    const navbar = safeQuerySelector(SELECTORS.navbar);
    const subnavbar = safeQuerySelector(SELECTORS.subnavbar);
    const header = safeQuerySelector(SELECTORS.header);
    const radios = safeQuerySelectorAll(SELECTORS.radios);

    // Create arrow button to toggle header visibility
    const arrowBtn = document.createElement('button');
    arrowBtn.id = 'r34-header-arrow';
    arrowBtn.textContent = '▼';
    arrowBtn.title = 'Toggle header visibility';
    arrowBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: ${theme.background};
      border: 1px solid ${theme.border};
      border-radius: 3px;
      color: ${theme.primary};
      font-size: 12px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      z-index: 10000;
    `;

    document.body.appendChild(arrowBtn);

    // Hide header elements by default
    if (navbar) navbar.style.display = 'none';
    if (subnavbar) subnavbar.style.display = 'none';
    radios.forEach(el => el.style.display = 'none');

    let headerVisible = false;

    arrowBtn.onclick = (e) => {
      e.stopPropagation();
      headerVisible = !headerVisible;

      if (headerVisible) {
        if (navbar) navbar.style.display = '';
        if (subnavbar) subnavbar.style.display = '';
        radios.forEach(el => el.style.display = '');
        arrowBtn.textContent = '▲';
      } else {
        if (navbar) navbar.style.display = 'none';
        if (subnavbar) subnavbar.style.display = 'none';
        radios.forEach(el => el.style.display = 'none');
        arrowBtn.textContent = '▼';
      }

      arrowBtn.style.transform = headerVisible ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    arrowBtn.onmouseover = () => {
      arrowBtn.style.borderColor = theme.primary;
      arrowBtn.style.background = theme.backgroundLight;
    };

    arrowBtn.onmouseout = () => {
      arrowBtn.style.borderColor = theme.border;
      arrowBtn.style.background = theme.background;
    };
  }

  // =============================================================================
  // DUPLICATE PAGINATION TO TOP
  // =============================================================================

  /**
   * Duplicate bottom pagination bar to top of content
   */
  async function duplicatePaginationToTop() {
    if (!isListPage()) return;

    const settings = await settingsManager.getAll();
    if (!settings.duplicatePagination) return;

    // Check if already duplicated
    if (document.querySelector('[data-r34-top-pagination]')) return;

    // Find the bottom pagination (could be .pagination or #paginator)
    const bottomPagination = safeQuerySelector(SELECTORS.pagination) || document.querySelector('#paginator');
    if (!bottomPagination) return;

    // Find the content div specifically - it's inside #post-list
    const postListDiv = document.querySelector('#post-list');
    if (!postListDiv) return;

    const contentDiv = postListDiv.querySelector('.content');
    if (!contentDiv) return;

    // Clone it deeply (including all child nodes and attributes)
    const topPagination = bottomPagination.cloneNode(true);

    // Remove ID to avoid duplicates (IDs must be unique)
    if (topPagination.id) {
      topPagination.removeAttribute('id');
    }

    // Remove IDs from all child elements too
    topPagination.querySelectorAll('[id]').forEach(element => {
      element.removeAttribute('id');
    });

    // Mark it as duplicated with data attribute
    topPagination.setAttribute('data-r34-top-pagination', 'true');

    // Copy critical computed styles from the original to preserve appearance
    const computedStyles = window.getComputedStyle(bottomPagination);
    const stylesToCopy = [
      'display', 'textAlign', 'padding', 'margin',
      'border', 'borderWidth', 'borderStyle', 'borderColor',
      'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
      'color', 'lineHeight', 'width', 'maxWidth'
    ];

    stylesToCopy.forEach(prop => {
      const value = computedStyles.getPropertyValue(prop);
      if (value && value !== 'none' && value !== 'auto') {
        topPagination.style[prop] = value;
      }
    });

    // Copy styles for child elements (links, buttons, spans) to preserve their appearance
    const originalLinks = bottomPagination.querySelectorAll('a, b, strong, span');
    const clonedLinks = topPagination.querySelectorAll('a, b, strong, span');

    originalLinks.forEach((originalEl, index) => {
      if (clonedLinks[index]) {
        const elStyles = window.getComputedStyle(originalEl);
        const linkStylesToCopy = ['color', 'textDecoration', 'fontWeight', 'padding', 'margin', 'border'];

        linkStylesToCopy.forEach(prop => {
          const value = elStyles.getPropertyValue(prop);
          if (value && value !== 'none') {
            clonedLinks[index].style[prop] = value;
          }
        });
      }
    });

    // Override margin-bottom for spacing between pagination and content
    topPagination.style.marginBottom = '16px';

    // Ensure center alignment (critical for matching original appearance)
    topPagination.style.textAlign = 'center';

    // Ensure display block if the original uses it
    if (computedStyles.display !== 'none') {
      topPagination.style.display = computedStyles.display;
    }

    // Insert as first child of content div (appears at top)
    contentDiv.insertBefore(topPagination, contentDiv.firstChild);
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
      p, div:not([class*="fluid"]):not([id*="fluid"]), span:not([class*="fluid"]), li { ${AMOLED_THEME_RULES.text} }
      input, select, textarea { ${AMOLED_THEME_RULES.inputs} }
      button { ${AMOLED_THEME_RULES.buttons} }
      button[type="submit"], input[type="submit"] { background: #00ff66 !important; color: #000000 !important; border-color: #00ff66 !important; }
      a { ${AMOLED_THEME_RULES.links} }
      a:hover { ${AMOLED_THEME_RULES.linksHover} }
      .thumb, .thumbnail { ${AMOLED_THEME_RULES.panels} }
      .pagination, .paginator, [data-r34-top-pagination] { ${AMOLED_THEME_RULES.cards} }
      [data-r34-top-pagination] a { ${AMOLED_THEME_RULES.links} }
      [data-r34-top-pagination] a:hover { ${AMOLED_THEME_RULES.linksHover} }
      table, th, td { ${AMOLED_THEME_RULES.borders} }
      .awesomplete ul { background: #000000 !important; border: 1px solid #333333 !important; }
      .awesomplete li { background: #000000 !important; color: #ffffff !important; }
      .awesomplete li:hover, .awesomplete li[aria-selected="true"] { background: #1a1a1a !important; }
      .awesomplete mark { background: #00ff66 !important; color: #000000 !important; }
      .${CLASS_NAMES.saveLinkIcon} { color: #00ff66 !important; }
      .${CLASS_NAMES.saveLinkIcon} svg { stroke: #00ff66 !important; }
      div.status-notice { background: #000000 !important; border-color: #333333 !important; color: #00ff66 !important; }

      /* Tag type color coding with neon theme - works on both list and post pages */
      .tag-type-artist a,
      li[class*="tag-type-artist"] a,
      ul li.tag-type-artist a,
      #tag-sidebar .tag-type-artist a { ${AMOLED_THEME_RULES.tagArtist} }
      .tag-type-artist a:hover,
      li[class*="tag-type-artist"] a:hover,
      ul li.tag-type-artist a:hover,
      #tag-sidebar .tag-type-artist a:hover { ${AMOLED_THEME_RULES.tagArtistHover} }

      .tag-type-character a,
      li[class*="tag-type-character"] a,
      ul li.tag-type-character a,
      #tag-sidebar .tag-type-character a { ${AMOLED_THEME_RULES.tagCharacter} }
      .tag-type-character a:hover,
      li[class*="tag-type-character"] a:hover,
      ul li.tag-type-character a:hover,
      #tag-sidebar .tag-type-character a:hover { ${AMOLED_THEME_RULES.tagCharacterHover} }

      .tag-type-copyright a,
      li[class*="tag-type-copyright"] a,
      ul li.tag-type-copyright a,
      #tag-sidebar .tag-type-copyright a { ${AMOLED_THEME_RULES.tagCopyright} }
      .tag-type-copyright a:hover,
      li[class*="tag-type-copyright"] a:hover,
      ul li.tag-type-copyright a:hover,
      #tag-sidebar .tag-type-copyright a:hover { ${AMOLED_THEME_RULES.tagCopyrightHover} }

      .tag-type-metadata a,
      .tag-type-meta a,
      li[class*="tag-type-metadata"] a,
      li[class*="tag-type-meta"] a,
      ul li.tag-type-metadata a,
      ul li.tag-type-meta a,
      #tag-sidebar .tag-type-metadata a,
      #tag-sidebar .tag-type-meta a { ${AMOLED_THEME_RULES.tagMeta} }
      .tag-type-metadata a:hover,
      .tag-type-meta a:hover,
      li[class*="tag-type-metadata"] a:hover,
      li[class*="tag-type-meta"] a:hover,
      ul li.tag-type-metadata a:hover,
      ul li.tag-type-meta a:hover,
      #tag-sidebar .tag-type-metadata a:hover,
      #tag-sidebar .tag-type-meta a:hover { ${AMOLED_THEME_RULES.tagMetaHover} }

      .tag-type-species a,
      li[class*="tag-type-species"] a,
      ul li.tag-type-species a,
      #tag-sidebar .tag-type-species a { ${AMOLED_THEME_RULES.tagSpecies} }
      .tag-type-species a:hover,
      li[class*="tag-type-species"] a:hover,
      ul li.tag-type-species a:hover,
      #tag-sidebar .tag-type-species a:hover { ${AMOLED_THEME_RULES.tagSpeciesHover} }

      .tag-type-general a,
      li[class*="tag-type-general"] a,
      ul li.tag-type-general a,
      #tag-sidebar .tag-type-general a,
      .tag a:not([class*="tag-type-"]) { ${AMOLED_THEME_RULES.tagGeneral} }
      .tag-type-general a:hover,
      li[class*="tag-type-general"] a:hover,
      ul li.tag-type-general a:hover,
      #tag-sidebar .tag-type-general a:hover,
      .tag a:not([class*="tag-type-"]):hover { ${AMOLED_THEME_RULES.tagGeneralHover} }

      /* Ensure video controls display properly */
      video::-webkit-media-controls-panel { display: flex !important; }
      video::-webkit-media-controls-current-time-display,
      video::-webkit-media-controls-time-remaining-display { display: block !important; }
    `;

    document.head.appendChild(style);
  }

  /**
   * Apply default theme styling for extension elements
   * Used when AMOLED theme is disabled
   */
  async function applyDefaultTheme() {
    const settings = await settingsManager.getAll();
    if (settings.amoledTheme) return;

    if (document.getElementById('r34-default-theme')) return;

    const style = document.createElement('style');
    style.id = 'r34-default-theme';
    style.textContent = `
      /* Floating post buttons */
      #r34-tools-floating-buttons button {
        background: #ffffff !important;
        border: 1px solid #3399ff !important;
        color: #3399ff !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
      }

      #r34-tools-floating-buttons button:hover {
        background: #3399ff !important;
        color: #ffffff !important;
      }

      /* Compact header arrow button */
      #r34-header-arrow {
        background: #ffffff !important;
        color: #333333 !important;
        border-color: #cccccc !important;
      }

      #r34-header-arrow:hover {
        background: #e8e8e8 !important;
        border-color: #3399ff !important;
      }

      /* Save icons */
      .r34-save-link-icon {
        color: #3399ff !important;
      }

      /* Quality badge on default theme */
      .r34-quality-badge {
        border: 1px solid #666666 !important;
      }

      /* Post download button on default theme */
      .r34-post-download-btn {
        opacity: 0.9 !important;
      }

      .r34-post-download-btn:hover {
        opacity: 1 !important;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Hide tag action buttons (?, +, -) and bookmark icons based on settings
   */
  async function hideTagActionButtons() {
    const settings = await settingsManager.getAll();

    // Build CSS rules based on which options are enabled
    let cssRules = [];

    if (settings.hideTagWiki) {
      cssRules.push(`
        /* Hide wiki/help (?) buttons - works on list and post pages */
        .tag-type-artist > a[href*="page=wiki"],
        .tag-type-character > a[href*="page=wiki"],
        .tag-type-copyright > a[href*="page=wiki"],
        .tag-type-general > a[href*="page=wiki"],
        .tag-type-metadata > a[href*="page=wiki"],
        .tag-type-meta > a[href*="page=wiki"],
        .tag-type-species > a[href*="page=wiki"],
        li[class*="tag-type"] > a[href*="page=wiki"],
        ul li[class*="tag-type"] > a[href*="page=wiki"],
        #tag-sidebar li[class*="tag-type"] > a[href*="page=wiki"] {
          display: none !important;
        }
      `);
    }

    if (settings.hideTagAdd) {
      cssRules.push(`
        /* Hide add (+) buttons - works on list and post pages */
        .tag-type-artist > a[onclick*='value += " "'],
        .tag-type-character > a[onclick*='value += " "'],
        .tag-type-copyright > a[onclick*='value += " "'],
        .tag-type-general > a[onclick*='value += " "'],
        .tag-type-metadata > a[onclick*='value += " "'],
        .tag-type-meta > a[onclick*='value += " "'],
        .tag-type-species > a[onclick*='value += " "'],
        li[class*="tag-type"] > a[onclick*='value += " "'],
        ul li[class*="tag-type"] > a[onclick*='value += " "'],
        #tag-sidebar li[class*="tag-type"] > a[onclick*='value += " "'] {
          display: none !important;
        }
      `);
    }

    if (settings.hideTagRemove) {
      cssRules.push(`
        /* Hide remove (-) buttons - works on list and post pages */
        .tag-type-artist > a[onclick*='value += " -"'],
        .tag-type-character > a[onclick*='value += " -"'],
        .tag-type-copyright > a[onclick*='value += " -"'],
        .tag-type-general > a[onclick*='value += " -"'],
        .tag-type-metadata > a[onclick*='value += " -"'],
        .tag-type-meta > a[onclick*='value += " -"'],
        .tag-type-species > a[onclick*='value += " -"'],
        li[class*="tag-type"] > a[onclick*='value += " -"'],
        ul li[class*="tag-type"] > a[onclick*='value += " -"'],
        #tag-sidebar li[class*="tag-type"] > a[onclick*='value += " -"'] {
          display: none !important;
        }
      `);
    }

    if (settings.hideTagBookmark) {
      cssRules.push(`
        /* Hide bookmark icons */
        .${CLASS_NAMES.saveLinkIcon} {
          display: none !important;
        }
      `);
    }

    // Only inject stylesheet if at least one option is enabled
    if (cssRules.length === 0) return;

    if (document.getElementById('r34-hide-tag-actions')) {
      document.getElementById('r34-hide-tag-actions').remove();
    }

    const style = document.createElement('style');
    style.id = 'r34-hide-tag-actions';
    style.textContent = cssRules.join('\n');

    document.head.appendChild(style);

    console.log('[R34 Tools] Applied tag hiding CSS:', {
      hideTagWiki: settings.hideTagWiki,
      hideTagAdd: settings.hideTagAdd,
      hideTagRemove: settings.hideTagRemove,
      hideTagBookmark: settings.hideTagBookmark
    });
  }

  // =============================================================================
  // SAVE ICONS ON TAG LINKS
  // =============================================================================

  /**
   * Add save icons to tag links (for quick saving)
   */
  async function addSaveIconsToLinks() {
    const settings = await settingsManager.getAll();
    const theme = getThemeColors(settings);
    const tagLinks = safeQuerySelectorAll(SELECTORS.allTags);

    tagLinks.forEach(link => {
      const parent = link.parentElement;
      if (parent.querySelector(`.${CLASS_NAMES.saveLinkIcon}`)) return;

      const saveIcon = document.createElement('span');
      saveIcon.className = CLASS_NAMES.saveLinkIcon;
      saveIcon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${SVG_ICONS.bookmark}
        </svg>
      `;
      saveIcon.style.cssText = `
        margin-right: 4px;
        cursor: pointer;
        opacity: 0.5;
        transition: opacity ${TIMINGS.buttonTransition}ms;
        display: inline-block;
        vertical-align: middle;
        color: ${theme.primary};
      `;

      saveIcon.onmouseover = () => saveIcon.style.opacity = '1';
      saveIcon.onmouseout = () => saveIcon.style.opacity = '0.5';

      saveIcon.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        savePageData();
      };

      // Insert at the beginning of the parent (before ? + - links)
      parent.insertBefore(saveIcon, parent.firstChild);
    });
  }

  // =============================================================================
  // THUMBNAIL DOWNLOAD BUTTONS - REFACTORED
  // =============================================================================

  /**
   * Add download and full-res buttons to all thumbnails
   * Refactored from 647 lines to ~40 lines
   */
  async function addThumbnailDownloadButtons() {
    const thumbnails = safeQuerySelectorAll(SELECTORS.thumbnails);
    console.log(`[R34 Tools] Processing ${thumbnails.length} thumbnails for button setup`);

    for (const img of thumbnails) {
      // Skip if already processed
      if (img.parentElement.querySelector(`.${CLASS_NAMES.thumbDownload}`)) continue;

      const postLink = findPostLink(img);
      if (!postLink) {
        console.warn('[R34 Tools] No post link found for thumbnail:', img);
        continue;
      }

      if (!postLink.href) {
        console.error('[R34 Tools] Post link has no href:', postLink);
        continue;
      }

      console.log('[R34 Tools] Setting up buttons for:', postLink.href);

      // Setup buttons using ui-components module
      const { wrapper, downloadBtn, fullResBtn, qualityBadge } = await setupThumbnailButtons(img, postLink);

      // Attach click handlers using download-handler module
      downloadBtn.onclick = (e) => handleThumbnailDownloadClick(e, postLink.href);
      fullResBtn.onclick = (e) => handleThumbnailFullResClick(e, img, postLink.href, wrapper);

      console.log('[R34 Tools] Buttons attached for:', postLink.href);
    }
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
    const debouncedUpgrade = debounce(async () => {
      upgradeToSampleQuality();
      await addThumbnailDownloadButtons();
      autoLoadVideoThumbnails();
    }, TIMINGS.mutationDebounce);

    const observer = new MutationObserver(debouncedUpgrade);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also poll periodically for dynamic content
    setInterval(async () => {
      upgradeToSampleQuality();
      await addThumbnailDownloadButtons();
    }, TIMINGS.imageCheckInterval);
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  /**
   * Auto-play video on video post pages if setting is enabled
   */
  async function handleVideoPostAutoplay() {
    const settings = await settingsManager.getAll();
    if (!settings.autoPlayPostVideos) return;

    // Check if we're on a video post page
    const urlParams = new URLSearchParams(window.location.search);
    const isPostPage = urlParams.get('page') === 'post' && urlParams.get('s') === 'view';
    if (!isPostPage) return;

    // Wait for video player to be ready
    const waitForVideo = setInterval(() => {
      const videoPlayer = document.querySelector('#gelcomVideoPlayer, video');
      if (videoPlayer) {
        clearInterval(waitForVideo);
        
        // Set default volume from settings
        videoPlayer.volume = settings.defaultVideoVolume;
        
        // Mute video first (required for auto-play in most browsers)
        videoPlayer.muted = true;
        
        // Function to attempt playback
        const attemptPlay = () => {
          videoPlayer.play().then(() => {
            console.log('[R34 Tools] Video auto-play started (muted)');
            
            // Unmute on first user interaction with the page (if enabled)
            if (settings.autoUnmuteOnInteraction) {
              const unmuteOnInteraction = () => {
                videoPlayer.muted = false;
                console.log('[R34 Tools] Video unmuted after user interaction at volume', videoPlayer.volume);
              };
              
              document.addEventListener('click', unmuteOnInteraction, { once: true });
              document.addEventListener('keydown', unmuteOnInteraction, { once: true });
            }
          }).catch(err => {
            console.log('[R34 Tools] Auto-play prevented by browser:', err);
          });
        };
        
        // Wait for metadata to be loaded before attempting play
        if (videoPlayer.readyState >= 1) {
          attemptPlay();
        } else {
          videoPlayer.addEventListener('loadedmetadata', attemptPlay, { once: true });
        }
      }
    }, 100);

    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(waitForVideo), 5000);
  }

  /**
   * Setup auto-pause when user leaves the tab
   */
  function setupVideoPauseOnTabLeave() {
    document.addEventListener('visibilitychange', async () => {
      const settings = await settingsManager.getAll();
      if (!settings.autoPauseOnTabLeave) return;

      const videoPlayer = document.querySelector('#gelcomVideoPlayer, video');
      if (!videoPlayer) return;

      if (document.hidden) {
        // Tab is hidden, pause the video
        if (!videoPlayer.paused) {
          videoPlayer.pause();
          // Mark that we paused it so we can resume it
          videoPlayer.dataset.pausedByExtension = 'true';
        }
      } else {
        // Tab is visible again, resume if we paused it
        if (videoPlayer.dataset.pausedByExtension === 'true') {
          videoPlayer.play().catch(err => {
            console.log('[R34 Tools] Auto-resume prevented by browser:', err);
          });
          delete videoPlayer.dataset.pausedByExtension;
        }
      }
    });
  }

  /**
   * Initialize extension features
   */
  async function init() {
    console.log('[R34 Tools] Initializing extension...');
    
    // Reset autoplay counter on page load
    resetAutoplayCounter();

    // Apply theme and layout modifications first
    await applyAmoledTheme();
    await applyDefaultTheme();
    await hideTagActionButtons();
    await applyCompactHeader();
    removeRightSidebar();
    await duplicatePaginationToTop();

    // Create UI elements
    await createViewPageControlsPanel();
    await createExtensionControlsPanel();
    await createImageDownloadButton();
    await addSaveIconsToLinks();

    // Apply saved thumbnail scale
    const settings = await settingsManager.getAll();
    if (settings.thumbnailScale && settings.thumbnailScale !== 1.0) {
      await applyThumbnailScale(settings.thumbnailScale, true); // Silent mode on page load
    } else {
      // Ensure buttons are highlighted for default scale
      await updateScaleButtonHighlights(settings.thumbnailScale || 1.0);
    }

    // Setup thumbnail features
    await addThumbnailDownloadButtons();
    await upgradeToSampleQuality();

    // Watch for new content
    watchForNewImages();

    // Auto-load videos if enabled (delayed to let page settle)
    setTimeout(async () => {
      await autoLoadVideoThumbnails();
    }, TIMINGS.videoLoadDelay);

    // Handle auto-play and auto-pause for video post pages
    await handleVideoPostAutoplay();
    setupVideoPauseOnTabLeave();

    console.log('[R34 Tools] Initialization complete');
  }

  // Listen for settings changes and update tag hiding dynamically
  browser.storage.local.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      const tagHidingKeys = ['hideTagWiki', 'hideTagAdd', 'hideTagRemove', 'hideTagBookmark'];
      const hasTagHidingChange = tagHidingKeys.some(key => key in changes);

      if (hasTagHidingChange) {
        console.log('[R34 Tools] Tag hiding settings changed, re-applying...');
        hideTagActionButtons();
      }
    }
  });

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
