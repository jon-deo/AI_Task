import { EventEmitter } from 'events';
import { Prisma, VoiceType } from '@prisma/client';

import { VideoGenerationService, type VideoGenerationRequest, type VideoGenerationProgress } from './video-generation';
import { prisma } from '@/lib/prisma';
import type { GenerationJob, GenerationStatus } from '@/types';

export interface QueueJob {
  id: string;
  request: VideoGenerationRequest;
  priority: number;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  progress?: VideoGenerationProgress;
  error?: string;
}

export interface QueueOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
  priorityLevels?: number;
  enableMetrics?: boolean;
}

export interface QueueMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  queuedJobs: number;
  averageProcessingTime: number;
  successRate: number;
}

export class VideoGenerationQueue extends EventEmitter {
  private jobs: Map<string, QueueJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private processing: boolean = false;
  private metrics: QueueMetrics = {
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    activeJobs: 0,
    queuedJobs: 0,
    averageProcessingTime: 0,
    successRate: 0,
  };

  constructor(private options: QueueOptions = {}) {
    super();
    this.options = {
      maxConcurrency: 3,
      maxRetries: 3,
      retryDelay: 5000,
      priorityLevels: 5,
      enableMetrics: true,
      ...options,
    };
  }

  /**
   * Add job to queue
   */
  async addJob(
    request: VideoGenerationRequest,
    priority: number = 3,
    options?: { delay?: number; maxAttempts?: number }
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    const job: QueueJob = {
      id: jobId,
      request,
      priority: Math.max(1, Math.min(priority, this.options.priorityLevels || 5)),
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: options?.maxAttempts || this.options.maxRetries || 3,
      delay: options?.delay,
    };

    this.jobs.set(jobId, job);
    this.updateMetrics();

    // Create database record
    await prisma.generationJob.create({
      data: {
        id: jobId,
        celebrityId: request.celebrity.id,
        status: 'PENDING',
        voiceType: request.voiceType || VoiceType.MALE_NARRATOR,
        duration: request.duration,
        quality: request.quality || '1080p',
        includeSubtitles: request.includeSubtitles ?? true,
      },
    });

    this.emit('jobAdded', job);

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return jobId;
  }

