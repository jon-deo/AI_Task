'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { VideoReelWithDetails } from '@/types';

// Fallback components and hooks
const motion = {
  div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  button: ({ children, className, onClick, ...props }: any) =>
    <button className={className} onClick={onClick} {...props}>{children}</button>
};

// Fallback icons
const Heart = ({ className }: { className?: string }) => <div className={className}>♥</div>;
const Share = ({ className }: { className?: string }) => <div className={className}>↗</div>;
const MessageCircle = ({ className }: { className?: string }) => <div className={className}>💬</div>;
const MoreHorizontal = ({ className }: { className?: string }) => <div className={className}>⋯</div>;
const Play = ({ className }: { className?: string }) => <div className={className}>▶</div>;
const Pause = ({ className }: { className?: string }) => <div className={className}>⏸</div>;

// Fallback components
const VideoPlayer = ({ src, onClick, onDoubleClick, className, preload }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [quality, setQuality] = useState<'auto' | 'high' | 'low'>('auto');

  // Handle quality switching based on network conditions
  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        const updateQuality = () => {
          if (connection.saveData) {
            setQuality('low');
          } else if (connection.effectiveType === '4g') {
            setQuality('high');
          } else {
            setQuality('auto');
          }
        };

        connection.addEventListener('change', updateQuality);
        updateQuality();
        return () => connection.removeEventListener('change', updateQuality);
      }
    }
  }, []);

  // Handle video loading
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Set appropriate quality
      if (quality === 'low') {
        video.playbackRate = 0.75;
      } else if (quality === 'high') {
        video.playbackRate = 1;
      }

      // Handle loading state
      const handleLoadedData = () => setIsLoaded(true);
      video.addEventListener('loadeddata', handleLoadedData);
      return () => video.removeEventListener('loadeddata', handleLoadedData);
    }
  }, [quality]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={className}
        preload={preload}
        playsInline
        muted
        loop={false}
        controls={false}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
};
const ShareModal = ({ isOpen, onClose }: any) => isOpen ? <div onClick={onClose}>Share Modal</div> : null;
const CelebrityInfo = ({ celebrity }: any) => <div>{celebrity.name}</div>;

// Fallback hooks
const useVideoPlayer = () => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  loading: false,
  error: null,
  play: () => {},
  pause: () => {},
  seek: () => {},
  setVolume: () => {},
  toggleMute: () => {},
});

// Fallback utils
const formatNumber = (num: number) => num.toString();

interface ReelItemProps {
  reel: VideoReelWithDetails;
  isActive: boolean;
  autoPlay?: boolean;
  onVideoEnd: () => void;
  onLike: (reelId: string) => Promise<void>;
  onShare: (reelId: string) => Promise<void>;
  onViewUpdate: (reelId: string) => Promise<void>;
  preloadNext?: boolean;
  preloadPrev?: boolean;
}

export function ReelItem({
  reel,
  isActive,
  autoPlay = true,
  onVideoEnd,
  onLike,
  onShare,
  onViewUpdate,
  preloadNext = false,
  preloadPrev = false,
}: ReelItemProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const controlsTimeoutRef = useRef<number>();

  const {
    isPlaying,
    currentTime,
    duration,
    muted,
    loading,
    error,
    play,
    pause,
  } = useVideoPlayer();

  // Handle view tracking
  useEffect(() => {
    if (isActive && !hasViewed && currentTime > 3) {
      setHasViewed(true);
      onViewUpdate(reel.id);
    }
  }, [isActive, currentTime, hasViewed, onViewUpdate, reel.id]);

  // Auto play/pause based on active state
  useEffect(() => {
    if (isActive && autoPlay) {
      play();
    } else {
      pause();
    }
  }, [isActive, autoPlay, play, pause]);

  // Handle video end
  useEffect(() => {
    if (currentTime >= duration && duration > 0) {
      onVideoEnd();
    }
  }, [currentTime, duration, onVideoEnd]);

  // Handle like action
  const handleLike = async () => {
    try {
      await onLike(reel.id);
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Failed to like reel:', error);
    }
  };

  // Handle share action
  const handleShare = async () => {
    setIsShareModalOpen(true);
  };

  // Handle double tap to like
  const handleDoubleTap = () => {
    if (!isLiked) {
      handleLike();
    }
  };

  // Show/hide controls
  const showControlsTemporarily = () => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Handle tap on video
  const handleVideoTap = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
    showControlsTemporarily();
  };

  // Progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {/* Video Player */}
      <VideoPlayer
        src={reel.videoUrl}
        poster={reel.thumbnailUrl}
        autoPlay={isActive && autoPlay}
        muted={muted}
        loop={false}
        controls={false}
        onEnded={onVideoEnd}
        onTimeUpdate={(_time: number) => {
          // Handle time update if needed
        }}
        onLoadedMetadata={(_dur: number) => {
          // Handle metadata if needed
        }}
        className="absolute inset-0 w-full h-full object-cover"
        onClick={handleVideoTap}
        onDoubleClick={handleDoubleTap}
        preload={preloadNext || preloadPrev ? 'metadata' : 'none'}
      />

      {/* Video overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <motion.div
          className="h-full bg-white"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Content overlay */}
      <div className="absolute inset-0 flex">
        {/* Left side - Content info */}
        <div className="flex-1 flex flex-col justify-end p-4 pb-20">
          <CelebrityInfo celebrity={reel.celebrity} />

          <div className="mt-4">
            <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">
              {reel.title}
            </h3>
            <p className="text-white/80 text-sm line-clamp-3 mb-3">
              {reel.description}
            </p>

            {/* Hashtags */}
            {reel.tags && reel.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reel.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="text-white/70 text-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex flex-col justify-end items-center p-4 pb-20 space-y-6">
          {/* Like button */}
          <motion.button
            onClick={handleLike}
            className="flex flex-col items-center space-y-1"
            whileTap={{ scale: 0.9 }}
            animate={isLiked ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className={`p-3 rounded-full ${isLiked ? 'bg-red-500' : 'bg-white/20'} backdrop-blur-sm`}>
              <Heart
                className={`w-6 h-6 ${isLiked ? 'text-white fill-current' : 'text-white'}`}
              />
            </div>
            <span className="text-white text-xs font-medium">
              {formatNumber(Number(reel.likes) + (isLiked ? 1 : 0))}
            </span>
          </motion.button>

          {/* Share button */}
          <motion.button
            onClick={handleShare}
            className="flex flex-col items-center space-y-1"
            whileTap={{ scale: 0.9 }}
          >
            <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
              <Share className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">
              {formatNumber(Number(reel.shares))}
            </span>
          </motion.button>

          {/* Comments button */}
          {/* <motion.button
            className="flex flex-col items-center space-y-1"
            whileTap={{ scale: 0.9 }}
          >
            <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">
              {formatNumber(reel.commentsCount ?? 0)}
            </span>
          </motion.button> */}

          {/* More options */}
          <motion.button
            className="flex flex-col items-center space-y-1"
            whileTap={{ scale: 0.9 }}
          >
            <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
              <MoreHorizontal className="w-6 h-6 text-white" />
            </div>
          </motion.button>
        </div>
      </div>

      {/* Play/Pause overlay */}
      {showControls && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="p-4 rounded-full bg-black/50 backdrop-blur-sm">
            {isPlaying ? (
              <Pause className="w-12 h-12 text-white" />
            ) : (
              <Play className="w-12 h-12 text-white" />
            )}
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white">
            <p className="mb-2">Failed to load video</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white/20 rounded-lg text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        reel={reel}
        onShare={onShare}
      />
    </div>
  );
}
