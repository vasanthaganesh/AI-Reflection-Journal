'use client';

import React, { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageBallProps {
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showRemove?: boolean;
  onRemove?: () => void;
  className?: string;
  alt?: string;
}

const SIZE_MAP = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export const ImageBall: React.FC<ImageBallProps> = ({
  src,
  size = 'md',
  showRemove = false,
  onRemove,
  className = '',
  alt = 'Journal photo',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <div className={`relative inline-block select-none group ${className}`}>
        {/* Circular Marble Sphere with Photo */}
        <div
          onClick={() => setIsOpen(true)}
          className={`relative rounded-full overflow-hidden border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform ${SIZE_MAP[size]}`}
          title="Click to view full photo"
        >
          <img src={src} alt={alt} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Optional remove button */}
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -top-3 -right-3 min-w-[44px] min-h-[44px] flex items-center justify-center p-2 group/btn cursor-pointer z-10"
            title="Remove photo"
            aria-label="Remove photo"
          >
            <span className="w-5 h-5 rounded-full bg-[#212121] text-white flex items-center justify-center text-[10px] group-hover/btn:bg-black shadow-xs transition-transform group-hover/btn:scale-110">
              <X className="w-3 h-3" />
            </span>
          </button>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-3xl max-h-[85vh] bg-white p-2 rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#212121]/70 hover:bg-[#212121] text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={src}
                alt={alt}
                className="max-h-[80vh] w-auto object-contain rounded-2xl"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
