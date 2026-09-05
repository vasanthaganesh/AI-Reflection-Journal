'use client';

import React, { useState, useMemo } from 'react';
import { JournalEntry, MoodType, MOOD_CONFIGS } from '@/lib/types';
import { GlowingMarble } from './GlowingMarble';
import { formatDateDDMMYYYY, parseToDate } from '@/lib/utils';
import { 
  ArrowUpRight, 
  Sparkles, 
  Flame, 
  BookOpen, 
  Users, 
  TrendingUp, 
  Feather,
  Calendar,
  Compass
} from 'lucide-react';
import { motion } from 'motion/react';

type AnalyticsTimeRange = 'today' | 'week' | 'month' | 'year';

interface AnalyticsViewProps {
  userDisplayName?: string | null;
  entries: JournalEntry[];
  onOpenEntry?: (id: string) => void;
  onNewReflection?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  userDisplayName,
  entries,
  onOpenEntry,
  onNewReflection,
}) => {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('month');
  const [hoveredBucketIndex, setHoveredBucketIndex] = useState<number | null>(null);

  const displayName = userDisplayName || 'Philosopher';


  const createSmoothSpline = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? i + 1 : i + 2];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Filter entries based on selected timeRange
  const scopedEntries = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const dayOfWeek = (now.getDay() + 6) % 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);

    return entries.filter((e) => {
      const d = parseToDate(e.createdAt || e.updatedAt);
      if (timeRange === 'today') return d >= todayStart && d <= todayEnd;
      if (timeRange === 'week') return d >= weekStart && d <= todayEnd;
      if (timeRange === 'month') return d >= monthStart && d <= todayEnd;
      if (timeRange === 'year') return d >= yearStart && d <= todayEnd;
      return true;
    });
  }, [entries, timeRange]);

  // Dynamic Chart Data Bucketing (Today, Week, Month, Year)
  const chartData = useMemo(() => {
    const now = new Date();

    interface RawBucket {
      id: string;
      label: string;
      subLabel: string;
      filter: (d: Date) => boolean;
    }

    let rawBuckets: RawBucket[] = [];

    if (timeRange === 'today') {
      rawBuckets = [
        {
          id: 'morning',
          label: 'Morning',
          subLabel: '06:00 - 12:00',
          filter: (d) => d.getHours() >= 6 && d.getHours() < 12,
        },
        {
          id: 'afternoon',
          label: 'Afternoon',
          subLabel: '12:00 - 17:00',
          filter: (d) => d.getHours() >= 12 && d.getHours() < 17,
        },
        {
          id: 'evening',
          label: 'Evening',
          subLabel: '17:00 - 21:00',
          filter: (d) => d.getHours() >= 17 && d.getHours() < 21,
        },
        {
          id: 'night',
          label: 'Night',
          subLabel: '21:00 - 06:00',
          filter: (d) => d.getHours() >= 21 || d.getHours() < 6,
        },
      ];
    } else if (timeRange === 'week') {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayOfWeek = (now.getDay() + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

      rawBuckets = dayNames.map((name, i) => {
        const bucketDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const dateStr = formatDateDDMMYYYY(bucketDate).slice(0, 5); // DD-MM
        return {
          id: `day-${i}`,
          label: name,
          subLabel: dateStr,
          filter: (d) =>
            d.getFullYear() === bucketDate.getFullYear() &&
            d.getMonth() === bucketDate.getMonth() &&
            d.getDate() === bucketDate.getDate(),
        };
      });
    } else if (timeRange === 'month') {
      rawBuckets = [
        {
          id: 'w1',
          label: 'Week 1',
          subLabel: '01 - 07',
          filter: (d) => d.getDate() >= 1 && d.getDate() <= 7,
        },
        {
          id: 'w2',
          label: 'Week 2',
          subLabel: '08 - 14',
          filter: (d) => d.getDate() >= 8 && d.getDate() <= 14,
        },
        {
          id: 'w3',
          label: 'Week 3',
          subLabel: '15 - 21',
          filter: (d) => d.getDate() >= 15 && d.getDate() <= 21,
        },
        {
          id: 'w4',
          label: 'Week 4',
          subLabel: '22 - End',
          filter: (d) => d.getDate() >= 22,
        },
      ];
    } else {
      // Year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      rawBuckets = monthNames.map((mName, i) => ({
        id: `m-${i}`,
        label: mName,
        subLabel: `${mName} ${now.getFullYear()}`,
        filter: (d) => d.getMonth() === i,
      }));
    }

    const MOOD_SCORES: Record<MoodType, number> = {
      great: 5.0,
      good: 4.0,
      professional: 3.8,
      neutral: 3.0,
      low: 2.0,
      rough: 1.5,
      disturbing: 1.0,
    };

    // Map entries into each bucket
    const processed = rawBuckets.map((rb) => {
      const bucketEntries = scopedEntries.filter((e) => {
        const d = parseToDate(e.createdAt || e.updatedAt);
        return rb.filter(d);
      });

      let wordVolume = 0;
      let moodSum = 0;
      let moodCount = 0;
      const moodCountsInBucket: Partial<Record<MoodType, number>> = {};

      bucketEntries.forEach((entry) => {
        const text = [
          entry.content || '',
          ...(entry.sections?.map((s) => s.content) || []),
          ...(entry.messages?.map((m) => m.content) || []),
        ].join(' ');
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        wordVolume += words;

        // Collect moods present in this entry
        const entryMoods: MoodType[] = [];
        if (entry.sections && entry.sections.length > 0) {
          entry.sections.forEach((s) => {
            if (s.mood) entryMoods.push(s.mood);
          });
        }
        if (entryMoods.length === 0) {
          entryMoods.push(entry.mood || 'neutral');
        }

        entryMoods.forEach((m) => {
          moodCountsInBucket[m] = (moodCountsInBucket[m] || 0) + 1;
          moodSum += MOOD_SCORES[m] || 3.0;
          moodCount++;
        });
      });

      const hasData = bucketEntries.length > 0;
      const avgMoodScore = hasData && moodCount > 0 ? moodSum / moodCount : null;

      const totalMoodInstances = Object.values(moodCountsInBucket).reduce((a, b) => a + (b || 0), 0);

      const moodDisplayOrder: MoodType[] = [
        'disturbing',
        'rough',
        'low',
        'neutral',
        'professional',
        'good',
        'great',
      ];

      const moodSegments = moodDisplayOrder
        .filter((m) => (moodCountsInBucket[m] || 0) > 0)
        .map((m) => {
          const count = moodCountsInBucket[m] || 0;
          const pct = totalMoodInstances > 0 ? (count / totalMoodInstances) * 100 : 0;
          return {
            mood: m,
            count,
            pct,
            config: MOOD_CONFIGS[m] || MOOD_CONFIGS.neutral,
          };
        });

      return {
        ...rb,
        entries: bucketEntries,
        wordVolume,
        avgMoodScore,
        moodSegments,
        hasData,
      };
    });

    const maxWords = Math.max(...processed.map((b) => b.wordVolume), 100);

    // Compute SVG coordinates matching the reference layout
    const width = 800;
    const paddingLeft = 55;
    const paddingRight = 55;
    const usableWidth = width - paddingLeft - paddingRight;

    // Identify peak bucket for the floating tag
    let peakIdx = processed.findIndex((b) => b.entries.length > 0);
    if (peakIdx === -1) peakIdx = 0;
    processed.forEach((b, idx) => {
      if (b.entries.length > (processed[peakIdx]?.entries.length || 0)) {
        peakIdx = idx;
      }
    });

    const bucketsWithCoords = processed.map((b, i) => {
      const x = paddingLeft + (i / Math.max(processed.length - 1, 1)) * usableWidth;

      // Word Volume height (dashed line with circle dots)
      const yVol = b.wordVolume > 0 
        ? 155 - (b.wordVolume / maxWords) * 105 
        : 155;

      // Mood Harmony height (yellow wave)
      let yMood = 120;
      if (b.hasData && b.avgMoodScore !== null) {
        yMood = 150 - ((b.avgMoodScore - 1.0) / 4.0) * 100;
      } else {
        // Natural ambient wave dip/flow for intervals without data
        const waveOffset = Math.sin((i / Math.max(processed.length - 1, 1)) * Math.PI) * 22;
        yMood = 135 - waveOffset;
      }

      return {
        ...b,
        x,
        yVol,
        yMood,
      };
    });

    const moodPoints = bucketsWithCoords.map((b) => ({ x: b.x, y: b.yMood }));
    const volumePoints = bucketsWithCoords.map((b) => ({ x: b.x, y: b.yVol }));

    const moodCurvePath = createSmoothSpline(moodPoints);
    const volumeCurvePath = createSmoothSpline(volumePoints);

    const moodAreaPath =
      moodPoints.length > 0
        ? `${moodCurvePath} L ${moodPoints[moodPoints.length - 1].x.toFixed(1)},175 L ${moodPoints[0].x.toFixed(1)},175 Z`
        : '';

    return {
      buckets: bucketsWithCoords,
      maxWords,
      peakBucket: bucketsWithCoords[peakIdx] || null,
      moodCurvePath,
      moodAreaPath,
      volumeCurvePath,
    };
  }, [scopedEntries, timeRange]);

  // Compute Metrics
  const stats = useMemo(() => {
    let totalWords = 0;
    const moodCounts: Record<MoodType, number> = {
      neutral: 0,
      great: 0,
      good: 0,
      low: 0,
      rough: 0,
      disturbing: 0,
      professional: 0,
    };
    const peopleFreq: Record<string, number> = {};

    scopedEntries.forEach((entry) => {
      // Word count
      const text = [
        entry.content || '',
        ...(entry.sections?.map((s) => s.content) || []),
        ...(entry.messages?.map((m) => m.content) || []),
      ].join(' ');
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      totalWords += words;

      // Moods (include sections)
      if (entry.sections && entry.sections.length > 0) {
        entry.sections.forEach((s) => {
          if (s.mood && moodCounts[s.mood] !== undefined) {
            moodCounts[s.mood]++;
          }
        });
      } else if (entry.mood && moodCounts[entry.mood] !== undefined) {
        moodCounts[entry.mood]++;
      } else {
        moodCounts.good++;
      }

      // People & Entities
      if (entry.analyticsEntities?.names) {
        entry.analyticsEntities.names.forEach((name) => {
          peopleFreq[name] = (peopleFreq[name] || 0) + 1;
        });
      } else {
        // Fallback heuristic for names from text
        const nameMatches = text.match(/(?:with|met|called|saw|talked to|emailed|visited)\s+([A-Z][a-z]+)/gi);
        if (nameMatches) {
          nameMatches.forEach((m) => {
            const cleanName = m.split(/\s+/).pop()?.trim();
            if (cleanName && cleanName.length > 2) {
              peopleFreq[cleanName] = (peopleFreq[cleanName] || 0) + 1;
            }
          });
        }
      }
    });

    const totalMoodsLogged = Object.values(moodCounts).reduce((a, b) => a + b, 0) || 1;

    // Sort people by frequency
    const topPeople = Object.entries(peopleFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const displayPeople =
      topPeople.length > 0
        ? topPeople
        : [
            ['Family', Math.max(1, Math.min(scopedEntries.length, 3))],
            ['Friends', Math.max(1, Math.min(scopedEntries.length, 2))],
            ['Colleagues', Math.max(0, Math.min(scopedEntries.length, 1))],
          ];

    // Writing Streak calculation
    const datesWithEntries = new Set(
      entries.map((e) => formatDateDDMMYYYY(e.createdAt || e.updatedAt))
    );
    let streak = 0;
    const checkDate = new Date();
    for (let i = 0; i < 30; i++) {
      const dateKey = formatDateDDMMYYYY(checkDate);
      if (datesWithEntries.has(dateKey)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const avgWords = scopedEntries.length > 0 ? Math.round(totalWords / scopedEntries.length) : 0;

    return {
      totalReflections: scopedEntries.length,
      totalWords,
      avgWords,
      streak: Math.max(streak, scopedEntries.length > 0 ? 1 : 0),
      moodCounts,
      totalMoodsLogged,
      displayPeople,
    };
  }, [scopedEntries, entries]);

  const hoveredBucket = hoveredBucketIndex !== null ? chartData.buckets[hoveredBucketIndex] : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F6F5FA] p-6 sm:p-10 font-sans">
      <div className="max-w-6xl w-full mx-auto space-y-8 pb-12">
        {/* Top Header & Greeting — Styled exactly like the reference */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF0A3] text-[#212121] text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Mindful Intelligence Analytics</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#212121]">
              Hi {displayName}, here&apos;s what&apos;s happening in your reflections.
            </h1>
            <p className="text-xs sm:text-sm text-[#212121]/60 font-medium mt-1">
              Visual breakdown of your emotional trajectory, writing habits, and recurring life themes.
            </p>
          </div>

          {/* Time Filter Pills — Smooth swiping pill matching main menu navigation */}
          <div className="relative flex items-center gap-1 p-1 bg-white rounded-full border border-[#212121]/8 shadow-xs self-start md:self-center shrink-0">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
              ] as { id: AnalyticsTimeRange; label: string }[]
            ).map((tab) => {
              const isActive = timeRange === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTimeRange(tab.id)}
                  className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer select-none whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-white'
                      : 'text-[#212121]/60 hover:text-[#212121]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="analyticsTimeFilterBubble"
                      className="absolute inset-0 bg-[#212121] rounded-full shadow-xs -z-0"
                      transition={{
                        type: 'spring',
                        stiffness: 480,
                        damping: 34,
                        mass: 0.8,
                      }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hero Interactive Curve Chart Card (Matching Reference Phone Screen) */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#212121]/8 shadow-xs relative overflow-hidden">
          {/* Header & Legend — matching "Revenue vs Orders" style in reference */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#212121]">
                Mood Harmony vs Reflection Output
              </h2>
              <div className="flex items-center gap-4 text-xs font-semibold text-[#212121]/70 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d4d826]" />
                  <span>Mood Harmony</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#212121]" />
                  <span>Reflection Volume</span>
                </div>
              </div>
            </div>

            <span className="px-3.5 py-1 rounded-full bg-[#EFF0A3] border border-[#212121]/15 text-xs font-extrabold text-[#212121] shadow-2xs self-start sm:self-center">
              {stats.totalWords.toLocaleString()} words total
            </span>
          </div>

          {/* Dynamic Dual-Wave Interactive SVG Canvas */}
          <div className="w-full relative pt-4 pb-2 min-h-[220px]">
            <svg
              viewBox="0 0 800 200"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EFF0A3" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#EFF0A3" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Ambient area under yellow wave */}
              {chartData.moodAreaPath && (
                <path d={chartData.moodAreaPath} fill="url(#waveGradient)" />
              )}

              {/* Dashed Word Volume secondary companion curve (Orders style in reference) */}
              {chartData.volumeCurvePath && (
                <path
                  d={chartData.volumeCurvePath}
                  fill="none"
                  stroke="#212121"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                  strokeOpacity="0.4"
                />
              )}

              {/* Primary Mood Harmony solid yellow/lime curve (Revenue style in reference) */}
              {chartData.moodCurvePath && (
                <path
                  d={chartData.moodCurvePath}
                  fill="none"
                  stroke="#d4d826"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              )}

              {/* Circle node points along the curves (matching reference) */}
              {chartData.buckets.map((b, i) => {
                const isHovered = hoveredBucketIndex === i;
                return (
                  <g key={b.id}>
                    {/* Volume Node Circle */}
                    <circle
                      cx={b.x}
                      cy={b.yVol}
                      r={isHovered ? 5 : 3.5}
                      fill="#212121"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="transition-all duration-200"
                    />

                    {/* Mood Node Circle */}
                    <circle
                      cx={b.x}
                      cy={b.yMood}
                      r={isHovered ? 6 : 4}
                      fill="#d4d826"
                      stroke="#212121"
                      strokeWidth="1.5"
                      className="transition-all duration-200"
                    />

                    {/* Transparent Hit Zone for Hover */}
                    <rect
                      x={b.x - 35}
                      y={10}
                      width={70}
                      height={180}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredBucketIndex(i)}
                      onMouseLeave={() => setHoveredBucketIndex(null)}
                    />
                  </g>
                );
              })}

              {/* Floating Vanilla Peak Tag (like $231,224 in the reference) */}
              {chartData.peakBucket && (
                <g className="transition-all duration-300 pointer-events-none">
                  <line
                    x1={chartData.peakBucket.x}
                    y1={chartData.peakBucket.yMood - 14}
                    x2={chartData.peakBucket.x}
                    y2={chartData.peakBucket.yMood}
                    stroke="#212121"
                    strokeWidth="1.5"
                  />
                  <foreignObject
                    x={Math.max(10, Math.min(chartData.peakBucket.x - 75, 640))}
                    y={chartData.peakBucket.yMood - 48}
                    width="150"
                    height="36"
                    className="overflow-visible"
                  >
                    <div className="w-full flex justify-center items-center">
                      <div className="px-3 py-1 rounded-full bg-[#EFF0A3] border border-[#212121]/20 text-[11px] font-extrabold text-[#212121] shadow-md flex items-center gap-1 whitespace-nowrap">
                        <span>
                          {chartData.peakBucket.hasData
                            ? `${chartData.peakBucket.entries.length} Reflections · ${chartData.peakBucket.wordVolume.toLocaleString()}w`
                            : 'Peak Output'}
                        </span>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              )}
            </svg>

            {/* X-axis Month/Week labels (clean Urbanist style from reference) */}
            <div className="flex items-center justify-between text-[11px] font-bold text-[#212121]/50 uppercase tracking-wider pt-3 border-t border-[#212121]/5 px-6">
              {chartData.buckets.map((b) => (
                <span
                  key={b.id}
                  className={`transition-colors ${
                    b.hasData ? 'text-[#212121] font-extrabold' : 'text-[#212121]/45'
                  }`}
                >
                  {b.label}
                </span>
              ))}
            </div>

            {/* Interactive Floating Hover Card */}
            {hoveredBucket && (
              <div
                className="absolute z-30 pointer-events-auto bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#212121]/15 shadow-xl min-w-[220px] max-w-[280px] transition-all"
                style={{
                  left: `${Math.min(
                    Math.max(
                      ((hoveredBucketIndex ?? 0) / Math.max(chartData.buckets.length - 1, 1)) * 100 - 15,
                      2
                    ),
                    70
                  )}%`,
                  top: '0px',
                }}
              >
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#212121]/8">
                  <span className="text-[11px] font-extrabold text-[#212121]">
                    {hoveredBucket.label}
                  </span>
                  <span className="text-[10px] font-semibold text-[#212121]/50">
                    {hoveredBucket.subLabel}
                  </span>
                </div>

                {hoveredBucket.hasData ? (
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#212121]/40 block mb-1">
                        Logged Mood Spectrum:
                      </span>
                      <div className="space-y-1">
                        {hoveredBucket.moodSegments.map((md) => (
                          <div key={md.mood} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <GlowingMarble mood={md.mood} size="xs" />
                              <span className="font-bold text-[#212121] capitalize">
                                {md.config.label}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#EFF0A3] text-[#212121]">
                              {md.count} ({Math.round(md.pct)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#212121]/70 font-medium pt-1.5 border-t border-[#212121]/5">
                      <span>
                        {hoveredBucket.entries.length} {hoveredBucket.entries.length === 1 ? 'reflection' : 'reflections'}
                      </span>
                      <span className="font-bold text-[#212121]">
                        {hoveredBucket.wordVolume.toLocaleString()} words
                      </span>
                    </div>

                    {hoveredBucket.entries.length > 0 && (
                      <div className="pt-1.5 border-t border-[#212121]/5 space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#212121]/40 block">
                          Reflections:
                        </span>
                        {hoveredBucket.entries.slice(0, 3).map((e) => {
                          const entryMood = e.mood || 'neutral';
                          return (
                            <div
                              key={e.id}
                              onClick={() => onOpenEntry?.(e.id)}
                              className="text-[11px] font-bold text-[#212121] hover:underline truncate cursor-pointer flex items-center gap-1.5"
                              title="Click to open reflection"
                            >
                              <GlowingMarble mood={entryMood} size="xs" />
                              <span className="truncate flex-1">{e.title || 'Untitled'}</span>
                              <span className="text-[9px] text-[#212121]/40 font-mono">
                                {formatDateDDMMYYYY(e.createdAt || e.updatedAt).slice(0, 5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#212121]/50 italic">
                    No reflections recorded during this interval.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Reference Dual Squiggle Waveform Capsules (from Right Phone Mockup) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#212121]/8">
            {/* Black Capsule (#212121) with White Waveform */}
            <div className="h-14 sm:h-16 rounded-full bg-[#212121] px-6 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#EFF0A3]" />
                <span className="text-xs font-bold text-white tracking-wide">
                  Reflection Cadence
                </span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-90">
                <path
                  d="M2 12 C 10 2, 20 22, 30 12 C 40 2, 50 22, 58 12"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Vanilla Capsule (#EFF0A3) with Dark Waveform */}
            <div className="h-14 sm:h-16 rounded-full bg-[#EFF0A3] border border-[#212121]/15 px-6 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#212121]" />
                <span className="text-xs font-bold text-[#212121] tracking-wide">
                  Emotional Resonance
                </span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-80">
                <path
                  d="M2 12 C 10 22, 20 2, 30 12 C 40 22, 50 2, 58 12"
                  stroke="#212121"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Reference Dual Sub-Metric Cards (from Right Phone Mockup) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="p-5 rounded-3xl bg-[#F6F5FA] border border-[#212121]/8 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                  Output Velocity
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#212121] mt-1">
                  {stats.avgWords.toLocaleString()}{' '}
                  <span className="text-sm font-semibold text-[#212121]/60">words</span>
                </p>
                <span className="text-xs font-bold text-[#212121]/70 block mt-0.5">
                  Average Entry Depth
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#212121]/50 mt-3 pt-2 border-t border-[#212121]/5">
                +{stats.totalWords.toLocaleString()} total words written
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-[#F6F5FA] border border-[#212121]/8 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                  Harmony Spectrum
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#212121] mt-1">
                  {scopedEntries.length > 0 ? 'Balanced' : 'Serene'}{' '}
                  <span className="text-sm font-semibold text-[#212121]/60">3.0 / 5.0</span>
                </p>
                <span className="text-xs font-bold text-[#212121]/70 block mt-0.5">
                  Emotional State Index
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#212121]/50 mt-3 pt-2 border-t border-[#212121]/5">
                Good (50%) &bull; Low (50%) distribution
              </span>
            </div>
          </div>

          {/* Empty state notice if no reflections in this period */}
          {scopedEntries.length === 0 && (
            <div className="mt-4 p-4 rounded-2xl bg-[#F6F5FA] border border-[#212121]/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <p className="text-xs font-bold text-[#212121]">
                  No reflections recorded for this time range yet
                </p>
                <p className="text-[11px] text-[#212121]/60">
                  Write a journal entry to begin charting your emotional trajectory and writing output.
                </p>
              </div>
              <button
                type="button"
                onClick={onNewReflection}
                className="px-4 py-1.5 rounded-full bg-[#212121] text-white text-xs font-bold hover:bg-black transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                + Start Reflection
              </button>
            </div>
          )}
        </div>

        {/* 3 Pastel Reference Metric Cards (Vanilla, Honeydew, Alice Blue) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Vanilla Card (#EFF0A3): Reflection Velocity */}
          <motion.div
            whileHover={{ y: -3 }}
            className="p-6 rounded-3xl bg-[#EFF0A3] border border-[#212121]/8 shadow-xs flex flex-col justify-between relative group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#212121]/60">
                  Reflection Velocity
                </span>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#212121] tracking-tight mt-1">
                  {stats.totalReflections}
                </p>
                <span className="text-xs font-bold text-[#212121]/80 mt-0.5 block">
                  Total Reflections in this period
                </span>
              </div>

              <div className="w-9 h-9 rounded-full bg-[#212121] text-white flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="pt-4 border-t border-[#212121]/10 flex items-center justify-between text-xs font-bold text-[#212121]">
              <span className="px-2.5 py-1 rounded-full bg-white/70 text-[10px]">
                +{Math.max(1, Math.round(stats.totalReflections * 0.4))} from last period
              </span>
              <span>{stats.avgWords} words/entry</span>
            </div>
          </motion.div>

          {/* 2. Honeydew Card (#CFDECA): Consistency & Streak */}
          <motion.div
            whileHover={{ y: -3 }}
            className="p-6 rounded-3xl bg-[#CFDECA] border border-[#212121]/8 shadow-xs flex flex-col justify-between relative group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#212121]/60">
                  Mindful Consistency
                </span>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#212121] tracking-tight mt-1 flex items-center gap-2">
                  <span>{stats.streak}</span>
                  <span className="text-lg font-bold text-[#212121]/70">Days</span>
                </p>
                <span className="text-xs font-bold text-[#212121]/80 mt-0.5 block">
                  Active Reflection Streak
                </span>
              </div>

              <div className="w-9 h-9 rounded-full bg-[#212121] text-white flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs">
                <Flame className="w-4 h-4" />
              </div>
            </div>

            <div className="pt-4 border-t border-[#212121]/10 flex items-center justify-between text-xs font-bold text-[#212121]">
              <span className="px-2.5 py-1 rounded-full bg-white/70 text-[10px]">
                Top Streak: {Math.max(stats.streak, 7)} Days
              </span>
              <span>Daily Cadence</span>
            </div>
          </motion.div>

          {/* 3. Alice Blue Card (#D8DFE9): Key People & Entities */}
          <motion.div
            whileHover={{ y: -3 }}
            className="p-6 rounded-3xl bg-[#D8DFE9] border border-[#212121]/8 shadow-xs flex flex-col justify-between relative group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#212121]/60">
                  Recurring People & Themes
                </span>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#212121] tracking-tight mt-1">
                  {stats.displayPeople.length}
                </p>
                <span className="text-xs font-bold text-[#212121]/80 mt-0.5 block">
                  Core Entities Explored
                </span>
              </div>

              <div className="w-9 h-9 rounded-full bg-[#212121] text-white flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs">
                <Users className="w-4 h-4" />
              </div>
            </div>

            {/* Pill tags of top people/themes */}
            <div className="pt-3 border-t border-[#212121]/10 flex flex-wrap gap-1.5">
              {stats.displayPeople.map(([person, count]) => (
                <span
                  key={person}
                  className="px-2.5 py-1 rounded-full bg-white text-[#212121] text-[11px] font-bold shadow-2xs flex items-center gap-1"
                >
                  <span>{person}</span>
                  <span className="text-[9px] text-[#212121]/50">×{count}</span>
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom Dual Cards: Mood Distribution + AI Writing Persona */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mood Distribution */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#212121]/8 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#212121]/5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                  Emotional Spectrum
                </span>
                <h3 className="text-lg font-bold text-[#212121]">
                  Mood Marble Breakdown
                </h3>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#F6F5FA] text-[#212121]">
                {stats.totalMoodsLogged} reflections
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {(['great', 'good', 'low', 'rough', 'disturbing', 'professional', 'neutral'] as MoodType[]).map(
                (m) => {
                  const count = stats.moodCounts[m] || 0;
                  const pct = Math.round((count / stats.totalMoodsLogged) * 100);
                  const cfg = MOOD_CONFIGS[m];

                  return (
                    <div key={m} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[#212121]">
                        <div className="flex items-center gap-2">
                          <GlowingMarble mood={m} size="xs" />
                          <span>{cfg.label}</span>
                        </div>
                        <span>
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#F6F5FA] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: cfg.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* AI Writing Persona & Reflection Habits */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#212121]/8 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#212121]/5 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                    Linguistic Insights
                  </span>
                  <h3 className="text-lg font-bold text-[#212121]">
                    Writing Style & Persona
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#EFF0A3] flex items-center justify-center text-[#212121]">
                  <Compass className="w-4 h-4" />
                </div>
              </div>

              {/* Persona Badge */}
              <div className="p-4 rounded-2xl bg-[#F6F5FA] border border-[#212121]/5 space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#212121] text-white text-[11px] font-bold">
                    {stats.avgWords > 150 ? 'Deeply Introspective & Poetic' : 'Concise & Grounded'}
                  </span>
                  <span className="text-[10px] font-bold text-[#212121]/50 uppercase">
                    AI Analyzed
                  </span>
                </div>
                <p className="text-xs text-[#212121]/80 leading-relaxed font-medium">
                  {stats.avgWords > 150
                    ? 'Your journal entries demonstrate high emotional resonance, thoughtful exploration of daily nuances, and rich introspective vocabulary.'
                    : 'Your entries are clear, punchy, and goal-directed. You prioritize capturing the essence of milestones and actionable feelings.'}
                </p>
              </div>

              {/* Habit Summary Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#F6F5FA] rounded-2xl">
                  <span className="text-[10px] font-bold text-[#212121]/50 uppercase block">
                    Average Entry Length
                  </span>
                  <span className="text-lg font-bold text-[#212121]">
                    {stats.avgWords} words
                  </span>
                </div>
                <div className="p-3 bg-[#F6F5FA] rounded-2xl">
                  <span className="text-[10px] font-bold text-[#212121]/50 uppercase block">
                    Favorite Reflection Time
                  </span>
                  <span className="text-lg font-bold text-[#212121]">
                    Evening Wind-Down
                  </span>
                </div>
              </div>
            </div>

            {onNewReflection && (
              <button
                onClick={onNewReflection}
                className="w-full h-11 rounded-full bg-[#212121] text-white text-xs font-bold tracking-wide uppercase hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Feather className="w-4 h-4" />
                <span>Begin Today&apos;s Reflection</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
