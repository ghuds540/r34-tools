// UI Components module for R34 Tools extension
// All UI component creation (notifications, buttons, panels, wrappers)

(function() {
  'use strict';

  // Get dependencies
  const { COLORS, NOTIFICATION_CONFIG, TIMINGS, BUTTON_STYLES, GRADIENTS, SVG_ICONS, CLASS_NAMES, QUALITY_BADGES } = window.R34Tools;

  // Track active notifications for stacking
  const activeNotifications = [];

  /**
   * Show notification on page
   * @param {string} message - Notification message
   * @param {string} type - Notification type: 'info', 'success', or 'error'
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');

    const colorScheme = COLORS[type] || COLORS.info;

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
   * Create styled button for sidebar panels
   * @param {string} emoji - Emoji character
   * @param {string} label - Button label text
   * @param {string} tooltip - Tooltip text
   * @param {string} accentColor - Accent color for hover state
   * @param {Function} onClick - Click handler
   * @returns {HTMLButtonElement} Button element
   */
  function createStyledButton(emoji, label, tooltip, accentColor, onClick) {
    const { borderColor, borderSize, background, color, padding, fontSize, borderRadius, gap } = BUTTON_STYLES.panel;

    const button = document.createElement('button');
    button.title = tooltip;
    button.style.cssText = `
      width: 100%;
      padding: ${padding};
      border: ${borderSize}px solid ${borderColor};
      border-radius: ${borderRadius}px;
      background: ${background};
      color: ${color};
      font-weight: 500;
      font-size: ${fontSize}px;
      cursor: pointer;
      transition: all ${TIMINGS.buttonTransition}ms ease;
      display: flex;
      align-items: center;
      gap: ${gap}px;
      line-height: 1.3;
    `;

    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = emoji;
    emojiSpan.style.cssText = `font-size: ${fontSize}px; opacity: 0.8;`;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    button.appendChild(emojiSpan);
    button.appendChild(labelSpan);

    button.onmouseover = () => {
      button.style.borderColor = BUTTON_STYLES.panel.borderColorHover;
      button.style.background = BUTTON_STYLES.panel.backgroundHover;
      button.style.color = accentColor;
    };

    button.onmouseout = () => {
      button.style.borderColor = BUTTON_STYLES.panel.borderColor;
      button.style.background = BUTTON_STYLES.panel.background;
      button.style.color = BUTTON_STYLES.panel.color;
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
  function createCircularIconButton(svgPath, className, title, gradient, styles) {
    const button = document.createElement('button');
    button.className = className;
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        ${svgPath}
      </svg>
    `;
    button.title = title;

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
      color: ${styles.color || '#000'};
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

    button.onmouseover = () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.8)';
    };

    button.onmouseout = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.6)';
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
      position: absolute;
      top: ${top}px;
      right: ${right}px;
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
  function createDownloadButton() {
    return createCircularIconButton(
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
  function createFullResButton() {
    return createCircularIconButton(
      SVG_ICONS.zoomIn,
      CLASS_NAMES.thumbFullRes,
      'Load full resolution',
      GRADIENTS.blueButton,
      BUTTON_STYLES.fullRes
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
  function setupThumbnailButtons(img, postLink) {
    const { positionButtonsForMedia, createButtonHoverHandlers, attachButtonHoverHandlers } = window.R34Tools;
    const { createBadgeUpdater } = window.R34Tools;

    const wrapper = createThumbnailWrapper(img);
    const downloadBtn = createDownloadButton();
    const fullResBtn = createFullResButton();
    const qualityBadge = createQualityBadge();

    wrapper.appendChild(downloadBtn);
    wrapper.appendChild(fullResBtn);
    wrapper.appendChild(qualityBadge);

    const updateBadge = createBadgeUpdater(img, qualityBadge);
    updateBadge(); // Initialize badge

    const positionFunc = () => positionButtonsForMedia(wrapper, img, downloadBtn, fullResBtn, qualityBadge);
    const handlers = createButtonHoverHandlers(wrapper, downloadBtn, fullResBtn, qualityBadge, positionFunc);
    attachButtonHoverHandlers(wrapper, img, handlers);

    // Attach click handlers - will be set by content.js
    return { wrapper, downloadBtn, fullResBtn, qualityBadge };
  }

  // Export all functions to global namespace
  window.R34Tools.showNotification = showNotification;
  window.R34Tools.repositionNotifications = repositionNotifications;
  window.R34Tools.createStyledButton = createStyledButton;
  window.R34Tools.createCircularIconButton = createCircularIconButton;
  window.R34Tools.createQualityBadge = createQualityBadge;
  window.R34Tools.createThumbnailWrapper = createThumbnailWrapper;
  window.R34Tools.createDownloadButton = createDownloadButton;
  window.R34Tools.createFullResButton = createFullResButton;
  window.R34Tools.displayUpgradeResults = displayUpgradeResults;
  window.R34Tools.setupThumbnailButtons = setupThumbnailButtons;

  // Export active notifications array
  window.R34Tools.activeNotifications = activeNotifications;

})();
