// DOM Utilities module for R34 Tools extension
// Reusable DOM manipulation and helper functions

(function() {
  'use strict';

  // Get constants
  const { SELECTORS, BUTTON_STYLES, URL_PATTERNS, TIMINGS } = window.R34Tools;

  function ensureOverlayContainers(wrapper) {
    if (!wrapper) return {};

    let controls = wrapper.querySelector('.r34-overlay-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'r34-overlay-controls';
      controls.style.cssText = `
        position: absolute;
        display: block;
        z-index: 120;
        width: 0;
        height: 0;
        pointer-events: auto;
      `;
      wrapper.appendChild(controls);
    }

    let badges = wrapper.querySelector('.r34-overlay-badges');
    if (!badges) {
      badges = document.createElement('div');
      badges.className = 'r34-overlay-badges';
      badges.style.cssText = `
        position: absolute;
        display: flex;
        flex-direction: row-reverse;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: flex-start;
        align-content: flex-start;
        gap: 6px;
        padding: 4px;
        z-index: 119;
        pointer-events: none;
      `;
      wrapper.appendChild(badges);
    }

    return { controls, badges };
  }

  /**
   * Find the post link associated with a thumbnail image
   * Tries multiple strategies to locate the link
   * @param {HTMLImageElement} img - Thumbnail image element
   * @returns {HTMLAnchorElement|null} Post link or null
   */
  function findPostLink(img) {
    // Try 1: Check if image itself is a post link
    let postLink = img.closest(SELECTORS.postLink);

    // Try 2: Check parent element for post link
    if (!postLink && img.parentElement) {
      postLink = img.parentElement.querySelector(SELECTORS.postLink);
    }

    // Try 3: Check grandparent element for post link
    if (!postLink && img.parentElement?.parentElement) {
      postLink = img.parentElement.parentElement.querySelector(SELECTORS.postLink);
    }

    return postLink;
  }

  /**
   * Extract post ID from URL
   * @param {string} url - URL containing post ID
   * @returns {string|null} Post ID or null
   */
  function extractPostId(url) {
    const match = url.match(URL_PATTERNS.postId);
    return match ? match[1] : null;
  }

  /**
   * Check if current page is a post page
   * @returns {boolean}
   */
  function isPostPage() {
    return window.location.href.includes(URL_PATTERNS.postPage);
  }

  /**
   * Check if current page is a list page
   * @returns {boolean}
   */
  function isListPage() {
    return window.location.href.includes(URL_PATTERNS.listPage);
  }

  /**
   * Position buttons over a media element (image or video)
   * Duplicated 5 times in content.js - this consolidates all instances
   * @param {HTMLElement} wrapper - Container wrapper element
   * @param {HTMLElement} mediaElement - Image or video element
   * @param {HTMLElement} downloadBtn - Download button element
   * @param {HTMLElement} fullResBtn - Full resolution button element
   * @param {HTMLElement} qualityBadge - Quality badge element
   */
  function positionButtonsForMedia(wrapper, mediaElement, downloadBtn, fullResBtn, qualityBadge, goToPostBtn = null) {
    if (!wrapper || !mediaElement) return;

    // Find the thumbnail container (span.thumb) to check for scaling
    let thumbContainer = wrapper.closest('.thumb, .thumbnail, span.thumb');
    let scale = 1.0;

    // Check if the thumbnail container has a transform scale applied
    if (thumbContainer) {
      const transform = window.getComputedStyle(thumbContainer).transform;
      if (transform && transform !== 'none') {
        // Extract scale from matrix (matrix(scaleX, 0, 0, scaleY, 0, 0))
        const matrixMatch = transform.match(/matrix\(([^,]+),/);
        if (matrixMatch) {
          scale = parseFloat(matrixMatch[1]) || 1.0;
        }
      }
    }

    const containerRect = wrapper.getBoundingClientRect();
    const mediaRect = mediaElement.getBoundingClientRect();

    // Calculate offsets and divide by scale to compensate for transform
    const offsetTop = (mediaRect.top - containerRect.top) / scale;
    const offsetLeft = (mediaRect.left - containerRect.left) / scale;
    const offsetRight = (containerRect.right - mediaRect.right) / scale;

    // Position shared overlay containers over the media bounds
    const { controls, badges } = ensureOverlayContainers(wrapper);
    if (controls) {
      controls.style.top = `${offsetTop}px`;
      controls.style.left = `${offsetLeft}px`;
    }
    if (badges) {
      // Reserve left space for the 2-column control buttons (download + upscale)
      const reservedLeft = (BUTTON_STYLES.fullRes.left + BUTTON_STYLES.fullRes.width) + 8;
      const mediaWidth = mediaRect.width / scale;
      const leftInset = Math.max(0, reservedLeft);
      const availableWidth = Math.max(0, mediaWidth - leftInset);

      badges.style.top = `${offsetTop}px`;
      badges.style.right = `${offsetRight}px`;
      badges.style.left = `${offsetLeft + leftInset}px`;
      badges.style.maxWidth = `${availableWidth}px`;
      badges.style.boxSizing = 'border-box';
    }

    // Back-compat: if a consumer still appends elements directly to wrapper,
    // keep them positioned relative to media bounds.
    if (downloadBtn && downloadBtn.parentElement !== controls) {
      downloadBtn.style.top = (offsetTop + BUTTON_STYLES.download.top) + 'px';
      downloadBtn.style.left = (offsetLeft + BUTTON_STYLES.download.left) + 'px';
    }
    if (fullResBtn && fullResBtn.parentElement !== controls) {
      fullResBtn.style.top = (offsetTop + BUTTON_STYLES.fullRes.top) + 'px';
      fullResBtn.style.left = (offsetLeft + BUTTON_STYLES.fullRes.left) + 'px';
    }
    if (goToPostBtn && goToPostBtn.parentElement !== controls) {
      goToPostBtn.style.top = (offsetTop + BUTTON_STYLES.goToPost.top) + 'px';
      goToPostBtn.style.left = (offsetLeft + BUTTON_STYLES.goToPost.left) + 'px';
    }

    if (qualityBadge && qualityBadge.parentElement !== badges) {
      if (qualityBadge.style.position === 'absolute') {
        qualityBadge.style.top = (offsetTop + BUTTON_STYLES.qualityBadge.top) + 'px';
        qualityBadge.style.right = (offsetRight + BUTTON_STYLES.qualityBadge.right) + 'px';
      }
    }
  }

  /**
   * Create show/hide handler functions for buttons
   * Duplicated 5 times in content.js - this consolidates all instances
   * @param {HTMLElement} wrapper - Container element
   * @param {HTMLElement} downloadBtn - Download button element
   * @param {HTMLElement} fullResBtn - Full resolution button element
   * @param {HTMLElement} qualityBadge - Quality badge element
   * @param {Function} positionFunc - Function to call for repositioning buttons
   * @param {HTMLElement} goToPostBtn - Go to post button element (optional, for videos)
   * @returns {Object} Object with showButtons and hideButtons functions
   */
  function createButtonHoverHandlers(wrapper, downloadBtn, fullResBtn, qualityBadge, positionFunc, goToPostBtn = null) {
    const showButtons = () => {
      // Reposition buttons if positioning function provided
      if (positionFunc) {
        positionFunc();
      }

      // Show download button
      if (downloadBtn) {
        downloadBtn.style.opacity = '1';
        downloadBtn.style.pointerEvents = 'auto';
      }

      // Show full res button
      if (fullResBtn) {
        fullResBtn.style.opacity = '1';
        fullResBtn.style.pointerEvents = 'auto';
      }

      // Show go to post button (for videos)
      if (goToPostBtn) {
        goToPostBtn.style.opacity = '1';
        goToPostBtn.style.pointerEvents = 'auto';
      }

      // Show quality badge
      if (qualityBadge) {
        qualityBadge.style.opacity = '1';
      }
    };

    const hideButtons = () => {
      // Hide download button
      if (downloadBtn) {
        downloadBtn.style.opacity = '0';
        downloadBtn.style.pointerEvents = 'none';
      }

      // Hide full res button
      if (fullResBtn) {
        fullResBtn.style.opacity = '0';
        fullResBtn.style.pointerEvents = 'none';
      }

      // Hide go to post button (for videos)
      if (goToPostBtn) {
        goToPostBtn.style.opacity = '0';
        goToPostBtn.style.pointerEvents = 'none';
      }

      // Hide quality badge
      if (qualityBadge) {
        qualityBadge.style.opacity = '0';
      }
    };

    return { showButtons, hideButtons };
  }

  /**
   * Attach hover event handlers to wrapper and media element
   * @param {HTMLElement} wrapper - Container element
   * @param {HTMLElement} mediaElement - Image or video element
   * @param {Object} handlers - Object with showButtons and hideButtons functions
   */
  function attachButtonHoverHandlers(wrapper, mediaElement, handlers) {
    const { showButtons, hideButtons } = handlers;

    // Remove existing listeners to avoid duplicates
    wrapper.removeEventListener('mouseenter', showButtons);
    wrapper.removeEventListener('mouseleave', hideButtons);

    // Attach new listeners to wrapper
    wrapper.addEventListener('mouseenter', showButtons);
    wrapper.addEventListener('mouseleave', hideButtons);

    // Also attach to media element if provided
    if (mediaElement) {
      mediaElement.removeEventListener('mouseenter', showButtons);
      mediaElement.addEventListener('mouseenter', showButtons);
    }
  }

  /**
   * Delay helper - returns a promise that resolves after specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Safely query selector with error handling
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (default: document)
   * @returns {Element|null}
   */
  function safeQuerySelector(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.error(`[R34 Tools] Invalid selector: ${selector}`, error);
      return null;
    }
  }

  /**
   * Safely query selector all with error handling
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (default: document)
   * @returns {NodeList|Array}
   */
  function safeQuerySelectorAll(selector, context = document) {
    try {
      return context.querySelectorAll(selector);
    } catch (error) {
      console.error(`[R34 Tools] Invalid selector: ${selector}`, error);
      return [];
    }
  }

  /**
   * Check if element is visible in viewport
   * @param {Element} elem - Element to check
   * @returns {boolean}
   */
  function isElementInViewport(elem) {
    const rect = elem.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Wait for element to appear in DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Maximum time to wait in ms
   * @returns {Promise<Element|null>}
   */
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  // Export all functions to global namespace
  window.R34Tools.findPostLink = findPostLink;
  window.R34Tools.extractPostId = extractPostId;
  window.R34Tools.isPostPage = isPostPage;
  window.R34Tools.isListPage = isListPage;
  window.R34Tools.positionButtonsForMedia = positionButtonsForMedia;
  window.R34Tools.createButtonHoverHandlers = createButtonHoverHandlers;
  window.R34Tools.attachButtonHoverHandlers = attachButtonHoverHandlers;
  window.R34Tools.ensureOverlayContainers = ensureOverlayContainers;
  window.R34Tools.delay = delay;
  window.R34Tools.debounce = debounce;
  window.R34Tools.safeQuerySelector = safeQuerySelector;
  window.R34Tools.safeQuerySelectorAll = safeQuerySelectorAll;
  window.R34Tools.isElementInViewport = isElementInViewport;
  window.R34Tools.waitForElement = waitForElement;

})();
