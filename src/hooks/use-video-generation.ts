import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

import type { Celebrity, VoiceType } from '@/types';

export interface VideoGenerationRequest {
  celebrityId: string;
  duration: number;
  voiceType?: VoiceType;
  voiceRegion?: 'US' | 'UK' | 'AU';
  customPrompt?: string;
  imageUrls?: string[];
  style?: 'documentary' | 'energetic' | 'inspirational' | 'highlight';
  quality?: '720p' | '1080p';
  includeSubtitles?: boolean;
  priority?: number;
  useQueue?: boolean;
}

export interface VideoGenerationProgress {
  stage: 'script' | 'speech' | 'images' | 'video' | 'upload' | 'complete' | 'error';
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export interface VideoGenerationResult {
  jobId: string;
  videoUrl: string;
  thumbnailUrl: string;
  audioUrl: string;
  script: string;
  title: string;
  description: string;
  hashtags: string[];
  metadata: {
    duration: number;
    resolution: string;
    fileSize: number;
    generationTime: number;
    costs: {
      openai: number;
      polly: number;
      storage: number;
      total: number;
    };
  };
}

export interface UseVideoGenerationOptions {
  onProgress?: (progress: VideoGenerationProgress) => void;
  onSuccess?: (result: VideoGenerationResult) => void;
  onError?: (error: string) => void;
  pollInterval?: number;
  maxPollTime?: number;
}

export interface UseVideoGenerationReturn {
  generateVideo: (request: VideoGenerationRequest) => Promise<VideoGenerationResult | null>;
  cancelGeneration: () => Promise<void>;
  isGenerating: boolean;
  progress: VideoGenerationProgress | null;
  error: string | null;
  result: VideoGenerationResult | null;
  jobId: string | null;
  reset: () => void;
}

export function useVideoGeneration(options: UseVideoGenerationOptions = {}): UseVideoGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<VideoGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoGenerationResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const {
    onProgress,
    onSuccess,
    onError,
    pollInterval = 2000,
    maxPollTime = 300000, // 5 minutes
  } = options;

