'use client';

import React, { useMemo } from 'react';
import { JournalEntry, Reminder, MoodType } from '@/lib/types';
import { GlowingMarble } from './GlowingMarble';
import { ImageBall } from './ImageBall';
import { formatFriendlyDateDDMMYYYY, formatDateDDMMYYYY, parseToDate } from '@/lib/utils';
import { 
  BookOpen, 
  Calendar as CalendarIcon, 
  Sparkles, 
  MapPin, 
  TrendingUp, 
  Plus, 
  ArrowUpRight, 
  Clock, 
  Flame, 
  Feather,
  ChevronRight,
  Headphones
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardHomeProps {
  userDisplayName?: string | null;
  entries: JournalEntry[];
  reminders: Reminder[];
  onNavigate: (view: 'journal' | 'calendar' | 'memories' | 'map' | 'analytics' | 'sanctuary') => void;
  onSelectEntry: (id: string) => void;
  onNewReflection: () => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  userDisplayName,
  entries,
  reminders,
  onNavigate,
  onSelectEntry,
  onNewReflection,
}) => {
  const name = userDisplayName || 'Reflective Traveler';
  const todayFriendly = formatFriendlyDateDDMMYYYY(new Date());

  const activeReminders = reminders.filter((r) => !r.completed);
  const geotaggedEntries = entries.filter((e) => e.location);
  const mediaMemories = entries.filter(
    (e) => (e.images && e.images.length > 0) || e.image || e.voiceNote
  );

  // Recent 3 entries
  const recentEntries = entries.slice(0, 3);

  // Calculate daily journaling streak and 7-day rhythm tracker
  const { streakCount, hasJournaledToday, weekDays } = useMemo(() => {
    if (!entries || entries.length === 0) {
      return { streakCount: 0, hasJournaledToday: false, weekDays: [] };
    }

    const dateSet = new Set<string>();
    entries.forEach((e) => {
      const d = parseToDate(e.createdAt || e.updatedAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dateSet.add(`${yyyy}-${mm}-${dd}`);
    });

    const now = new Date();
    const formatYMD = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayStr = formatYMD(now);
    const hasJournaledToday = dateSet.has(todayStr);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatYMD(yesterday);

    let streakCount = 0;
    let cursor = new Date(now);

    if (hasJournaledToday) {
      while (dateSet.has(formatYMD(cursor))) {
        streakCount++;
        cursor.setDate(cursor.getDate() - 1);
      }
    } else if (dateSet.has(yesterdayStr)) {
      cursor = new Date(yesterday);
      while (dateSet.has(formatYMD(cursor))) {
        streakCount++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const weekDays = [];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = formatYMD(d);
      weekDays.push({
        dateStr,
        label: dayNames[d.getDay()],
        active: dateSet.has(dateStr),
        isToday: i === 0,
      });
    }

    return { streakCount, hasJournaledToday, weekDays };
  }, [entries]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F6F5FA] p-6 sm:p-10 font-sans">
      <div className="max-w-6xl w-full mx-auto space-y-8 pb-12">
        {/* Welcome Banner with Compact Daily Streak Widget */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white p-6 sm:p-7 rounded-3xl border border-[#212121]/8 shadow-xs"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF0A3] text-[#212121] text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Central Sanctuary</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#212121]">
              Good day, {name}.
            </h1>
            <p className="text-xs sm:text-sm text-[#212121]/60 font-medium flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-[#212121]/50" />
              <span>{todayFriendly}</span>
              <span>•</span>
              <span>{entries.length} reflections recorded</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Compact Daily Streak Motivation Widget */}
            <div 
              onClick={() => onNavigate('journal')}
              className="px-4 py-2 rounded-2xl bg-[#F6F5FA] border border-[#212121]/8 hover:border-[#212121]/20 flex items-center gap-3 shadow-2xs transition-all cursor-pointer group"
              title="Daily journaling streak - click to reflect"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs shrink-0 relative group-hover:scale-105 transition-transform">
                <Flame className="w-5 h-5 fill-white" />
                {hasJournaledToday && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" title="Active today!" />
                )}
              </div>
              <div className="pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-[#212121]">
                    {streakCount} {streakCount === 1 ? 'Day' : 'Days'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-100/80 text-amber-800">
                    Streak
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#212121]/60">
                  {hasJournaledToday
                    ? '🔥 Active today'
                    : streakCount > 0
                    ? '⚡ Write today to continue'
                    : '🌱 Write today to start'}
                </p>
              </div>

              {/* Mini 7-Day Completion Rhythm */}
              <div className="hidden sm:flex items-center gap-1 pl-2.5 border-l border-[#212121]/10">
                {weekDays.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5" title={`${d.dateStr}: ${d.active ? 'Completed' : 'Missed'}`}>
                    <span className="text-[9px] font-bold text-[#212121]/40">{d.label}</span>
                    <div
                      className={`w-2 h-2 rounded-full transition-all ${
                        d.active
                          ? 'bg-amber-500 ring-2 ring-amber-200'
                          : d.isToday
                          ? 'bg-amber-200 ring-1 ring-amber-400'
                          : 'bg-[#212121]/12'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* New Reflection Button */}
            <button
              onClick={onNewReflection}
              className="h-11 px-5 rounded-full bg-[#212121] text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition-all flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Reflection</span>
            </button>
          </div>
        </motion.div>

        {/* Central Hub Navigation Cards with Smooth Motion */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50 block mb-3 px-1">
            Choose Your Destination
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Daily Journal Card (Vanilla #EFF0A3) */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => onNavigate('journal')}
              className="p-6 rounded-3xl bg-[#EFF0A3] border border-[#212121]/10 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#212121] text-white flex items-center justify-center shadow-xs">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white text-[#212121] flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shadow-2xs">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-[#212121] mb-1">
                  Journal & Reflections
                </h3>
                <p className="text-xs text-[#212121]/75 leading-relaxed font-medium mb-4">
                  Distraction-free canvas with real-time empathetic Gemini reflections, neural mood marbles, and multiple photos.
                </p>
              </div>

              <div className="pt-4 border-t border-[#212121]/10 flex items-center justify-between text-xs font-bold text-[#212121]">
                <span>{entries.length} {entries.length === 1 ? 'reflection stored' : 'reflections stored'}</span>
                <span className="underline group-hover:text-black">Open Studio →</span>
              </div>
            </motion.div>

            {/* 2. Calendar & Milestones (Honeydew #CFDECA) */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => onNavigate('calendar')}
              className="p-6 rounded-3xl bg-[#CFDECA] border border-[#212121]/10 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#212121] text-white flex items-center justify-center shadow-xs">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white text-[#212121] flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shadow-2xs">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-[#212121] mb-1">
                  Calendar & Reminders
                </h3>
                <p className="text-xs text-[#212121]/75 leading-relaxed font-medium mb-4">
                  Monthly interactive grid with photo previews on day cells, smart reminders, and daily inspectors.
                </p>
              </div>

              <div className="pt-4 border-t border-[#212121]/10 flex items-center justify-between text-xs font-bold text-[#212121]">
                <span className="px-2 py-0.5 rounded-full bg-white/70 text-[10px]">
                  {activeReminders.length} {activeReminders.length === 1 ? 'active task' : 'active tasks'}
                </span>
                <span className="underline group-hover:text-black">View Timeline →</span>
              </div>
            </motion.div>

            {/* 3. Memory Museum (Alice Blue #D8DFE9) */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => onNavigate('memories')}
              className="p-6 rounded-3xl bg-[#D8DFE9] border border-[#212121]/10 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#212121] text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white text-[#212121] flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shadow-2xs">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-[#212121] mb-1">
                  Memories Museum
                </h3>
                <p className="text-xs text-[#212121]/75 leading-relaxed font-medium mb-4">
                  Walk down memory lane with rich multi-filters (photos, audio, places, moods) and horizontal snap carousels.
                </p>
              </div>

              <div className="pt-4 border-t border-[#212121]/10 flex items-center justify-between text-xs font-bold text-[#212121]">
                <span>{mediaMemories.length} {mediaMemories.length === 1 ? 'rich memory' : 'rich memories'}</span>
                <span className="underline group-hover:text-black">Explore →</span>
              </div>
            </motion.div>
          </div>

          {/* Secondary 3 Cards: Companion Sanctuary, Interactive Map & Mindful Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Sanctuary Companion Card */}
            <motion.div
              whileHover={{ y: -3 }}
              onClick={() => onNavigate('sanctuary')}
              className="p-6 rounded-3xl bg-white border border-[#212121]/8 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 group relative overflow-hidden"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#212121] text-white flex items-center justify-center font-bold shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Headphones className="w-6 h-6 text-[#EFF0A3]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-[#212121] group-hover:text-black">
                    AI Companion Sanctuary
                  </h4>
                  <p className="text-xs text-[#212121]/60 font-medium">
                    Confide, decompress & reflect with Samantha, Marcus, or Alex
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="px-3 py-1 rounded-full bg-[#EFF0A3] text-xs font-bold text-[#212121] whitespace-nowrap shrink-0">
                  Voice
                </span>
                <div className="w-8 h-8 rounded-full bg-[#F6F5FA] group-hover:bg-[#212121] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>

            {/* Map Card */}
            <motion.div
              whileHover={{ y: -3 }}
              onClick={() => onNavigate('map')}
              className="p-6 rounded-3xl bg-white border border-[#212121]/8 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#CFDECA] text-[#212121] flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-[#212121] group-hover:text-black">
                    Interactive Map
                  </h4>
                  <p className="text-xs text-[#212121]/60 font-medium">
                    Explore geotagged journal reflections worldwide
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="px-3 py-1 rounded-full bg-[#F6F5FA] text-xs font-semibold text-[#212121] whitespace-nowrap shrink-0">
                  {geotaggedEntries.length === 1 ? '1 place' : `${geotaggedEntries.length} places`}
                </span>
                <div className="w-8 h-8 rounded-full bg-[#F6F5FA] group-hover:bg-[#212121] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>

            {/* Mindful Analytics Card */}
            <motion.div
              whileHover={{ y: -3 }}
              onClick={() => onNavigate('analytics')}
              className="p-6 rounded-3xl bg-white border border-[#212121]/8 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#EFF0A3] text-[#212121] flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-[#212121] group-hover:text-black">
                    Mindful Analytics
                  </h4>
                  <p className="text-xs text-[#212121]/60 font-medium">
                    Mood curve trends and recurring life themes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="px-3 py-1 rounded-full bg-[#F6F5FA] text-xs font-semibold text-[#212121] whitespace-nowrap shrink-0">
                  Insights
                </span>
                <div className="w-8 h-8 rounded-full bg-[#F6F5FA] group-hover:bg-[#212121] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Recent Reflections & Quick Jump */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#212121]/8 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                Quick Jump
              </span>
              <h3 className="text-lg font-bold text-[#212121]">
                Recent Reflections
              </h3>
            </div>

            <button
              onClick={() => onNavigate('journal')}
              className="text-xs font-bold text-[#212121] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentEntries.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#212121]/50 font-medium">
              No journal reflections yet. Click "New Reflection" to write your first entry.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentEntries.map((entry) => {
                const dateStr = formatDateDDMMYYYY(entry.createdAt || entry.updatedAt);
                const firstImg = (entry.images && entry.images.length > 0) ? entry.images[0] : entry.image;

                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      onSelectEntry(entry.id);
                      onNavigate('journal');
                    }}
                    className="p-4 rounded-2xl bg-[#F6F5FA] hover:bg-[#EFF0A3]/30 border border-[#212121]/5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <GlowingMarble mood={entry.mood || 'good'} size="sm" showLabel />
                        <span className="text-[10px] font-semibold text-[#212121]/40">
                          {dateStr}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#212121] group-hover:text-black truncate mb-1">
                        {entry.title || 'Untitled Reflection'}
                      </h4>

                      <p className="text-xs text-[#212121]/60 line-clamp-2">
                        {entry.content || (entry.messages.length > 0 ? entry.messages[0].content : 'No text')}
                      </p>
                    </div>

                    {firstImg && (
                      <div className="mt-3 w-8 h-8 rounded-lg overflow-hidden border border-white shadow-2xs">
                        <img src={firstImg} alt="Thumbnail" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
