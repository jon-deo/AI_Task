'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense, memo } from 'react';
import { Video } from '@/types/video';
import { useReels } from '@/hooks/use-reels';
import { useInView } from 'react-intersection-observer';
import { VideoReel, Celebrity } from '@prisma/client';

// Use simple reel item to avoid hooks issues
import { SimpleReelItem as ReelItem } from './simple-reel-item';

const ReelsLoading = React.lazy(() =>
  import('./reels-loading').then(module => ({ default: module.ReelsLoading })).catch(() => ({
    default: () => <div className="h-full bg-black flex items-center justify-center text-white">Loading...</div>
  }))
);

// Performance-optimized fallback components with memoization
const MotionDiv = ({ children, className, ...props }: any) =>
  <div className={className} {...props}>{children}</div>;

const motion = {
  div: MotionDiv
};

const AnimatePresence = ({ children }: any) => <>{children}</>;

// Cache management
const useVideoCache = () => {
  const cache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedData = (key: string) => {
    const cached = cache.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  };

  const setCachedData = (key: string, data: any) => {
    cache.current.set(key, { data, timestamp: Date.now() });
  };

  return { getCachedData, setCachedData };
};

interface ReelsContainerProps {
  initialReels?: (VideoReel & { celebrity: Celebrity | null })[];
  autoPlay?: boolean;
  enableInfiniteScroll?: boolean;
  onGenerate: (celebrity: string) => Promise<any>;
  isGenerating: boolean;
}

