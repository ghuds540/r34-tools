// Content script for extracting media and metadata from rule34.xxx

class Rule34Extractor {
  constructor() {
    this.postId = null;
    this.mediaUrl = null;
    this.artists = [];
  }

  // Extract post ID from URL or page
  extractPostId() {
    const urlParams = new URLSearchParams(window.location.search);
    this.postId = urlParams.get('id');

    // Fallback: try to get from page variable
    if (!this.postId && typeof id !== 'undefined') {
      this.postId = id;
    }

    // Additional fallback: extract from URL path or hash
    if (!this.postId) {
      const match = window.location.href.match(/[?&]id=(\d+)/);
      if (match) {
        this.postId = match[1];
      }
    }

    return this.postId;
  }

  // Extract highest quality media URL
  extractMediaUrl() {
    // Method 1: Check for image JavaScript object (most reliable for images)
    if (typeof image !== 'undefined' && image.domain && image.dir !== undefined && image.img) {
      // Domain already includes protocol (https://) and may include trailing slash
      let domain = image.domain;

      // Ensure domain has protocol
      if (!domain.startsWith('http')) {
        domain = 'https://' + domain;
      }

      // Ensure domain has trailing slash
      if (!domain.endsWith('/')) {
        domain += '/';
      }

      // base_dir should be 'images' for full resolution (not 'samples')
      const baseDir = image.base_dir === 'samples' ? 'images' : (image.base_dir || 'images');

      // Construct full quality URL
      this.mediaUrl = `${domain}${baseDir}/${image.dir}/${image.img}`;
      return this.mediaUrl;
    }

    // Method 2: Check for video element (videos are typically full quality)
    const videoElement = document.querySelector('video source, video');
    if (videoElement) {
      this.mediaUrl = videoElement.src || videoElement.querySelector('source')?.src;
      if (this.mediaUrl) {
        return this.mediaUrl;
      }
    }

    // Method 3: Check for "Original image" link in options
    const originalLink = document.querySelector('a[href*="/images/"]');
    if (originalLink && originalLink.textContent.includes('Original')) {
      this.mediaUrl = originalLink.href;
      return this.mediaUrl;
    }

    // Method 4: Look for main image and upgrade to full resolution
    const mainImage = document.querySelector('#image, .flexi img, img[onclick*="note"]');
    if (mainImage) {
      let imgUrl = mainImage.src;

      // Force highest quality by replacing sample/thumbnail paths
      imgUrl = imgUrl.replace('/thumbnails/', '/images/');
      imgUrl = imgUrl.replace('/samples/', '/images/');
      imgUrl = imgUrl.replace('thumbnail_', '');

      // Remove any query parameters that might indicate sample size
      const url = new URL(imgUrl);
      url.searchParams.delete('sample');

      this.mediaUrl = url.toString();
      return this.mediaUrl;
    }

    return null;
  }

  // Extract tags and artists from page
  extractMetadata() {
    this.artists = [];

    // Get artist links, filter out control characters
    const tagLinks = document.querySelectorAll('.tag-type-artist a, li[class*="tag-type-artist"] a');
    tagLinks.forEach(link => {
      const artistName = link.textContent.trim().replace(/\s*\d+$/, ''); // Remove count
      // Filter out control characters and single-character artifacts
      if (artistName && artistName.length > 1 && !['?', '+', '-'].includes(artistName) && !this.artists.includes(artistName)) {
        this.artists.push(artistName);
      }
    });

    return { artists: this.artists };
  }

  // Get filename for download
  getFilename() {
    if (!this.mediaUrl) return null;

    const urlObj = new URL(this.mediaUrl);
    const pathname = urlObj.pathname;
    const baseFilename = pathname.split('/').pop().split('?')[0];

    // Extract file extension
    const lastDotIndex = baseFilename.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? baseFilename.substring(lastDotIndex) : '';
    const nameWithoutExt = lastDotIndex !== -1 ? baseFilename.substring(0, lastDotIndex) : baseFilename;

    // Build filename with post ID and artists
    let finalName = '';

    // Add post ID prefix
    if (this.postId) {
      finalName = `r34_${this.postId}_`;
    }

    // Add base filename
    finalName += nameWithoutExt;

    // Append artists if available
    if (this.artists && this.artists.length > 0) {
      // Sanitize artist names for filename (replace spaces with underscores, remove invalid chars)
      const artistString = this.artists
        .map(artist => artist.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, ''))
        .join('_');
      finalName += `_${artistString}`;
    }

    // Add extension back
    finalName += extension;

    return finalName;
  }

  // Format metadata for saving
  formatMetadata() {
    const timestamp = new Date().toISOString();
    let output = '\n' + '='.repeat(80) + '\n';
    output += `Post ID: ${this.postId || 'Unknown'}\n`;
    output += `URL: ${window.location.href}\n`;
    output += `Timestamp: ${timestamp}\n`;
    output += `\nArtists: ${this.artists.length > 0 ? this.artists.join(', ') : 'None found'}\n`;
    output += `\nTags:\n${this.tags.join(', ')}\n`;
    output += '='.repeat(80) + '\n';

    return output;
  }
}

// Global extractor instance
let extractor = new Rule34Extractor();

// Listen for messages from background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'downloadMedia') {
    await handleDownloadMedia();
  } else if (message.action === 'savePage') {
    await handleSavePage();
  }
});

