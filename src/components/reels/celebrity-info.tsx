'use client';

import React from 'react';

// Fallback Image component
const Image = ({ src, alt, width, height, className }: any) =>
  <img src={src} alt={alt} width={width} height={height} className={className} />;

// Fallback components
const motion = {
  div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  button: ({ children, className, onClick, ...props }: any) =>
    <button className={className} onClick={onClick} {...props}>{children}</button>
};

// Fallback icons
const Verified = ({ className }: { className?: string }) => <div className={className}>✓</div>;

interface CelebrityInfoProps {
  celebrity: {
    id: string;
    name: string;
    slug: string;
    sport: string;
    imageUrl: string | null;
  };
  showFollowButton?: boolean;
  compact?: boolean;
}

export function CelebrityInfo({
  celebrity,
  showFollowButton = true,
  compact = false
}: CelebrityInfoProps) {
  const handleFollowClick = () => {
    // Handle follow/unfollow logic
    console.log('Follow clicked for:', celebrity.name);
  };

  const handleProfileClick = () => {
    // Navigate to celebrity profile
    window.open(`/celebrity/${celebrity.slug}`, '_blank');
  };

  if (compact) {
    return (
      <motion.div
        className="flex items-center space-x-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
            {celebrity.imageUrl ? (
              <Image
                src={celebrity.imageUrl}
                alt={celebrity.name}
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {celebrity.name.charAt(0)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1">
            <span className="text-white font-medium text-sm truncate">
              {celebrity.name}
            </span>
            <Verified className="w-3 h-3 text-blue-400 flex-shrink-0" />
          </div>
          <span className="text-white/60 text-xs">
            {celebrity.sport}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex items-center space-x-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Profile Image */}
      <motion.button
        onClick={handleProfileClick}
        className="relative group"
        whileTap={{ scale: 0.95 }}
      >
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 group-hover:border-white/50 transition-colors">
          {celebrity.imageUrl ? (
            <Image
              src={celebrity.imageUrl}
              alt={celebrity.name}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">
                {celebrity.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Online indicator */}
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-black rounded-full" />
      </motion.button>

      {/* Celebrity Info */}
      <div className="flex-1 min-w-0">
        <motion.button
          onClick={handleProfileClick}
          className="flex items-center space-x-1 group"
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-white font-semibold text-base truncate group-hover:text-white/80 transition-colors">
            {celebrity.name}
          </span>
          <Verified className="w-4 h-4 text-blue-400 flex-shrink-0" />
        </motion.button>

        <div className="flex items-center space-x-2 mt-1">
          <span className="text-white/70 text-sm font-medium">
            {celebrity.sport}
          </span>
          <span className="text-white/50 text-xs">•</span>
          <span className="text-white/50 text-xs">Sports Legend</span>
        </div>
      </div>

      {/* Follow Button */}
      {showFollowButton && (
        <motion.button
          onClick={handleFollowClick}
          className="px-4 py-1.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors"
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
        >
          Follow
        </motion.button>
      )}
    </motion.div>
  );
}
