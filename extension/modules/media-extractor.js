// Media Extractor module for R34 Tools extension
// Enhanced Rule34Extractor class with additional extraction methods

(function() {
  'use strict';

  // Get dependencies
  const { SELECTORS } = window.R34Tools;
  const { forceMaxQualityUrl } = window.R34Tools;
  const { extractVideoFromHtml } = window.R34Tools;
  const { extractPostId } = window.R34Tools;

  /**
   * Enhanced Rule34Extractor class
   * Extracts media, metadata, and generates filenames
   */
  class Rule34Extractor {
    constructor() {
      this.postId = null;
      this.mediaUrl = null;
      this.artists = [];
      this.tags = [];
    }

    /**
     * Extract post ID from URL or page
     * @returns {string|null} Post ID
     */
    extractPostId() {
      const urlParams = new URLSearchParams(window.location.search);
      this.postId = urlParams.get('id');

      // Fallback: try to get from page variable
      if (!this.postId && typeof id !== 'undefined') {
        this.postId = id;
      }

      // Additional fallback: extract from URL
      if (!this.postId) {
        this.postId = extractPostId(window.location.href);
      }

      return this.postId;
    }

    /**
     * Extract highest quality media URL from current page
     * @returns {string|null} Media URL
     */
    extractMediaUrl() {
      // Method 1: Check for image JavaScript object (most reliable for images)
      if (typeof image !== 'undefined' && image.domain && image.dir !== undefined && image.img) {
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

      // Method 2: Check for video element
      const videoElement = document.querySelector(SELECTORS.videoElement);
      if (videoElement) {
        this.mediaUrl = videoElement.src || videoElement.querySelector(SELECTORS.videoSource)?.src;
        if (this.mediaUrl) {
          return this.mediaUrl;
        }
      }

      // Method 3: Check for "Original image" link
      const originalLink = document.querySelector(SELECTORS.originalImageLink);
      if (originalLink && originalLink.textContent.includes('Original')) {
        this.mediaUrl = originalLink.href;
        return this.mediaUrl;
      }

      // Method 4: Look for main image and upgrade to full resolution
      const mainImage = document.querySelector(SELECTORS.mainImage);
      if (mainImage) {
        this.mediaUrl = forceMaxQualityUrl(mainImage.src);
        return this.mediaUrl;
      }

      return null;
    }

    /**
     * Extract media URL from parsed document (for thumbnail downloads)
     * @param {Document} doc - Parsed post page document
     * @returns {string|null} Media URL
     */
    extractMediaFromDocument(doc) {
      let mediaUrl = null;

      // Method 1: Check for video
      const html = doc.documentElement.outerHTML;
      mediaUrl = extractVideoFromHtml(html, doc);
      if (mediaUrl) return mediaUrl;

      // Method 2: Check for "Original image" link
      const originalLink = doc.querySelector(SELECTORS.originalImageLink);
      if (originalLink && originalLink.textContent.includes('Original')) {
        return originalLink.href;
      }

      // Method 3: Look for main image and upgrade to full resolution
      const mainImage = doc.querySelector(SELECTORS.mainImage);
      if (mainImage) {
        return forceMaxQualityUrl(mainImage.src);
      }

      return null;
    }

    /**
     * Extract artists from current page
     * @returns {Object} Object with artists array
     */
    extractMetadata() {
      this.artists = [];

      const tagLinks = document.querySelectorAll(SELECTORS.artistTags);
      tagLinks.forEach(link => {
        const artistName = link.textContent.trim().replace(/\s*\d+$/, ''); // Remove count
        // Filter out control characters and single-character artifacts
        if (artistName && artistName.length > 1 && !['?', '+', '-'].includes(artistName) && !this.artists.includes(artistName)) {
          this.artists.push(artistName);
        }
      });

      return { artists: this.artists };
    }

    /**
     * Extract artists from parsed document
     * @param {Document} doc - Parsed post page document
     * @returns {Array<string>} Array of artist names
     */
    extractArtistsFromDocument(doc) {
      const artists = [];
      const tagLinks = doc.querySelectorAll(SELECTORS.artistTags);

      tagLinks.forEach(link => {
        const artistName = link.textContent.trim().replace(/\s*\d+$/, ''); // Remove count
        // Filter out control characters and single-character artifacts
        if (artistName && artistName.length > 1 && !['?', '+', '-'].includes(artistName) && !artists.includes(artistName)) {
          artists.push(artistName);
        }
      });

      return artists;
    }

    /**
     * Build filename with post ID, hash, and artists
     * @param {string} mediaUrl - Media URL
     * @param {string} postId - Post ID
     * @param {Array<string>} artists - Array of artist names
     * @returns {string} Formatted filename
     */
    buildFilename(mediaUrl, postId, artists) {
      const urlObj = new URL(mediaUrl);
      const pathname = urlObj.pathname;
      const baseFilename = pathname.split('/').pop().split('?')[0];

      // Extract file extension
      const lastDotIndex = baseFilename.lastIndexOf('.');
      const extension = lastDotIndex !== -1 ? baseFilename.substring(lastDotIndex) : '';
      const nameWithoutExt = lastDotIndex !== -1 ? baseFilename.substring(0, lastDotIndex) : baseFilename;

      // Build filename
      let finalName = '';

      // Add post ID prefix if available
      if (postId) {
        finalName = `r34_${postId}_`;
      }

      // Add base filename (hash)
      finalName += nameWithoutExt;

      // Append artists if available
      if (artists && artists.length > 0) {
        // Sanitize artist names for filename
        const artistString = artists
          .map(artist => artist.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, ''))
          .join('_');
        finalName += `_${artistString}`;
      }

      // Add extension back
      finalName += extension;

      return finalName;
    }

    /**
     * Get filename for download (uses instance properties)
     * @returns {string|null} Filename or null
     */
    getFilename() {
      if (!this.mediaUrl) return null;
      return this.buildFilename(this.mediaUrl, this.postId, this.artists);
    }

    /**
     * Format metadata for saving (legacy - not currently used)
     * @returns {string} Formatted metadata string
     */
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

  // Export class to global namespace
  window.R34Tools.Rule34Extractor = Rule34Extractor;

})();
