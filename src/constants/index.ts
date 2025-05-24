// API Routes
export const API_ROUTES = {
  REELS: '/api/reels',
  CELEBRITIES: '/api/celebrities',
  GENERATE: '/api/generate',
  UPLOAD: '/api/upload',
  HEALTH: '/api/health',
  ANALYTICS: '/api/analytics',
} as const;

// Sports Categories
export const SPORTS_CATEGORIES = [
  { value: 'FOOTBALL', label: 'Football', icon: '🏈' },
  { value: 'BASKETBALL', label: 'Basketball', icon: '🏀' },
  { value: 'BASEBALL', label: 'Baseball', icon: '⚾' },
  { value: 'SOCCER', label: 'Soccer', icon: '⚽' },
  { value: 'TENNIS', label: 'Tennis', icon: '🎾' },
  { value: 'GOLF', label: 'Golf', icon: '⛳' },
  { value: 'HOCKEY', label: 'Hockey', icon: '🏒' },
  { value: 'BOXING', label: 'Boxing', icon: '🥊' },
  { value: 'MMA', label: 'MMA', icon: '🥋' },
  { value: 'TRACK_AND_FIELD', label: 'Track & Field', icon: '🏃' },
  { value: 'SWIMMING', label: 'Swimming', icon: '🏊' },
  { value: 'GYMNASTICS', label: 'Gymnastics', icon: '🤸' },
  { value: 'OTHER', label: 'Other', icon: '🏆' },
] as const;

// Video Status
export const VIDEO_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
} as const;

// Voice Types
export const VOICE_TYPES = [
  { value: 'MALE_NARRATOR', label: 'Male Narrator', description: 'Professional male voice' },
  { value: 'FEMALE_NARRATOR', label: 'Female Narrator', description: 'Professional female voice' },
  { value: 'SPORTS_COMMENTATOR', label: 'Sports Commentator', description: 'Energetic sports commentary style' },
  { value: 'DOCUMENTARY_STYLE', label: 'Documentary Style', description: 'Calm, informative documentary voice' },
] as const;

// Video Quality Options
export const VIDEO_QUALITY_OPTIONS = [
  { value: '480p', label: '480p', bitrate: '500k' },
  { value: '720p', label: '720p HD', bitrate: '1000k' },
  { value: '1080p', label: '1080p Full HD', bitrate: '2000k' },
] as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please log in.',
  AUTHORIZATION_ERROR: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Internal server error. Please try again later.',
  VIDEO_PROCESSING_ERROR: 'Error processing video. Please try again.',
  AI_GENERATION_ERROR: 'Error generating content. Please try again.',
  S3_UPLOAD_ERROR: 'Error uploading file. Please try again.',
  RATE_LIMIT_ERROR: 'Too many requests. Please wait before trying again.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  INVALID_FILE_TYPE: 'Invalid file type. Please upload a supported format.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  VIDEO_GENERATED: 'Video generated successfully!',
  VIDEO_UPLOADED: 'Video uploaded successfully!',
  CELEBRITY_CREATED: 'Celebrity profile created successfully!',
  CELEBRITY_UPDATED: 'Celebrity profile updated successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  VIDEO_LIKED: 'Video liked!',
  VIDEO_SHARED: 'Video shared successfully!',
} as const;

// Loading Messages
export const LOADING_MESSAGES = {
  GENERATING_SCRIPT: 'Generating script...',
  CREATING_VOICE: 'Creating voice narration...',
  PROCESSING_VIDEO: 'Processing video...',
  UPLOADING_FILE: 'Uploading file...',
  LOADING_REELS: 'Loading reels...',
  SAVING_CHANGES: 'Saving changes...',
} as const;

// Animation Durations (in milliseconds)
export const ANIMATION_DURATIONS = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  EXTRA_SLOW: 1000,
} as const;

