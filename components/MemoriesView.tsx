'use client';

import React, { useState, useMemo } from 'react';
import { JournalEntry, MoodType, MOOD_CONFIGS } from '@/lib/types';
import { GlowingMarble } from './GlowingMarble';
import { ImageBall } from './ImageBall';
import { AudioNotePlayer } from './AudioNotePlayer';
import { formatDateDDMMYYYY, parseToDate } from '@/lib/utils';
import { 
  Sparkles, 
  MapPin, 
  ArrowUpRight, 
  Calendar, 
  Feather, 
  Mic, 
  Image as ImageIcon,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type MemoryTimeFilter = 'all' | 'today' | 'week' | 'month' | 'year';
type MemoryMediaFilter = 'all' | 'photos' | 'audio' | 'location';

interface MemoriesViewProps {
  entries: JournalEntry[];
  onSelectEntry: (id: string) => void;
  onNewEntry: () => void;
}

export const MemoriesView: React.FC<MemoriesViewProps> = ({
  entries,
  onSelectEntry,
  onNewEntry,
}) => {
  const [timeFilter, setTimeFilter] = useState<MemoryTimeFilter>('all');
  const [mediaFilter, setMediaFilter] = useState<MemoryMediaFilter>('all');
  const [moodFilter, setMoodFilter] = useState<MoodType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Filter & prioritize memories
  const filteredMemories = useMemo(() => {
    return entries.filter((entry) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = entry.title?.toLowerCase().includes(q);
        const matchesContent = entry.content?.toLowerCase().includes(q);
        const matchesLocation = entry.location?.name?.toLowerCase().includes(q);
        const matchesSections = entry.sections?.some(
          (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesContent && !matchesLocation && !matchesSections) {
          return false;
        }
      }

      // Time filter
      if (timeFilter !== 'all') {
        const d = parseToDate(entry.createdAt || entry.updatedAt);
        const now = new Date();
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);

        if (timeFilter === 'today' && diffDays > 1) return false;
        if (timeFilter === 'week' && diffDays > 7) return false;
        if (timeFilter === 'month' && diffDays > 30) return false;
        if (timeFilter === 'year' && diffDays > 365) return false;
      }

      // Media filter
      const hasImages = Boolean(
        (entry.images && entry.images.length > 0) || entry.image
      );
      if (mediaFilter === 'photos' && !hasImages) return false;
      if (mediaFilter === 'audio' && !entry.voiceNote) return false;
      if (mediaFilter === 'location' && !entry.location) return false;

      // Mood filter (checks entry mood or any section mood)
      if (moodFilter !== 'all') {
        const entryMoodMatches = entry.mood === moodFilter;
        const sectionMoodMatches = entry.sections?.some((s) => s.mood === moodFilter);
        if (!entryMoodMatches && !sectionMoodMatches) return false;
      }

      return true;
    }).sort((a, b) => {
      const aScore = ((a.images?.length || (a.image ? 1 : 0)) * 2) + (a.voiceNote ? 2 : 0) + (a.location ? 1 : 0);
      const bScore = ((b.images?.length || (b.image ? 1 : 0)) * 2) + (b.voiceNote ? 2 : 0) + (b.location ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;

      const aTime = parseToDate(a.createdAt || a.updatedAt).getTime();
      const bTime = parseToDate(b.createdAt || b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [entries, searchQuery, timeFilter, mediaFilter, moodFilter]);

  const activeFiltersCount = 
    (timeFilter !== 'all' ? 1 : 0) + 
    (mediaFilter !== 'all' ? 1 : 0) + 
    (moodFilter !== 'all' ? 1 : 0) + 
    (searchQuery.trim() ? 1 : 0);

  const clearAllFilters = () => {
    setTimeFilter('all');
    setMediaFilter('all');
    setMoodFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F6F5FA] p-6 sm:p-10">
      <div className="max-w-7xl w-full mx-auto flex flex-col h-full">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF0A3] text-[#212121] text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Immersive Retrospective</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#212121]">
              Walk Down Memory Lane
            </h2>
            <p className="text-xs sm:text-sm text-[#212121]/60 font-medium mt-1">
              Curated snapshots of your past thoughts, photos, audio notes, and emotional landscapes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-full bg-white border border-[#212121]/10 text-xs font-bold text-[#212121] shadow-2xs">
              {filteredMemories.length} Memories Showing
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-3xl border border-[#212121]/5 shadow-xs mb-6 shrink-0 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#212121]/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories by keyword, place, or note..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-[#F6F5FA] rounded-full border border-transparent focus:border-[#212121]/20 outline-none text-[#212121]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Time Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-[#F6F5FA] rounded-full border border-[#212121]/5 text-xs shrink-0">
              {(
                [
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                  { id: 'year', label: 'Past Year' },
                ] as { id: MemoryTimeFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTimeFilter(tab.id)}
                  className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                    timeFilter === tab.id
                      ? 'bg-[#212121] text-white shadow-2xs'
                      : 'text-[#212121]/60 hover:text-[#212121] hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filter Toggle Button for Media & Mood */}
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`px-4 py-2 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                isFilterPanelOpen || activeFiltersCount > 0
                  ? 'bg-[#EFF0A3] border-[#212121] text-[#212121]'
                  : 'bg-white border-[#212121]/15 text-[#212121] hover:bg-[#F6F5FA]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#212121] text-white text-[9px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Expanded Secondary Filters (Media & Mood) */}
          <AnimatePresence>
            {isFilterPanelOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 border-t border-[#212121]/5 flex flex-wrap items-center justify-between gap-4 overflow-hidden"
              >
                {/* Media Type Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                    Media:
                  </span>
                  <div className="flex items-center gap-1 p-0.5 bg-[#F6F5FA] rounded-full border border-[#212121]/5 text-xs">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'photos', label: 'Photos Only' },
                        { id: 'audio', label: 'Audio Only' },
                        { id: 'location', label: 'Geotagged' },
                      ] as { id: MemoryMediaFilter; label: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMediaFilter(m.id)}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                          mediaFilter === m.id
                            ? 'bg-[#212121] text-white shadow-2xs'
                            : 'text-[#212121]/60 hover:text-[#212121]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood Marble Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                    Mood:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setMoodFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        moodFilter === 'all'
                          ? 'bg-[#212121] text-white'
                          : 'bg-[#F6F5FA] text-[#212121]/60 hover:text-[#212121]'
                      }`}
                    >
                      All Moods
                    </button>
                    {(['neutral', 'great', 'good', 'low', 'rough', 'disturbing', 'professional'] as MoodType[]).map(
                      (m) => (
                        <button
                          key={m}
                          onClick={() => setMoodFilter(m)}
                          className={`p-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                            moodFilter === m
                              ? 'ring-2 ring-[#212121] bg-white shadow-xs px-2'
                              : 'hover:opacity-80'
                          }`}
                          title={MOOD_CONFIGS[m].label}
                        >
                          <GlowingMarble mood={m} size="sm" />
                          {moodFilter === m && (
                            <span className="text-[10px] font-bold text-[#212121] capitalize">
                              {MOOD_CONFIGS[m].label}
                            </span>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Clear Button */}
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer ml-auto"
                  >
                    Reset Filters
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredMemories.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-[#212121]/5 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-[#CFDECA] flex items-center justify-center mb-4">
              <Feather className="w-8 h-8 text-[#212121]" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">No Matching Memories</h3>
            <p className="text-xs text-[#212121]/60 max-w-sm mb-6">
              {activeFiltersCount > 0
                ? 'Try clearing some filters or searching for different keywords to uncover memories.'
                : 'Start journaling your daily reflections with photos, voice notes, and places to build your memory museum.'}
            </p>
            {activeFiltersCount > 0 ? (
              <button
                onClick={clearAllFilters}
                className="px-6 py-2.5 rounded-full bg-[#212121] text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            ) : (
              <button
                onClick={onNewEntry}
                className="px-6 py-2.5 rounded-full bg-[#212121] text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer"
              >
                Capture First Memory
              </button>
            )}
          </div>
        ) : (
          /* Horizontal Snap Carousel */
          <div className="flex-1 overflow-x-auto snap-x snap-mandatory flex gap-6 pb-6 no-scrollbar items-stretch">
            {filteredMemories.map((entry, idx) => {
              const dateStr = formatDateDDMMYYYY(entry.createdAt || entry.updatedAt);
              const allImages = entry.images && entry.images.length > 0
                ? entry.images
                : entry.image ? [entry.image] : [];

              // Collect section moods
              const entryMoods: MoodType[] = [];
              if (entry.sections && entry.sections.length > 0) {
                entry.sections.forEach((s) => {
                  if (s.mood && !entryMoods.includes(s.mood)) {
                    entryMoods.push(s.mood);
                  }
                });
              }
              if (entryMoods.length === 0) {
                entryMoods.push(entry.mood || 'good');
              }

              return (
                <motion.div
                  key={entry.id}
                  layoutId={`memory-card-${entry.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    layout: { type: 'spring', damping: 28, stiffness: 240 },
                    opacity: { duration: 0.25, delay: idx * 0.03 },
                    y: { duration: 0.25, delay: idx * 0.03 },
                  }}
                  onClick={() => onSelectEntry(entry.id)}
                  className="snap-center shrink-0 w-84 sm:w-96 bg-white rounded-3xl p-6 sm:p-7 border border-[#212121]/8 shadow-sm hover:shadow-xl hover:border-[#212121]/25 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative group cursor-pointer select-none overflow-hidden"
                >
                  <div>
                    {/* Top Row: Mood Marbles + Images Ball */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {entryMoods.map((m, mIdx) => (
                          <GlowingMarble key={mIdx} mood={m} size="md" />
                        ))}
                        <span className="text-[11px] font-bold text-[#212121] capitalize ml-1">
                          {MOOD_CONFIGS[entryMoods[0]].label}
                          {entryMoods.length > 1 ? ` +${entryMoods.length - 1}` : ''}
                        </span>
                      </div>

                      {/* Primary Image Ball Avatar */}
                      {allImages.length > 0 && (
                        <div>
                          <ImageBall src={allImages[0]} size="md" />
                        </div>
                      )}
                    </div>

                    {/* Date Pill & Location */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="px-2.5 py-1 rounded-full bg-[#F6F5FA] text-[10px] font-bold text-[#212121]/60 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{dateStr}</span>
                      </span>

                      {entry.location && (
                        <span className="px-2.5 py-1 rounded-full bg-[#D8DFE9] text-[10px] font-bold text-[#212121] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[130px]">{entry.location.name}</span>
                        </span>
                      )}

                      {entry.voiceNote && (
                        <span className="px-2.5 py-1 rounded-full bg-[#CFDECA] text-[10px] font-bold text-[#212121] flex items-center gap-1">
                          <Mic className="w-3 h-3" />
                          <span>Audio</span>
                        </span>
                      )}
                    </div>

                    {/* Entry Title */}
                    <h3 className="text-xl font-bold tracking-tight text-[#212121] mb-3 leading-snug line-clamp-2">
                      {entry.title || 'Untitled Reflection'}
                    </h3>

                    {/* Photo Gallery preview (if more than 1 image) */}
                    {allImages.length > 1 && (
                      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar py-1">
                        {allImages.map((imgSrc, imgIdx) => (
                          <div key={imgIdx} className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white shadow-2xs">
                            <ImageBall src={imgSrc} size="sm" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Voice Note Player if present */}
                    {entry.voiceNote && (
                      <div className="mb-4">
                        <AudioNotePlayer
                          audioUrl={entry.voiceNote.audioUrl}
                          duration={entry.voiceNote.duration}
                        />
                      </div>
                    )}

                    {/* Content Snippet */}
                    <p className="text-xs text-[#212121]/70 leading-relaxed line-clamp-4 font-medium mb-4">
                      {entry.content || (entry.messages.length > 0 ? entry.messages[0].content : 'No written notes recorded.')}
                    </p>

                    {/* AI Reflection Quote Card */}
                    {entry.aiReflection && (
                      <div className="bg-[#EFF0A3]/50 p-3.5 rounded-2xl border border-[#212121]/5 mb-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#212121] mb-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Gemini Insight</span>
                        </div>
                        <p className="text-xs italic text-[#212121]/80 font-serif leading-relaxed line-clamp-2">
                          &ldquo;{entry.aiReflection}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer Action Button */}
                  <div className="pt-4 border-t border-[#212121]/5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#212121]/40">
                      {allImages.length > 0 ? `${allImages.length} photos • ` : ''}
                      {entry.sections && entry.sections.length > 0 ? `${entry.sections.length} sections` : `${entry.messages.length} interactions`}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntry(entry.id);
                      }}
                      className="px-4 py-1.5 rounded-full bg-[#212121] text-white text-xs font-semibold group-hover:bg-black transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>Open Memory</span>
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
