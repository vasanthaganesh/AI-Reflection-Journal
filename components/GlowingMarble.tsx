'use client';

import React from 'react';
import { MoodType, MOOD_CONFIGS } from '@/lib/types';
import { motion } from 'motion/react';

interface GlowingMarbleProps {
  mood?: MoodType | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  interactive?: boolean;
  isListening?: boolean;
  onClick?: () => void;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

const GLOW_SIZE_MAP = {
  xs: '10px',
  sm: '14px',
  md: '18px',
  lg: '24px',
  xl: '32px',
};

export const GlowingMarble: React.FC<GlowingMarbleProps> = ({
  mood = 'neutral',
  size = 'md',
  showLabel = false,
  interactive = false,
  isListening = false,
  onClick,
  className = '',
}) => {
  const config = mood && MOOD_CONFIGS[mood] ? MOOD_CONFIGS[mood] : MOOD_CONFIGS.neutral;
  const isNeutral = mood === 'neutral';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 select-none ${
        interactive ? 'cursor-pointer group' : ''
      } ${className}`}
      title={`${config.label}: ${config.description}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Ambient Outer Halo Glow */}
        <motion.div
          animate={
            isListening || isNeutral
              ? { scale: [1, 1.25, 1], opacity: [0.65, 0.95, 0.65] }
              : {}
          }
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute rounded-full blur-xs transition-all duration-300 ${
            interactive ? 'group-hover:opacity-100 group-hover:scale-125' : ''
          }`}
          style={{
            backgroundColor: isNeutral ? '#ffffff' : config.color,
            boxShadow: isNeutral
              ? `0 0 16px 4px rgba(255, 255, 255, 0.85), 0 0 8px 1px rgba(200, 225, 255, 0.6)`
              : `0 0 14px 2px ${config.shadow}`,
            width: GLOW_SIZE_MAP[size],
            height: GLOW_SIZE_MAP[size],
          }}
        />

        {/* 3D Glass Marble Sphere */}
        <motion.div
          whileHover={interactive ? { scale: 1.15 } : {}}
          whileTap={interactive ? { scale: 0.95 } : {}}
          className={`relative rounded-full shadow-inner border border-white/50 overflow-hidden ${SIZE_MAP[size]}`}
          style={{
            background: isNeutral
              ? 'radial-gradient(circle at 35% 30%, #ffffff 0%, #f1f5f9 45%, #cbd5e1 100%)'
              : config.gradient,
            boxShadow: isNeutral
              ? `inset -2px -2px 4px rgba(148, 163, 184, 0.4), inset 2px 2px 5px rgba(255, 255, 255, 0.95), 0 2px 8px rgba(0, 0, 0, 0.08)`
              : `inset -2px -2px 5px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.7), 0 2px 6px ${config.shadow}`,
          }}
        >
          {/* Specular White Highlight Glint */}
          <div className="absolute top-[12%] left-[18%] w-[38%] h-[32%] bg-white/90 rounded-full blur-[0.4px] rotate-[-25deg]" />
          <div className="absolute bottom-[10%] right-[18%] w-[25%] h-[20%] bg-white/30 rounded-full blur-[0.6px]" />

          {/* Opalescent iridescent shimmer for neural white marble */}
          {isNeutral && (
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-tr from-cyan-200/25 via-pink-200/20 to-amber-100/25 pointer-events-none rounded-full"
            />
          )}
        </motion.div>
      </div>

      {showLabel && (
        <span className="text-xs font-semibold text-[#212121] tracking-tight capitalize">
          {config.label}
        </span>
      )}
    </div>
  );
};
