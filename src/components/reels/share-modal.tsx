'use client';

import React, { useState } from 'react';

// Fallback components
const motion = {
  div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  button: ({ children, className, onClick, ...props }: any) =>
    <button className={className} onClick={onClick} {...props}>{children}</button>
};

const AnimatePresence = ({ children }: any) => <>{children}</>;

// Fallback icons
const X = ({ className }: { className?: string }) => <div className={className}>✕</div>;
const Copy = ({ className }: { className?: string }) => <div className={className}>📋</div>;
const Facebook = ({ className }: { className?: string }) => <div className={className}>📘</div>;
const Twitter = ({ className }: { className?: string }) => <div className={className}>🐦</div>;
const Instagram = ({ className }: { className?: string }) => <div className={className}>📷</div>;
const MessageCircle = ({ className }: { className?: string }) => <div className={className}>💬</div>;
const Mail = ({ className }: { className?: string }) => <div className={className}>📧</div>;
const Download = ({ className }: { className?: string }) => <div className={className}>⬇</div>;
const ExternalLink = ({ className }: { className?: string }) => <div className={className}>🔗</div>;

import type { VideoReelWithDetails } from '@/types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  reel: VideoReelWithDetails;
  onShare: (reelId: string) => Promise<void>;
}

interface ShareOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
}

export function ShareModal({ isOpen, onClose, reel, onShare }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/reel/${reel.id}`
    : `/reel/${reel.id}`;
  const shareText = `Check out this amazing ${reel.celebrity.sport} reel about ${reel.celebrity.name}! ${reel.title}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await onShare(reel.id);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const shareToSocial = async (_platform: string, url: string) => {
    setIsSharing(true);
    try {
      window.open(url, '_blank', 'width=600,height=400');
      await onShare(reel.id);
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const downloadVideo = async () => {
    try {
      const response = await fetch(reel.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reel.celebrity.name}-${reel.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      await onShare(reel.id);
    } catch (error) {
      console.error('Failed to download video:', error);
    }
  };

  const shareOptions: ShareOption[] = [
    {
      id: 'copy',
      name: 'Copy Link',
      icon: <Copy className="w-6 h-6" />,
      color: 'bg-gray-600',
      action: copyToClipboard,
    },
    {
      id: 'twitter',
      name: 'Twitter',
      icon: <Twitter className="w-6 h-6" />,
      color: 'bg-blue-500',
      action: () => shareToSocial('twitter',
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
      ),
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <Facebook className="w-6 h-6" />,
      color: 'bg-blue-600',
      action: () => shareToSocial('facebook',
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
      ),
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <Instagram className="w-6 h-6" />,
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      action: () => shareToSocial('instagram',
        `https://www.instagram.com/`
      ),
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: <MessageCircle className="w-6 h-6" />,
      color: 'bg-green-500',
      action: () => shareToSocial('whatsapp',
        `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`
      ),
    },
    {
      id: 'email',
      name: 'Email',
      icon: <Mail className="w-6 h-6" />,
      color: 'bg-red-500',
      action: () => shareToSocial('email',
        `mailto:?subject=${encodeURIComponent(reel.title)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`
      ),
    },
    {
      id: 'download',
      name: 'Download',
      icon: <Download className="w-6 h-6" />,
      color: 'bg-indigo-500',
      action: downloadVideo,
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
        <motion.div
          className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-8"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Share Reel</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Reel Preview */}
          <div className="flex items-center space-x-3 mb-6 p-3 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden">
              {reel.thumbnailUrl && (
                <img
                  src={reel.thumbnailUrl}
                  alt={reel.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{reel.title}</p>
              <p className="text-sm text-gray-500">{reel.celebrity.name}</p>
            </div>
          </div>

          {/* Share Options Grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {shareOptions.map((option) => (
              <motion.button
                key={option.id}
                onClick={option.action}
                className="flex flex-col items-center space-y-2 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                whileTap={{ scale: 0.95 }}
                disabled={isSharing}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${option.color}`}>
                  {option.icon}
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {option.name}
                </span>
              </motion.button>
            ))}
          </div>

          {/* URL Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Share Link</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600"
              />
              <motion.button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </motion.button>
            </div>
          </div>

          {/* Native Share (if supported) */}
          {navigator.share && (
            <motion.button
              onClick={async () => {
                try {
                  await navigator.share({
                    title: reel.title,
                    text: shareText,
                    url: shareUrl,
                  });
                  await onShare(reel.id);
                } catch (error) {
                  console.error('Native share failed:', error);
                }
              }}
              className="w-full mt-4 flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              <ExternalLink className="w-5 h-5" />
              <span>More Options</span>
            </motion.button>
          )}
        </motion.div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
