'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, X, Plus, User, Settings } from 'lucide-react';

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Handle search logic
      console.log('Searching for:', searchQuery);
      setIsSearchOpen(false);
    }
  };

  return (
    <header className="relative z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <motion.div
          className="flex items-center space-x-2"
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SR</span>
          </div>
          <span className="text-white font-bold text-lg hidden sm:block">
            Sports Reels
          </span>
        </motion.div>

        {/* Center Navigation - Hidden on mobile */}
        <nav className="hidden md:flex items-center space-x-6">
          <motion.button
            className="text-white/80 hover:text-white transition-colors font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            For You
          </motion.button>
          <motion.button
            className="text-white/60 hover:text-white transition-colors font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Following
          </motion.button>
          <motion.button
            className="text-white/60 hover:text-white transition-colors font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Trending
          </motion.button>
          <motion.button
            className="text-white/60 hover:text-white transition-colors font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sports
          </motion.button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          {/* Search Button */}
          <motion.button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Search className="w-5 h-5" />
          </motion.button>

          {/* Create Button - Hidden on mobile */}
          <motion.button
            className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </motion.button>

          {/* Profile Button */}
          <motion.button
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <User className="w-5 h-5" />
          </motion.button>

          {/* Menu Button - Mobile only */}
          <motion.button
            onClick={() => setIsMenuOpen(true)}
            className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Menu className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            className="absolute inset-0 bg-black/95 backdrop-blur-md z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center px-4 py-3">
              <form onSubmit={handleSearch} className="flex-1 flex items-center space-x-3">
                <Search className="w-5 h-5 text-white/60" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search celebrities, sports, or content..."
                  className="flex-1 bg-transparent text-white placeholder-white/60 outline-none text-lg"
                  autoFocus
                />
              </form>
              <motion.button
                onClick={() => setIsSearchOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-2"
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Search Suggestions */}
            {searchQuery && (
              <motion.div
                className="px-4 py-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="space-y-2">
                  <div className="text-white/60 text-sm font-medium">Suggestions</div>
                  {['LeBron James', 'Serena Williams', 'Tom Brady', 'Lionel Messi'].map((suggestion) => (
                    <motion.button
                      key={suggestion}
                      onClick={() => {
                        setSearchQuery(suggestion);
                        handleSearch(new Event('submit') as any);
                      }}
                      className="block w-full text-left px-3 py-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                      whileHover={{ x: 4 }}
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="absolute inset-0 bg-black/95 backdrop-blur-md z-10 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-semibold">Menu</span>
              <motion.button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="p-4 space-y-4">
              {/* Navigation Links */}
              <div className="space-y-2">
                {['For You', 'Following', 'Trending', 'Sports'].map((item) => (
                  <motion.button
                    key={item}
                    className="block w-full text-left px-3 py-3 text-white hover:bg-white/10 rounded-lg transition-colors font-medium"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {item}
                  </motion.button>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 my-4" />

              {/* Action Buttons */}
              <div className="space-y-2">
                <motion.button
                  className="flex items-center space-x-3 w-full px-3 py-3 text-white hover:bg-white/10 rounded-lg transition-colors"
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-5 h-5" />
                  <span>Create Reel</span>
                </motion.button>
                <motion.button
                  className="flex items-center space-x-3 w-full px-3 py-3 text-white hover:bg-white/10 rounded-lg transition-colors"
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