// Handle download media command
async function handleDownloadMedia() {
  extractor = new Rule34Extractor();
  extractor.extractPostId();
  extractor.extractMediaUrl();
  extractor.extractMetadata(); // Extract artists for filename

  if (!extractor.mediaUrl) {
    showNotification('No media found on this page', 'error');
    return;
  }

  const filename = extractor.getFilename();

  try {
    const response = await browser.runtime.sendMessage({
      action: 'download',
      url: extractor.mediaUrl,
      filename: filename
    });

    if (response.success) {
      // Get artist names for display
      const artistInfo = extractor.artists.length > 0
        ? `\nArtists: ${extractor.artists.join(', ')}`
        : '';

      showNotification(`Downloaded: ${filename}${artistInfo}`, 'success');
    } else {
      showNotification(`Download failed: ${response.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Handle save page for later command
async function handleSavePage() {
  extractor = new Rule34Extractor();
  extractor.extractPostId();
  extractor.extractMetadata();

  const data = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    postId: extractor.postId || null,
    artists: extractor.artists
  };

  try {
    const response = await browser.runtime.sendMessage({
      action: 'savePageJson',
      data: data
    });

    if (response && response.success) {
      const info = extractor.postId ? `Post ${extractor.postId}` : 'Page';
      showNotification(`Saved ${info}\n→ ${response.filename}`, 'success');
    } else {
      showNotification(`Save failed: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('Save error:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Track active notifications for stacking
const activeNotifications = [];

// Show notification on page
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');

  let bgColor, textColor, borderColor;
  if (type === 'error') {
    bgColor = '#2f0f0f';
    textColor = '#ff6666';
    borderColor = '#4a1a1a';
  } else if (type === 'success') {
    bgColor = '#0f2f1a';
    textColor = '#00ff66';
    borderColor = '#1a4a2a';
  } else {
    bgColor = '#0f2f1a';
    textColor = '#00ff66';
    borderColor = '#1a4a2a';
  }

  // Calculate vertical position based on existing notifications
  let topPosition = 50; // Start below header button
  activeNotifications.forEach(notif => {
    if (notif && notif.offsetHeight) {
      topPosition += notif.offsetHeight + 10; // 10px gap between notifications
    }
  });

  notification.style.cssText = `
    position: fixed;
    top: ${topPosition}px;
    right: 20px;
    padding: 14px 18px;
    background: ${bgColor};
    color: ${textColor};
    border: 1px solid ${borderColor};
    border-radius: 6px;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    max-width: 350px;
    backdrop-filter: blur(10px);
    white-space: pre-line;
    line-height: 1.5;
    transition: opacity 0.3s ease, transform 0.3s ease;
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
      // Remove from active notifications array
      const index = activeNotifications.indexOf(notification);
      if (index > -1) {
        activeNotifications.splice(index, 1);
      }
      // Reposition remaining notifications
      repositionNotifications();
    }, 300);
  }, 3000);
}

// Reposition all active notifications after one is removed
function repositionNotifications() {
  let topPosition = 50;
  activeNotifications.forEach(notif => {
    if (notif && notif.offsetHeight) {
      notif.style.top = topPosition + 'px';
      topPosition += notif.offsetHeight + 10;
    }
  });
}

// Create action buttons on page
function createFloatingButtons() {
  const isPostPage = window.location.href.includes('page=post&s=view');
  const isListPage = window.location.href.includes('page=post&s=list');

  if (isPostPage) {
    // On post pages: download button appears on image hover
    createImageDownloadButton();
    // Add controls panel on post pages
    createExtensionControlsPanel();
  } else if (isListPage) {
    // On list pages: add controls panel
    createExtensionControlsPanel();
  }
}

// Create styled container for all extension controls
function createExtensionControlsPanel() {
  const isPostPage = window.location.href.includes('page=post&s=view');
  const isListPage = window.location.href.includes('page=post&s=list');

  // Create main container
  const controlsPanel = document.createElement('div');
  controlsPanel.id = 'r34-tools-controls';
  controlsPanel.style.cssText = `
    width: 100%;
    margin: 8px 0;
    padding: 8px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 2px;
  `;

  // Create header with title only
  const header = document.createElement('div');
  header.style.cssText = `
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid #333;
  `;

  // Title
  const title = document.createElement('span');
  title.textContent = 'R34 Tools';
  title.style.cssText = `
    color: #999;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;

  header.appendChild(title);
  controlsPanel.appendChild(header);

  // Create buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.id = 'r34-tools-buttons';
  buttonsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;

  // Add save button
  buttonsContainer.appendChild(createStyledButton(
    '🔖',
    'Save Page',
    'Save page (Ctrl+Shift+S)',
    '#00ff66',
    () => handleSavePage()
  ));

  // Add force max quality button (list pages only)
  if (isListPage) {
    buttonsContainer.appendChild(createStyledButton(
      '⚡',
      'Force Max Quality',
      'Load highest quality for all visible images',
      '#66b3ff',
      () => forceLoadAllMaxQuality()
    ));

    // Add force load videos button
    buttonsContainer.appendChild(createStyledButton(
      '▶',
      'Force Load Videos',
      'Load all videos on page',
      '#ff66b3',
      () => forceLoadAllVideos()
    ));
  }

  controlsPanel.appendChild(buttonsContainer);

  // Try to find search form and insert after it
  const searchForm = document.querySelector('form[action*="list"]');
  const sidebar = document.querySelector('#leftmenu, .sidebar, aside');

  if (searchForm && searchForm.parentNode) {
    // Insert after search form
    searchForm.parentNode.insertBefore(controlsPanel, searchForm.nextSibling);
  } else if (sidebar) {
    // Fallback: insert at top of sidebar
    sidebar.insertBefore(controlsPanel, sidebar.firstChild);
  } else {
    // Last resort: fixed position
    controlsPanel.style.position = 'fixed';
    controlsPanel.style.top = '10px';
    controlsPanel.style.left = '10px';
    controlsPanel.style.width = '200px';
    controlsPanel.style.zIndex = '9999';
    document.body.appendChild(controlsPanel);
  }
}

// Helper function to create styled buttons
function createStyledButton(emoji, label, tooltip, accentColor, onClick) {
  const button = document.createElement('button');
  button.title = tooltip;
  button.style.cssText = `
    width: 100%;
    padding: 4px 6px;
    border: 1px solid #333;
    border-radius: 2px;
    background: #0a0a0a;
    color: #ccc;
    font-weight: 500;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 5px;
    line-height: 1.3;
  `;

  const emojiSpan = document.createElement('span');
  emojiSpan.textContent = emoji;
  emojiSpan.style.cssText = `
    font-size: 11px;
    opacity: 0.8;
  `;

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;

  button.appendChild(emojiSpan);
  button.appendChild(labelSpan);

  button.onmouseover = () => {
    button.style.borderColor = '#555';
    button.style.background = '#222';
    button.style.color = accentColor;
  };
  button.onmouseout = () => {
    button.style.borderColor = '#333';
    button.style.background = '#0a0a0a';
    button.style.color = '#ccc';
  };

  button.onclick = onClick;

  return button;
}

// Create download button that appears on image/video hover
function createImageDownloadButton() {
  const imageElement = document.querySelector('#image, img.img, .flexi img, video, #gelcomVideoPlayer');
  if (!imageElement) return;

  // Wrap image in a positioned container if needed
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
  downloadBtn.id = 'r34-tools-download';
  downloadBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
    </svg>
  `;
  downloadBtn.title = 'Download (Ctrl+Q)';
  downloadBtn.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #00ff66 0%, #00cc52 100%);
    color: #000;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    transition: all 0.2s ease;
    opacity: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  wrapper.appendChild(downloadBtn);

  // Show on hover
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
  downloadBtn.addEventListener('mouseenter', showButton);

  downloadBtn.onclick = () => handleDownloadMedia();
}

// Force load maximum quality for all thumbnails
async function forceLoadAllMaxQuality() {
  const settings = await browser.storage.local.get({
    autoLoadVideoEmbeds: true,
    autoStartEmbedVideos: true
  });

  const thumbnails = document.querySelectorAll('.thumb img, .thumbnail img, span.thumb img');

  if (thumbnails.length === 0) {
    showNotification('No thumbnails found on this page', 'info');
    return;
  }

  showNotification(`Loading max quality for ${thumbnails.length} images...`, 'info');

  let successCount = 0;
  let failCount = 0;
  let skippedVideos = 0;

  for (const img of thumbnails) {
    // Find the post link
    let postLink = img.closest('a[href*="page=post"]');
    if (!postLink) {
      postLink = img.parentElement.querySelector('a[href*="page=post"]');
    }
    if (!postLink && img.parentElement.parentElement) {
      postLink = img.parentElement.parentElement.querySelector('a[href*="page=post"]');
    }
    if (!postLink) {
      failCount++;
      continue;
    }

    const postUrl = postLink.href;

    try {
      // Fetch the post page
      const response = await fetch(postUrl);
      const html = await response.text();

      // Parse HTML to extract image object
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      let fullResUrl = null;

      // Method 1: Check if it's a video - try to replace with video element
      const videoElement = doc.querySelector('video source, video');
      if (videoElement) {
        const videoUrl = videoElement.src || videoElement.querySelector('source')?.src;
        if (videoUrl && settings.autoLoadVideoEmbeds) {
          // Get the wrapper element that contains the buttons
          const wrapper = img.closest('.r34-thumb-wrapper');

          // Replace img with video element
          const video = document.createElement('video');
          video.src = videoUrl;
          video.controls = true;
          video.loop = true;
          video.muted = true;
          video.autoplay = settings.autoStartEmbedVideos;
          video.style.cssText = img.style.cssText; // Copy img styles
          video.style.maxWidth = '100%';
          video.style.maxHeight = '100%';
          video.style.width = 'auto';
          video.style.height = 'auto';

          // Replace the img element with video
          img.parentNode.replaceChild(video, img);

          // Re-attach download and full-res buttons if wrapper exists
          if (wrapper) {
            const downloadBtn = wrapper.querySelector('.r34-thumb-download');
            const fullResBtn = wrapper.querySelector('.r34-thumb-fullres');
            const qualityBadge = wrapper.querySelector('.r34-quality-badge');

            // Update quality badge to show it's a video
            if (qualityBadge) {
              qualityBadge.textContent = 'V';
              qualityBadge.style.background = 'rgba(102, 179, 255, 0.9)';
              console.log('[R34 Tools] Updated quality badge to V');
            } else {
              console.log('[R34 Tools] Warning: No quality badge found for video');
            }

            // Update button positioning to work with video element
            const positionButtonsForVideo = () => {
              const containerRect = wrapper.getBoundingClientRect();
              const videoRect = video.getBoundingClientRect();

              const offsetTop = videoRect.top - containerRect.top;
              const offsetLeft = videoRect.left - containerRect.left;
              const offsetRight = containerRect.right - videoRect.right;

              if (downloadBtn) {
                downloadBtn.style.top = (offsetTop + 4) + 'px';
                downloadBtn.style.left = (offsetLeft + 4) + 'px';
              }
              if (fullResBtn) {
                fullResBtn.style.top = (offsetTop + 4) + 'px';
                fullResBtn.style.left = (offsetLeft + 36) + 'px';
              }
              if (qualityBadge) {
                qualityBadge.style.top = (offsetTop + 4) + 'px';
                qualityBadge.style.right = (offsetRight + 4) + 'px';
              }
            };

            positionButtonsForVideo();

            // Re-add hover events for the video
            const showButtons = () => {
              positionButtonsForVideo();
              if (downloadBtn) {
                downloadBtn.style.opacity = '1';
                downloadBtn.style.pointerEvents = 'auto';
              }
              if (fullResBtn) {
                fullResBtn.style.opacity = '1';
                fullResBtn.style.pointerEvents = 'auto';
              }
              if (qualityBadge) {
                qualityBadge.style.opacity = '1';
              }
            };

            const hideButtons = () => {
              if (downloadBtn) {
                downloadBtn.style.opacity = '0';
                downloadBtn.style.pointerEvents = 'none';
              }
              if (fullResBtn) {
                fullResBtn.style.opacity = '0';
                fullResBtn.style.pointerEvents = 'none';
              }
              if (qualityBadge) {
                qualityBadge.style.opacity = '0';
              }
            };

            wrapper.removeEventListener('mouseenter', showButtons);
            wrapper.removeEventListener('mouseleave', hideButtons);
            wrapper.addEventListener('mouseenter', showButtons);
            wrapper.addEventListener('mouseleave', hideButtons);
            video.addEventListener('mouseenter', showButtons);
          }

          successCount++;
        } else if (!settings.autoLoadVideoEmbeds) {
          // Skip videos if auto-load is disabled
          skippedVideos++;
        } else {
          // No video URL found
          skippedVideos++;
        }
        continue;
      }

      // Method 2: Look for "Original image" link
      const originalLink = doc.querySelector('a[href*="/images/"]');
      if (originalLink && originalLink.textContent.includes('Original')) {
        fullResUrl = originalLink.href;
      }

      // Method 3: Look for main image and upgrade to full resolution
      if (!fullResUrl) {
        const mainImage = doc.querySelector('#image, .flexi img, img[onclick*="note"]');
        if (mainImage) {
          let imgUrl = mainImage.src;
          // Force highest quality
          imgUrl = imgUrl.replace('/thumbnails/', '/images/');
          imgUrl = imgUrl.replace('/samples/', '/images/');
          imgUrl = imgUrl.replace('thumbnail_', '');
          imgUrl = imgUrl.replace('sample_', '');
          const url = new URL(imgUrl);
          url.searchParams.delete('sample');
          fullResUrl = url.toString();
        }
      }

      if (fullResUrl) {
        // Validate URL before replacing - test if it actually loads
        try {
          const testImg = new Image();
          const loadPromise = new Promise((resolve, reject) => {
            testImg.onload = () => resolve(true);
            testImg.onerror = () => reject(false);
          });
          testImg.src = fullResUrl;

          await loadPromise;

          // URL is valid, replace the thumbnail
          img.src = fullResUrl;
          setImageQuality(img, 'F');
          successCount++;
        } catch {
          // URL returned 404 or failed to load
          console.log('Failed to load full res URL:', fullResUrl);
          failCount++;
        }
      } else {
        failCount++;
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error('Error loading full res for image:', error);
      failCount++;
    }
  }

  let message = `Loaded: ${successCount} success, ${failCount} failed`;
  if (skippedVideos > 0) {
    message += `, ${skippedVideos} videos couldn't load`;
  }

  showNotification(message, 'success');
}

// Force load all videos on the page
async function forceLoadAllVideos() {
  const settings = await browser.storage.local.get({
    autoStartEmbedVideos: true
  });

  const thumbnails = document.querySelectorAll('.thumb img, .thumbnail img, span.thumb img');

  // Filter for video thumbnails only
  const videoThumbnails = Array.from(thumbnails).filter(img => {
    return img.classList.contains('webm-thumb') ||
           img.classList.contains('webm') ||
           (img.title && img.title.toLowerCase().includes(' video')) ||
           (img.alt && img.alt.toLowerCase().includes(' video'));
  });

  if (videoThumbnails.length === 0) {
    showNotification('No video thumbnails found on this page', 'info');
    return;
  }

  showNotification(`Loading ${videoThumbnails.length} videos...`, 'info');

  let successCount = 0;
  let failCount = 0;

  for (const img of videoThumbnails) {
    // Find the post link
    let postLink = img.closest('a[href*="page=post"]');
    if (!postLink) {
      postLink = img.parentElement?.querySelector('a[href*="page=post"]');
    }
    if (!postLink && img.parentElement?.parentElement) {
      postLink = img.parentElement.parentElement.querySelector('a[href*="page=post"]');
    }
    if (!postLink) {
      failCount++;
      continue;
    }

    const postUrl = postLink.href;
    const postIdMatch = postUrl.match(/[?&]id=(\d+)/);
    const postId = postIdMatch ? postIdMatch[1] : null;

    try {
      let videoUrl = null;

      // Try direct URL construction
      const thumbnailUrl = new URL(img.src);
      const pathParts = thumbnailUrl.pathname.split('/');
      const filename = pathParts[pathParts.length - 1].split('?')[0];
      const hash = filename.replace('thumbnail_', '').replace('.jpg', '').replace('.png', '');
      const directory = pathParts[pathParts.length - 2];

      const cdnDomains = [
        'https://api-cdn-us-mp4.rule34.xxx',
        'https://ws-cdn-video.rule34.xxx',
        'https://video-cdn3.rule34.xxx'
      ];
      const videoExtensions = ['.mp4', '.webm'];

      for (const cdn of cdnDomains) {
        for (const ext of videoExtensions) {
          const testUrl = `${cdn}//images/${directory}/${hash}${ext}${postId ? '?' + postId : ''}`;
          try {
            const testResponse = await fetch(testUrl, { method: 'HEAD' });
            if (testResponse.ok) {
              videoUrl = testUrl;
              break;
            }
          } catch (e) {
            // Continue trying
          }
        }
        if (videoUrl) break;
      }

      if (videoUrl) {
        // Get the wrapper element
        const wrapper = img.closest('.r34-thumb-wrapper');

        // Replace img with video element
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.loop = true;
        video.muted = true;
        video.autoplay = settings.autoStartEmbedVideos;
        video.style.cssText = img.style.cssText;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.style.width = 'auto';
        video.style.height = 'auto';

        img.parentNode.replaceChild(video, img);

        // Re-attach buttons if wrapper exists
        if (wrapper) {
          const downloadBtn = wrapper.querySelector('.r34-thumb-download');
          const fullResBtn = wrapper.querySelector('.r34-thumb-fullres');
          const qualityBadge = wrapper.querySelector('.r34-quality-badge');

          if (qualityBadge) {
            qualityBadge.textContent = 'V';
            qualityBadge.style.background = 'rgba(102, 179, 255, 0.9)';
          }

          const positionButtonsForVideo = () => {
            const containerRect = wrapper.getBoundingClientRect();
            const videoRect = video.getBoundingClientRect();
            const offsetTop = videoRect.top - containerRect.top;
            const offsetLeft = videoRect.left - containerRect.left;
            const offsetRight = containerRect.right - videoRect.right;

            if (downloadBtn) {
              downloadBtn.style.top = (offsetTop + 4) + 'px';
              downloadBtn.style.left = (offsetLeft + 4) + 'px';
            }
            if (fullResBtn) {
              fullResBtn.style.top = (offsetTop + 4) + 'px';
              fullResBtn.style.left = (offsetLeft + 36) + 'px';
            }
            if (qualityBadge) {
              qualityBadge.style.top = (offsetTop + 4) + 'px';
              qualityBadge.style.right = (offsetRight + 4) + 'px';
            }
          };

          positionButtonsForVideo();

          const showButtons = () => {
            positionButtonsForVideo();
            if (downloadBtn) {
              downloadBtn.style.opacity = '1';
              downloadBtn.style.pointerEvents = 'auto';
            }
            if (fullResBtn) {
              fullResBtn.style.opacity = '1';
              fullResBtn.style.pointerEvents = 'auto';
            }
            if (qualityBadge) {
              qualityBadge.style.opacity = '1';
            }
          };

          const hideButtons = () => {
            if (downloadBtn) {
              downloadBtn.style.opacity = '0';
              downloadBtn.style.pointerEvents = 'none';
            }
            if (fullResBtn) {
              fullResBtn.style.opacity = '0';
              fullResBtn.style.pointerEvents = 'none';
            }
            if (qualityBadge) {
              qualityBadge.style.opacity = '0';
            }
          };

          wrapper.removeEventListener('mouseenter', showButtons);
          wrapper.removeEventListener('mouseleave', hideButtons);
          wrapper.addEventListener('mouseenter', showButtons);
          wrapper.addEventListener('mouseleave', hideButtons);
          video.addEventListener('mouseenter', showButtons);
        }

        successCount++;
      } else {
        failCount++;
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error('[R34 Tools] Error loading video:', error);
      failCount++;
    }
  }

  showNotification(`Loaded ${successCount} videos, ${failCount} failed`, 'success');
}

// Remove right sidebar ads to give more room for posts
function removeRightSidebar() {
  const rightSidebar = document.querySelector('.postListSidebarRight');
  if (rightSidebar) {
    rightSidebar.remove();
  }
}

// Apply compact header mode
async function applyCompactHeader() {
  const settings = await browser.storage.local.get({ compactHeader: true });

  if (settings.compactHeader) {
    // Only show on list pages
    const isListPage = window.location.href.includes('page=post&s=list');
    if (!isListPage) return;

    // Get header elements
    const navbar = document.querySelector('#navbar');
    const subnavbar = document.querySelector('#subnavbar');
    const header = document.querySelector('#header, header');
    const radios = document.querySelectorAll('.tradio, .tlabel');

    // Create arrow button to toggle header visibility
    const arrowBtn = document.createElement('button');
    arrowBtn.id = 'r34-header-arrow';
    arrowBtn.textContent = '▲';
    arrowBtn.title = 'Toggle header visibility';
    arrowBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 3px;
      color: #00ff66;
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

    // Add button to page
    document.body.appendChild(arrowBtn);

    // Hide header elements by default
    if (navbar) navbar.style.display = 'none';
    if (subnavbar) subnavbar.style.display = 'none';
    radios.forEach(el => el.style.display = 'none');

    // Track header visibility state
    let headerVisible = false;

    // Toggle header visibility when arrow is clicked
    arrowBtn.onclick = (e) => {
      e.stopPropagation();
      headerVisible = !headerVisible;

      if (headerVisible) {
        // Show header elements
        if (navbar) navbar.style.display = '';
        if (subnavbar) subnavbar.style.display = '';
        radios.forEach(el => el.style.display = '');
        arrowBtn.textContent = '▲';
      } else {
        // Hide header elements
        if (navbar) navbar.style.display = 'none';
        if (subnavbar) subnavbar.style.display = 'none';
        radios.forEach(el => el.style.display = 'none');
        arrowBtn.textContent = '▼';
      }

      // Rotate arrow
      arrowBtn.style.transform = headerVisible ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    // Hover effects for arrow button
    arrowBtn.onmouseover = () => {
      arrowBtn.style.borderColor = '#00ff66';
      arrowBtn.style.background = '#2a2a2a';
    };
    arrowBtn.onmouseout = () => {
      arrowBtn.style.borderColor = '#2a2a2a';
      arrowBtn.style.background = '#1a1a1a';
    };
  }
}

// Apply AMOLED theme if enabled
async function applyAmoledTheme() {
  const settings = await browser.storage.local.get({ amoledTheme: true });

  if (settings.amoledTheme) {
    const style = document.createElement('style');
    style.id = 'r34-tools-amoled-theme';
    style.textContent = `
      /* AMOLED Theme - Pure black backgrounds */
      body, html {
        background: #000000 !important;
        color: #ffffff !important;
      }

      /* Content areas */
      #content, .content, .sidebar, #leftmenu, .flexi {
        background: #000000 !important;
      }

      /* Top navigation bar */
      #navlinksContainer, #navlinks, ul.flat-list, .flat-list, nav, nav ul, nav li {
        background: #000000 !important;
      }

      /* Headers and navigation */
      #header, .header, #navbar, .navbar, #menu, .menu, header {
        background: #000000 !important;
      }

      /* Navigation lists */
      ul, ol {
        background: transparent !important;
      }

      /* Change dark text to white */
      div, span, p, td, th, li, a, label, input, textarea, select {
        color: #ffffff !important;
      }

      /* Borders and separators */
      hr, .divider, border {
        border-color: #333333 !important;
      }

      /* Tables and lists */
      table, tr, td, th {
        background: #000000 !important;
        border-color: #333333 !important;
      }

      /* Input elements */
      input, textarea, select {
        background: #1a1a1a !important;
        border-color: #333333 !important;
      }

      /* Links - keep visible */
      a {
        color: #00ff66 !important;
      }

      a:visited {
        color: #00cc52 !important;
      }

      /* Thumbnails and image containers */
      .thumb, .thumbnail, .image-container {
        background: #000000 !important;
      }

      /* Post info boxes */
      .status-notice, .notice, .info {
        background: #1a1a1a !important;
        border-color: #333333 !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Add save icons next to tag/artist links
function addSaveIconsToLinks() {
  // Find all tag and artist links
  const tagLinks = document.querySelectorAll('.tag a, li[class*="tag-type"] a, .tag-type-artist a');

  tagLinks.forEach(link => {
    // Skip if already has save icon
    if (link.parentElement.querySelector('.r34-save-link-icon')) return;

    const saveIcon = document.createElement('span');
    saveIcon.className = 'r34-save-link-icon';
    saveIcon.textContent = '🔖';
    saveIcon.title = 'Save this page';
    saveIcon.style.cssText = `
      cursor: pointer;
      margin-right: 4px;
      font-size: 10px;
      opacity: 0.6;
      transition: opacity 0.2s;
      display: inline-block;
    `;

    saveIcon.onmouseover = () => saveIcon.style.opacity = '1';
    saveIcon.onmouseout = () => saveIcon.style.opacity = '0.6';

    saveIcon.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const targetUrl = link.href;
      const data = {
        url: targetUrl,
        timestamp: new Date().toISOString(),
        postId: null,
        artists: []
      };

      try {
        const response = await browser.runtime.sendMessage({
          action: 'savePageJson',
          data: data
        });

        if (response && response.success) {
          showNotification(`Saved link\n→ ${response.filename}`, 'success');
        } else {
          showNotification(`Save failed: ${response?.error || 'Unknown error'}`, 'error');
        }
      } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
      }
    };

    // Insert before the link
    link.parentNode.insertBefore(saveIcon, link);
  });
}

// Add download buttons to thumbnails
function addThumbnailDownloadButtons() {
  // Find all thumbnail images
  const thumbnails = document.querySelectorAll('.thumb img, .thumbnail img, span.thumb img');

  thumbnails.forEach(img => {
    // Skip if already has download button
    if (img.parentElement.querySelector('.r34-thumb-download')) return;

    // Find the post link (might be parent or ancestor)
    let postLink = img.closest('a[href*="page=post"]');
    if (!postLink) {
      postLink = img.parentElement.querySelector('a[href*="page=post"]');
    }
    if (!postLink && img.parentElement.parentElement) {
      postLink = img.parentElement.parentElement.querySelector('a[href*="page=post"]');
    }
    if (!postLink) return;

    // Wrap image in tight container
    let wrapper = img.parentElement;

    if (!wrapper.classList.contains('r34-thumb-wrapper')) {
      const newWrapper = document.createElement('span');
      newWrapper.className = 'r34-thumb-wrapper';
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

    // Constrain image to fit within parent bounds while maintaining natural size
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

    // Create small download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'r34-thumb-download';
    downloadBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
    `;
    downloadBtn.title = 'Download media';
    downloadBtn.style.cssText = `
      position: absolute;
      top: 4px;
      left: 4px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #00ff66 0%, #00cc52 100%);
      color: #000;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      transition: all 0.2s ease;
      opacity: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 0;
    `;

    wrapper.appendChild(downloadBtn);

    // Create full resolution button
    const fullResBtn = document.createElement('button');
    fullResBtn.className = 'r34-thumb-fullres';
    fullResBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
      </svg>
    `;
    // Set title based on whether it's a video
    const isVideo = img.classList.contains('webm-thumb') ||
                    img.classList.contains('webm') ||
                    (img.title && img.title.toLowerCase().includes(' video')) ||
                    (img.alt && img.alt.toLowerCase().includes(' video'));
    fullResBtn.title = isVideo ? 'Load video' : 'Load full resolution';
    fullResBtn.style.cssText = `
      position: absolute;
      top: 4px;
      left: 36px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #66b3ff 0%, #3399ff 100%);
      color: #000;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      transition: all 0.2s ease;
      opacity: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 0;
    `;

    wrapper.appendChild(fullResBtn);

    // Create quality indicator badge
    const qualityBadge = document.createElement('div');
    qualityBadge.className = 'r34-quality-badge';
    qualityBadge.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.8);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      z-index: 101;
      border: 1px solid #333;
    `;
    wrapper.appendChild(qualityBadge);

    // Update badge text based on quality
    const updateBadge = () => {
      const quality = imageQuality.get(img) || 'T';
      qualityBadge.textContent = quality;
      // Color code: T=red, S=yellow, F=green
      if (quality === 'F') {
        qualityBadge.style.background = 'rgba(0, 150, 0, 0.9)';
      } else if (quality === 'S') {
        qualityBadge.style.background = 'rgba(180, 140, 0, 0.9)';
      } else {
        qualityBadge.style.background = 'rgba(150, 0, 0, 0.9)';
      }
    };

    // Store the updater so it can be called when quality changes
    badgeUpdaters.set(img, updateBadge);

    // Position buttons on the actual image, not just the container
    const positionButtons = () => {
      const containerRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Calculate offset from container to actual image position
      const offsetTop = imgRect.top - containerRect.top;
      const offsetLeft = imgRect.left - containerRect.left;
      const offsetRight = containerRect.right - imgRect.right;

      // Position download button
      downloadBtn.style.top = (offsetTop + 4) + 'px';
      downloadBtn.style.left = (offsetLeft + 4) + 'px';

      // Position full res button
      fullResBtn.style.top = (offsetTop + 4) + 'px';
      fullResBtn.style.left = (offsetLeft + 36) + 'px';

      // Position quality badge
      qualityBadge.style.top = (offsetTop + 4) + 'px';
      qualityBadge.style.right = (offsetRight + 4) + 'px';
    };

    // Show on hover
    wrapper.addEventListener('mouseenter', () => {
      positionButtons();
      downloadBtn.style.opacity = '1';
      downloadBtn.style.pointerEvents = 'auto';
      fullResBtn.style.opacity = '1';
      fullResBtn.style.pointerEvents = 'auto';
      updateBadge();
      qualityBadge.style.opacity = '1';
    });
    wrapper.addEventListener('mouseleave', () => {
      downloadBtn.style.opacity = '0';
      downloadBtn.style.pointerEvents = 'none';
      fullResBtn.style.opacity = '0';
      fullResBtn.style.pointerEvents = 'none';
      qualityBadge.style.opacity = '0';
    });

    downloadBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const postUrl = postLink.href;
      showNotification('Fetching media...', 'info');

      try {
        // Fetch the post page
        const response = await fetch(postUrl);
        const html = await response.text();

        // Parse HTML to extract image object
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let mediaUrl = null;
        let postId = null;
        let artists = [];

        // Extract post ID from URL
        const idMatch = postUrl.match(/[?&]id=(\d+)/);
        if (idMatch) postId = idMatch[1];

        // Extract artists
        const tagLinks = doc.querySelectorAll('.tag-type-artist a, li[class*="tag-type-artist"] a');
        tagLinks.forEach(link => {
          const artistName = link.textContent.trim().replace(/\s*\d+$/, '');
          if (artistName && artistName.length > 1 && !['?', '+', '-'].includes(artistName) && !artists.includes(artistName)) {
            artists.push(artistName);
          }
        });

        // Method 1: Look for video element
        const videoElement = doc.querySelector('video source, video');
        if (videoElement) {
          mediaUrl = videoElement.src || videoElement.querySelector('source')?.src;
        }

        // Method 2: Look for "Original image" link
        if (!mediaUrl) {
          const originalLink = doc.querySelector('a[href*="/images/"]');
          if (originalLink && originalLink.textContent.includes('Original')) {
            mediaUrl = originalLink.href;
          }
        }

        // Method 3: Look for main image and upgrade to full resolution
        if (!mediaUrl) {
          const mainImage = doc.querySelector('#image, .flexi img, img[onclick*="note"]');
          if (mainImage) {
            let imgUrl = mainImage.src;
            // Force highest quality
            imgUrl = imgUrl.replace('/thumbnails/', '/images/');
            imgUrl = imgUrl.replace('/samples/', '/images/');
            imgUrl = imgUrl.replace('thumbnail_', '');
            const url = new URL(imgUrl);
            url.searchParams.delete('sample');
            mediaUrl = url.toString();
          }
        }

        if (!mediaUrl) {
          showNotification('Could not extract media URL', 'error');
          return;
        }

        // Build filename with same logic as main download
        const urlObj = new URL(mediaUrl);
        const pathname = urlObj.pathname;
        const baseFilename = pathname.split('/').pop().split('?')[0];

        const lastDotIndex = baseFilename.lastIndexOf('.');
        const extension = lastDotIndex !== -1 ? baseFilename.substring(lastDotIndex) : '';
        const nameWithoutExt = lastDotIndex !== -1 ? baseFilename.substring(0, lastDotIndex) : baseFilename;

        let finalName = '';
        if (postId) {
          finalName = `r34_${postId}_`;
        }
        finalName += nameWithoutExt;

        if (artists && artists.length > 0) {
          const artistString = artists
            .map(artist => artist.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, ''))
            .join('_');
          finalName += `_${artistString}`;
        }
        finalName += extension;

        const filename = finalName;

        // Trigger download
        const dlResponse = await browser.runtime.sendMessage({
          action: 'download',
          url: mediaUrl,
          filename: filename
        });

        if (dlResponse.success) {
          showNotification(`Downloaded: ${filename}`, 'success');
        } else {
          showNotification(`Download failed: ${dlResponse.error}`, 'error');
        }
      } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
      }
    };

    fullResBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const postUrl = postLink.href;

      // Check if this is likely a video thumbnail
      const isLikelyVideo = img.classList.contains('webm-thumb') ||
                            img.classList.contains('webm') ||
                            (img.title && img.title.toLowerCase().includes(' video')) ||
                            (img.alt && img.alt.toLowerCase().includes(' video'));

      if (isLikelyVideo) {
        showNotification('Loading video...', 'info');
      } else {
        showNotification('Loading full resolution...', 'info');
      }

      try {
        // Get video settings
        const settings = await browser.storage.local.get({
          autoLoadVideoEmbeds: true,
          autoStartEmbedVideos: true
        });

        // For videos, try direct URL construction first
        if (isLikelyVideo) {
          const postIdMatch = postUrl.match(/[?&]id=(\d+)/);
          const postId = postIdMatch ? postIdMatch[1] : null;

          try {
            const thumbnailUrl = new URL(img.src);
            const pathParts = thumbnailUrl.pathname.split('/');
            const filename = pathParts[pathParts.length - 1].split('?')[0];
            const hash = filename.replace('thumbnail_', '').replace('.jpg', '').replace('.png', '');
            const directory = pathParts[pathParts.length - 2];

            const cdnDomains = [
              'https://api-cdn-us-mp4.rule34.xxx',
              'https://ws-cdn-video.rule34.xxx',
              'https://video-cdn3.rule34.xxx'
            ];
            const videoExtensions = ['.mp4', '.webm'];

            let videoUrl = null;
            for (const cdn of cdnDomains) {
              for (const ext of videoExtensions) {
                const testUrl = `${cdn}//images/${directory}/${hash}${ext}${postId ? '?' + postId : ''}`;
                try {
                  const testResponse = await fetch(testUrl, { method: 'HEAD' });
                  if (testResponse.ok) {
                    videoUrl = testUrl;
                    break;
                  }
                } catch (e) {
                  // Continue trying
                }
              }
              if (videoUrl) break;
            }

            if (videoUrl) {
              // Successfully found video via direct URL
              const wrapper = img.closest('.r34-thumb-wrapper');
              const video = document.createElement('video');
              video.src = videoUrl;
              video.controls = true;
              video.loop = true;
              video.muted = true;
              video.autoplay = settings.autoStartEmbedVideos;
              video.style.cssText = img.style.cssText;
              video.style.maxWidth = '100%';
              video.style.maxHeight = '100%';
              video.style.width = 'auto';
              video.style.height = 'auto';

              img.parentNode.replaceChild(video, img);

              if (wrapper) {
                const downloadBtn = wrapper.querySelector('.r34-thumb-download');
                const fullResBtn = wrapper.querySelector('.r34-thumb-fullres');
                const qualityBadge = wrapper.querySelector('.r34-quality-badge');

                if (qualityBadge) {
                  qualityBadge.textContent = 'V';
                  qualityBadge.style.background = 'rgba(102, 179, 255, 0.9)';
                }

                const positionButtonsForVideo = () => {
                  const containerRect = wrapper.getBoundingClientRect();
                  const videoRect = video.getBoundingClientRect();
                  const offsetTop = videoRect.top - containerRect.top;
                  const offsetLeft = videoRect.left - containerRect.left;
                  const offsetRight = containerRect.right - videoRect.right;

                  if (downloadBtn) {
                    downloadBtn.style.top = (offsetTop + 4) + 'px';
                    downloadBtn.style.left = (offsetLeft + 4) + 'px';
                  }
                  if (fullResBtn) {
                    fullResBtn.style.top = (offsetTop + 4) + 'px';
                    fullResBtn.style.left = (offsetLeft + 36) + 'px';
                  }
                  if (qualityBadge) {
                    qualityBadge.style.top = (offsetTop + 4) + 'px';
                    qualityBadge.style.right = (offsetRight + 4) + 'px';
                  }
                };

                positionButtonsForVideo();

                const showButtons = () => {
                  positionButtonsForVideo();
                  if (downloadBtn) {
                    downloadBtn.style.opacity = '1';
                    downloadBtn.style.pointerEvents = 'auto';
                  }
                  if (fullResBtn) {
                    fullResBtn.style.opacity = '1';
                    fullResBtn.style.pointerEvents = 'auto';
                  }
                  if (qualityBadge) {
                    qualityBadge.style.opacity = '1';
                  }
                };

                const hideButtons = () => {
                  if (downloadBtn) {
                    downloadBtn.style.opacity = '0';
                    downloadBtn.style.pointerEvents = 'none';
                  }
                  if (fullResBtn) {
                    fullResBtn.style.opacity = '0';
                    fullResBtn.style.pointerEvents = 'none';
                  }
                  if (qualityBadge) {
                    qualityBadge.style.opacity = '0';
                  }
                };

                wrapper.removeEventListener('mouseenter', showButtons);
                wrapper.removeEventListener('mouseleave', hideButtons);
                wrapper.addEventListener('mouseenter', showButtons);
                wrapper.addEventListener('mouseleave', hideButtons);
                video.addEventListener('mouseenter', showButtons);
              }

              showNotification('Video loaded', 'success');
              return;
            }
          } catch (error) {
            console.log('[R34 Tools] Direct video URL construction failed:', error);
          }
        }

        // Fallback: Fetch the post page
        const response = await fetch(postUrl);
        const html = await response.text();

        // Parse HTML to extract image object
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let fullResUrl = null;

        // Method 1: Check if it's a video - try to replace with video element
        const videoElement = doc.querySelector('video source, video');
        if (videoElement) {
          const videoUrl = videoElement.src || videoElement.querySelector('source')?.src;
          if (videoUrl) {
            // Get the wrapper element that contains the buttons
            const wrapper = img.closest('.r34-thumb-wrapper');

            // Replace img with video element
            const video = document.createElement('video');
            video.src = videoUrl;
            video.controls = true;
            video.loop = true;
            video.muted = true;
            video.autoplay = settings.autoStartEmbedVideos;
            video.style.cssText = img.style.cssText; // Copy img styles
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            video.style.width = 'auto';
            video.style.height = 'auto';

            // Replace the img element with video
            img.parentNode.replaceChild(video, img);

            // Re-attach download and full-res buttons if wrapper exists
            if (wrapper) {
              // Keep the buttons functional over the video
              const downloadBtn = wrapper.querySelector('.r34-thumb-download');
              const fullResBtn = wrapper.querySelector('.r34-thumb-fullres');
              const qualityBadge = wrapper.querySelector('.r34-quality-badge');

              // Update quality badge
              if (qualityBadge) {
                qualityBadge.textContent = 'V';
                qualityBadge.style.background = 'rgba(102, 179, 255, 0.9)';
              }

              // Update button positioning to work with video element
              const positionButtonsForVideo = () => {
                const containerRect = wrapper.getBoundingClientRect();
                const videoRect = video.getBoundingClientRect();

                // Calculate offset from container to actual video position
                const offsetTop = videoRect.top - containerRect.top;
                const offsetLeft = videoRect.left - containerRect.left;
                const offsetRight = containerRect.right - videoRect.right;

                // Position download button
                if (downloadBtn) {
                  downloadBtn.style.top = (offsetTop + 4) + 'px';
                  downloadBtn.style.left = (offsetLeft + 4) + 'px';
                }

                // Position full res button
                if (fullResBtn) {
                  fullResBtn.style.top = (offsetTop + 4) + 'px';
                  fullResBtn.style.left = (offsetLeft + 36) + 'px';
                }

                // Position quality badge
                if (qualityBadge) {
                  qualityBadge.style.top = (offsetTop + 4) + 'px';
                  qualityBadge.style.right = (offsetRight + 4) + 'px';
                }
              };

              // Position buttons immediately
              positionButtonsForVideo();

              // Re-add hover events for the video
              const showButtons = () => {
                positionButtonsForVideo();
                if (downloadBtn) {
                  downloadBtn.style.opacity = '1';
                  downloadBtn.style.pointerEvents = 'auto';
                }
                if (fullResBtn) {
                  fullResBtn.style.opacity = '1';
                  fullResBtn.style.pointerEvents = 'auto';
                }
                if (qualityBadge) {
                  qualityBadge.style.opacity = '1';
                }
              };

              const hideButtons = () => {
                if (downloadBtn) {
                  downloadBtn.style.opacity = '0';
                  downloadBtn.style.pointerEvents = 'none';
                }
                if (fullResBtn) {
                  fullResBtn.style.opacity = '0';
                  fullResBtn.style.pointerEvents = 'none';
                }
                if (qualityBadge) {
                  qualityBadge.style.opacity = '0';
                }
              };

              // Remove old event listeners (they reference the old img)
              wrapper.removeEventListener('mouseenter', showButtons);
              wrapper.removeEventListener('mouseleave', hideButtons);

              // Add new event listeners for video
              wrapper.addEventListener('mouseenter', showButtons);
              wrapper.addEventListener('mouseleave', hideButtons);
              video.addEventListener('mouseenter', showButtons);
            }

            showNotification('Video loaded', 'success');
            return;
          } else {
            showNotification('Could not find video URL', 'error');
            return;
          }
        }

        // Method 2: Look for "Original image" link
        const originalLink = doc.querySelector('a[href*="/images/"]');
        if (originalLink && originalLink.textContent.includes('Original')) {
          fullResUrl = originalLink.href;
        }

        // Method 3: Look for main image and upgrade to full resolution
        if (!fullResUrl) {
          const mainImage = doc.querySelector('#image, .flexi img, img[onclick*="note"]');
          if (mainImage) {
            let imgUrl = mainImage.src;
            // Force highest quality
            imgUrl = imgUrl.replace('/thumbnails/', '/images/');
            imgUrl = imgUrl.replace('/samples/', '/images/');
            imgUrl = imgUrl.replace('thumbnail_', '');
            imgUrl = imgUrl.replace('sample_', '');
            const url = new URL(imgUrl);
            url.searchParams.delete('sample');
            fullResUrl = url.toString();
          }
        }

        if (!fullResUrl) {
          showNotification('Could not extract full resolution URL', 'error');
          return;
        }

        // Validate URL before replacing - test if it actually loads
        try {
          const testImg = new Image();
          const loadPromise = new Promise((resolve, reject) => {
            testImg.onload = () => resolve(true);
            testImg.onerror = () => reject(false);
          });
          testImg.src = fullResUrl;

          await loadPromise;

          // URL is valid, replace the thumbnail
          img.src = fullResUrl;
          setImageQuality(img, 'F');
          showNotification('Full resolution loaded', 'success');
        } catch {
          showNotification('Full resolution URL returned 404', 'error');
        }
      } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
      }
    };
  });
}

