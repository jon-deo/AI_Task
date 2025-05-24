'use client';

import React from 'react';

// Fallback motion component
const motion = {
  div: ({ children, className, animate, transition, ...props }: any) =>
    <div className={className} {...props}>{children}</div>
};

interface ReelsLoadingProps {
  variant?: 'full' | 'inline' | 'skeleton';
  count?: number;
}

export function ReelsLoading({ variant = 'full', count = 3 }: ReelsLoadingProps) {
  if (variant === 'skeleton') {
    return (
      <div className="h-full bg-black">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="h-full relative">
            {/* Video skeleton */}
            <div className="absolute inset-0 bg-gray-800 animate-pulse" />

            {/* Content skeleton */}
            <div className="absolute inset-0 flex">
              {/* Left side content */}
              <div className="flex-1 flex flex-col justify-end p-4 pb-20">
                {/* Celebrity info skeleton */}
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-700 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded animate-pulse mb-2" />
                    <div className="h-3 bg-gray-700 rounded animate-pulse w-2/3" />
                  </div>
                </div>

                {/* Title skeleton */}
                <div className="space-y-2 mb-3">
                  <div className="h-5 bg-gray-700 rounded animate-pulse" />
                  <div className="h-5 bg-gray-700 rounded animate-pulse w-4/5" />
                </div>

                {/* Description skeleton */}
                <div className="space-y-2 mb-3">
                  <div className="h-4 bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2" />
                </div>

                {/* Tags skeleton */}
                <div className="flex space-x-2">
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-16" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-20" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-14" />
                </div>
              </div>

              {/* Right side actions */}
              <div className="flex flex-col justify-end items-center p-4 pb-20 space-y-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center space-y-1">
                    <div className="w-12 h-12 rounded-full bg-gray-700 animate-pulse" />
                    <div className="h-3 bg-gray-700 rounded animate-pulse w-8" />
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar skeleton */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex space-x-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <motion.div
              key={index}
              className="w-2 h-2 bg-white rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: index * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Full screen loading
  return (
    <div className="h-full bg-black flex items-center justify-center">
      <div className="text-center">
        {/* Animated logo or spinner */}
        <motion.div
          className="relative w-16 h-16 mx-auto mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute inset-0 border-4 border-white/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full" />
        </motion.div>

        {/* Loading text */}
        <motion.div
          className="text-white text-lg font-medium mb-2"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading Reels
        </motion.div>

        {/* Subtitle */}
        <p className="text-white/60 text-sm">
          Preparing amazing sports content...
        </p>

        {/* Animated dots */}
        <div className="flex justify-center space-x-1 mt-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <motion.div
              key={index}
              className="w-2 h-2 bg-white/40 rounded-full"
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: index * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
