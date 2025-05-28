'use client';

import { useState, useEffect } from 'react';
import { ReelsContainer } from '@/components/reels/reels-container';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [initialReels, setInitialReels] = useState([]);

  // Fetch initial reels on mount
  useEffect(() => {
    fetch('/api/reels')
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          throw new Error(data.error || 'Failed to load reels');
        }
        // The reels are in data.data.data
        const reels = data.data?.data || [];
        console.log('Fetched reels:', reels); // Debug log
        setInitialReels(reels);
      })
      .catch(error => {
        console.error('Error fetching reels:', error);
        toast.error('Failed to load reels');
      });
  }, []);

  const handleGenerate = async (celebrity: string) => {
    try {
      setIsGenerating(true);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ celebrity }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate video');
      }

      const data = await response.json();
      toast.success('Video generated successfully!');
      return data;
    } catch (error) {
      console.error('Error generating video:', error);
      toast.error('Failed to generate video');
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen">
      <ReelsContainer
        initialReels={initialReels}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        autoPlay={true}
        enableInfiniteScroll={true}
      />
    </main>
  );
}
