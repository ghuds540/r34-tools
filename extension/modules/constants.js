// Constants module for R34 Tools extension
// All hard-coded values centralized here for easy maintenance

(function() {
  'use strict';

  // Initialize global namespace
  window.R34Tools = window.R34Tools || {};

  // Color schemes for notifications and UI elements
  const COLORS = {
    success: {
      bg: '#0f2f1a',
      text: '#00ff66',
      border: '#1a4a2a'
    },
    error: {
      bg: '#2f0f0f',
      text: '#ff6666',
      border: '#4a1a1a'
    },
    info: {
      bg: '#0f2f1a',
      text: '#00ff66',
      border: '#1a4a2a'
    },
    accent: {
      green: '#00ff66',
      greenDark: '#00cc52',
      blue: '#66b3ff',
      blueDark: '#3399ff',
      pink: '#ff66b3',
      white: '#ffffff',
      black: '#000000',
      gray: '#999',
      grayLight: '#ccc',
      grayDark: '#333',
      grayDarker: '#1a1a1a',
      grayDarkest: '#0a0a0a',
      grayMedium: '#555',
      grayBorder: '#2a2a2a'
    }
  };

  // CSS Gradients
  const GRADIENTS = {
    greenButton: 'linear-gradient(135deg, #00ff66 0%, #00cc52 100%)',
    blueButton: 'linear-gradient(135deg, #66b3ff 0%, #3399ff 100%)'
  };

  // Timing constants (in milliseconds)
  const TIMINGS = {
    notificationDuration: 3000,
    notificationFadeOut: 300,
    buttonTransition: 200,
    notificationGap: 10,
    mutationDebounce: 500,
    scrollDebounce: 200,
    imageCheckInterval: 3000,
    videoLoadDelay: 2000,
    serverRequestDelay: 50,
    videoRequestDelay: 100
  };

  // DOM Selectors
  const SELECTORS = {
    // Thumbnail images
    thumbnails: '.thumb img, .thumbnail img, span.thumb img',

    // Post links
    postLink: 'a[href*="page=post"]',

    // Main images and videos
    mainImage: '#image, .flexi img, img[onclick*="note"]',
    imageElement: '#image, img.img, .flexi img, video, #gelcomVideoPlayer',
    videoElement: 'video source, video',
    videoSource: 'source',

    // Links and tags
    originalImageLink: 'a[href*="/images/"]',
    artistTags: '.tag-type-artist a, li[class*="tag-type-artist"] a',
    allTags: '.tag a, li[class*="tag-type"] a, .tag-type-artist a',

    // Layout elements
    searchForm: 'form[action*="list"]',
    sidebar: '#leftmenu, .sidebar, aside',
    rightSidebar: '.postListSidebarRight',
    navbar: '#navbar',
    subnavbar: '#subnavbar',
    header: '#header, header',
    radios: '.tradio, .tlabel',

    // Extension-added elements
    thumbWrapper: '.r34-thumb-wrapper',
    thumbDownload: '.r34-thumb-download',
    thumbFullRes: '.r34-thumb-fullres',
    qualityBadge: '.r34-quality-badge',
    saveLinkIcon: '.r34-save-link-icon'
  };

  // CDN domains for video content
  const CDN_DOMAINS = [
    'https://api-cdn-us-mp4.rule34.xxx',
    'https://ws-cdn-video.rule34.xxx',
    'https://video-cdn3.rule34.xxx'
  ];

  // Video file extensions
  const VIDEO_EXTENSIONS = ['.mp4', '.webm'];

  // URL patterns and regex
  const URL_PATTERNS = {
    postPage: 'page=post&s=view',
    listPage: 'page=post&s=list',
    postId: /[?&]id=(\d+)/,
    videoUrl: /https?:\/\/[^"'\s]+\.(mp4|webm|mov)[^"'\s]*/i,
    imagesPath: '/images/',
    samplesPath: '/samples/',
    thumbnailsPath: '/thumbnails/'
  };

  // Path replacements for quality upgrades
  const PATH_REPLACEMENTS = {
    toFull: {
      thumbnailsToImages: ['/thumbnails/', '/images/'],
      samplesToImages: ['/samples/', '/images/'],
      thumbnailPrefix: ['thumbnail_', ''],
      samplePrefix: ['sample_', '']
    },
    toSample: {
      thumbnailsToSamples: ['/thumbnails/', '/samples/'],
      thumbnailToSample: ['/thumbnail_', '/sample_']
    }
  };

  // Quality badge configurations
  const QUALITY_BADGES = {
    thumbnail: {
      letter: 'T',
      color: 'rgba(150, 0, 0, 0.9)',
      name: 'Thumbnail'
    },
    sample: {
      letter: 'S',
      color: 'rgba(180, 140, 0, 0.9)',
      name: 'Sample'
    },
    full: {
      letter: 'F',
      color: 'rgba(0, 150, 0, 0.9)',
      name: 'Full Resolution'
    },
    video: {
      letter: 'V',
      color: 'rgba(102, 179, 255, 0.9)',
      name: 'Video'
    }
  };

  // Button styles and positioning
  const BUTTON_STYLES = {
    download: {
      width: 28,
      height: 28,
      top: 4,
      left: 4,
      gradient: GRADIENTS.greenButton,
      color: '#000'
    },
    fullRes: {
      width: 28,
      height: 28,
      top: 4,
      left: 36,
      gradient: GRADIENTS.blueButton,
      color: '#000'
    },
    qualityBadge: {
      width: 20,
      height: 20,
      top: 4,
      right: 4,
      fontSize: 11,
      fontFamily: 'monospace',
      fontWeight: 700
    },
    panel: {
      borderColor: '#333',
      borderSize: 1,
      background: '#0a0a0a',
      backgroundHover: '#222',
      color: '#ccc',
      colorHover: null, // Set dynamically based on button type
      borderColorHover: '#555',
      padding: '4px 6px',
      fontSize: 11,
      borderRadius: 2,
      gap: 5
    }
  };

  // Default settings
  const DEFAULT_SETTINGS = {
    conflictAction: 'overwrite',
    amoledTheme: true,
    compactHeader: true,
    highQualityPreviews: true,
    alwaysUseFullResolution: false,
    autoLoadVideoEmbeds: true,
    autoStartEmbedVideos: true
  };

  // Notification positioning
  const NOTIFICATION_CONFIG = {
    startTop: 50,
    gap: 10,
    right: 20,
    maxWidth: 350,
    zIndex: 9999,
    padding: '14px 18px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)'
  };

  // Panel styles for sidebar controls
  const PANEL_STYLES = {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderBottom: '1px solid #333',
    padding: '8px',
    margin: '8px 0',
    borderRadius: '4px',
    gap: '6px'
  };

  // AMOLED theme CSS rules
  const AMOLED_THEME_RULES = {
    body: 'background: #000000 !important; color: #ffffff !important;',
    content: 'background: #000000 !important;',
    sidebar: 'background: #000000 !important;',
    navigation: 'background: #000000 !important;',
    text: 'color: #ffffff !important;',
    borders: 'border-color: #333333 !important;',
    inputs: 'background: #000000 !important; border-color: #333333 !important;',
    buttons: 'background: #1a1a1a !important; border-color: #333333 !important;',
    links: 'color: #00ff66 !important;',
    linksHover: 'color: #00cc52 !important;',
    panels: 'background: #000000 !important;',
    cards: 'background: #1a1a1a !important; border-color: #333333 !important;'
  };

  // Compact header styles
  const COMPACT_HEADER_STYLES = {
    panel: {
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      padding: '6px',
      color: '#00ff66',
      borderRadius: '4px'
    },
    button: {
      borderColorActive: '#00ff66',
      backgroundActive: '#2a2a2a',
      borderColorInactive: '#2a2a2a',
      backgroundInactive: '#1a1a1a'
    }
  };

  // CSS class names used by extension
  const CLASS_NAMES = {
    thumbWrapper: 'r34-thumb-wrapper',
    thumbDownload: 'r34-thumb-download',
    thumbFullRes: 'r34-thumb-fullres',
    qualityBadge: 'r34-quality-badge',
    saveLinkIcon: 'r34-save-link-icon',
    videoThumb: 'webm-thumb',
    videoThumbAlt: 'webm'
  };

  // SVG icon paths
  const SVG_ICONS = {
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
    zoomIn: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>',
    arrowUp: '<polyline points="18 15 12 9 6 15"></polyline>',
    arrowDown: '<polyline points="6 9 12 15 18 9"></polyline>'
  };

  // Export all constants to global namespace
  window.R34Tools.COLORS = COLORS;
  window.R34Tools.GRADIENTS = GRADIENTS;
  window.R34Tools.TIMINGS = TIMINGS;
  window.R34Tools.SELECTORS = SELECTORS;
  window.R34Tools.CDN_DOMAINS = CDN_DOMAINS;
  window.R34Tools.VIDEO_EXTENSIONS = VIDEO_EXTENSIONS;
  window.R34Tools.URL_PATTERNS = URL_PATTERNS;
  window.R34Tools.PATH_REPLACEMENTS = PATH_REPLACEMENTS;
  window.R34Tools.QUALITY_BADGES = QUALITY_BADGES;
  window.R34Tools.BUTTON_STYLES = BUTTON_STYLES;
  window.R34Tools.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  window.R34Tools.NOTIFICATION_CONFIG = NOTIFICATION_CONFIG;
  window.R34Tools.PANEL_STYLES = PANEL_STYLES;
  window.R34Tools.AMOLED_THEME_RULES = AMOLED_THEME_RULES;
  window.R34Tools.COMPACT_HEADER_STYLES = COMPACT_HEADER_STYLES;
  window.R34Tools.CLASS_NAMES = CLASS_NAMES;
  window.R34Tools.SVG_ICONS = SVG_ICONS;

})();
