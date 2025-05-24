'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';

import type { VideoReelWithDetails, ApiResponse, PaginationInfo } from '@/types';

interface UseReelsOptions {
  initialData?: VideoReelWithDetails[];
  autoLoad?: boolean;
  limit?: number;
  sport?: string;
  celebrityId?: string;
  featured?: boolean;
}

interface UseReelsReturn {
  reels: VideoReelWithDetails[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  pagination: PaginationInfo | null;
  loadMore: () => void;
  refresh: () => void;
  likeReel: (reelId: string) => Promise<void>;
  shareReel: (reelId: string) => Promise<void>;
  updateViews: (reelId: string) => Promise<void>;
}

const fetcher = async (url: string): Promise<ApiResponse<{ items: VideoReelWithDetails[]; pagination: PaginationInfo }>> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch reels');
  }
  return response.json();
};

export function useReels(options: UseReelsOptions = {}): UseReelsReturn {
  const {
    initialData = [],
    autoLoad = true,
    limit = 10,
    sport,
    celebrityId,
    featured,
  } = options;

  const [page, setPage] = useState(1);
  const [allReels, setAllReels] = useState<VideoReelWithDetails[]>(initialData);
  const [hasMore, setHasMore] = useState(true);

  // Build query parameters
  const buildQuery = useCallback((pageNum: number) => {
    const params = new URLSearchParams({
      page: pageNum.toString(),
      limit: limit.toString(),
    });

    if (sport) params.append('sport', sport);
    if (celebrityId) params.append('celebrityId', celebrityId);
    if (featured !== undefined) params.append('featured', featured.toString());

    return params.toString();
  }, [limit, sport, celebrityId, featured]);

  // SWR for data fetching
  const { data, error, isLoading, mutate } = useSWR(
    autoLoad ? `/api/reels?${buildQuery(page)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  // Update reels when data changes
  useEffect(() => {
    if (data?.success && data.data) {
      const newReels = data.data.items;
      const pagination = data.data.pagination;

      if (page === 1) {
        // First page - replace all reels
        setAllReels(newReels);
      } else {
        // Subsequent pages - append to existing reels
        setAllReels(prev => {
          const existingIds = new Set(prev.map(reel => reel.id));
          const uniqueNewReels = newReels.filter(reel => !existingIds.has(reel.id));
          return [...prev, ...uniqueNewReels];
        });
      }

      setHasMore(pagination.hasNext);
    }
  }, [data, page]);

  // Load more reels
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [isLoading, hasMore]);

  // Refresh reels
  const refresh = useCallback(() => {
    setPage(1);
    setAllReels([]);
    setHasMore(true);
    mutate();
  }, [mutate]);

  // Like a reel
  const likeReel = useCallback(async (reelId: string) => {
    try {
      const response = await fetch(`/api/reels/${reelId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to like reel');
      }

      // Optimistically update the reel
      setAllReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, likes: reel.likes + BigInt(1) }
          : reel
      ));

      // Revalidate data
      mutate();
    } catch (error) {
      console.error('Error liking reel:', error);
      throw error;
    }
  }, [mutate]);

  // Share a reel
  const shareReel = useCallback(async (reelId: string) => {
    try {
      const response = await fetch(`/api/reels/${reelId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'COPY_LINK',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to share reel');
      }

      // Optimistically update the reel
      setAllReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, shares: reel.shares + BigInt(1) }
          : reel
      ));

      // Revalidate data
      mutate();
    } catch (error) {
      console.error('Error sharing reel:', error);
      throw error;
    }
  }, [mutate]);

  // Update view count
  const updateViews = useCallback(async (reelId: string) => {
    try {
      const response = await fetch(`/api/reels/${reelId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          watchDuration: 5, // Minimum watch time to count as view
          completionRate: 50,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update view count');
      }

      // Optimistically update the reel
      setAllReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, views: reel.views + BigInt(1) }
          : reel
      ));
    } catch (error) {
      console.error('Error updating view count:', error);
      // Don't throw error for view tracking failures
    }
  }, []);

  return {
    reels: allReels,
    loading: isLoading,
    error: error?.message || null,
    hasMore,
    pagination: data?.data?.pagination || null,
    loadMore,
    refresh,
    likeReel,
    shareReel,
    updateViews,
  };
}
