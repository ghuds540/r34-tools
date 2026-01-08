// UI Components module for R34 Tools extension
// All UI component creation (notifications, buttons, panels, wrappers)

(function() {
  'use strict';

  // Get dependencies
  const { COLORS, NOTIFICATION_CONFIG, TIMINGS, BUTTON_STYLES, GRADIENTS, SVG_ICONS, CLASS_NAMES, QUALITY_BADGES, getThemeColors } = window.R34Tools;
  const { settingsManager } = window.R34Tools;

  // Track active notifications for stacking
  const activeNotifications = [];

  /**
   * Play success sound cue
   * Uses Web Audio API to generate a very short, subtle success tone
   */
  function playSuccessSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Very short ascending tone for success - minimally invasive
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.06);

      // Very quiet and quick fade
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.08);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug('[R34 Tools] Audio playback not available:', error);
    }
  }

  /**
   * Play error sound cue
   * Uses Web Audio API to generate a short error tone
   */
  function playErrorSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Short descending tone for error - made more noticeable (2x volume and slightly longer)
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.15);

      // Louder volume (2x from 0.3 to 0.6) and slightly longer duration
      gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug('[R34 Tools] Audio playback not available:', error);
    }
  }

  /**
   * Play click sound cue
   * Uses Web Audio API to generate a very short, subtle click tone for button feedback
   */
  function playClickSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Very short, high-pitched click - extremely subtle
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.02);

      // Very quiet and instantaneous
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.03);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.03);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug('[R34 Tools] Audio playback not available:', error);
    }
  }

  /**
   * Show notification on page
   * @param {string} message - Notification message
   * @param {string} type - Notification type: 'info', 'success', or 'error'
   */
  async function showNotification(message, type = 'info') {
    // Play sound for notifications
    if (type === 'error') {
      playErrorSound();
    } else if (type === 'success') {
      playSuccessSound();
    }
    const settings = await settingsManager.getAll();
    const theme = getThemeColors(settings);
    const notification = document.createElement('div');

    // Map type to theme notification colors
    const notificationColors = {
      success: {
        bg: theme.notificationSuccessBg,
        text: theme.notificationSuccessText,
        border: theme.notificationSuccessBorder
      },
      error: {
        bg: theme.notificationErrorBg,
        text: theme.notificationErrorText,
        border: theme.notificationErrorBorder
      },
      info: {
        bg: theme.notificationInfoBg,
        text: theme.notificationInfoText,
        border: theme.notificationInfoBorder
      }
    };
    const colorScheme = notificationColors[type] || notificationColors.info;

    // Calculate vertical position based on existing notifications
    let topPosition = NOTIFICATION_CONFIG.startTop;
    activeNotifications.forEach(notif => {
      if (notif && notif.offsetHeight) {
        topPosition += notif.offsetHeight + NOTIFICATION_CONFIG.gap;
      }
    });

    notification.style.cssText = `
      position: fixed;
      top: ${topPosition}px;
      right: ${NOTIFICATION_CONFIG.right}px;
      padding: ${NOTIFICATION_CONFIG.padding};
      background: ${colorScheme.bg};
      color: ${colorScheme.text};
      border: 1px solid ${colorScheme.border};
      border-radius: ${NOTIFICATION_CONFIG.borderRadius}px;
      z-index: ${NOTIFICATION_CONFIG.zIndex};
      font-family: ${NOTIFICATION_CONFIG.fontFamily};
      font-size: ${NOTIFICATION_CONFIG.fontSize}px;
      font-weight: ${NOTIFICATION_CONFIG.fontWeight};
      box-shadow: ${NOTIFICATION_CONFIG.boxShadow};
      max-width: ${NOTIFICATION_CONFIG.maxWidth}px;
      backdrop-filter: ${NOTIFICATION_CONFIG.backdropFilter};
      white-space: pre-line;
      word-wrap: break-word;
      overflow-wrap: break-word;
      line-height: 1.5;
      transition: opacity ${TIMINGS.notificationFadeOut}ms ease, transform ${TIMINGS.notificationFadeOut}ms ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);
    activeNotifications.push(notification);

    // Remove notification after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(20px)';

      setTimeout(() => {
        notification.remove();
        const index = activeNotifications.indexOf(notification);
        if (index > -1) {
          activeNotifications.splice(index, 1);
        }
        repositionNotifications();
      }, TIMINGS.notificationFadeOut);
    }, TIMINGS.notificationDuration);
  }

  /**
   * Reposition all active notifications after one is removed
   */
  function repositionNotifications() {
    let topPosition = NOTIFICATION_CONFIG.startTop;
    activeNotifications.forEach(notif => {
      if (notif && notif.offsetHeight) {
        notif.style.top = topPosition + 'px';
        topPosition += notif.offsetHeight + NOTIFICATION_CONFIG.gap;
      }
    });
  }

  /**
   * Create dimensions badge that shows on hover
   * @param {HTMLElement} wrapper - Thumbnail wrapper element
   * @param {HTMLElement} mediaElement - Image or video element
   * @returns {HTMLDivElement} Dimensions badge element
   */
  function createDimensionsBadge(wrapper, mediaElement) {
    const badge = document.createElement('div');
    badge.className = CLASS_NAMES.dimensionsBadge;
    badge.dataset.mediaType = (mediaElement?.tagName || '').toLowerCase();
    badge.style.cssText = `
      position: relative;
      padding: 5px 9px;
      background: rgba(0, 0, 0, 0.9);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
      font-size: 12px;
      font-weight: 600;
      border-radius: 4px;
      z-index: 5;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      white-space: nowrap;
      max-width: 100%;
      min-width: 0;
      flex: 0 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      backdrop-filter: blur(8px);
      line-height: 1;
      letter-spacing: 0.3px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    `;
    badge.textContent = 'Loading...';

    return badge;
  }

  /**
   * Update dimensions badge with media info
   * @param {HTMLDivElement} badge - Badge element
   * @param {number} width - Media width
   * @param {number} height - Media height
   * @param {boolean} hasAudio - Whether video has audio (optional)
   */
  function updateDimensionsBadge(badge, width, height, hasAudio = false) {
    const resolutionLabel = height >= 2160 ? '4K' :
                           height >= 1440 ? '1440p' :
                           height >= 1080 ? '1080p' :
                           height >= 720 ? '720p' :
                           height >= 480 ? '480p' : `${height}p`;

    const mediaType = (badge?.dataset?.mediaType || '').toLowerCase();
    const isVideoElement = mediaType === 'video';
    const shouldShowResolution = isVideoElement && height >= 480;

    let text = shouldShowResolution ? resolutionLabel : `${width}×${height}`;

    // For videos, always show a speaker indicator so spacing is consistent.
    if (isVideoElement && shouldShowResolution) {
      text += hasAudio ? ' 🔊' : ' 🔇';
    }
    
    badge.textContent = text;
  }

  /**
   * Create styled button for sidebar panels
   * @param {string} emoji - Emoji character
   * @param {string} label - Button label text
   * @param {string} tooltip - Tooltip text
   * @param {string} accentColor - Accent color for hover state
   * @param {Function} onClick - Click handler
   * @returns {HTMLButtonElement} Button element
   */
  async function createStyledButton(emoji, label, tooltip, accentColor, onClick) {
    const settings = await settingsManager.getAll();
    const theme = getThemeColors(settings);

    const { borderSize, padding, fontSize, borderRadius, gap } = BUTTON_STYLES.panel;

    const button = document.createElement('button');
    button.title = tooltip;

    // Different styling for default theme
    if (settings.amoledTheme) {
      button.style.cssText = `
        width: 100%;
        padding: ${padding};
        border: ${borderSize}px solid ${BUTTON_STYLES.panel.borderColor};
        border-radius: ${borderRadius}px;
        background: ${BUTTON_STYLES.panel.background};
        color: ${BUTTON_STYLES.panel.color};
        font-weight: 500;
        font-size: ${fontSize}px;
        cursor: pointer;
        transition: all ${TIMINGS.buttonTransition}ms ease;
        display: flex;
        align-items: center;
        gap: ${gap}px;
        line-height: 1.3;
      `;
    } else {
      // Default theme: keep same background as panel
      button.style.cssText = `
        width: 100%;
        padding: ${padding};
        border: ${borderSize}px solid rgba(0, 0, 0, 0.15);
        border-radius: ${borderRadius}px;
        background: rgba(255, 255, 255, 0.3);
        color: #333333;
        font-weight: 500;
        font-size: ${fontSize}px;
        cursor: pointer;
        transition: all ${TIMINGS.buttonTransition}ms ease;
        display: flex;
        align-items: center;
        gap: ${gap}px;
        line-height: 1.3;
      `;
    }

    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = emoji;
    emojiSpan.style.cssText = `font-size: ${fontSize}px; opacity: 0.8;`;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    button.appendChild(emojiSpan);
    button.appendChild(labelSpan);

    button.onmouseover = () => {
      if (settings.amoledTheme) {
        button.style.borderColor = BUTTON_STYLES.panel.borderColorHover;
        button.style.background = BUTTON_STYLES.panel.backgroundHover;
        button.style.color = accentColor;
      } else {
        button.style.borderColor = 'rgba(0, 0, 0, 0.25)';
        button.style.background = 'rgba(255, 255, 255, 0.5)';
      }
    };

    button.onmouseout = () => {
      if (settings.amoledTheme) {
        button.style.borderColor = BUTTON_STYLES.panel.borderColor;
        button.style.background = BUTTON_STYLES.panel.background;
        button.style.color = BUTTON_STYLES.panel.color;
      } else {
        button.style.borderColor = 'rgba(0, 0, 0, 0.15)';
        button.style.background = 'rgba(255, 255, 255, 0.3)';
      }
    };

    button.onclick = onClick;
    return button;
  }

  /**
   * Create circular icon button (for thumbnails)
   * @param {string} svgPath - SVG path data
   * @param {string} className - CSS class name
   * @param {string} title - Tooltip title
   * @param {string} gradient - CSS gradient
   * @param {Object} styles - Style object with top, left/right, width, height
   * @returns {HTMLButtonElement} Button element
   */
  async function createCircularIconButton(svgPath, className, title, gradient, styles) {
    const settings = await settingsManager.getAll();
    const theme = getThemeColors(settings);

    const button = document.createElement('button');
    button.className = className;
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        ${svgPath}
      </svg>
    `;
    button.title = title;

    // Use different styling for default theme
    if (settings.amoledTheme) {
      button.style.cssText = `
        position: absolute;
        top: ${styles.top}px;
        ${styles.left !== undefined ? `left: ${styles.left}px;` : ''}
        ${styles.right !== undefined ? `right: ${styles.right}px;` : ''}
        width: ${styles.width}px;
        height: ${styles.height}px;
        border-radius: 50%;
        border: none;
        background: ${gradient};
        color: ${styles.color || '#00ff66'};
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        transition: all ${TIMINGS.buttonTransition}ms ease;
        opacity: 0;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 0;
      `;
    } else {
      // Default theme: white background with border and dark icons
      button.style.cssText = `
        position: absolute;
        top: ${styles.top}px;
        ${styles.left !== undefined ? `left: ${styles.left}px;` : ''}
        ${styles.right !== undefined ? `right: ${styles.right}px;` : ''}
        width: ${styles.width}px;
        height: ${styles.height}px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.2);
        background: rgba(255, 255, 255, 0.95);
        color: #333333;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        transition: all ${TIMINGS.buttonTransition}ms ease;
        opacity: 0;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 0;
      `;
    }

    button.onmouseover = () => {
      button.style.transform = 'scale(1.1)';
      if (settings.amoledTheme) {
        button.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.8)';
      } else {
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        button.style.borderColor = theme.primary;
      }
    };

    button.onmouseout = () => {
      button.style.transform = 'scale(1)';
      if (settings.amoledTheme) {
        button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.6)';
      } else {
        button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
        button.style.borderColor = 'rgba(0, 0, 0, 0.2)';
      }
    };

    return button;
  }

  /**
   * Create quality badge element
   * @returns {HTMLDivElement} Quality badge element
   */
  function createQualityBadge() {
    const { top, right, width, height, fontSize, fontFamily, fontWeight } = BUTTON_STYLES.qualityBadge;

    const qualityBadge = document.createElement('div');
    qualityBadge.className = CLASS_NAMES.qualityBadge;
    qualityBadge.style.cssText = `
      position: relative;
      width: ${width}px;
      height: ${height}px;
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.8);
      color: #ffffff;
      font-size: ${fontSize}px;
      font-weight: ${fontWeight};
      font-family: ${fontFamily};
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      z-index: 101;
      border: 1px solid ${COLORS.accent.grayDark};
    `;

    qualityBadge.style.flexShrink = '0';

    return qualityBadge;
  }

  /**
   * Create thumbnail wrapper element
   * @param {HTMLImageElement} img - Image to wrap
   * @returns {HTMLElement} Wrapper element
   */
  function createThumbnailWrapper(img) {
    let wrapper = img.parentElement;

    // Check if wrapper already exists
    if (!wrapper.classList.contains(CLASS_NAMES.thumbWrapper)) {
      const newWrapper = document.createElement('span');
      newWrapper.className = CLASS_NAMES.thumbWrapper;
      newWrapper.style.cssText = `
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        line-height: 0;
        overflow: hidden;
      `;

      img.parentNode.insertBefore(newWrapper, img);
      newWrapper.appendChild(img);
      wrapper = newWrapper;
    }

    // Constrain image to fit within parent
    img.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      display: block;
      margin: auto;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `;

    return wrapper;
  }

  /**
   * Create download button for thumbnails
   * @returns {HTMLButtonElement} Download button
   */
  async function createDownloadButton() {
    return await createCircularIconButton(
      SVG_ICONS.download,
      CLASS_NAMES.thumbDownload,
      'Download full resolution',
      GRADIENTS.greenButton,
      BUTTON_STYLES.download
    );
  }

  /**
   * Create full resolution button for thumbnails
   * @returns {HTMLButtonElement} Full resolution button
   */
  async function createFullResButton() {
    return await createCircularIconButton(
      SVG_ICONS.zoomIn,
      CLASS_NAMES.thumbFullRes,
      'Load full resolution',
      GRADIENTS.blueButton,
      BUTTON_STYLES.fullRes
    );
  }

  /**
   * Create go to post button for video thumbnails
   * @returns {HTMLButtonElement} Go to post button
   */
  async function createGoToPostButton() {
    return await createCircularIconButton(
      SVG_ICONS.cursor,
      CLASS_NAMES.thumbGoToPost,
      'Go to post page',
      GRADIENTS.purpleButton,
      BUTTON_STYLES.goToPost
    );
  }

  /**
   * Display upgrade results notification
   * @param {Object} results - Results object with success, failed, skippedVideos counts
   */
  function displayUpgradeResults(results) {
    let message = `Loaded: ${results.success} success, ${results.failed} failed`;
    if (results.skippedVideos > 0) {
      message += `, ${results.skippedVideos} videos couldn't load`;
    }
    showNotification(message, 'success');
  }

  /**
   * Setup thumbnail buttons (download, full-res, quality badge)
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {HTMLAnchorElement} postLink - Post link element
   */
  async function setupThumbnailButtons(img, postLink) {
    const { positionButtonsForMedia, createButtonHoverHandlers, attachButtonHoverHandlers } = window.R34Tools;
    const { createBadgeUpdater } = window.R34Tools;
    const { ensureOverlayContainers } = window.R34Tools;

    const wrapper = createThumbnailWrapper(img);

    // Stamp wrapper with postId for fast lookups (used by download indicators)
    try {
      const match = postLink?.href?.match(/[?&]id=(\d+)/);
      if (match) {
        wrapper.dataset.postId = match[1];
      }
    } catch (e) {
      // ignore
    }
    const downloadBtn = await createDownloadButton();
    const fullResBtn = await createFullResButton();
    const qualityBadge = createQualityBadge();

    const { controls, badges } = ensureOverlayContainers ? ensureOverlayContainers(wrapper) : {};
    if (controls) {
      controls.appendChild(downloadBtn);
      controls.appendChild(fullResBtn);
    } else {
      wrapper.appendChild(downloadBtn);
      wrapper.appendChild(fullResBtn);
    }

    if (badges) {
      badges.appendChild(qualityBadge);
    } else {
      wrapper.appendChild(qualityBadge);
    }

    const updateBadge = createBadgeUpdater(img, qualityBadge);
    updateBadge(); // Initialize badge

    const positionFunc = () => positionButtonsForMedia(wrapper, img, downloadBtn, fullResBtn, qualityBadge);
    const handlers = createButtonHoverHandlers(wrapper, downloadBtn, fullResBtn, qualityBadge, positionFunc);
    attachButtonHoverHandlers(wrapper, img, handlers);

    // Setup dimensions overlay (will be initialized when module loads)
    if (window.R34Tools.setupDimensionsOverlay) {
      window.R34Tools.setupDimensionsOverlay(wrapper, img);
    }

    // Attach click handlers - will be set by content.js
    return { wrapper, downloadBtn, fullResBtn, qualityBadge };
  }

  // Export all functions to global namespace
  window.R34Tools.playErrorSound = playErrorSound;
  window.R34Tools.playSuccessSound = playSuccessSound;
  window.R34Tools.playClickSound = playClickSound;
  window.R34Tools.showNotification = showNotification;
  window.R34Tools.repositionNotifications = repositionNotifications;
  window.R34Tools.createStyledButton = createStyledButton;
  window.R34Tools.createCircularIconButton = createCircularIconButton;
  window.R34Tools.createQualityBadge = createQualityBadge;
  window.R34Tools.createDimensionsBadge = createDimensionsBadge;
  window.R34Tools.updateDimensionsBadge = updateDimensionsBadge;
  window.R34Tools.createThumbnailWrapper = createThumbnailWrapper;
  window.R34Tools.createDownloadButton = createDownloadButton;
  window.R34Tools.createFullResButton = createFullResButton;
  window.R34Tools.createGoToPostButton = createGoToPostButton;
  window.R34Tools.displayUpgradeResults = displayUpgradeResults;
  window.R34Tools.setupThumbnailButtons = setupThumbnailButtons;

  // Export active notifications array
  window.R34Tools.activeNotifications = activeNotifications;

})();
