// Dimensions Overlay module for R34 Tools extension
// Shows media dimensions on hover (lazy-loaded)

(function() {
  'use strict';

  // Get dependencies
  const { CLASS_NAMES } = window.R34Tools;
  const { createDimensionsBadge, updateDimensionsBadge } = window.R34Tools;
  const { findPostLink, extractPostId } = window.R34Tools;
  const { isVideoThumbnail, getVideoUrl } = window.R34Tools;
  const { forceMaxQualityUrl } = window.R34Tools;

  // Cache for dimensions to avoid re-fetching
  const dimensionsCache = new WeakMap();

  /**
   * Check if video has audio
   * @param {HTMLVideoElement} video - Video element
   * @returns {boolean} Whether video has audio
   */
  function hasAudioTrack(video) {
    // Try multiple browser-specific methods
    if (video.mozHasAudio !== undefined) {
      return video.mozHasAudio; // Firefox
    }
    if (video.webkitAudioDecodedByteCount !== undefined) {
      return video.webkitAudioDecodedByteCount > 0; // Chrome
    }
    if (video.audioTracks && video.audioTracks.length > 0) {
      return true; // Standard API
    }
    
    // Default: assume no audio if we can't detect
    return false;
  }

  /**
   * Get dimensions from currently loaded media
   * @param {HTMLElement} mediaElement - Image or video element
   * @returns {Object|null} Dimensions object or null
   */
  function getCurrentDimensions(mediaElement) {
    if (mediaElement.tagName === 'VIDEO') {
      if (mediaElement.videoWidth > 0) {
        return {
          width: mediaElement.videoWidth,
          height: mediaElement.videoHeight,
          hasAudio: hasAudioTrack(mediaElement)
        };
      }
    } else if (mediaElement.tagName === 'IMG') {
      if (mediaElement.naturalWidth > 0) {
        return {
          width: mediaElement.naturalWidth,
          height: mediaElement.naturalHeight,
          hasAudio: false
        };
      }
    }
    return null;
  }

  /**
   * Position badge relative to media element and quality badge
   * Places it to the left of quality badge, or underneath if not enough space
   * @param {HTMLDivElement} badge - Badge element
   * @param {HTMLElement} mediaElement - Image or video element
   * @param {HTMLElement} wrapper - Wrapper container
   */
  function positionBadgeToMedia(badge, mediaElement, wrapper) {
    // Find quality badge and buttons
    const qualityBadge = wrapper.querySelector(`.${CLASS_NAMES.qualityBadge}`);
    const downloadBtn = wrapper.querySelector(`.${CLASS_NAMES.thumbDownload}`);
    const fullResBtn = wrapper.querySelector(`.${CLASS_NAMES.thumbFullRes}`);
    
    if (!qualityBadge) return;
    
    // Get actual positions relative to viewport
    const wrapperRect = wrapper.getBoundingClientRect();
    const mediaRect = mediaElement.getBoundingClientRect();
    
    // Calculate media position within wrapper
    const mediaTopOffset = mediaRect.top - wrapperRect.top;
    const mediaRightOffset = wrapperRect.right - mediaRect.right;
    
    // Get dimensions badge width (needs to be visible to measure)
    const wasVisible = badge.style.opacity !== '0';
    const originalOpacity = badge.style.opacity;
    badge.style.opacity = '1';
    badge.style.visibility = 'hidden';
    const badgeWidth = badge.offsetWidth;
    badge.style.visibility = '';
    if (!wasVisible) badge.style.opacity = originalOpacity;
    
    // Quality badge dimensions
    const qualityBadgeWidth = qualityBadge.offsetWidth;
    const qualityBadgeHeight = qualityBadge.offsetHeight;
    
    // Position relative to media element's top-right
    const topOffset = mediaTopOffset + 4;
    const baseRightOffset = mediaRightOffset + 4;
    
    // Calculate position to left of quality badge with 6px gap
    const leftOfQualityPos = baseRightOffset + qualityBadgeWidth + 6;
    
    // Check if dimensions badge would collide with buttons (left side)
    // Buttons are at top-left (downloadBtn at 4px, fullResBtn at 36px)
    const buttonRightEdge = 36 + 28 + 4; // fullResBtn left + width + margin
    const mediaWidth = mediaRect.width;
    const hasSpaceOnLeft = (mediaWidth - qualityBadgeWidth - badgeWidth - 14) >= buttonRightEdge;
    
    if (hasSpaceOnLeft) {
      // Position to left of quality badge
      badge.style.top = `${topOffset}px`;
      badge.style.right = `${leftOfQualityPos}px`;
      badge.style.bottom = 'auto';
    } else {
      // Position underneath quality badge
      badge.style.top = `${topOffset + qualityBadgeHeight + 4}px`;
      badge.style.right = `${baseRightOffset}px`;
      badge.style.bottom = 'auto';
    }
  }

  /**
   * Setup dimensions overlay for a thumbnail
   * @param {HTMLElement} wrapper - Thumbnail wrapper
   * @param {HTMLElement} mediaElement - Image or video element
   */
  async function setupDimensionsOverlay(wrapper, mediaElement) {
    const settings = await window.R34Tools.settingsManager.getAll();
    if (!settings.showMediaDimensions) return;

    // Create dimensions badge (hidden by default)
    const dimensionsBadge = createDimensionsBadge(wrapper, mediaElement);
    
    let isHovering = false;
    let dimensionsLoaded = false;

    // Position badge relative to media on show
    const updatePosition = () => {
      positionBadgeToMedia(dimensionsBadge, mediaElement, wrapper);
    };

    // Show badge on hover
    wrapper.addEventListener('mouseenter', async () => {
      isHovering = true;
      updatePosition();
      dimensionsBadge.style.opacity = '1';
      
      // Get current dimensions
      if (!dimensionsLoaded || !dimensionsCache.has(mediaElement)) {
        const dimensions = getCurrentDimensions(mediaElement);
        
        if (dimensions) {
          dimensionsCache.set(mediaElement, dimensions);
          updateDimensionsBadge(dimensionsBadge, dimensions.width, dimensions.height, dimensions.hasAudio);
          dimensionsLoaded = true;
        } else {
          dimensionsBadge.textContent = 'Loading...';
        }
      } else if (dimensionsCache.has(mediaElement)) {
        // Use cached dimensions
        const cached = dimensionsCache.get(mediaElement);
        updateDimensionsBadge(dimensionsBadge, cached.width, cached.height, cached.hasAudio);
      }
    });

    // Hide badge on mouse leave
    wrapper.addEventListener('mouseleave', () => {
      isHovering = false;
      dimensionsBadge.style.opacity = '0';
    });

    // Update position on image/video load and resize
    mediaElement.addEventListener('load', () => {
      updatePosition();
      // Update dimensions when image loads (e.g., after full-res upgrade)
      dimensionsCache.delete(mediaElement);
      dimensionsLoaded = false;
      const dimensions = getCurrentDimensions(mediaElement);
      if (dimensions && isHovering) {
        dimensionsCache.set(mediaElement, dimensions);
        updateDimensionsBadge(dimensionsBadge, dimensions.width, dimensions.height, dimensions.hasAudio);
      }
    });
    mediaElement.addEventListener('loadedmetadata', () => {
      updatePosition();
      // Update dimensions when video metadata loads
      dimensionsCache.delete(mediaElement);
      dimensionsLoaded = false;
      const dimensions = getCurrentDimensions(mediaElement);
      if (dimensions && isHovering) {
        dimensionsCache.set(mediaElement, dimensions);
        updateDimensionsBadge(dimensionsBadge, dimensions.width, dimensions.height, dimensions.hasAudio);
      }
    });
    window.addEventListener('resize', updatePosition);
  }

  /**
   * Setup dimensions overlay for embedded video
   * @param {HTMLElement} wrapper - Thumbnail wrapper
   * @param {HTMLVideoElement} video - Video element
   */
  function setupVideoDimensionsOverlay(wrapper, video) {
    video.addEventListener('loadedmetadata', async () => {
      const settings = await window.R34Tools.settingsManager.getAll();
      if (!settings.showMediaDimensions) return;

      // Cache dimensions
      const dimensions = {
        width: video.videoWidth,
        height: video.videoHeight,
        hasAudio: hasAudioTrack(video)
      };
      dimensionsCache.set(video, dimensions);

      // Setup overlay
      await setupDimensionsOverlay(wrapper, video);
    });
  }

  // Export functions to global namespace
  window.R34Tools.setupDimensionsOverlay = setupDimensionsOverlay;
  window.R34Tools.setupVideoDimensionsOverlay = setupVideoDimensionsOverlay;
  window.R34Tools.dimensionsCache = dimensionsCache;

})();
