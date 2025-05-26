"use client";
import { useEffect, useState } from "react";
import { ReelsContainer } from "@/components/reels/reels-container";

export default function ReelsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [initialReels, setInitialReels] = useState<any[]>([]);

  // Fetch initial reels on mount
  useEffect(() => {
    fetch("/api/reels")
      .then((res) => res.json())
      .then((data) => setInitialReels(data.reels || []));
  }, []);

  // Function to generate a new reel
  const onGenerate = async (celebrity: string) => {
    setIsGenerating(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ celebrity }),
    });
    const data = await res.json();
    setInitialReels((reels) => [data, ...reels]);
    setIsGenerating(false);
    return data;
  };

  return (
    <ReelsContainer
      initialReels={initialReels}
      onGenerate={onGenerate}
      isGenerating={isGenerating}
    />
  );
} 