'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ReelData {
  id: string;
  title: string;
  videoUrl: string;
  celebrity: string;
  duration: number;
  likes: number;
  shares: number;
}

export default function ReelView() {
  const params = useParams();
  const [reel, setReel] = useState<ReelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReel = async () => {
      try {
        const response = await fetch(`/api/reels/${params.id}`);
        const data = await response.json();
        setReel(data);
      } catch (error) {
        console.error('Error fetching reel:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReel();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!reel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">Reel not found</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto p-4">
        <div className="aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden relative">
          <video
            src={reel.videoUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            loop
          />
        </div>

        <div className="mt-4 space-y-4">
          <h1 className="text-2xl font-bold">{reel.title}</h1>
          <p className="text-gray-400">{reel.celebrity}</p>

          <div className="flex space-x-4">
            <button className="flex items-center space-x-2">
              <span>❤️</span>
              <span>{reel.likes}</span>
            </button>
            <button className="flex items-center space-x-2">
              <span>🔄</span>
              <span>{reel.shares}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
} 