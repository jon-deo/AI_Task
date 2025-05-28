'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Celebrity {
  id: string;
  name: string;
  sport: string;
}

export default function CreateReel() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [formData, setFormData] = useState({
    celebrity: '',
    duration: 30,
    voiceType: 'MALE_NARRATOR',
    quality: '1080p',
    includeSubtitles: true
  });

  // Fetch celebrities on component mount
  useEffect(() => {
    const fetchCelebrities = async () => {
      try {
        const response = await fetch('/api/celebrities');
        const data = await response.json();
        if (data.success) {
          setCelebrities(data.data.items || []);
        }
      } catch (error) {
        console.error('Error fetching celebrities:', error);
      }
    };

    fetchCelebrities();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/reels/${data.id}`);
      } else {
        alert('Failed to generate reel: ' + data.error);
      }
    } catch (error) {
      alert('Error generating reel');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Create New Reel</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Celebrity
            </label>
            <select
              value={formData.celebrity}
              onChange={(e) => setFormData({ ...formData, celebrity: e.target.value })}
              className="w-full p-2 border rounded-lg"
              required
            >
              <option value="">Select a celebrity</option>
              {celebrities.map((celebrity) => (
                <option key={celebrity.id} value={celebrity.name}>
                  {celebrity.name} ({celebrity.sport})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Duration (seconds)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              className="w-full p-2 border rounded-lg"
              min="15"
              max="60"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Voice Type
            </label>
            <select
              value={formData.voiceType}
              onChange={(e) => setFormData({ ...formData, voiceType: e.target.value })}
              className="w-full p-2 border rounded-lg"
            >
              <option value="MALE_NARRATOR">Male Narrator</option>
              <option value="FEMALE_NARRATOR">Female Narrator</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Quality
            </label>
            <select
              value={formData.quality}
              onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
              className="w-full p-2 border rounded-lg"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.includeSubtitles}
              onChange={(e) => setFormData({ ...formData, includeSubtitles: e.target.checked })}
              className="mr-2"
            />
            <label className="text-sm font-medium">
              Include Subtitles
            </label>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isGenerating ? 'Generating...' : 'Generate Reel'}
          </button>
        </form>
      </div>
    </main>
  );
} 