// Optimized for high traffic with memoization and performance improvements
export const ReelsContainer = memo(function ReelsContainer({
  initialReels = [],
  autoPlay = true,
  enableInfiniteScroll = true,
  onGenerate,
  isGenerating,
}: ReelsContainerProps) {
  // Initialize all state with safe default values
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number>();
  const { getCachedData, setCachedData } = useVideoCache();
  const [loadedReels, setLoadedReels] = useState<Set<string>>(new Set());
  const [videos, setVideos] = useState<Video[]>([]);

  // Destructure with safe defaults
  const {
    reels: fetchedReels = [],
    loading = false,
    error = null,
    hasMore = false,
    loadMore = () => { },
    refresh = () => { },
  } = useReels({
    initialData: initialReels || [],
    autoLoad: true,
  });

  // Ensure reels is always an array
  const reels = Array.isArray(fetchedReels) ? fetchedReels : [];

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px',
  });

  // Preload adjacent videos with safe checks
  const preloadAdjacentVideos = useCallback((currentIndex: number) => {
    if (!Array.isArray(reels) || reels.length === 0) return;

    const preloadIndexes = [currentIndex - 1, currentIndex + 1];
    preloadIndexes.forEach(index => {
      if (index >= 0 && index < reels.length) {
        const reel = reels[index];
        if (reel?.id && !loadedReels.has(reel.id) && reel.thumbnailUrl) {
          const video = new Image();
          video.src = reel.thumbnailUrl;
          setLoadedReels(prev => new Set([...prev, reel.id]));
        }
      }
    });
  }, [reels, loadedReels]);

  // Memoize visible reels with safe checks
  const visibleReels = useMemo(() => {
    if (!Array.isArray(reels) || reels.length === 0) return [];

    const start = Math.max(0, currentIndex - 1);
    const end = Math.min(reels.length, currentIndex + 3);
    return reels.slice(start, end).map(reel => {
      if (!reel?.id) return null;
      const cachedData = getCachedData(reel.id);
      return cachedData ? { ...reel, ...cachedData } : reel;
    }).filter(Boolean);
  }, [reels, currentIndex, getCachedData]);

  // Handle scroll detection to update current index
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !Array.isArray(reels) || reels.length === 0) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / containerHeight);

      // Update current index if it changed
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < reels.length) {
        console.log('Scroll detected - changing from index', currentIndex, 'to', newIndex);
        setCurrentIndex(newIndex);
      }

      // Handle scrolling state
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentIndex, reels]);

  // Preload adjacent videos
  useEffect(() => {
    preloadAdjacentVideos(currentIndex);
  }, [currentIndex, preloadAdjacentVideos]);

  // Load more reels when reaching the end
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

  // Debug log for reels
  useEffect(() => {
    console.log('Current reels:', reels);
    console.log('Visible reels:', visibleReels);
    console.log('Current index:', currentIndex);
  }, [reels, visibleReels, currentIndex]);

  // Handle keyboard navigation with safe checks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current || !Array.isArray(reels) || reels.length === 0) return;

      const container = containerRef.current;
      const reelHeight = container.clientHeight;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            setCurrentIndex(newIndex);
            container.scrollTo({
              top: newIndex * reelHeight,
              behavior: 'smooth',
            });
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < reels.length - 1) {
            const newIndex = currentIndex + 1;
            setCurrentIndex(newIndex);
            container.scrollTo({
              top: newIndex * reelHeight,
              behavior: 'smooth',
            });
          }
          break;
        case ' ':
          e.preventDefault();
          // Toggle play/pause for current reel
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, reels]);

  // Handle video end with safe checks
  const handleVideoEnd = useCallback(() => {
    if (!Array.isArray(reels) || reels.length === 0) return;

    if (currentIndex < reels.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      if (containerRef.current) {
        const reelHeight = containerRef.current.clientHeight;
        containerRef.current.scrollTo({
          top: newIndex * reelHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [currentIndex, reels]);

  // Handle generate video with safe checks
  const handleGenerateVideo = async (celebrity: string) => {
    if (!celebrity || !onGenerate) return;

    try {
      const video = await onGenerate(celebrity);
      if (video) {
        setVideos(prev => [video, ...prev]);
      }
    } catch (error) {
      console.error('Error generating video:', error);
    }
  };

  // Check states for conditional rendering
  const showEmptyState = !loading && reels.length === 0;
  const showErrorState = error && (!Array.isArray(reels) || reels.length === 0);

  return (
    <div className="relative h-screen bg-black overflow-hidden">
      {showEmptyState ? (
        // Empty state
        <div className="h-screen bg-black flex items-center justify-center text-white">
          <div className="text-center p-8">
            <div className="text-8xl mb-6">🎬</div>
            <h2 className="text-2xl font-bold mb-4">No Videos Available</h2>
            <p className="text-gray-400 mb-6">There are no video reels to display yet.</p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Refresh Page
              </button>
              {typeof onGenerate === 'function' && (
                <button
                  onClick={() => handleGenerateVideo('Michael Jordan')}
                  disabled={isGenerating}
                  className="block w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  {isGenerating ? 'Generating...' : 'Generate Sample Video'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Try running: npm run create:test-reels
            </p>
          </div>
        </div>
      ) : showErrorState ? (
        // Error state
        <div className="flex h-full items-center justify-center bg-black text-white">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        // Main content
        <>
          {/* Main reels container */}
          <div
            ref={containerRef}
            className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide reel-container"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* Optimized rendering - only render visible reels for performance */}
            <AnimatePresence mode="wait">
              {Array.isArray(reels) && reels.map((reel, index) => {
                if (!reel?.id) return null;

                // Only render reels that are visible or adjacent for performance
                const isVisible = Math.abs(index - currentIndex) <= 2;

                if (!isVisible) {
                  return (
                    <div
                      key={reel.id}
                      className="h-full snap-start snap-always reel-item bg-black"
                    />
                  );
                }

                return (
                  <motion.div
                    key={reel.id}
                    className="h-full snap-start snap-always reel-item"
                  >
                    <ReelItem
                      reel={reel}
                      isActive={index === currentIndex && !isScrolling}
                      autoPlay={autoPlay}
                      onVideoEnd={handleVideoEnd}
                      preloadNext={index === currentIndex + 1}
                      preloadPrev={index === currentIndex - 1}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Loading indicator for infinite scroll */}
            {enableInfiniteScroll && hasMore && !loading && (
              <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
                <ReelsLoading />
              </div>
            )}

            {/* End of content indicator */}
            {enableInfiniteScroll && !hasMore && reels.length > 0 && (
              <div className="h-20 flex items-center justify-center">
                <div className="text-white/60 text-sm text-center">
                  <div className="text-2xl mb-2">🎬</div>
                  <div>You've reached the end!</div>
                  <div className="text-xs mt-1">No more reels to load</div>
                </div>
              </div>
            )}
          </div>

          {/* Scroll indicators */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10">
            <div className="flex flex-col space-y-2">
              {Array.isArray(reels) && reels.slice(0, 5).map((_, index) => (
                <div
                  key={index}
                  className={`w-1 h-8 rounded-full transition-all duration-300 ${index === currentIndex
                    ? 'bg-white'
                    : 'bg-white/30'
                    }`}
                />
              ))}
              {Array.isArray(reels) && reels.length > 5 && (
                <div className="text-white/60 text-xs text-center mt-2">
                  {currentIndex + 1}/{reels.length}
                </div>
              )}
            </div>
          </div>

          {/* Loading overlay */}
          {loading && (!Array.isArray(reels) || reels.length === 0) && (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-20">
              <ReelsLoading />
            </div>
          )}
        </>
      )}
    </div>
  );
});