  const pollTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress(null);
    setError(null);
    setResult(null);
    setJobId(null);
    
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const pollJobStatus = useCallback(async (
    currentJobId: string,
    startTime: number
  ): Promise<VideoGenerationResult | null> => {
    try {
      const response = await axios.get(`/api/generate/status?jobId=${currentJobId}`, {
        signal: abortControllerRef.current?.signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get job status');
      }

      const jobData = response.data.data;

      // Update progress if available
      if (jobData.progress) {
        setProgress(jobData.progress);
        onProgress?.(jobData.progress);
      }

      // Check if job is complete
      if (jobData.status === 'completed') {
        const completedResult: VideoGenerationResult = {
          jobId: currentJobId,
          videoUrl: jobData.videoUrl,
          thumbnailUrl: jobData.thumbnailUrl || '',
          audioUrl: jobData.audioUrl || '',
          script: jobData.script || '',
          title: jobData.title || '',
          description: jobData.description || '',
          hashtags: jobData.hashtags || [],
          metadata: jobData.metadata || {
            duration: 0,
            resolution: '1080p',
            fileSize: 0,
            generationTime: 0,
            costs: { openai: 0, polly: 0, storage: 0, total: 0 },
          },
        };

        setResult(completedResult);
        setIsGenerating(false);
        onSuccess?.(completedResult);
        return completedResult;
      }

      // Check if job failed
      if (jobData.status === 'failed') {
        const errorMessage = jobData.error || 'Video generation failed';
        setError(errorMessage);
        setIsGenerating(false);
        onError?.(errorMessage);
        return null;
      }

      // Check timeout
      if (Date.now() - startTime > maxPollTime) {
        throw new Error('Video generation timed out');
      }

      // Continue polling
      pollTimeoutRef.current = setTimeout(() => {
        pollJobStatus(currentJobId, startTime);
      }, pollInterval);

      return null;
    } catch (err) {
      if (axios.isCancel(err)) {
        return null; // Request was cancelled
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to check job status';
      setError(errorMessage);
      setIsGenerating(false);
      onError?.(errorMessage);
      return null;
    }
  }, [onProgress, onSuccess, onError, pollInterval, maxPollTime]);

  const generateVideo = useCallback(async (
    request: VideoGenerationRequest
  ): Promise<VideoGenerationResult | null> => {
    try {
      setIsGenerating(true);
      setError(null);
      setProgress(null);
      setResult(null);
      setJobId(null);

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Start generation
      const response = await axios.post('/api/generate', request, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Video generation failed');
      }

      const responseData = response.data.data;
      const currentJobId = responseData.jobId;
      setJobId(currentJobId);

      // If processing immediately (not queued)
      if (responseData.status === 'completed') {
        const immediateResult: VideoGenerationResult = {
          jobId: currentJobId,
          videoUrl: responseData.videoUrl,
          thumbnailUrl: responseData.thumbnailUrl,
          audioUrl: responseData.audioUrl,
          script: responseData.script,
          title: responseData.title,
          description: responseData.description,
          hashtags: responseData.hashtags,
          metadata: responseData.metadata,
        };

        setResult(immediateResult);
        setIsGenerating(false);
        onSuccess?.(immediateResult);
        return immediateResult;
      }

      // Start polling for queued job
      const startTime = Date.now();
      return await pollJobStatus(currentJobId, startTime);
    } catch (err) {
      if (axios.isCancel(err)) {
        return null; // Request was cancelled
      }

      const errorMessage = err instanceof Error ? err.message : 'Video generation failed';
      setError(errorMessage);
      setIsGenerating(false);
      onError?.(errorMessage);
      return null;
    }
  }, [pollJobStatus, onSuccess, onError]);

  const cancelGeneration = useCallback(async () => {
    try {
      // Abort current requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear polling timeout
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }

      // Cancel job on server if we have a job ID
      if (jobId) {
        await axios.delete(`/api/generate?jobId=${jobId}`);
      }

      reset();
    } catch (error) {
      console.warn('Failed to cancel generation:', error);
      // Still reset local state even if server cancellation fails
      reset();
    }
  }, [jobId, reset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    generateVideo,
    cancelGeneration,
    isGenerating,
    progress,
    error,
    result,
    jobId,
    reset,
  };
}

// Hook for managing multiple video generations
export function useMultipleVideoGeneration() {
  const [generations, setGenerations] = useState<Map<string, {
    request: VideoGenerationRequest;
    isGenerating: boolean;
    progress: VideoGenerationProgress | null;
    error: string | null;
    result: VideoGenerationResult | null;
    jobId: string | null;
  }>>(new Map());

  const addGeneration = useCallback((id: string, request: VideoGenerationRequest) => {
    setGenerations(prev => new Map(prev.set(id, {
      request,
      isGenerating: false,
      progress: null,
      error: null,
      result: null,
      jobId: null,
    })));
    return id;
  }, []);

  const removeGeneration = useCallback((id: string) => {
    setGenerations(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const updateGeneration = useCallback((id: string, updates: Partial<{
    isGenerating: boolean;
    progress: VideoGenerationProgress | null;
    error: string | null;
    result: VideoGenerationResult | null;
    jobId: string | null;
  }>) => {
    setGenerations(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;
      
      return new Map(prev.set(id, { ...existing, ...updates }));
    });
  }, []);

  const startGeneration = useCallback(async (id: string): Promise<VideoGenerationResult | null> => {
    const generation = generations.get(id);
    if (!generation) return null;

    updateGeneration(id, { isGenerating: true, error: null });

    try {
      const response = await axios.post('/api/generate', generation.request);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Video generation failed');
      }

      const jobId = response.data.data.jobId;
      updateGeneration(id, { jobId });

      // Start polling (simplified - in real implementation, use the full polling logic)
      return null; // Would return result when complete
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      updateGeneration(id, { isGenerating: false, error: errorMessage });
      return null;
    }
  }, [generations, updateGeneration]);

  return {
    generations: Array.from(generations.entries()).map(([id, gen]) => ({ id, ...gen })),
    addGeneration,
    removeGeneration,
    updateGeneration,
    startGeneration,
    isAnyGenerating: Array.from(generations.values()).some(gen => gen.isGenerating),
  };
}
