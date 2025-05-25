'use client';

import { useState } from 'react';
import { ReelsContainer } from '@/components/reels/reels-container';
import { toast } from 'react-hot-toast';

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);

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
    <main className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white mb-8">
          Sports Celebrity Reels
        </h1>
        <ReelsContainer onGenerate={handleGenerate} isGenerating={isGenerating} />
      </div>
    </main>
  );
}
