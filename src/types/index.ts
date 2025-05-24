// Re-export Prisma types
export type {
  Celebrity,
  VideoReel,
  User,
  UserSession,
  UserVideoLike,
  UserVideoShare,
  UserVideoView,
  UserCelebrityLike,
  VideoComment,
  VideoAnalytics,
  SystemAnalytics,
  GenerationJob,
  Sport,
  VideoStatus,
  VoiceType,
  SharePlatform,
  GenerationStatus,
  Prisma,
} from '@prisma/client';

// Extended types with relations
export interface CelebrityWithStats extends Celebrity {
  _count: {
    videoReels: number;
    userLikes: number;
  };
  videoReels?: VideoReel[];
}

export interface VideoReelWithDetails extends VideoReel {
  celebrity: {
    id: string;
    name: string;
    slug: string;
    sport: Sport;
    imageUrl: string | null;
  };
  _count: {
    userLikes: number;
    userShares: number;
    userViews: number;
    comments: number;
  };
}

// Custom interfaces for API responses and requests

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Request Types
export interface CreateVideoRequest {
  celebrityId: string;
  customPrompt?: string;
  duration?: number;
  voiceType?: VoiceType;
}

export interface GetReelsRequest {
  page?: number;
  limit?: number;
  sport?: Sport;
  celebrityId?: string;
  sortBy?: 'createdAt' | 'views' | 'likes';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  status?: VideoStatus;
}

// AI Generation Types
export interface AIGenerationRequest {
  celebrityName: string;
  sport: string;
  biography: string;
  achievements: string[];
  customPrompt?: string;
  duration: number;
}

export interface AIGenerationResponse {
  script: string;
  title: string;
  description: string;
  estimatedDuration: number;
}

export interface VoiceGenerationRequest {
  text: string;
  voiceType: VoiceType;
  speed?: number;
  pitch?: number;
}

// VoiceType enum is now imported from Prisma

// AWS S3 Types
export interface S3UploadResponse {
  key: string;
  url: string;
  bucket: string;
  etag: string;
  size: number;
}

export interface S3PresignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

// Component Props Types
export interface ReelItemProps {
  reel: VideoReel;
  isActive: boolean;
  onVideoEnd: () => void;
  onLike: (reelId: string) => void;
  onShare: (reelId: string) => void;
  onViewUpdate: (reelId: string) => void;
}

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  className?: string;
}

// Hook Types
export interface UseReelsReturn {
  reels: VideoReel[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  likeReel: (reelId: string) => Promise<void>;
  shareReel: (reelId: string) => Promise<void>;
  updateViews: (reelId: string) => Promise<void>;
}

export interface UseVideoPlayerReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loading: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  VIDEO_PROCESSING_ERROR = 'VIDEO_PROCESSING_ERROR',
  AI_GENERATION_ERROR = 'AI_GENERATION_ERROR',
  S3_UPLOAD_ERROR = 'S3_UPLOAD_ERROR',
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