// Track which images we've already processed to avoid reprocessing
const processedImages = new WeakSet(); // For quality upgrades
const processedVideos = new WeakSet(); // Separate tracking for video loading
// Track quality level for each image
const imageQuality = new WeakMap();
// Track badge update functions for each image
const badgeUpdaters = new WeakMap();

// Helper to set quality and trigger badge update
function setImageQuality(img, quality) {
  imageQuality.set(img, quality);
  const updater = badgeUpdaters.get(img);
  if (updater) {
    updater();
  }
}

// Track if video loading is already running to prevent concurrent runs
let isLoadingVideos = false;
// Track which POST IDs we've already checked to avoid duplicate fetches
const checkedPostIds = new Set();

// Auto-load video thumbnails into embed players
async function autoLoadVideoThumbnails() {
  // Prevent concurrent runs
  if (isLoadingVideos) return;

  const settings = await browser.storage.local.get({
    autoLoadVideoEmbeds: true,
    autoStartEmbedVideos: true
  });

  if (!settings.autoLoadVideoEmbeds) {
    return;
  }

  const images = document.querySelectorAll('.thumb img, .thumbnail img, span.thumb img');
  console.log('[R34 Tools] Total images on page:', images.length);

  // Use separate tracking for videos - don't use processedImages
  const unprocessedImages = Array.from(images).filter(img => !processedVideos.has(img));
  console.log('[R34 Tools] Already checked for videos:', images.length - unprocessedImages.length);

  // If no new images to process, skip silently
  if (unprocessedImages.length === 0) {
    console.log('[R34 Tools] No new images to check for videos');
    return;
  }

  console.log('[R34 Tools] Found', unprocessedImages.length, 'new thumbnails to check for videos');
  isLoadingVideos = true;

  // Process only unprocessed images
  for (const img of unprocessedImages) {
    // Mark as processed for VIDEO checking (separate from quality upgrade tracking)
    processedVideos.add(img);

    // Check if thumbnail indicates it's a video (webm-thumb class or "video" in tags)
    const isVideo = img.classList.contains('webm-thumb') ||
                    img.classList.contains('webm') ||
                    (img.title && img.title.toLowerCase().includes(' video')) ||
                    (img.alt && img.alt.toLowerCase().includes(' video'));

    if (!isVideo) {
      // Not a video thumbnail, skip it
      continue;
    }

    console.log('[R34 Tools] Found video thumbnail:', img.src);

    // Find the post link
    let postLink = img.closest('a[href*="page=post"]');
    if (!postLink) {
      postLink = img.parentElement?.querySelector('a[href*="page=post"]');
    }
    if (!postLink && img.parentElement?.parentElement) {
      postLink = img.parentElement.parentElement.querySelector('a[href*="page=post"]');
    }
    if (!postLink) {
      console.log('[R34 Tools] No post link found for image, skipping');
      continue;
    }

    const postUrl = postLink.href;

    // Extract post ID
    const postIdMatch = postUrl.match(/[?&]id=(\d+)/);
    const postId = postIdMatch ? postIdMatch[1] : null;

    if (postId && checkedPostIds.has(postId)) {
      console.log('[R34 Tools] Post', postId, 'already checked, skipping duplicate');
      continue;
    }

    if (postId) {
      checkedPostIds.add(postId);
    }

    try {
      let videoUrl = null;

      // Try to construct video URL directly from thumbnail URL
      try {
        const thumbnailUrl = new URL(img.src);
        const pathParts = thumbnailUrl.pathname.split('/');
        const filename = pathParts[pathParts.length - 1].split('?')[0];

        // Extract hash from thumbnail filename (remove thumbnail_ prefix)
        const hash = filename.replace('thumbnail_', '').replace('.jpg', '').replace('.png', '');
        const directory = pathParts[pathParts.length - 2];

        // Try multiple CDN domains and extensions
        const cdnDomains = [
          'https://api-cdn-us-mp4.rule34.xxx',
          'https://ws-cdn-video.rule34.xxx',
          'https://video-cdn3.rule34.xxx'
        ];
        const videoExtensions = ['.mp4', '.webm'];

        console.log('[R34 Tools] Constructing video URL for hash:', hash);

        // Try each combination
        for (const cdn of cdnDomains) {
          for (const ext of videoExtensions) {
            const testUrl = `${cdn}//images/${directory}/${hash}${ext}${postId ? '?' + postId : ''}`;

            try {
              // Test if video URL is valid with HEAD request
              const testResponse = await fetch(testUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                videoUrl = testUrl;
                console.log('[R34 Tools] Found working video URL:', videoUrl);
                break;
              }
            } catch (e) {
              // Continue trying other URLs
            }
          }
          if (videoUrl) break;
        }
      } catch (error) {
        console.log('[R34 Tools] Error constructing video URL:', error);
      }

      // Fallback: fetch the post page if direct URL construction failed
      if (!videoUrl) {
        console.log('[R34 Tools] Direct URL failed, fetching post page for:', postId);
        try {
          const response = await fetch(postUrl);
          const html = await response.text();

          console.log('[R34 Tools] Fetched HTML length:', html.length, 'bytes');

          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Try multiple methods to detect video from post page
          // Method 1: Look for video tags
          const videoTag = doc.querySelector('video');
          const videoSource = doc.querySelector('video source');

          // Method 2: Look for video URLs in the HTML content (for embeds)
          const videoUrlMatch = html.match(/https?:\/\/[^"'\s]+\.(mp4|webm|mov)[^"'\s]*/i);

          console.log('[R34 Tools] Post page check:', {
            postId: postId || 'unknown',
            hasVideoTag: !!videoTag,
            hasVideoSource: !!videoSource,
            hasVideoUrlInHtml: !!videoUrlMatch
          });

          // Extract video URL using priority order
          if (videoSource && videoSource.src) {
            videoUrl = videoSource.src;
            console.log('[R34 Tools] Found video from <source> tag:', videoUrl);
          } else if (videoTag && videoTag.src) {
            videoUrl = videoTag.src;
            console.log('[R34 Tools] Found video from <video> tag:', videoUrl);
          } else if (videoTag) {
            // Try to find source inside video tag
            const source = videoTag.querySelector('source');
            if (source && source.src) {
              videoUrl = source.src;
              console.log('[R34 Tools] Found video from <video><source>:', videoUrl);
            }
          } else if (videoUrlMatch) {
            videoUrl = videoUrlMatch[0];
            console.log('[R34 Tools] Found video from HTML content:', videoUrl);
          }
        } catch (error) {
          console.error('[R34 Tools] Error fetching post page:', error);
        }
      }

      if (videoUrl) {
        // Get the wrapper element
        const wrapper = img.closest('.r34-thumb-wrapper');

        // Create video element
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.loop = true;
        video.muted = true;
        video.autoplay = settings.autoStartEmbedVideos;
        video.style.cssText = img.style.cssText;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.style.width = 'auto';
        video.style.height = 'auto';

        // Replace the img element with video
        img.parentNode.replaceChild(video, img);
        console.log('[R34 Tools] Replaced thumbnail with video player');

        // Re-attach download and full-res buttons if wrapper exists
        if (wrapper) {
          const downloadBtn = wrapper.querySelector('.r34-thumb-download');
          const fullResBtn = wrapper.querySelector('.r34-thumb-fullres');
          const qualityBadge = wrapper.querySelector('.r34-quality-badge');

          // Update quality badge to show it's a video
          if (qualityBadge) {
            qualityBadge.textContent = 'V';
            qualityBadge.style.background = 'rgba(102, 179, 255, 0.9)';
            console.log('[R34 Tools] Updated quality badge to V');
          } else {
            console.log('[R34 Tools] Warning: No quality badge found for video');
          }

          // Update button positioning
          const positionButtonsForVideo = () => {
            const containerRect = wrapper.getBoundingClientRect();
            const videoRect = video.getBoundingClientRect();

            const offsetTop = videoRect.top - containerRect.top;
            const offsetLeft = videoRect.left - containerRect.left;
            const offsetRight = containerRect.right - videoRect.right;

            if (downloadBtn) {
              downloadBtn.style.top = (offsetTop + 4) + 'px';
              downloadBtn.style.left = (offsetLeft + 4) + 'px';
            }
            if (fullResBtn) {
              fullResBtn.style.top = (offsetTop + 4) + 'px';
              fullResBtn.style.left = (offsetLeft + 36) + 'px';
            }
            if (qualityBadge) {
              qualityBadge.style.top = (offsetTop + 4) + 'px';
              qualityBadge.style.right = (offsetRight + 4) + 'px';
            }
          };

          positionButtonsForVideo();

          // Re-add hover events for the video
          const showButtons = () => {
            positionButtonsForVideo();
            if (downloadBtn) {
              downloadBtn.style.opacity = '1';
              downloadBtn.style.pointerEvents = 'auto';
            }
            if (fullResBtn) {
              fullResBtn.style.opacity = '1';
              fullResBtn.style.pointerEvents = 'auto';
            }
            if (qualityBadge) {
              qualityBadge.style.opacity = '1';
            }
          };

          const hideButtons = () => {
            if (downloadBtn) {
              downloadBtn.style.opacity = '0';
              downloadBtn.style.pointerEvents = 'none';
            }
            if (fullResBtn) {
              fullResBtn.style.opacity = '0';
              fullResBtn.style.pointerEvents = 'none';
            }
            if (qualityBadge) {
              qualityBadge.style.opacity = '0';
            }
          };

          wrapper.removeEventListener('mouseenter', showButtons);
          wrapper.removeEventListener('mouseleave', hideButtons);
          wrapper.addEventListener('mouseenter', showButtons);
          wrapper.addEventListener('mouseleave', hideButtons);
          video.addEventListener('mouseenter', showButtons);
        }
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('[R34 Tools] Error auto-loading video:', error);
    }
  }

  console.log('[R34 Tools] Finished processing thumbnails');
  isLoadingVideos = false;
}

// Upgrade thumbnails to sample or full quality
async function upgradeToSampleQuality() {
  const settings = await browser.storage.local.get({
    highQualityPreviews: true,
    alwaysUseFullResolution: false
  });

  if (settings.alwaysUseFullResolution || settings.highQualityPreviews) {
    const images = document.querySelectorAll('.thumb img, .thumbnail img, span.thumb img');

    images.forEach(img => {
      // Skip if already processed
      if (processedImages.has(img)) return;
      processedImages.add(img);

      const originalSrc = img.src;
      if (!originalSrc || !originalSrc.includes('/thumbnails/')) return;

      // Default to thumbnail quality
      setImageQuality(img, 'T');

      try {
        // Parse the URL properly
        const url = new URL(originalSrc);

        const buildUpgradedUrl = (quality) => {
          let pathname = url.pathname;

          if (quality === 'full') {
            // Use full resolution /images/
            pathname = pathname.replace('/thumbnails/', '/images/');
            // Remove thumbnail_ prefix from filename
            pathname = pathname.replace('/thumbnail_', '/');
          } else if (quality === 'sample') {
            // Use sample quality
            pathname = pathname.replace('/thumbnails/', '/samples/');
            // Replace thumbnail_ with sample_ in filename
            pathname = pathname.replace('/thumbnail_', '/sample_');
          }

          return url.origin + pathname;
        };

        if (settings.alwaysUseFullResolution) {
          // Try full resolution first, fallback to sample, then thumbnail
          const fullResUrl = buildUpgradedUrl('full');
          const sampleUrl = buildUpgradedUrl('sample');

          const testFullRes = new Image();
          testFullRes.onload = () => {
            img.src = fullResUrl;
            setImageQuality(img, 'F');
          };
          testFullRes.onerror = () => {
            // Full res failed, try sample (silently)
            const testSample = new Image();
            testSample.onload = () => {
              img.src = sampleUrl;
              setImageQuality(img, 'S');
            };
            testSample.onerror = () => {
              // Sample failed too, keep original thumbnail (silently)
              setImageQuality(img, 'T');
            };
            testSample.src = sampleUrl;
          };
          testFullRes.src = fullResUrl;
        } else {
          // Try sample quality
          const sampleUrl = buildUpgradedUrl('sample');

          const testImg = new Image();
          testImg.onload = () => {
            img.src = sampleUrl;
            setImageQuality(img, 'S');
          };
          testImg.onerror = () => {
            // If upgrade fails, keep original thumbnail (silently - common for videos)
            setImageQuality(img, 'T');
          };
          testImg.src = sampleUrl;
        }
      } catch (error) {
        console.error('Error upgrading thumbnail URL:', originalSrc, error);
      }
    });
  }
}

// Watch for dynamically loaded images
function watchForNewImages() {
  // Use MutationObserver for DOM changes - debounced
  let mutationTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      upgradeToSampleQuality();
      autoLoadVideoThumbnails();
      addThumbnailDownloadButtons();
    }, 500); // Debounce mutations
  });

  // Observe the content area for new images
  const content = document.querySelector('#content, body');
  if (content) {
    observer.observe(content, {
      childList: true,
      subtree: true
    });
  }

  // Also periodically check for new images (catch lazy-loaded images)
  setInterval(() => {
    upgradeToSampleQuality();
    autoLoadVideoThumbnails();
    addThumbnailDownloadButtons();
  }, 3000); // Reduced from 1 second to 3 seconds

  // Trigger on scroll to catch lazy loading
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      upgradeToSampleQuality();
      autoLoadVideoThumbnails();
      addThumbnailDownloadButtons();
    }, 200);
  }, { passive: true });
}

// Initialize when page loads
removeRightSidebar();
applyCompactHeader();
applyAmoledTheme();
upgradeToSampleQuality();
createFloatingButtons();
addSaveIconsToLinks();
addThumbnailDownloadButtons(); // Must create buttons BEFORE loading videos
watchForNewImages();

// Delay initial video loading to ensure DOM is fully ready and buttons exist
setTimeout(() => {
  console.log('[R34 Tools] Starting initial video auto-load check...');
  autoLoadVideoThumbnails();
}, 2000); // 2 second delay to ensure page is loaded