// Breakpoints (matching Tailwind CSS)
export const BREAKPOINTS = {
  XS: 475,
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
  '3XL': 1600,
} as const;

// Z-Index Layers
export const Z_INDEX = {
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070,
  TOAST: 1080,
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  THEME: 'sports-reels-theme',
  USER_PREFERENCES: 'sports-reels-preferences',
  VIDEO_PROGRESS: 'sports-reels-video-progress',
  LIKED_VIDEOS: 'sports-reels-liked-videos',
  VIEWED_VIDEOS: 'sports-reels-viewed-videos',
} as const;

// Cache Keys
export const CACHE_KEYS = {
  REELS: 'reels',
  CELEBRITIES: 'celebrities',
  USER_ANALYTICS: 'user-analytics',
  VIDEO_METADATA: 'video-metadata',
} as const;

// File Upload Constraints
export const FILE_CONSTRAINTS = {
  MAX_SIZE_MB: 100,
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_VIDEO_DURATION_SECONDS: 300, // 5 minutes
  MIN_VIDEO_DURATION_SECONDS: 5,
} as const;

// Social Media Platforms
export const SOCIAL_PLATFORMS = [
  { name: 'Twitter', icon: '🐦', shareUrl: 'https://twitter.com/intent/tweet?url=' },
  { name: 'Facebook', icon: '📘', shareUrl: 'https://www.facebook.com/sharer/sharer.php?u=' },
  { name: 'LinkedIn', icon: '💼', shareUrl: 'https://www.linkedin.com/sharing/share-offsite/?url=' },
  { name: 'WhatsApp', icon: '💬', shareUrl: 'https://wa.me/?text=' },
  { name: 'Telegram', icon: '✈️', shareUrl: 'https://t.me/share/url?url=' },
] as const;

// Video Player Settings
export const VIDEO_PLAYER_SETTINGS = {
  PRELOAD_COUNT: 3, // Number of videos to preload
  BUFFER_SIZE: 5, // Buffer size in seconds
  SEEK_STEP: 10, // Seek step in seconds
  VOLUME_STEP: 0.1, // Volume adjustment step
  DOUBLE_TAP_SEEK: 10, // Double tap seek duration
  AUTOPLAY_DELAY: 500, // Delay before autoplay in milliseconds
} as const;

// AI Generation Prompts
export const AI_PROMPTS = {
  SCRIPT_GENERATION: `Create an engaging 30-60 second script about {celebrityName}, a {sport} player. 
    Focus on their most interesting career highlights, personal journey, and impact on the sport. 
    Make it conversational and exciting, suitable for a short video format.
    Include specific achievements: {achievements}
    Biography context: {biography}`,
  
  TITLE_GENERATION: `Generate a catchy, engaging title for a sports reel about {celebrityName}. 
    The title should be under 60 characters and capture the most interesting aspect of their story.`,
  
  DESCRIPTION_GENERATION: `Write a compelling description for a sports reel about {celebrityName}. 
    Keep it under 150 characters, include relevant hashtags, and make it shareable.`,
} as const;

// Performance Metrics
export const PERFORMANCE_THRESHOLDS = {
  GOOD_LCP: 2500, // Largest Contentful Paint in ms
  GOOD_FID: 100, // First Input Delay in ms
  GOOD_CLS: 0.1, // Cumulative Layout Shift
  GOOD_FCP: 1800, // First Contentful Paint in ms
  GOOD_TTFB: 800, // Time to First Byte in ms
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_ANALYTICS: 'enable_analytics',
  ENABLE_OFFLINE_MODE: 'enable_offline_mode',
  ENABLE_VIDEO_PRELOADING: 'enable_video_preloading',
  ENABLE_INFINITE_SCROLL: 'enable_infinite_scroll',
  ENABLE_DARK_MODE: 'enable_dark_mode',
  ENABLE_SHARING: 'enable_sharing',
  ENABLE_COMMENTS: 'enable_comments',
} as const;
