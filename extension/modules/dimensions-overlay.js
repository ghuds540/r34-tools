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

  // Cache postId -> media dimensions (used mainly for list/search thumbnails)
  const postDimensionsCache = new Map();
  const postDimensionsInFlight = new Map();

  function isListPageUrl() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('page') === 'post' && url.searchParams.get('s') === 'list';
    } catch {
      return window.location.href.includes('page=post&s=list');
    }
  }

  function getPostIdForWrapper(wrapper, mediaElement) {
    const direct = wrapper?.dataset?.postId;
    if (direct) return direct;

    try {
      const postLink = findPostLink ? findPostLink(mediaElement) : null;
      const href = postLink?.href;
      if (!href) return null;
      return extractPostId ? extractPostId(href) : null;
    } catch {
      return null;
    }
  }

  async function fetchPostDimensionsViaDapi(postId) {
    if (!postId) return null;
    if (postDimensionsCache.has(postId)) return postDimensionsCache.get(postId);
    if (postDimensionsInFlight.has(postId)) return postDimensionsInFlight.get(postId);

    const promise = (async () => {
      try {
        // Use same-origin DAPI endpoint to avoid CORS issues in content scripts.
        const url = new URL('/index.php', window.location.origin);
        url.searchParams.set('page', 'dapi');
        url.searchParams.set('s', 'post');
        url.searchParams.set('q', 'index');
        url.searchParams.set('id', String(postId));
        url.searchParams.set('json', '1');

        const response = await fetch(url.toString());
        if (!response.ok) return null;

        const data = await response.json();

        // Expected shapes vary; normalize to "post" object.
        const post = Array.isArray(data)
          ? data[0]
          : (Array.isArray(data?.post) ? data.post[0] : (data?.post || data));

        const width = Number(post?.width || 0);
        const height = Number(post?.height || 0);
        const fileUrl = String(post?.file_url || post?.file || '');
        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(fileUrl);

        if (!width || !height) return null;

        const result = { width, height, isVideo };
        postDimensionsCache.set(postId, result);
        return result;
      } catch {
        return null;
      } finally {
        postDimensionsInFlight.delete(postId);
      }
    })();

    postDimensionsInFlight.set(postId, promise);
    return promise;
  }

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


  function repositionDimensionsBadge(wrapper, mediaElement) {
    // Dimensions badge layout is handled by the shared badges container; this is
    // kept as a no-op-ish helper for callers that want to trigger a refresh.
    if (!wrapper || !mediaElement) return;
    if (window.R34Tools?.positionButtonsForMedia) {
      const downloadBtn = wrapper.querySelector(`.${CLASS_NAMES.thumbDownload}`);
      const fullResBtn = wrapper.querySelector(`.${CLASS_NAMES.thumbFullRes}`);
      const qualityBadge = wrapper.querySelector(`.${CLASS_NAMES.qualityBadge}`);
      const goToPostBtn = wrapper.querySelector(`.${CLASS_NAMES.thumbGoToPost}`);
      window.R34Tools.positionButtonsForMedia(wrapper, mediaElement, downloadBtn, fullResBtn, qualityBadge, goToPostBtn);
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

    // Show dimensions on list/search pages as well.
    // (Previously suppressed for IMG thumbnails, which also hid it for video thumbnails on search pages.)

    // Create dimensions badge (hidden by default)
    const dimensionsBadge = createDimensionsBadge(wrapper, mediaElement);

    // Place into shared top-right badges container if available
    const { ensureOverlayContainers } = window.R34Tools;
    const { badges } = ensureOverlayContainers ? ensureOverlayContainers(wrapper) : {};
    if (badges) {
      badges.appendChild(dimensionsBadge);
    } else {
      wrapper.appendChild(dimensionsBadge);
    }
    
    let isHovering = false;
    let dimensionsLoaded = false;

    let hoverFetchTimeoutId = null;

    // Position badge relative to media on show
    const updatePosition = () => {
      repositionDimensionsBadge(wrapper, mediaElement);
    };

    // Show badge on hover
    wrapper.addEventListener('mouseenter', async () => {
      isHovering = true;
      updatePosition();
      dimensionsBadge.style.opacity = '1';

      if (hoverFetchTimeoutId) {
        clearTimeout(hoverFetchTimeoutId);
        hoverFetchTimeoutId = null;
      }
      
      // Get current dimensions
      if (!dimensionsLoaded || !dimensionsCache.has(mediaElement)) {
        let dimensions = getCurrentDimensions(mediaElement);

        // On search/list pages, thumbnails are low-res; prefer real media dimensions via DAPI.
        // This also enables proper "1080p" style labels for video thumbnails.
        if (isListPageUrl() && mediaElement?.tagName === 'IMG') {
          const postId = getPostIdForWrapper(wrapper, mediaElement);
          if (postId) {
            dimensionsBadge.textContent = 'Loading...';

            // Small hover delay so fast mouse movement doesn't spam requests.
            hoverFetchTimeoutId = setTimeout(async () => {
              hoverFetchTimeoutId = null;
              if (!isHovering) return;

              const remote = await fetchPostDimensionsViaDapi(postId);
              if (!remote || !isHovering) return;

              // Mark badge as video if the post is a video, even though the DOM element is an IMG thumbnail.
              if (remote.isVideo) {
                dimensionsBadge.dataset.mediaType = 'video';
              }

              const updated = {
                width: remote.width,
                height: remote.height,
                // We can't reliably know audio from DAPI alone; default to muted emoji.
                hasAudio: false
              };

              dimensionsCache.set(mediaElement, updated);
              updateDimensionsBadge(dimensionsBadge, updated.width, updated.height, updated.hasAudio);
              dimensionsLoaded = true;
            }, 160);
          }
        }
        
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
      if (hoverFetchTimeoutId) {
        clearTimeout(hoverFetchTimeoutId);
        hoverFetchTimeoutId = null;
      }
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
  window.R34Tools.repositionDimensionsBadge = repositionDimensionsBadge;

})();