  /**
   * Remove job from queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Can't remove active jobs
    if (this.activeJobs.has(jobId)) {
      throw new Error('Cannot remove active job');
    }

    this.jobs.delete(jobId);
    this.updateMetrics();

    // Update database
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    this.emit('jobRemoved', job);
    return true;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(filter?: {
    status?: 'pending' | 'active' | 'completed' | 'failed';
    priority?: number;
    limit?: number;
  }): QueueJob[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter(job => {
        if (filter.status === 'active') return this.activeJobs.has(job.id);
        if (filter.status === 'pending') return !this.activeJobs.has(job.id) && !job.error;
        if (filter.status === 'failed') return !!job.error;
        if (filter.status === 'completed') return job.progress?.stage === 'complete';
        return true;
      });
    }

    if (filter?.priority) {
      jobs = jobs.filter(job => job.priority === filter.priority);
    }

    // Sort by priority (higher first) then by creation time
    jobs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    if (filter?.limit) {
      jobs = jobs.slice(0, filter.limit);
    }

    return jobs;
  }

  /**
   * Start queue processing
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    this.emit('processingStarted');

    while (this.processing) {
      const availableSlots = (this.options.maxConcurrency || 3) - this.activeJobs.size;

      if (availableSlots <= 0) {
        // Wait for active jobs to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Get next jobs to process
      const pendingJobs = this.getJobs({ status: 'pending', limit: availableSlots });

      if (pendingJobs.length === 0) {
        // No pending jobs, check if we should stop processing
        if (this.activeJobs.size === 0) {
          this.processing = false;
          this.emit('processingCompleted');
          break;
        }

        // Wait for active jobs
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Process jobs
      for (const job of pendingJobs) {
        if (this.activeJobs.size >= (this.options.maxConcurrency || 3)) {
          break;
        }

        // Check if job should be delayed
        if (job.delay && Date.now() - job.createdAt.getTime() < job.delay) {
          continue;
        }

        this.processJob(job);
      }

      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: QueueJob): Promise<void> {
    this.activeJobs.add(job.id);
    job.attempts++;
    this.updateMetrics();

    const startTime = Date.now();

    try {
      this.emit('jobStarted', job);

      // Update database status
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          progress: 0,
          error: null,
        },
      });

      // Process the video generation
      const result = await VideoGenerationService.generateVideo(
        job.request,
        (progress) => {
          job.progress = progress;
          this.emit('jobProgress', job, progress);
        }
      );

      // Job completed successfully
      this.jobs.delete(job.id);
      this.activeJobs.delete(job.id);
      this.metrics.completedJobs++;

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);
      this.updateMetrics();

      this.emit('jobCompleted', job, result);

    } catch (error) {
      this.activeJobs.delete(job.id);
      job.error = error instanceof Error ? error.message : 'Unknown error';

      // Check if we should retry
      if (job.attempts < job.maxAttempts) {
        // Schedule retry with exponential backoff
        job.delay = Math.pow(2, job.attempts) * (this.options.retryDelay || 5000);
        job.error = undefined; // Clear error for retry

        this.emit('jobRetry', job, error);

        // Update database
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'PENDING',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } else {
        // Job failed permanently
        this.jobs.delete(job.id);
        this.metrics.failedJobs++;
        this.updateMetrics();

        this.emit('jobFailed', job, error);

        // Update database
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            progress: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  /**
   * Stop queue processing
   */
  async stop(graceful: boolean = true): Promise<void> {
    this.processing = false;

    if (graceful) {
      // Wait for active jobs to complete
      while (this.activeJobs.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      // Force stop - mark active jobs as failed
      for (const jobId of this.activeJobs) {
        const job = this.jobs.get(jobId);
        if (job) {
          job.error = 'Queue stopped forcefully';
          this.emit('jobFailed', job, new Error('Queue stopped'));
        }
      }
      this.activeJobs.clear();
    }

    this.emit('queueStopped');
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.processing = false;
    this.emit('queuePaused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (!this.processing && this.jobs.size > 0) {
      this.startProcessing();
      this.emit('queueResumed');
    }
  }

  /**
   * Clear all jobs from queue
   */
  async clear(): Promise<void> {
    // Can't clear if there are active jobs
    if (this.activeJobs.size > 0) {
      throw new Error('Cannot clear queue with active jobs');
    }

    const jobIds = Array.from(this.jobs.keys());
    this.jobs.clear();
    this.updateMetrics();

    // Update database
    await prisma.generationJob.updateMany({
      where: { id: { in: jobIds } },
      data: { status: 'CANCELLED' },
    });

    this.emit('queueCleared');
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Update queue metrics
   */
  private updateMetrics(): void {
    this.metrics.totalJobs = this.metrics.completedJobs + this.metrics.failedJobs + this.jobs.size;
    this.metrics.activeJobs = this.activeJobs.size;
    this.metrics.queuedJobs = this.jobs.size - this.activeJobs.size;
    this.metrics.successRate = this.metrics.totalJobs > 0
      ? (this.metrics.completedJobs / this.metrics.totalJobs) * 100
      : 0;
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.metrics.completedJobs === 1) {
      this.metrics.averageProcessingTime = newTime;
    } else {
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime * (this.metrics.completedJobs - 1) + newTime) /
        this.metrics.completedJobs;
    }
  }

  /**
   * Get queue status
   */
  getStatus(): {
    processing: boolean;
    activeJobs: number;
    queuedJobs: number;
    totalJobs: number;
  } {
    return {
      processing: this.processing,
      activeJobs: this.activeJobs.size,
      queuedJobs: this.jobs.size - this.activeJobs.size,
      totalJobs: this.jobs.size,
    };
  }
}

// Global queue instance
export const videoGenerationQueue = new VideoGenerationQueue({
  maxConcurrency: 3,
  maxRetries: 3,
  retryDelay: 5000,
  enableMetrics: true,
});

// Queue event handlers for logging
videoGenerationQueue.on('jobAdded', (job) => {
  console.log(`Job added to queue: ${job.id}`);
});

videoGenerationQueue.on('jobStarted', (job) => {
  console.log(`Job started: ${job.id}`);
});

videoGenerationQueue.on('jobProgress', (job, progress) => {
  console.log(`Job progress: ${job.id} - ${progress.stage} (${progress.progress}%)`);
});

videoGenerationQueue.on('jobCompleted', (job, result) => {
  console.log(`Job completed: ${job.id} - Video: ${result.videoUrl}`);
});

videoGenerationQueue.on('jobFailed', (job, error) => {
  console.error(`Job failed: ${job.id} - Error: ${error}`);
});

videoGenerationQueue.on('jobRetry', (job, error) => {
  console.warn(`Job retry: ${job.id} - Attempt ${job.attempts} - Error: ${error}`);
});
