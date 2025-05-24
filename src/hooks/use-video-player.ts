'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVideoPlayerOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onError?: (error: string) => void;
}

interface UseVideoPlayerReturn {
  // State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loading: boolean;
  error: string | null;
  buffered: number;
  
  // Controls
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  
  // Refs
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function useVideoPlayer(options: UseVideoPlayerOptions = {}): UseVideoPlayerReturn {
  const { onPlay, onPause, onEnded, onTimeUpdate, onError } = options;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(true); // Start muted for autoplay
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);

  // Play video
  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      setError(null);
      await video.play();
      setIsPlaying(true);
      onPlay?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to play video';
      setError(errorMessage);
      onError?.(errorMessage);
      setIsPlaying(false);
    }
  }, [onPlay, onError]);

  // Pause video
  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  // Seek to specific time
  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  // Set volume
  const setVolume = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    video.volume = clampedVolume;
    setVolumeState(clampedVolume);
    
    // Unmute if volume is set above 0
    if (clampedVolume > 0 && muted) {
      video.muted = false;
      setMuted(false);
    }
  }, [muted]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !muted;
    video.muted = newMuted;
    setMuted(newMuted);
  }, [muted]);

  // Event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setError(null);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    const handleError = () => {
      const errorMessage = 'Video failed to load';
      setError(errorMessage);
      setLoading(false);
      setIsPlaying(false);
      onError?.(errorMessage);
    };

    const handleLoadStart = () => {
      setLoading(true);
      setError(null);
    };

    const handleCanPlay = () => {
      setLoading(false);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / video.duration) * 100;
        setBuffered(bufferedPercent);
      }
    };

    const handleVolumeChange = () => {
      setVolumeState(video.volume);
      setMuted(video.muted);
    };

    // Add event listeners
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [onTimeUpdate, onEnded, onError]);

  return {
    // State
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    loading,
    error,
    buffered,
    
    // Controls
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    
    // Refs
    videoRef,
  };
}
