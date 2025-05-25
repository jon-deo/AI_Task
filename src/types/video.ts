export interface Video {
  id: string;
  title: string;
  description: string;
  s3Url: string;
  metadata: {
    celebrity: string;
    script: string;
    status: 'PROCESSING' | 'READY' | 'FAILED';
  };
  createdAt: string;
  updatedAt: string;
} 