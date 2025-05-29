// Fallback type definitions (when @prisma/client is not available)
// TODO: Replace with actual Prisma imports after running `npm install`

export interface Celebrity {
  id: string;
  name: string;
  slug: string;
  sport: string;
  imageUrl: string | null;
  biography: string;
  achievements: string[];
  birthDate: Date | null;
  nationality: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoReel {
  id: string;
  celebrityId: string;
  title: string;
  description: string;
  script: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  fileSize: bigint;
  resolution: string;
  bitrate: string;
  format: string;
  s3Key: string;
  s3Bucket: string;
  cloudFrontUrl: string | null;
  tags: string[];
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum VideoStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum VoiceType {
  MALE_NARRATOR = 'MALE_NARRATOR',
  FEMALE_NARRATOR = 'FEMALE_NARRATOR',
  SPORTS_COMMENTATOR = 'SPORTS_COMMENTATOR',
  DOCUMENTARY_STYLE = 'DOCUMENTARY_STYLE',
  ENERGETIC_HOST = 'ENERGETIC_HOST',
  CALM_NARRATOR = 'CALM_NARRATOR',
}

export enum Sport {
  FOOTBALL = 'FOOTBALL',
  BASKETBALL = 'BASKETBALL',
  BASEBALL = 'BASEBALL',
  SOCCER = 'SOCCER',
  TENNIS = 'TENNIS',
  GOLF = 'GOLF',
  HOCKEY = 'HOCKEY',
  BOXING = 'BOXING',
  MMA = 'MMA',
  OTHER = 'OTHER',
}

export enum GenerationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface GenerationJob {
  id: string;
  celebrityId: string;
  status: GenerationStatus;
  prompt?: string;
  voiceType?: VoiceType;
  duration?: number;
  scriptGenerated: boolean;
  voiceGenerated: boolean;
  videoGenerated: boolean;
  generatedScript?: string;
  generatedTitle?: string;
  generatedVideoUrl?: string;
  errorMessage?: string;
  retryCount: number;
  totalCost: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  celebrity?: {
    id: string;
    name: string;
    sport: Sport;
  };
}

// Extended types with relations
export interface CelebrityWithStats extends Celebrity {
  videoReels?: VideoReel[];
}

export interface VideoReelWithDetails extends VideoReel {
  celebrity: {
    id: string;
    name: string;
    slug: string;
    sport: string;
    imageUrl: string | null;
  };
}

// Custom interfaces for API responses and requests
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

export interface CreateVideoRequest {
  celebrityId: string;
  duration?: number;
  voiceType?: VoiceType;
}

export interface GetReelsRequest {
  page?: number;
  limit?: number;
  sport?: Sport;
  celebrityId?: string;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  status?: VideoStatus;
}

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

export interface ReelItemProps {
  reel: VideoReel;
  isActive: boolean;
  onVideoEnd: () => void;
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

export interface UseReelsReturn {
  reels: VideoReel[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
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

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
