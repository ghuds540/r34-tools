// Video Loader module for R34 Tools extension
// All video detection, URL construction, and loading logic

(function() {
  'use strict';

  // Get dependencies
  const { CDN_DOMAINS, VIDEO_EXTENSIONS, SELECTORS, CLASS_NAMES, QUALITY_BADGES, TIMINGS } = window.R34Tools;
  const { extractPostId, positionButtonsForMedia, createButtonHoverHandlers, attachButtonHoverHandlers, delay } = window.R34Tools;

  // Track processed videos to avoid re-processing
  const processedVideos = new WeakSet();

  // Track checked post IDs to avoid duplicate fetches
  const checkedPostIds = new Set();

  /**
   * Detect if a thumbnail image is a video
   * Consolidates 4 duplicate instances from content.js
   * @param {HTMLImageElement} img - Thumbnail image element
   * @returns {boolean} True if video thumbnail
   */
  function isVideoThumbnail(img) {
    return img.classList.contains(CLASS_NAMES.videoThumb) ||
           img.classList.contains(CLASS_NAMES.videoThumbAlt) ||
           (img.title && img.title.toLowerCase().includes(' video')) ||
           (img.alt && img.alt.toLowerCase().includes(' video'));
  }

  /**
   * Construct video URL directly from thumbnail URL
   * Tries multiple CDN domains and video extensions
   * @param {string} thumbnailSrc - Thumbnail image source URL
   * @param {string} postId - Post ID (optional, appended as query param)
   * @returns {Promise<string|null>} Video URL or null if not found
   */
  async function constructVideoUrl(thumbnailSrc, postId) {
    try {
      const thumbnailUrl = new URL(thumbnailSrc);
      const pathParts = thumbnailUrl.pathname.split('/');
      const filename = pathParts[pathParts.length - 1].split('?')[0];

      // Extract hash from thumbnail filename
      const hash = filename
        .replace('thumbnail_', '')
        .replace('.jpg', '')
        .replace('.png', '')
        .replace('.gif', '');

      // Get directory from path
      const directory = pathParts[pathParts.length - 2];

      // Try multiple CDN domains and extensions
      for (const cdn of CDN_DOMAINS) {
        for (const ext of VIDEO_EXTENSIONS) {
          const testUrl = `${cdn}//images/${directory}/${hash}${ext}${postId ? '?' + postId : ''}`;

          try {
            const testResponse = await fetch(testUrl, { method: 'HEAD' });
            if (testResponse.ok) {
              return testUrl;
            }
          } catch (e) {
            // Continue trying other combinations
          }

          // Small delay to avoid hammering servers
          await delay(10);
        }
      }
    } catch (error) {
      console.error('[R34 Tools] Error constructing video URL:', error);
    }

    return null;
  }

  /**
   * Extract video URL from post page HTML
   * @param {string} html - HTML content of post page
   * @param {Document} doc - Parsed DOM document
   * @returns {string|null} Video URL or null
   */
  function extractVideoFromHtml(html, doc) {
    // Method 1: Look for video source tag
    const videoSource = doc.querySelector('video source');
    if (videoSource && videoSource.src) {
      return videoSource.src;
    }

    // Method 2: Look for video tag
    const videoTag = doc.querySelector(SELECTORS.videoElement);
    if (videoTag && videoTag.src) {
      return videoTag.src;
    }

    // Method 3: Look for source within video
    if (videoTag) {
      const source = videoTag.querySelector(SELECTORS.videoSource);
      if (source && source.src) {
        return source.src;
      }
    }

    // Method 4: Look for video URLs in raw HTML using regex
    const videoUrlMatch = html.match(/https?:\/\/[^"'\s]+\.(mp4|webm|mov)[^"'\s]*/i);
    if (videoUrlMatch) {
      return videoUrlMatch[0];
    }

    return null;
  }

  /**
   * Get video URL - tries direct construction first, then fetches post page
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {string} postUrl - URL of post page
   * @param {string} postId - Post ID
   * @returns {Promise<string|null>} Video URL or null
   */
  async function getVideoUrl(img, postUrl, postId) {
    // Try direct URL construction first (faster, no HTTP request)
    let videoUrl = await constructVideoUrl(img.src, postId);

    if (videoUrl) {
      console.log('[R34 Tools] Found video via direct construction:', videoUrl);
      return videoUrl;
    }

    // Fallback: fetch the post page and extract video URL
    console.log('[R34 Tools] Direct construction failed, fetching post page...');
    try {
      const response = await fetch(postUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      videoUrl = extractVideoFromHtml(html, doc);

      if (videoUrl) {
        console.log('[R34 Tools] Found video via page fetch:', videoUrl);
      }

      return videoUrl;
    } catch (error) {
      console.error('[R34 Tools] Error fetching post page:', error);
      return null;
    }
  }

  /**
   * Create video element from URL with styling
   * @param {string} videoUrl - Video source URL
   * @param {string} imgStyles - CSS styles from original image
   * @param {boolean} autoplay - Whether to autoplay video
   * @param {string} postUrl - Post page URL (optional, for click navigation)
   * @returns {HTMLVideoElement} Video element
   */
  function createVideoElement(videoUrl, imgStyles, autoplay = false, postUrl = null) {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.controls = true;
    video.loop = true;
    video.muted = true;
    video.autoplay = autoplay;

    // Copy styles from original image
    video.style.cssText = imgStyles;

    // Ensure video sizing is appropriate
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.width = 'auto';
    video.style.height = 'auto';
    video.style.display = 'block';

    // Add click handler to navigate to post page (except when clicking controls or play/pause)
    if (postUrl) {
      video.style.cursor = 'pointer';

      let wasPaused = video.paused;

      video.addEventListener('mousedown', () => {
        wasPaused = video.paused;
      });

      video.addEventListener('click', (e) => {
        // Small delay to check if video state changed (play/pause was triggered)
        setTimeout(() => {
          const stateChanged = wasPaused !== video.paused;

          // Don't navigate if video state changed (user clicked play/pause)
          if (stateChanged) {
            return;
          }

          // Don't navigate if clicking on video controls area
          const rect = video.getBoundingClientRect();
          const clickY = e.clientY - rect.top;
          const videoHeight = rect.height;

          // Controls are in bottom ~50px, but also check for center play button area
          const controlsHeight = 50;
          const isInControlsArea = clickY > (videoHeight - controlsHeight);

          // Check if clicking near center (where play button overlay might be)
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const clickX = e.clientX - rect.left;
          const clickYRel = e.clientY - rect.top;
          const distanceFromCenter = Math.sqrt(
            Math.pow(clickX - centerX, 2) + Math.pow(clickYRel - centerY, 2)
          );
          const isNearCenter = distanceFromCenter < 60; // 60px radius from center

          // Navigate only if not in controls and not clicking center play button
          if (!isInControlsArea && !isNearCenter) {
            window.location.href = postUrl;
          }
        }, 50);
      });
    }

    return video;
  }

  /**
   * Replace image with video element in the DOM
   * @param {HTMLImageElement} img - Original image element
   * @param {HTMLVideoElement} video - Video element to insert
   * @param {HTMLElement} wrapper - Container wrapper
   * @returns {HTMLVideoElement} The inserted video element
   */
  function replaceImageWithVideo(img, video, wrapper) {
    // Replace image with video
    img.parentNode.replaceChild(video, img);

    // Reattach buttons if wrapper provided
    if (wrapper) {
      reattachButtonsToVideo(wrapper, video);
    }

    return video;
  }

  /**
   * Reattach download/fullres buttons to video after replacement
   * @param {HTMLElement} wrapper - Container wrapper
   * @param {HTMLVideoElement} video - Video element
   */
  function reattachButtonsToVideo(wrapper, video) {
    const downloadBtn = wrapper.querySelector(`.${CLASS_NAMES.thumbDownload}`);
    const fullResBtn = wrapper.querySelector(`.${CLASS_NAMES.thumbFullRes}`);
    const qualityBadge = wrapper.querySelector(`.${CLASS_NAMES.qualityBadge}`);

    // Update quality badge to show 'V' for video
    if (qualityBadge) {
      qualityBadge.textContent = QUALITY_BADGES.video.letter;
      qualityBadge.style.background = QUALITY_BADGES.video.color;
    }

    // Create position function for video
    const positionFunc = () => {
      positionButtonsForMedia(wrapper, video, downloadBtn, fullResBtn, qualityBadge);
    };

    // Position buttons immediately
    positionFunc();

    // Recreate hover handlers for video
    const handlers = createButtonHoverHandlers(wrapper, downloadBtn, fullResBtn, qualityBadge, positionFunc);
    attachButtonHoverHandlers(wrapper, video, handlers);

    // Reposition on video load
    video.addEventListener('loadedmetadata', positionFunc);
  }

  /**
   * Load video into a thumbnail - used by full-res button click handler
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {string} postUrl - Post page URL
   * @param {HTMLElement} wrapper - Container wrapper
   * @param {Object} settings - Extension settings
   * @returns {Promise<boolean>} True if successful
   */
  async function loadVideoInThumbnail(img, postUrl, wrapper, settings) {
    const { showNotification } = window.R34Tools;

    showNotification('Loading video...', 'info');

    const postId = extractPostId(postUrl);
    const videoUrl = await getVideoUrl(img, postUrl, postId);

    if (videoUrl) {
      const video = createVideoElement(videoUrl, img.style.cssText, settings.autoStartEmbedVideos, postUrl);
      replaceImageWithVideo(img, video, wrapper);
      showNotification('Video loaded', 'success');
      return true;
    } else {
      showNotification('Could not find video URL', 'error');
      return false;
    }
  }

  /**
   * Embed video in thumbnail during auto-load
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {string} videoUrl - Video URL
   * @param {Object} settings - Extension settings
   * @param {string} postUrl - Post page URL (optional, for click navigation)
   */
  async function embedVideoInThumbnail(img, videoUrl, settings, postUrl = null) {
    const wrapper = img.closest(`.${CLASS_NAMES.thumbWrapper}`);
    const video = createVideoElement(videoUrl, img.style.cssText, settings.autoStartEmbedVideos, postUrl);

    img.parentNode.replaceChild(video, img);
    console.log('[R34 Tools] Replaced thumbnail with video player');

    if (wrapper) {
      reattachButtonsToVideo(wrapper, video);
    }
  }

  /**
   * Process a single video thumbnail for auto-loading
   * @param {HTMLImageElement} img - Thumbnail image
   * @param {Object} settings - Extension settings
   */
  async function processVideoThumbnail(img, settings) {
    const { findPostLink } = window.R34Tools;

    // Mark as processed
    processedVideos.add(img);

    // Check if it's actually a video
    if (!isVideoThumbnail(img)) {
      return;
    }

    console.log('[R34 Tools] Found video thumbnail:', img.src);

    // Find associated post link
    const postLink = findPostLink(img);
    if (!postLink) {
      console.log('[R34 Tools] No post link found for video thumbnail');
      return;
    }

    // Extract post ID and check if already processed
    const postId = extractPostId(postLink.href);
    if (postId && checkedPostIds.has(postId)) {
      console.log('[R34 Tools] Post', postId, 'already checked, skipping');
      return;
    }

    if (postId) {
      checkedPostIds.add(postId);
    }

    // Get video URL
    const videoUrl = await getVideoUrl(img, postLink.href, postId);

    // Embed video if found
    if (videoUrl) {
      await embedVideoInThumbnail(img, videoUrl, settings, postLink.href);
    } else {
      console.log('[R34 Tools] Could not find video URL for thumbnail');
    }
  }

  // Export all functions to global namespace
  window.R34Tools.isVideoThumbnail = isVideoThumbnail;
  window.R34Tools.constructVideoUrl = constructVideoUrl;
  window.R34Tools.extractVideoFromHtml = extractVideoFromHtml;
  window.R34Tools.getVideoUrl = getVideoUrl;
  window.R34Tools.createVideoElement = createVideoElement;
  window.R34Tools.replaceImageWithVideo = replaceImageWithVideo;
  window.R34Tools.reattachButtonsToVideo = reattachButtonsToVideo;
  window.R34Tools.loadVideoInThumbnail = loadVideoInThumbnail;
  window.R34Tools.embedVideoInThumbnail = embedVideoInThumbnail;
  window.R34Tools.processVideoThumbnail = processVideoThumbnail;

  // Export tracking sets
  window.R34Tools.processedVideos = processedVideos;
  window.R34Tools.checkedPostIds = checkedPostIds;

})();
