'use client';

import React, { useEffect, useRef } from 'react';
import type { VideoReelWithDetails } from '@/types';
import { VideoPlayer, VideoPlayerRef } from './video-player';
import { CelebrityInfo } from './celebrity-info';

interface ReelItemProps {
  reel: VideoReelWithDetails;
  isActive: boolean;
  autoPlay?: boolean;
  onVideoEnd: () => void;
  preloadNext?: boolean;
  preloadPrev?: boolean;
}

export function ReelItem({
  reel,
  isActive,
  autoPlay = true,
  onVideoEnd,
  preloadNext = false,
  preloadPrev = false,
}: ReelItemProps) {
  const videoRef = useRef<VideoPlayerRef>(null);
  const hasVideoUrl = Boolean(reel.videoUrl);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {!hasVideoUrl ? (
        <div className="relative h-full w-full bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden flex items-center justify-center">
          <div className="text-center text-white p-8">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-xl font-bold mb-2">{reel.title}</h3>
            <p className="text-gray-300 mb-4">Video not available</p>
            <p className="text-sm text-gray-400">Celebrity: {reel.celebrity?.name}</p>
          </div>
        </div>
      ) : (
        <>
          <VideoPlayer
            ref={videoRef}
            src={reel.videoUrl}
            poster={reel.thumbnailUrl}
            autoPlay={isActive && autoPlay}
            muted={false}
            loop={false}
            controls={true}
            onEnded={onVideoEnd}
            className="absolute inset-0 w-full h-full object-cover"
            preload={preloadNext || preloadPrev ? 'metadata' : 'none'}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </>
      )}
      <div className="absolute inset-0 flex">
        <div className="flex-1 flex flex-col justify-end p-4 pb-20">
          <CelebrityInfo celebrity={reel.celebrity} />
          <div className="mt-4">
            <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">{reel.title}</h3>
            <p className="text-white/80 text-sm line-clamp-3 mb-3">{reel.description}</p>
            {reel.tags && reel.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reel.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="text-white/70 text-sm">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
