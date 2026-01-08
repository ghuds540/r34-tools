// Download Indicators module for R34 Tools extension
// Adds visual indicators to thumbnails and post pages for downloaded content

(function() {
  'use strict';

  // Get dependencies
  const { DownloadTracker, extractPostId } = window.R34Tools;

  // Indicator styles
  const INDICATOR_STYLES = {
    thumbnail: {
      position: 'relative',
      width: '20px',
      height: '20px',
      backgroundColor: 'rgba(76, 175, 80, 0.9)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: 'white',
      zIndex: '102',
      pointerEvents: 'none',
      textDecoration: 'none',
      lineHeight: '1',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      border: '2px solid white'
    },
    postPage: {
      position: 'absolute',
      top: '10px',
      right: '10px',
      padding: '6px 12px',
      backgroundColor: 'rgba(76, 175, 80, 0.95)',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      fontWeight: '600',
      color: 'white',
      zIndex: '1000',
      pointerEvents: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      border: '2px solid white'
    }
  };

  /**
   * Create download indicator element
   * @param {string} type - 'thumbnail' or 'postPage'
   * @param {string} state - 'downloading', 'success', or 'failed'
   * @returns {HTMLElement} Indicator element
   */
  async function createIndicator(type = 'thumbnail', state = 'success') {
    const indicator = document.createElement('div');
    indicator.className = `r34-download-indicator r34-${type}-indicator r34-indicator-${state}`;
    indicator.dataset.state = state;
    
    const styles = INDICATOR_STYLES[type];
    Object.assign(indicator.style, styles);

    // Prevent inherited underline from parent links
    indicator.style.textDecoration = 'none';

    // Default flex sizing
    indicator.style.flexShrink = '0';

    // State-specific colors
    if (state === 'downloading') {
      indicator.style.backgroundColor = 'rgba(33, 150, 243, 0.9)'; // Blue
    } else if (state === 'failed') {
      indicator.style.backgroundColor = 'rgba(244, 67, 54, 0.9)'; // Red
    } else {
      indicator.style.backgroundColor = 'rgba(76, 175, 80, 0.9)'; // Green
    }

    // Check visibility setting
    const settings = await browser.storage.local.get({ downloadIndicatorVisibility: 'always' });
    if (settings.downloadIndicatorVisibility === 'hover') {
      indicator.style.opacity = '0';
      indicator.style.transition = 'opacity 0.2s';
    }

    // Render icon based on state
    if (type === 'thumbnail') {
      if (state === 'downloading') {
        indicator.innerHTML = '<span class="r34-spinner">⟳</span>';
        indicator.title = 'Downloading...';
      } else if (state === 'failed') {
        indicator.textContent = '✗';
        indicator.title = 'Download failed';
      } else {
        indicator.textContent = '✓';
        indicator.title = 'Already downloaded';
      }
    } else {
      if (state === 'downloading') {
        indicator.innerHTML = `
          <span class="r34-spinner" style="font-size: 16px;">⟳</span>
          <span>Downloading...</span>
        `;
      } else if (state === 'failed') {
        indicator.innerHTML = `
          <span style="font-size: 16px;">✗</span>
          <span>Failed</span>
        `;
      } else {
        indicator.innerHTML = `
          <span style="font-size: 16px;">✓</span>
          <span>Downloaded</span>
        `;
      }
    }

    return indicator;
  }

  /**
   * Update existing indicator state
   * @param {string} postId - Post ID
   * @param {string} newState - 'downloading', 'success', or 'failed'
   */
  async function updateIndicatorState(postId, newState) {
    const indicators = document.querySelectorAll(`.r34-download-indicator[data-post-id="${postId}"]`);
    
    for (const indicator of indicators) {
      const oldState = indicator.dataset.state;
      if (oldState === newState) continue;

      indicator.dataset.state = newState;
      indicator.className = indicator.className.replace(/r34-indicator-\w+/, `r34-indicator-${newState}`);

      // Update colors
      if (newState === 'downloading') {
        indicator.style.backgroundColor = 'rgba(33, 150, 243, 0.9)'; // Blue
      } else if (newState === 'failed') {
        indicator.style.backgroundColor = 'rgba(244, 67, 54, 0.9)'; // Red
      } else {
        indicator.style.backgroundColor = 'rgba(76, 175, 80, 0.9)'; // Green
      }

      // Update content
      const isPostPage = indicator.classList.contains('r34-postPage-indicator');
      if (isPostPage) {
        if (newState === 'downloading') {
          indicator.innerHTML = `
            <span class="r34-spinner" style="font-size: 16px;">⟳</span>
            <span>Downloading...</span>
          `;
        } else if (newState === 'failed') {
          indicator.innerHTML = `
            <span style="font-size: 16px;">✗</span>
            <span>Failed</span>
          `;
        } else {
          indicator.innerHTML = `
            <span style="font-size: 16px;">✓</span>
            <span>Downloaded</span>
          `;
        }
      } else {
        if (newState === 'downloading') {
          indicator.innerHTML = '<span class="r34-spinner">⟳</span>';
          indicator.title = 'Downloading...';
        } else if (newState === 'failed') {
          indicator.textContent = '✗';
          indicator.title = 'Download failed';
        } else {
          indicator.textContent = '✓';
          indicator.title = 'Already downloaded';
        }
      }
    }
  }

  /**
   * Show downloading indicator for a post
   * @param {string} postId - Post ID
   * @param {HTMLElement} thumbnail - Optional thumbnail element for new indicator
   */
  async function showDownloadingIndicator(postId, thumbnail = null) {
    console.log('[R34 Download Indicators] showDownloadingIndicator called for postId:', postId, 'thumbnail:', thumbnail);
    
    // Check if indicator already exists
    let indicator = document.querySelector(`.r34-download-indicator[data-post-id="${postId}"]`);
    
    if (indicator) {
      // Update existing indicator
      console.log('[R34 Download Indicators] Updating existing indicator to downloading state');
      await updateIndicatorState(postId, 'downloading');
    } else if (thumbnail) {
      // Create new downloading indicator
      console.log('[R34 Download Indicators] Creating new downloading indicator');
      await addThumbnailIndicator(thumbnail, postId, 'downloading');
    } else {
      console.warn('[R34 Download Indicators] No indicator found and no thumbnail provided');
    }
  }

  /**
   * Show success indicator for a post
   * @param {string} postId - Post ID
   */
  async function showSuccessIndicator(postId) {
    console.log('[R34 Download Indicators] showSuccessIndicator called for postId:', postId);
    
    // Check if indicator exists
    let indicator = document.querySelector(`.r34-download-indicator[data-post-id="${postId}"]`);
    
    if (indicator) {
      await updateIndicatorState(postId, 'success');
    } else {
      console.log('[R34 Download Indicators] No indicator found to update to success');
      // Try to create one on the current page
      const isPostPage = window.location.href.includes('page=post&s=view');
      if (isPostPage) {
        await addPostPageIndicator(postId, 'success');
      } else {
        // Prefer wrapper stamped with data-post-id
        const wrapper = document.querySelector(`.r34-thumb-wrapper[data-post-id="${postId}"]`);
        if (wrapper) {
          await addThumbnailIndicator(wrapper, postId, 'success');
          return;
        }

        // Fallback: locate by link href
        const thumbnailLink = document.querySelector(`a[href*="id=${postId}"]`);
        if (thumbnailLink) {
          const thumbnail = thumbnailLink.querySelector('img, video') || thumbnailLink;
          await addThumbnailIndicator(thumbnail, postId, 'success');
        }
      }
    }
  }

  /**
   * Show failed indicator for a post
   * @param {string} postId - Post ID
   */
  async function showFailedIndicator(postId) {
    console.log('[R34 Download Indicators] showFailedIndicator called for postId:', postId);
    
    // Check if indicator exists
    let indicator = document.querySelector(`.r34-download-indicator[data-post-id="${postId}"]`);
    
    if (indicator) {
      await updateIndicatorState(postId, 'failed');
    } else {
      console.log('[R34 Download Indicators] No indicator found to update to failed');
      // Try to create one on the current page
      const isPostPage = window.location.href.includes('page=post&s=view');
      if (isPostPage) {
        await addPostPageIndicator(postId, 'failed');
      } else {
        const thumbnailLink = document.querySelector(`a[href*="id=${postId}"]`);
        if (thumbnailLink) {
          const thumbnail = thumbnailLink.querySelector('img');
          if (thumbnail) {
            await addThumbnailIndicator(thumbnail, postId, 'failed');
          }
        }
      }
    }
  }

  /**
   * Add indicator to thumbnail
   * @param {HTMLElement} thumbnail - Thumbnail image or container
   * @param {string} postId - Post ID
   * @param {string} state - 'downloading', 'success', or 'failed'
   */
  async function addThumbnailIndicator(thumbnail, postId, state = 'success') {
    console.log('[R34 Download Indicators] addThumbnailIndicator called - postId:', postId, 'state:', state);
    
    // Check visibility setting
    const settings = await browser.storage.local.get({ downloadIndicatorVisibility: 'always' });
    const isHoverMode = settings.downloadIndicatorVisibility === 'hover';
    
    // Find the thumbnail container
    let container = thumbnail?.closest?.('.thumb, .thumbnail, span.thumb') ||
      thumbnail?.closest?.('.r34-thumb-wrapper') ||
      thumbnail?.parentElement;
    
    // Always try to add to the button wrapper if it exists
    const buttonWrapper = container?.classList?.contains('r34-thumb-wrapper')
      ? container
      : container?.querySelector?.('.r34-thumb-wrapper');
    console.log('[R34 Download Indicators] Looking for button wrapper, found:', buttonWrapper);
    
    if (buttonWrapper) {
      // Check if indicator already exists in wrapper
      if (buttonWrapper.querySelector('.r34-thumbnail-indicator')) {
        console.log('[R34 Download Indicators] Indicator already exists in button wrapper, skipping');
        return;
      }
      
      // Create indicator without applying default styles that would position it absolutely
      const indicator = document.createElement('div');
      indicator.className = `r34-download-indicator r34-thumbnail-indicator r34-indicator-${state}`;
      indicator.dataset.state = state;
      indicator.dataset.postId = postId;
      
      // Apply visual styles (badge container handles placement)
      indicator.style.width = '20px';
      indicator.style.height = '20px';
      indicator.style.borderRadius = '50%';
      indicator.style.position = 'relative';
      indicator.style.display = 'flex';
      indicator.style.alignItems = 'center';
      indicator.style.justifyContent = 'center';
      indicator.style.fontSize = '12px';
      indicator.style.color = 'white';
      indicator.style.zIndex = '102';
      indicator.style.pointerEvents = 'none';
      indicator.style.textDecoration = 'none';
      indicator.style.lineHeight = '1';
      indicator.style.flexShrink = '0';
      // Do not override flex order; DOM order + container layout controls placement
      indicator.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      indicator.style.border = '2px solid white';

      // Respect visibility setting
      if (isHoverMode) {
        indicator.style.opacity = '0';
        indicator.style.transition = 'opacity 0.2s';

        // Bind hover listeners once per wrapper
        if (buttonWrapper.dataset.r34DownloadIndicatorHoverBound !== 'true') {
          buttonWrapper.addEventListener('mouseenter', () => {
            const el = buttonWrapper.querySelector('.r34-thumbnail-indicator');
            if (el) el.style.opacity = '1';
          });
          buttonWrapper.addEventListener('mouseleave', () => {
            const el = buttonWrapper.querySelector('.r34-thumbnail-indicator');
            if (el) el.style.opacity = '0';
          });
          buttonWrapper.dataset.r34DownloadIndicatorHoverBound = 'true';
        }
      }
      
      // State-specific colors
      if (state === 'downloading') {
        indicator.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
        indicator.innerHTML = '<span class=\"r34-spinner\">⟳</span>';
        indicator.title = 'Downloading...';
      } else if (state === 'failed') {
        indicator.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        indicator.textContent = '✗';
        indicator.title = 'Download failed';
      } else {
        indicator.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
        indicator.textContent = '✓';
        indicator.title = 'Already downloaded';
      }
      
      // Prefer shared badges container (top-right over media bounds)
      const { ensureOverlayContainers } = window.R34Tools || {};
      const { badges } = ensureOverlayContainers ? ensureOverlayContainers(buttonWrapper) : {};
      if (badges) {
        badges.insertBefore(indicator, badges.firstChild);
      } else {
        buttonWrapper.appendChild(indicator);
      }

      // Reposition related UI immediately so we don't overlap until re-hover
      try {
        const img = thumbnail?.tagName === 'IMG' ? thumbnail : buttonWrapper.querySelector('img');
        const downloadBtn = buttonWrapper.querySelector('.r34-thumb-download');
        const fullResBtn = buttonWrapper.querySelector('.r34-thumb-fullres');
        const qualityBadge = buttonWrapper.querySelector('.r34-quality-badge');
        const goToPostBtn = buttonWrapper.querySelector('.r34-thumb-gotopost');

        if (img && window.R34Tools?.positionButtonsForMedia) {
          window.R34Tools.positionButtonsForMedia(
            buttonWrapper,
            img,
            downloadBtn,
            fullResBtn,
            qualityBadge,
            goToPostBtn
          );
        }

        if (img && window.R34Tools?.repositionDimensionsBadge) {
          window.R34Tools.repositionDimensionsBadge(buttonWrapper, img);
        }

        // If we're currently hovered and visibility is hover-only, show immediately
        if (isHoverMode && buttonWrapper.matches(':hover')) {
          indicator.style.opacity = '1';
        }
      } catch (e) {
        // Non-fatal: positioning is best-effort
      }

      console.log('[R34 Download Indicators] Added indicator to button wrapper');
      return;
    }
    
    // Fallback: Standard positioning if no button wrapper (shouldn't happen normally)
    console.warn('[R34 Download Indicators] No button wrapper found, using fallback positioning');
    
    // Make sure container is positioned
    if (container && getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Check if indicator already exists
    if (container && container.querySelector('.r34-thumbnail-indicator')) {
      console.log('[R34 Download Indicators] Indicator already exists for this thumbnail, skipping');
      return;
    }

    const indicator = await createIndicator('thumbnail', state);
    indicator.dataset.postId = postId;

    // Add hover effect for parent container if visibility is 'hover' (reuse settings from above)
    if (isHoverMode && container) {
      container.addEventListener('mouseenter', () => {
        indicator.style.opacity = '1';
      });
      container.addEventListener('mouseleave', () => {
        indicator.style.opacity = '0';
      });
    }

    if (container) {
      container.appendChild(indicator);
    } else {
      // Fallback: add directly to thumbnail
      thumbnail.style.position = 'relative';
      thumbnail.appendChild(indicator);
    }
  }

  /**
   * Add indicator to post page
   * @param {string} postId - Post ID
   * @param {string} state - 'downloading', 'success', or 'failed'
   */
  async function addPostPageIndicator(postId, state = 'success') {
    // Check if indicator already exists
    if (document.querySelector('.r34-postPage-indicator')) {
      return;
    }

    // Find the media container
    const mediaContainer = document.querySelector('#image, #gelcomVideoPlayer, video');
    if (!mediaContainer) return;

    const container = mediaContainer.parentElement;
    if (!container) return;

    // Make sure container is positioned
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    const indicator = await createIndicator('postPage', state);
    indicator.dataset.postId = postId;
    container.appendChild(indicator);
  }

  /**
   * Scan and mark downloaded thumbnails on list pages
   */
  async function markDownloadedThumbnails() {
    const thumbnails = document.querySelectorAll('.thumb img, .thumbnail img');
    if (thumbnails.length === 0) return;

    // Extract post IDs from thumbnails
    const postIds = [];
    const thumbnailMap = new Map(); // postId -> thumbnail element

    thumbnails.forEach(thumb => {
      // Find post link
      const link = thumb.closest('a[href*="id="]');
      if (!link) return;

      const match = link.href.match(/[?&]id=(\d+)/);
      if (match) {
        const postId = match[1];
        postIds.push(postId);
        thumbnailMap.set(postId, thumb);
      }
    });

    if (postIds.length === 0) return;

    // Check all post IDs at once
    const downloadStatus = await DownloadTracker.checkMultiple(postIds);

    // Add indicators to downloaded thumbnails
    let markedCount = 0;
    for (const [postId, isDownloaded] of Object.entries(downloadStatus)) {
      if (isDownloaded) {
        const thumb = thumbnailMap.get(postId);
        if (thumb) {
          addThumbnailIndicator(thumb, postId);
          markedCount++;
        }
      }
    }

    if (markedCount > 0) {
      console.log(`[R34 Tools] Marked ${markedCount} thumbnails as downloaded`);
    }
  }

  /**
   * Check and mark current post page if downloaded
   */
  async function markDownloadedPostPage() {
    const postId = extractPostId();
    if (!postId) return;

    const isDownloaded = await DownloadTracker.isDownloaded(postId);
    if (isDownloaded) {
      addPostPageIndicator(postId);
      console.log(`[R34 Tools] Marked post ${postId} as downloaded`);
    }
  }

  /**
   * Initialize download indicators
   */
  async function initializeIndicators() {
    // Check if tracking is enabled
    const settings = await browser.storage.local.get({ enableDownloadTracking: true });
    if (!settings.enableDownloadTracking) {
      return; // Don't show indicators if tracking is disabled
    }

    // Check if we're on a list page or post page
    const isListPage = window.location.href.includes('page=post&s=list') || 
                       window.location.href.includes('tags=');
    const isPostPage = window.location.href.includes('page=post&s=view');

    if (isListPage) {
      await markDownloadedThumbnails();
    } else if (isPostPage) {
      await markDownloadedPostPage();
    }
  }

  /**
   * Watch for new thumbnails and mark them
   */
  function watchForNewThumbnails() {
    const observer = new MutationObserver((mutations) => {
      let hasNewThumbnails = false;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            if (node.matches?.('.thumb, .thumbnail') || 
                node.querySelector?.('.thumb, .thumbnail')) {
              hasNewThumbnails = true;
              break;
            }
          }
        }
        if (hasNewThumbnails) break;
      }

      if (hasNewThumbnails) {
        markDownloadedThumbnails();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Export to global namespace
  window.R34Tools = window.R34Tools || {};
  Object.assign(window.R34Tools, {
    addThumbnailIndicator,
    addPostPageIndicator,
    updateIndicatorState,
    showDownloadingIndicator,
    showSuccessIndicator,
    showFailedIndicator,
    markDownloadedThumbnails,
    markDownloadedPostPage,
    initializeIndicators,
    watchForNewThumbnails
  });

})();
