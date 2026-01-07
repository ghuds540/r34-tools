// Image Quality module for R34 Tools extension
// Image quality upgrades and URL transformations

(function() {
  'use strict';

  // Get dependencies
  const { PATH_REPLACEMENTS, QUALITY_BADGES, SELECTORS } = window.R34Tools;

  // Track processed images and their quality
  const processedImages = new WeakSet();
  const imageQuality = new WeakMap();
  const badgeUpdaters = new WeakMap();

  /**
   * Upgrade image URL to higher quality
   * @param {string} originalUrl - Original image URL
   * @param {string} targetQuality - 'full' or 'sample'
   * @returns {string} Upgraded URL
   */
  function upgradeImageUrl(originalUrl, targetQuality) {
    try {
      const url = new URL(originalUrl);
      let pathname = url.pathname;

      if (targetQuality === 'full') {
        // Upgrade to full resolution
        pathname = pathname.replace(
          PATH_REPLACEMENTS.toFull.thumbnailsToImages[0],
          PATH_REPLACEMENTS.toFull.thumbnailsToImages[1]
        );
        pathname = pathname.replace(
          PATH_REPLACEMENTS.toFull.samplesToImages[0],
          PATH_REPLACEMENTS.toFull.samplesToImages[1]
        );
        pathname = pathname.replace(
          PATH_REPLACEMENTS.toFull.thumbnailPrefix[0],
          PATH_REPLACEMENTS.toFull.thumbnailPrefix[1]
        );
        pathname = pathname.replace(
          PATH_REPLACEMENTS.toFull.samplePrefix[0],
          PATH_REPLACEMENTS.toFull.samplePrefix[1]
        );
      } else if (targetQuality === 'sample') {
        // Upgrade to sample quality
        pathname = pathname.replace(
          PATH_REPLACEMENTS.toSample.thumbnailsToSamples[0],
          PATH_REPLACEMENTS.toSample.thumbnailsToSamples[1]
        );
        pathname = pathname.replace(
          PATH_REPLACEMENTS.toSample.thumbnailToSample[0],
          PATH_REPLACEMENTS.toSample.thumbnailToSample[1]
        );
      }

      return url.origin + pathname;
    } catch (error) {
      console.error('[R34 Tools] Error upgrading URL:', error);
      return originalUrl;
    }
  }

  /**
   * Force maximum quality URL by replacing all paths
   * Consolidates duplicate logic from content.js
   * @param {string} imgUrl - Original image URL
   * @returns {string} Maximum quality URL
   */
  function forceMaxQualityUrl(imgUrl) {
    // Replace paths
    imgUrl = imgUrl.replace(
      PATH_REPLACEMENTS.toFull.thumbnailsToImages[0],
      PATH_REPLACEMENTS.toFull.thumbnailsToImages[1]
    );
    imgUrl = imgUrl.replace(
      PATH_REPLACEMENTS.toFull.samplesToImages[0],
      PATH_REPLACEMENTS.toFull.samplesToImages[1]
    );
    imgUrl = imgUrl.replace(
      PATH_REPLACEMENTS.toFull.thumbnailPrefix[0],
      PATH_REPLACEMENTS.toFull.thumbnailPrefix[1]
    );
    imgUrl = imgUrl.replace(
      PATH_REPLACEMENTS.toFull.samplePrefix[0],
      PATH_REPLACEMENTS.toFull.samplePrefix[1]
    );

    // Remove query parameters that might indicate sample size
    try {
      const url = new URL(imgUrl);
      url.searchParams.delete('sample');
      return url.toString();
    } catch (error) {
      return imgUrl;
    }
  }

  /**
   * Set image quality and trigger badge update
   * @param {HTMLImageElement} img - Image element
   * @param {string} quality - Quality level: 'T', 'S', or 'F'
   */
  function setImageQuality(img, quality) {
    imageQuality.set(img, quality);
    const updater = badgeUpdaters.get(img);
    if (updater) {
      updater();
    }
  }

  /**
   * Get image quality
   * @param {HTMLImageElement} img - Image element
   * @returns {string} Quality level: 'T', 'S', 'F', or null
   */
  function getImageQuality(img) {
    return imageQuality.get(img) || null;
  }

  /**
   * Upgrade image with fallback strategy
   * Tries full-res first, then sample, then keeps thumbnail
   * Uses optimistic loading with error handlers to avoid CORS console spam
   * @param {HTMLImageElement} img - Image element
   * @param {boolean} preferFullRes - Whether to prefer full resolution
   */
  async function upgradeImageWithFallback(img, preferFullRes) {
    if (processedImages.has(img)) return;
    processedImages.add(img);

    const originalSrc = img.src;
    if (!originalSrc || !originalSrc.includes('/thumbnails/')) {
      setImageQuality(img, 'T');
      return;
    }

    // Start with thumbnail quality
    setImageQuality(img, 'T');

    if (preferFullRes) {
      // Try full resolution with fallback
      const fullResUrl = upgradeImageUrl(originalSrc, 'full');
      const sampleUrl = upgradeImageUrl(originalSrc, 'sample');

      // Optimistically load full-res, fallback to sample on error
      img.onerror = () => {
        img.onerror = () => {
          // Sample failed too, revert to thumbnail
          img.src = originalSrc;
          setImageQuality(img, 'T');
          img.onerror = null;
        };
        img.onload = () => {
          setImageQuality(img, 'S');
          img.onload = null;
          img.onerror = null;
        };
        img.src = sampleUrl;
      };
      img.onload = () => {
        setImageQuality(img, 'F');
        img.onload = null;
        img.onerror = null;
      };
      img.src = fullResUrl;
    } else {
      // Only try sample quality
      const sampleUrl = upgradeImageUrl(originalSrc, 'sample');
      img.onerror = () => {
        img.src = originalSrc;
        setImageQuality(img, 'T');
        img.onerror = null;
      };
      img.onload = () => {
        setImageQuality(img, 'S');
        img.onload = null;
        img.onerror = null;
      };
      img.src = sampleUrl;
    }
  }

  /**
   * Create badge updater function for an image
   * @param {HTMLImageElement} img - Image element
   * @param {HTMLElement} qualityBadge - Quality badge element
   * @returns {Function} Updater function
   */
  function createBadgeUpdater(img, qualityBadge) {
    const updater = () => {
      const quality = imageQuality.get(img) || 'T';
      qualityBadge.textContent = quality;

      const badge = QUALITY_BADGES[
        quality === 'F' ? 'full' :
        quality === 'S' ? 'sample' :
        'thumbnail'
      ];

      qualityBadge.style.background = badge.color;
    };

    badgeUpdaters.set(img, updater);
    return updater;
  }

  /**
   * Extract full resolution URL from parsed document
   * Used by thumbnail full-res button handler
   * @param {Document} doc - Parsed post page document
   * @returns {string|null} Full resolution URL or null
   */
  function extractFullResUrlFromDocument(doc) {
    const { extractVideoFromHtml } = window.R34Tools;

    // Check if it's a video first
    const videoElement = doc.querySelector(SELECTORS.videoElement);
    if (videoElement) {
      const videoUrl = videoElement.src || videoElement.querySelector(SELECTORS.videoSource)?.src;
      if (videoUrl) return videoUrl;
    }

    // Check for video in HTML
    const html = doc.documentElement.outerHTML;
    const videoUrl = extractVideoFromHtml(html, doc);
    if (videoUrl) return videoUrl;

    // Check for "Original image" link
    const originalLink = doc.querySelector(SELECTORS.originalImageLink);
    if (originalLink && originalLink.textContent.includes('Original')) {
      return originalLink.href;
    }

    // Get main image and upgrade to full resolution
    const mainImage = doc.querySelector(SELECTORS.mainImage);
    if (mainImage) {
      return forceMaxQualityUrl(mainImage.src);
    }

    return null;
  }

  /**
   * Load full resolution image into thumbnail
   * Used by full-res button click handler
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {string} postUrl - Post page URL
   * @returns {Promise<boolean>} True if successful
   */
  async function loadFullResInThumbnail(img, postUrl) {
    const { showNotification } = window.R34Tools;

    showNotification('Loading full resolution...', 'info');

    try {
      const response = await fetch(postUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const fullResUrl = extractFullResUrlFromDocument(doc);

      if (fullResUrl) {
        // Optimistically load without pre-validation to avoid console spam
        return new Promise((resolve) => {
          const originalSrc = img.src;
          img.onerror = () => {
            img.src = originalSrc;
            img.onerror = null;
            img.onload = null;
            showNotification('Full resolution URL not available', 'error');
            resolve(false);
          };
          img.onload = () => {
            setImageQuality(img, 'F');
            img.onerror = null;
            img.onload = null;
            showNotification('Full resolution loaded', 'success');
            resolve(true);
          };
          img.src = fullResUrl;
        });
      } else {
        showNotification('Full resolution URL not available', 'error');
        return false;
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Process a single image for max quality upgrade
   * Used by forceLoadAllMaxQuality()
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {Object} settings - Extension settings
   * @param {Object} results - Results object to update
   */
  async function processMaxQualityUpgrade(img, settings, results) {
    const { findPostLink, extractPostId, delay } = window.R34Tools;
    const { replaceImageWithVideo } = window.R34Tools;

    const postLink = findPostLink(img);
    if (!postLink) {
      results.failed++;
      return;
    }

    try {
      const response = await fetch(postLink.href);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Check if it's a video
      const videoElement = doc.querySelector(SELECTORS.videoElement);
      if (videoElement) {
        if (settings.autoLoadVideoEmbeds) {
          const videoUrl = videoElement.src || videoElement.querySelector(SELECTORS.videoSource)?.src;
          if (videoUrl) {
            const { createVideoElement } = window.R34Tools;
            const wrapper = img.closest('.r34-thumb-wrapper');
            const video = createVideoElement(videoUrl, img.style.cssText, settings.autoStartEmbedVideos);
            replaceImageWithVideo(img, video, wrapper);
            results.success++;
          } else {
            results.skippedVideos++;
          }
        } else {
          results.skippedVideos++;
        }
        return;
      }

      // Process as image
      const fullResUrl = extractFullResUrlFromDocument(doc);
      if (fullResUrl) {
        // Optimistically load without pre-validation to avoid console spam
        await new Promise((resolve) => {
          const originalSrc = img.src;
          img.onerror = () => {
            img.src = originalSrc;
            img.onerror = null;
            img.onload = null;
            results.failed++;
            resolve();
          };
          img.onload = () => {
            setImageQuality(img, 'F');
            img.onerror = null;
            img.onload = null;
            results.success++;
            resolve();
          };
          img.src = fullResUrl;
        });
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error('[R34 Tools] Error loading full res for image:', error);
      results.failed++;
    }
  }

  // Export all functions to global namespace
  window.R34Tools.upgradeImageUrl = upgradeImageUrl;
  window.R34Tools.forceMaxQualityUrl = forceMaxQualityUrl;
  window.R34Tools.setImageQuality = setImageQuality;
  window.R34Tools.getImageQuality = getImageQuality;
  window.R34Tools.upgradeImageWithFallback = upgradeImageWithFallback;
  window.R34Tools.createBadgeUpdater = createBadgeUpdater;
  window.R34Tools.extractFullResUrlFromDocument = extractFullResUrlFromDocument;
  window.R34Tools.loadFullResInThumbnail = loadFullResInThumbnail;
  window.R34Tools.processMaxQualityUpgrade = processMaxQualityUpgrade;

  // Export tracking structures
  window.R34Tools.processedImages = processedImages;
  window.R34Tools.imageQuality = imageQuality;
  window.R34Tools.badgeUpdaters = badgeUpdaters;

})();
