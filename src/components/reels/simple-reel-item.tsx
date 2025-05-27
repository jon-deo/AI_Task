'use client';

import React from 'react';
import type { VideoReelWithDetails } from '@/types';

interface SimpleReelItemProps {
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

export function SimpleReelItem({
  reel,
  isActive,
  autoPlay = true,
  onVideoEnd,
  onLike,
  onShare,
  onViewUpdate,
  preloadNext = false,
  preloadPrev = false,
}: SimpleReelItemProps) {

  // Check if video URL exists - MUST be first
  const hasVideoUrl = Boolean(reel.videoUrl);

  // Simple state for mute/unmute
  const [isMuted, setIsMuted] = React.useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = React.useState(false);
  const [videoError, setVideoError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Handle video loading and autoplay when active
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideoUrl) return;

    console.log(`Video effect for ${reel.title.slice(0, 20)}:`, {
      isActive,
      autoPlay,
      videoSrc: reel.videoUrl?.slice(0, 50),
      videoLoaded: isVideoLoaded
    });

    if (isActive && autoPlay && isVideoLoaded) {
      video.play().catch(error => {
        console.error('Autoplay failed:', error);
      });
    } else if (!isActive) {
      video.pause();
    }
  }, [isActive, autoPlay, isVideoLoaded, hasVideoUrl, reel.title, reel.videoUrl]);

  // Simple handlers without complex state
  const handleLike = () => {
    onLike(reel.id).catch(console.error);
  };

  const handleShare = () => {
    onShare(reel.id).catch(console.error);
  };

  const handleVideoClick = () => {
    // Toggle mute/unmute on video click
    if (videoRef.current) {
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      videoRef.current.muted = newMutedState;
      console.log('Video clicked:', reel.title, 'Muted:', newMutedState);
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      videoRef.current.muted = newMutedState;
    }
  };

  return (
    <div className={`relative h-full w-full bg-black overflow-hidden ${!isActive ? 'opacity-60' : ''}`}>
      {!hasVideoUrl ? (
        // Placeholder for missing video
        <div className="relative h-full w-full bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden flex items-center justify-center">
          <div className="text-center text-white p-8">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-xl font-bold mb-2">{reel.title}</h3>
            <p className="text-gray-300 mb-4">Video not available</p>
            <p className="text-sm text-gray-400">Celebrity: {reel.celebrity?.name}</p>
            <p className="text-xs text-gray-500 mt-2">URL: {reel.videoUrl || 'No URL'}</p>
          </div>
        </div>
      ) : (
        // Video content
        <>
          {/* Simple Video Element */}
          <video
            ref={videoRef}
            src={reel.videoUrl}
            poster={reel.thumbnailUrl}
            autoPlay={false} // We'll handle autoplay manually
            muted={isMuted}
            loop={false}
            controls={false}
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onClick={handleVideoClick}
            onEnded={onVideoEnd}
            onLoadedData={() => {
              console.log('Video loaded:', reel.title.slice(0, 20));
              setIsVideoLoaded(true);
              setVideoError(null);
            }}
            onCanPlay={() => {
              console.log('Video can play:', reel.title.slice(0, 20));
              // Try to play if this reel is active
              if (isActive && autoPlay && videoRef.current) {
                videoRef.current.play().catch(error => {
                  console.error('Autoplay failed on canplay:', error);
                });
              }
            }}
            onError={(e) => {
              const error = `Video error: ${e.currentTarget.error?.message || 'Unknown error'}`;
              console.error(error);
              console.log('Failed video URL:', reel.videoUrl);
              setVideoError(error);
              setIsVideoLoaded(false);
            }}
            onLoadStart={() => {
              console.log('Video load started:', reel.title.slice(0, 20));
              setIsVideoLoaded(false);
              setVideoError(null);
            }}
            preload={isActive || preloadNext || preloadPrev ? 'metadata' : 'none'}
          />

          {/* Video overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </>
      )}

      {/* Content overlay - Always show */}
      <div className="absolute inset-0 flex">
        {/* Left side - Content info */}
        <div className="flex-1 flex flex-col justify-end p-4 pb-20">
          <div className="mt-4">
            <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">
              {reel.title}
            </h3>
            <p className="text-white/80 text-sm line-clamp-3 mb-3">
              {reel.description}
            </p>
            <p className="text-white/60 text-sm">
              {reel.celebrity?.name} • {reel.celebrity?.sport}
            </p>

            {/* Hashtags */}
            {reel.tags && reel.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
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
          <button
            onClick={handleLike}
            className="flex flex-col items-center space-y-1"
          >
            <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
              <div className="w-6 h-6 text-white">♥</div>
            </div>
            <span className="text-white text-xs font-medium">
              {reel.likes?.toString() || '0'}
            </span>
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center space-y-1"
          >
            <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
              <div className="w-6 h-6 text-white">↗</div>
            </div>
            <span className="text-white text-xs font-medium">
              {reel.shares?.toString() || '0'}
            </span>
          </button>

          {/* Mute/Unmute button - Only show for videos */}
          {hasVideoUrl && (
            <button
              onClick={handleMuteToggle}
              className="flex flex-col items-center space-y-1"
            >
              <div className={`p-3 rounded-full backdrop-blur-sm ${isMuted ? 'bg-red-500/80' : 'bg-green-500/80'}`}>
                <div className="w-6 h-6 text-white">
                  {isMuted ? '🔇' : '🔊'}
                </div>
              </div>
              <span className="text-white text-xs font-medium">
                {isMuted ? 'Muted' : 'Audio'}
              </span>
            </button>
          )}

          {/* Views */}
          <div className="flex flex-col items-center space-y-1">
            <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
              <div className="w-6 h-6 text-white">👁</div>
            </div>
            <span className="text-white text-xs font-medium">
              {reel.views?.toString() || '0'}
            </span>
          </div>
        </div>
      </div>

      {/* Debug info */}
      <div className="absolute top-4 left-4 text-white text-xs bg-black/70 p-2 rounded max-w-xs">
        <div>ID: {reel.id.slice(-8)}</div>
        <div className={`font-bold ${isActive ? 'text-green-400' : 'text-red-400'}`}>
          Active: {isActive ? 'YES' : 'NO'}
        </div>
        <div>Has URL: {hasVideoUrl ? 'Yes' : 'No'}</div>
        <div className={`${isVideoLoaded ? 'text-green-400' : 'text-orange-400'}`}>
          Video Loaded: {isVideoLoaded ? 'YES' : 'NO'}
        </div>
        {videoError && (
          <div className="text-red-400">Error: {videoError.slice(0, 30)}...</div>
        )}
        <div>Status: {reel.status || 'Unknown'}</div>
        <div>Audio: {isMuted ? 'Muted' : 'Unmuted'}</div>
        <div>Title: {reel.title.slice(0, 20)}...</div>
        <div className="mt-1 text-green-400">
          💡 Click video to toggle audio
        </div>
        <div className="mt-1 text-blue-400">
          ℹ️ 206 status = normal video streaming
        </div>
        {hasVideoUrl && (
          <div className="mt-1 text-yellow-400">
            🎬 Video should {isActive && autoPlay ? 'autoplay' : 'be paused'}
          </div>
        )}
      </div>
    </div>
  );
}
