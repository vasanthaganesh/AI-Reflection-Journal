'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Trash2, Volume2 } from 'lucide-react';

interface AudioNotePlayerProps {
  audioUrl: string;
  duration?: number;
  onRemove?: () => void;
  className?: string;
}

export const AudioNotePlayer: React.FC<AudioNotePlayerProps> = ({
  audioUrl,
  duration = 0,
  onRemove,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = Math.floor(sec % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#F6F5FA] border border-[#212121]/10 shadow-2xs select-none ${className}`}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-7 h-7 rounded-full bg-[#212121] text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer shrink-0 shadow-2xs"
        title={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
      </button>

      {/* Mini Waveform Bars */}
      <div className="flex items-center gap-0.5 h-4 px-1">
        {[40, 75, 55, 90, 60, 80, 45].map((height, idx) => (
          <div
            key={idx}
            className={`w-0.5 rounded-full bg-[#212121] transition-all duration-200 ${
              isPlaying ? 'animate-pulse' : 'opacity-40'
            }`}
            style={{
              height: isPlaying ? `${height}%` : '40%',
              animationDelay: `${idx * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* Duration */}
      <span className="text-[11px] font-semibold text-[#212121]/70 tracking-tight font-mono">
        {isPlaying ? formatSeconds(currentTime) : formatSeconds(duration || currentTime)}
      </span>

      {/* Remove Audio Button */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors cursor-pointer"
          title="Delete voice note"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
