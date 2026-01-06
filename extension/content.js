// Content script for extracting media and metadata from rule34.xxx

class Rule34Extractor {
  constructor() {
    this.postId = null;
    this.mediaUrl = null;
    this.tags = [];
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

    console.log('Extracted post ID:', this.postId);
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

      console.log('Extracted highest quality image URL:', this.mediaUrl);
      return this.mediaUrl;
    }

    // Method 2: Check for video element (videos are typically full quality)
    const videoElement = document.querySelector('video source, video');
    if (videoElement) {
      this.mediaUrl = videoElement.src || videoElement.querySelector('source')?.src;
      if (this.mediaUrl) {
        console.log('Extracted video URL:', this.mediaUrl);
        return this.mediaUrl;
      }
    }

    // Method 3: Check for "Original image" link in options
    const originalLink = document.querySelector('a[href*="/images/"]');
    if (originalLink && originalLink.textContent.includes('Original')) {
      this.mediaUrl = originalLink.href;
      console.log('Extracted from Original link:', this.mediaUrl);
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
      console.log('Upgraded image URL to full quality:', this.mediaUrl);
      return this.mediaUrl;
    }

    console.warn('Could not extract media URL from page');
    return null;
  }

  // Extract tags and artists from page
  extractMetadata() {
    this.tags = [];
    this.artists = [];

    // Method 1: Get from tag sidebar
    const tagLinks = document.querySelectorAll('.tag-type-artist a, li[class*="tag-type-artist"] a');
    tagLinks.forEach(link => {
      const artistName = link.textContent.trim().replace(/\s*\d+$/, ''); // Remove count
      if (artistName && !this.artists.includes(artistName)) {
        this.artists.push(artistName);
      }
    });

    // Get all tags
    const allTagLinks = document.querySelectorAll('.tag a:first-child, li[class*="tag-type"] a:first-child');
    allTagLinks.forEach(link => {
      const tagName = link.textContent.trim().replace(/\s*\d+$/, ''); // Remove count
      if (tagName && !this.tags.includes(tagName)) {
        this.tags.push(tagName);
      }
    });

    // Method 2: Fallback - parse from tag list in stats
    if (this.tags.length === 0) {
      const statsSection = document.querySelector('#stats');
      if (statsSection) {
        const tagText = statsSection.textContent;
        const tagMatches = tagText.match(/Tags:\s*([^\n]+)/);
        if (tagMatches) {
          this.tags = tagMatches[1].split(/\s+/).filter(t => t.length > 0);
        }
      }
    }

    return { tags: this.tags, artists: this.artists };
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
      // Show notification based on conflict action
      let message = '';
      if (response.conflictAction === 'overwrite') {
        message = `Downloaded (overwrites existing): ${filename}`;
      } else if (response.conflictAction === 'uniquify') {
        message = `Downloaded: ${filename}`;
      } else {
        message = `Downloading: ${filename}`;
      }

      // Get artist names for display
      const artistInfo = extractor.artists.length > 0
        ? `\nArtists: ${extractor.artists.join(', ')}`
        : '';

      showNotification(message + artistInfo, 'success');
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

  const timestamp = new Date().toISOString();
  let content = '\n' + '='.repeat(80) + '\n';
  content += `URL: ${window.location.href}\n`;
  content += `Timestamp: ${timestamp}\n`;

  // If we have post ID and metadata, add it
  if (extractor.postId) {
    content += `Post ID: ${extractor.postId}\n`;
  }

  if (extractor.artists.length > 0) {
    content += `Artists: ${extractor.artists.join(', ')}\n`;
  }

  if (extractor.tags.length > 0) {
    content += `Tags: ${extractor.tags.join(', ')}\n`;
  }

  content += '='.repeat(80) + '\n';

  try {
    const response = await browser.runtime.sendMessage({
      action: 'appendToFile',
      content: content
    });

    console.log('Save response:', response);

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
    bgColor = '#0f1f2f';
    textColor = '#00d4ff';
    borderColor = '#1a2a4a';
  }

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 14px 18px;
    background: ${bgColor};
    color: ${textColor};
    border: 1px solid ${borderColor};
    border-radius: 6px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    max-width: 350px;
    backdrop-filter: blur(10px);
    white-space: pre-line;
    line-height: 1.5;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(20px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Create action buttons on page
function createFloatingButtons() {
  const isPostPage = window.location.href.includes('page=post&s=view');

  if (isPostPage) {
    // On post pages: download button appears on image hover
    createImageDownloadButton();
  }

  // Always add save button in sidebar
  createSidebarSaveButton();
}

// Create download button that appears on image hover
function createImageDownloadButton() {
  const imageElement = document.querySelector('#image, img.img, .flexi img');
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
    background: linear-gradient(135deg, #00d4ff 0%, #0080ff 100%);
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

// Create save button in sidebar
function createSidebarSaveButton() {
  const saveBtn = document.createElement('button');
  saveBtn.id = 'r34-tools-save';
  saveBtn.textContent = '🔖 Save';
  saveBtn.title = 'Save page (Ctrl+Shift+S)';
  saveBtn.style.cssText = `
    width: 100%;
    padding: 6px 10px;
    margin-bottom: 8px;
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    background: #1a1a1a;
    color: #00d4ff;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  `;
  saveBtn.onmouseover = () => {
    saveBtn.style.borderColor = '#00d4ff';
    saveBtn.style.background = '#2a2a2a';
  };
  saveBtn.onmouseout = () => {
    saveBtn.style.borderColor = '#2a2a2a';
    saveBtn.style.background = '#1a1a1a';
  };
  saveBtn.onclick = () => handleSavePage();

  // Try to find sidebar search area
  const searchForm = document.querySelector('form[action*="list"]');
  const sidebar = document.querySelector('#leftmenu, .sidebar, aside');

  if (searchForm) {
    searchForm.parentNode.insertBefore(saveBtn, searchForm);
  } else if (sidebar) {
    sidebar.insertBefore(saveBtn, sidebar.firstChild);
  } else {
    // Fallback: fixed position top-left
    saveBtn.style.position = 'fixed';
    saveBtn.style.top = '10px';
    saveBtn.style.left = '10px';
    saveBtn.style.width = 'auto';
    saveBtn.style.zIndex = '9999';
    document.body.appendChild(saveBtn);
  }
}

// Initialize when page loads
console.log('Rule34.xxx Tools extension loaded');
createFloatingButtons();
