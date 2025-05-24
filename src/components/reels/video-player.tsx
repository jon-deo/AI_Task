'use client';

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

// Fallback cn function
const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ');

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: Event) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onWaiting?: () => void;
}

export interface VideoPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  isMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  isPaused: () => boolean;
  isEnded: () => boolean;
  getVideoElement: () => HTMLVideoElement | null;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (props: VideoPlayerProps, ref: React.Ref<VideoPlayerRef>) => {
    const {
      src,
      poster,
      autoPlay = false,
      muted = true,
      loop = false,
      controls = false,
      preload = 'metadata',
      className,
      onClick,
      onDoubleClick,
      onEnded,
      onTimeUpdate,
      onLoadedMetadata,
      onPlay,
      onPause,
      onError,
      onLoadStart,
      onCanPlay,
      onWaiting,
    } = props;
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastTapRef = useRef<number>(0);

    // Expose video controls through ref
    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
          } catch (error) {
            console.error('Error playing video:', error);
          }
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
      getVolume: () => {
        return videoRef.current?.volume || 0;
      },
      setVolume: (volume: number) => {
        if (videoRef.current) {
          videoRef.current.volume = Math.max(0, Math.min(1, volume));
        }
      },
      isMuted: () => {
        return videoRef.current?.muted || false;
      },
      setMuted: (muted: boolean) => {
        if (videoRef.current) {
          videoRef.current.muted = muted;
        }
      },
      isPaused: () => {
        return videoRef.current?.paused || true;
      },
      isEnded: () => {
        return videoRef.current?.ended || false;
      },
      getVideoElement: () => {
        return videoRef.current;
      },
    }));

    // Handle double tap detection
    const handleClick = (_e: React.MouseEvent) => {
      const now = Date.now();
      const timeDiff = now - lastTapRef.current;

      if (timeDiff < 300 && timeDiff > 0) {
        // Double tap detected
        onDoubleClick?.();
      } else {
        // Single tap
        onClick?.();
      }

      lastTapRef.current = now;
    };

    // Handle video events
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        onTimeUpdate?.(videoRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        onLoadedMetadata?.(videoRef.current.duration);
      }
    };

    const handlePlay = () => {
      onPlay?.();
    };

    const handlePause = () => {
      onPause?.();
    };

    const handleEnded = () => {
      onEnded?.();
    };

    const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      onError?.(e.nativeEvent);
    };

    const handleLoadStart = () => {
      onLoadStart?.();
    };

    const handleCanPlay = () => {
      onCanPlay?.();
    };

    const handleWaiting = () => {
      onWaiting?.();
    };

    // Optimize video for mobile
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Set video attributes for better mobile performance
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

      // Disable picture-in-picture
      if ('disablePictureInPicture' in video) {
        video.disablePictureInPicture = true;
      }

      // Prevent context menu
      const preventContextMenu = (e: Event) => e.preventDefault();
      video.addEventListener('contextmenu', preventContextMenu);

      return () => {
        video.removeEventListener('contextmenu', preventContextMenu);
      };
    }, []);

    // Handle autoplay with user gesture requirement
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !autoPlay) return;

      const attemptAutoplay = async () => {
        try {
          await video.play();
        } catch (error) {
          // Autoplay failed, likely due to browser policy
          console.warn('Autoplay failed:', error);
        }
      };

      // Small delay to ensure video is ready
      const timer = setTimeout(attemptAutoplay, 100);

      return () => clearTimeout(timer);
    }, [autoPlay, src]);

    return (
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={muted}
        loop={loop}
        controls={controls}
        preload={preload}
        playsInline
        className={cn(
          'w-full h-full object-cover',
          'focus:outline-none',
          'select-none',
          className
        )}
        onClick={handleClick}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        style={{
          WebkitTapHighlightColor: 'transparent',
        }}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
