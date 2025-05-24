// Base error interface for external services (used for type checking)
export interface ExternalServiceError extends Error {
  retryable?: boolean;
  code?: string;
  statusCode?: number;
}

// Base error class for the application
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public retryable: boolean = false,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, false, context);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', context?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 429, true, context);
    this.name = 'RateLimitError';
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 'RESOURCE_NOT_FOUND', 404, false, { resource, id });
    this.name = 'ResourceNotFoundError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, context?: Record<string, any>) {
    super(`${service} service is currently unavailable`, 'SERVICE_UNAVAILABLE', 503, true, context);
    this.name = 'ServiceUnavailableError';
  }
}

export class GenerationError extends AppError {
  constructor(
    stage: string,
    message: string,
    retryable: boolean = true,
    context?: Record<string, any>
  ) {
    super(`Generation failed at ${stage}: ${message}`, 'GENERATION_ERROR', 500, retryable, {
      stage,
      ...context,
    });
    this.name = 'GenerationError';
  }
}

export class QueueError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'QUEUE_ERROR', 500, false, context);
    this.name = 'QueueError';
  }
}

// Error classification and handling
export interface ErrorClassification {
  type: 'user' | 'system' | 'external' | 'temporary';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  userMessage: string;
  logLevel: 'info' | 'warn' | 'error' | 'fatal';
}

export function classifyError(error: Error): ErrorClassification {
  // Handle known error types
  if (error instanceof ValidationError) {
    return {
      type: 'user',
      severity: 'low',
      retryable: false,
      userMessage: error.message,
      logLevel: 'info',
    };
  }

  if (error instanceof ResourceNotFoundError) {
    return {
      type: 'user',
      severity: 'low',
      retryable: false,
      userMessage: error.message,
      logLevel: 'info',
    };
  }

  if (error instanceof RateLimitError) {
    return {
      type: 'temporary',
      severity: 'medium',
      retryable: true,
      userMessage: 'Too many requests. Please try again later.',
      logLevel: 'warn',
    };
  }

  // Handle external service errors by checking error name and properties
  if (error.name === 'OpenAIError' || error.message.includes('OpenAI')) {
    const retryable = (error as any).retryable || false;
    return {
      type: 'external',
      severity: retryable ? 'medium' : 'high',
      retryable,
      userMessage: retryable
        ? 'AI service is temporarily unavailable. Please try again.'
        : 'AI service error. Please contact support.',
      logLevel: retryable ? 'warn' : 'error',
    };
  }

  if (error.name === 'PollyError' || error.message.includes('Polly')) {
    const retryable = (error as any).retryable || false;
    return {
      type: 'external',
      severity: retryable ? 'medium' : 'high',
      retryable,
      userMessage: retryable
        ? 'Speech service is temporarily unavailable. Please try again.'
        : 'Speech service error. Please contact support.',
      logLevel: retryable ? 'warn' : 'error',
    };
  }

  if (error.name === 'AWSError' || error.message.includes('AWS') || error.message.includes('S3')) {
    const retryable = (error as any).retryable || false;
    return {
      type: 'external',
      severity: retryable ? 'medium' : 'high',
      retryable,
      userMessage: retryable
        ? 'Storage service is temporarily unavailable. Please try again.'
        : 'Storage service error. Please contact support.',
      logLevel: retryable ? 'warn' : 'error',
    };
  }

  if (error instanceof ServiceUnavailableError) {
    return {
      type: 'external',
      severity: 'high',
      retryable: true,
      userMessage: 'Service is temporarily unavailable. Please try again later.',
      logLevel: 'error',
    };
  }

  if (error instanceof GenerationError) {
    return {
      type: 'system',
      severity: 'medium',
      retryable: error.retryable,
      userMessage: error.retryable
        ? 'Video generation failed. Please try again.'
        : 'Video generation error. Please contact support.',
      logLevel: 'error',
    };
  }

  if (error instanceof QueueError) {
    return {
      type: 'system',
      severity: 'medium',
      retryable: false,
      userMessage: 'Queue processing error. Please try again.',
      logLevel: 'error',
    };
  }

  // Handle generic errors
  if (error.message.includes('timeout')) {
    return {
      type: 'temporary',
      severity: 'medium',
      retryable: true,
      userMessage: 'Request timed out. Please try again.',
      logLevel: 'warn',
    };
  }

  if (error.message.includes('network') || error.message.includes('connection')) {
    return {
      type: 'temporary',
      severity: 'medium',
      retryable: true,
      userMessage: 'Network error. Please check your connection and try again.',
      logLevel: 'warn',
    };
  }

  // Default classification for unknown errors
  return {
    type: 'system',
    severity: 'high',
    retryable: false,
    userMessage: 'An unexpected error occurred. Please try again or contact support.',
    logLevel: 'error',
  };
}

// Error logging utility
export interface ErrorLogEntry {
  timestamp: string;
  error: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  classification: ErrorClassification;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
}

export function logError(
  error: Error,
  context?: Record<string, any>,
  userId?: string,
  requestId?: string,
  userAgent?: string,
  ip?: string
): ErrorLogEntry {
  const classification = classifyError(error);

  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      ...(((error as any).code) && { code: (error as any).code }),
      ...(error.stack && { stack: error.stack }),
    },
    classification,
    ...(context && { context }),
    ...(userId && { userId }),
    ...(requestId && { requestId }),
    ...(userAgent && { userAgent }),
    ...(ip && { ip }),
  };

  // Log to console (in production, send to logging service)
  const logMessage = `[${classification.logLevel.toUpperCase()}] ${error.name}: ${error.message}`;

  switch (classification.logLevel) {
    case 'info':
      console.info(logMessage, logEntry);
      break;
    case 'warn':
      console.warn(logMessage, logEntry);
      break;
    case 'error':
      console.error(logMessage, logEntry);
      break;
    case 'fatal':
      console.error(`[FATAL] ${logMessage}`, logEntry);
      break;
  }

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // sendToMonitoringService(logEntry);
  }

  return logEntry;
}

// Retry utility with exponential backoff
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    baseDelay,
    maxDelay,
    backoffMultiplier,
    retryCondition = (error) => classifyError(error).retryable,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxAttempts || !retryCondition(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;

      console.warn(`Attempt ${attempt} failed, retrying in ${jitteredDelay}ms:`, lastError.message);

      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  throw lastError!;
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) { }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'half-open') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
    console.info('Circuit breaker reset to closed state');
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Global error handler for unhandled errors
export function setupGlobalErrorHandling(): void {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logError(error, { type: 'unhandledRejection', promise });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logError(error, { type: 'uncaughtException' });

    // In production, gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
      console.error('Uncaught exception, shutting down gracefully...');
      process.exit(1);
    }
  });
}
