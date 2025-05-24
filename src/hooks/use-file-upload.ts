import { useState, useCallback } from 'react';
import axios, { AxiosProgressEvent } from 'axios';

import { validateFile } from '@/lib/aws-config';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  type: 'video' | 'image';
  video?: {
    key: string;
    url: string;
    cloudFrontUrl: string;
  };
  thumbnail?: {
    key: string;
    url: string;
    cloudFrontUrl: string;
  };
  image?: {
    key: string;
    url: string;
    cloudFrontUrl: string;
  };
  webp?: {
    key: string;
    url: string;
    cloudFrontUrl: string;
  };
  metadata?: {
    duration: number;
    resolution: string;
    bitrate: string;
    format: string;
    size: number;
  };
}

export interface UseFileUploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  maxFileSize?: number;
  allowedTypes?: string[];
  autoUpload?: boolean;
}

export interface UseFileUploadReturn {
  upload: (file: File) => Promise<UploadResult | null>;
  uploadWithPresignedUrl: (file: File) => Promise<UploadResult | null>;
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  result: UploadResult | null;
  reset: () => void;
  validateFile: (file: File) => { valid: boolean; error?: string };
}

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const {
    onProgress,
    onSuccess,
    onError,
    maxFileSize,
    allowedTypes,
  } = options;

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(null);
    setError(null);
    setResult(null);
  }, []);

  const validateFileInput = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (maxFileSize && file.size > maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`,
      };
    }

    // Check file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    // Use AWS validation
    const fileType = file.type.startsWith('video/') ? 'video' : 'image';
    return validateFile(
      { size: file.size, type: file.type, name: file.name },
      fileType
    );
  }, [maxFileSize, allowedTypes]);

  const handleProgress = useCallback((progressEvent: AxiosProgressEvent) => {
    if (progressEvent.total) {
      const progressData: UploadProgress = {
        loaded: progressEvent.loaded,
        total: progressEvent.total,
        percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
      };
      
      setProgress(progressData);
      onProgress?.(progressData);
    }
  }, [onProgress]);

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    try {
      setIsUploading(true);
      setError(null);
      setProgress(null);

      // Validate file
      const validation = validateFileInput(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload file
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: handleProgress,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Upload failed');
      }

      const uploadResult = response.data.data as UploadResult;
      setResult(uploadResult);
      onSuccess?.(uploadResult);
      
      return uploadResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [validateFileInput, handleProgress, onSuccess, onError]);

  const uploadWithPresignedUrl = useCallback(async (file: File): Promise<UploadResult | null> => {
    try {
      setIsUploading(true);
      setError(null);
      setProgress(null);

      // Validate file
      const validation = validateFileInput(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get presigned URL
      const folder = file.type.startsWith('video/') ? 'VIDEOS' : 'IMAGES';
      const presignedResponse = await axios.get('/api/upload/presigned', {
        params: {
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
          folder,
        },
      });

      if (!presignedResponse.data.success) {
        throw new Error(presignedResponse.data.error || 'Failed to get upload URL');
      }

      const { uploadUrl, key, fields } = presignedResponse.data.data;

      // Upload to S3 using presigned URL
      const formData = new FormData();
      
      // Add required fields
      Object.entries(fields).forEach(([fieldKey, value]) => {
        formData.append(fieldKey, value as string);
      });
      
      // Add file last
      formData.append('file', file);

      await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: handleProgress,
      });

      // Create result object
      const uploadResult: UploadResult = {
        type: file.type.startsWith('video/') ? 'video' : 'image',
        [file.type.startsWith('video/') ? 'video' : 'image']: {
          key,
          url: uploadUrl.split('?')[0], // Remove query parameters
          cloudFrontUrl: uploadUrl.split('?')[0], // Simplified
        },
      };

      setResult(uploadResult);
      onSuccess?.(uploadResult);
      
      return uploadResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [validateFileInput, handleProgress, onSuccess, onError]);

  return {
    upload,
    uploadWithPresignedUrl,
    isUploading,
    progress,
    error,
    result,
    reset,
    validateFile: validateFileInput,
  };
}

// Utility hook for multiple file uploads
export function useMultipleFileUpload(options: UseFileUploadOptions = {}) {
  const [uploads, setUploads] = useState<Map<string, {
    file: File;
    isUploading: boolean;
    progress: UploadProgress | null;
    error: string | null;
    result: UploadResult | null;
  }>>(new Map());

  const addUpload = useCallback((file: File) => {
    const id = `${file.name}-${Date.now()}`;
    setUploads(prev => new Map(prev.set(id, {
      file,
      isUploading: false,
      progress: null,
      error: null,
      result: null,
    })));
    return id;
  }, []);

  const removeUpload = useCallback((id: string) => {
    setUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const uploadFile = useCallback(async (id: string): Promise<UploadResult | null> => {
    const upload = uploads.get(id);
    if (!upload) return null;

    setUploads(prev => new Map(prev.set(id, {
      ...upload,
      isUploading: true,
      error: null,
    })));

    try {
      // Use the single file upload hook logic here
      const formData = new FormData();
      formData.append('file', upload.file);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress: UploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
            };
            
            setUploads(prev => new Map(prev.set(id, {
              ...prev.get(id)!,
              progress,
            })));
          }
        },
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Upload failed');
      }

      const result = response.data.data as UploadResult;
      
      setUploads(prev => new Map(prev.set(id, {
        ...prev.get(id)!,
        isUploading: false,
        result,
      })));

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      
      setUploads(prev => new Map(prev.set(id, {
        ...prev.get(id)!,
        isUploading: false,
        error: errorMessage,
      })));

      return null;
    }
  }, [uploads]);

  const uploadAll = useCallback(async (): Promise<UploadResult[]> => {
    const results = await Promise.all(
      Array.from(uploads.keys()).map(id => uploadFile(id))
    );
    
    return results.filter((result): result is UploadResult => result !== null);
  }, [uploads, uploadFile]);

  return {
    uploads: Array.from(uploads.entries()).map(([id, upload]) => ({ id, ...upload })),
    addUpload,
    removeUpload,
    uploadFile,
    uploadAll,
    isUploading: Array.from(uploads.values()).some(upload => upload.isUploading),
    totalProgress: Array.from(uploads.values()).reduce((acc, upload) => {
      if (upload.progress) {
        acc.loaded += upload.progress.loaded;
        acc.total += upload.progress.total;
      }
      return acc;
    }, { loaded: 0, total: 0 }),
  };
}
