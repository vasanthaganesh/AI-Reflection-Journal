'use client';

import React, { useState, useMemo } from 'react';
import { JournalEntry, Reminder, MoodType } from '@/lib/types';
import { GlowingMarble } from './GlowingMarble';
import { ImageBall } from './ImageBall';
import { formatDateDDMMYYYY, formatFriendlyDateDDMMYYYY } from '@/lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Check, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  ArrowUpRight,
  ImageIcon,
  MapPin
} from 'lucide-react';
import { motion } from 'motion/react';

interface CalendarViewProps {
  entries: JournalEntry[];
  reminders: Reminder[];
  onSelectEntry: (id: string) => void;
  onNewEntryForDate: (dateStr: string) => void;
  onToggleReminder: (id: string, completed: boolean) => void;
  onDeleteReminder: (id: string) => void;
  onAddReminder: (title: string, date: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  entries,
  reminders,
  onSelectEntry,
  onNewEntryForDate,
  onToggleReminder,
  onDeleteReminder,
  onAddReminder,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderDate, setNewReminderDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun

  // Map entries by date key YYYY-MM-DD
  const entriesByDate = useMemo(() => {
    const map: Record<string, JournalEntry[]> = {};
    entries.forEach((entry) => {
      let d: Date;
      if (entry.createdAt?.toDate) {
        d = entry.createdAt.toDate();
      } else if (entry.createdAt) {
        d = new Date(entry.createdAt);
      } else {
        d = new Date();
      }
      const key = d.toISOString().split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    });
    return map;
  }, [entries]);

  const selectedDateEntries = entriesByDate[selectedDateStr] || [];

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;
    onAddReminder(newReminderTitle.trim(), newReminderDate);
    setNewReminderTitle('');
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#F6F5FA]">
      {/* Left: Interactive Month Calendar */}
      <div className="flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto space-y-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-[#212121]/5 shadow-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                Timeline & Milestones
              </span>
              <h2 className="text-2xl font-bold text-[#212121] tracking-tight">
                {monthNames[month]} {year}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-full bg-[#F6F5FA] hover:bg-[#212121]/10 flex items-center justify-center text-[#212121] transition-colors cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-full bg-[#F6F5FA] hover:bg-[#212121]/10 flex items-center justify-center text-[#212121] transition-colors cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white p-6 rounded-3xl border border-[#212121]/5 shadow-xs">
            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#212121]/50 uppercase tracking-wider pb-3 border-b border-[#212121]/5">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2 pt-4">
              {/* Empty padding days */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 sm:h-22 rounded-2xl bg-transparent" />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayEntries = entriesByDate[dateKey] || [];
                const isSelected = selectedDateStr === dateKey;
                const isToday =
                  new Date().toISOString().split('T')[0] === dateKey;

                // Check for day images
                const dayImages: string[] = [];
                dayEntries.forEach((entry) => {
                  if (entry.images && entry.images.length > 0) {
                    dayImages.push(...entry.images);
                  } else if (entry.image) {
                    dayImages.push(entry.image);
                  }
                });

                // Gather all unique moods for this day (including section moods)
                const dayMoods: MoodType[] = [];
                dayEntries.forEach((entry) => {
                  if (entry.sections && entry.sections.length > 0) {
                    entry.sections.forEach((sec) => {
                      if (sec.mood && !dayMoods.includes(sec.mood)) {
                        dayMoods.push(sec.mood);
                      }
                    });
                  }
                  if (entry.mood && !dayMoods.includes(entry.mood)) {
                    dayMoods.push(entry.mood);
                  }
                });
                if (dayMoods.length === 0 && dayEntries.length > 0) {
                  dayMoods.push('neutral');
                }

                return (
                  <motion.div
                    key={dateKey}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDateStr(dateKey)}
                    className={`h-16 sm:h-22 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                      isSelected
                        ? 'bg-[#EFF0A3] border-[#212121] shadow-xs'
                        : isToday
                        ? 'bg-[#F6F5FA] border-[#212121]/30'
                        : 'bg-white hover:bg-[#F6F5FA] border-[#212121]/5'
                    }`}
                  >
                    <div className="flex items-center justify-between z-10">
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-[#212121]' : isToday ? 'text-[#212121]' : 'text-[#212121]/70'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayEntries.length > 0 && (
                        <span className="text-[10px] font-extrabold text-[#212121]">
                          {dayEntries.length > 1 ? `×${dayEntries.length}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Middle: Journal Image Thumbnail on Day Cell if available */}
                    {dayImages.length > 0 && (
                      <div className="flex items-center gap-1 my-0.5 z-10">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg overflow-hidden border border-white/80 shadow-xs shrink-0">
                          <img
                            src={dayImages[0]}
                            alt="Day photo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {dayImages.length > 1 && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded-md bg-black/70 text-white leading-none">
                            +{dayImages.length - 1}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bottom: Marbles / Section Emotion Indicators */}
                    <div className="flex items-center gap-1 overflow-hidden z-10">
                      {dayMoods.slice(0, 4).map((mood, idx) => (
                        <GlowingMarble
                          key={idx}
                          mood={mood}
                          size="xs"
                        />
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Entry Preview */}
          <div className="bg-white p-6 rounded-3xl border border-[#212121]/5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50">
                  Daily Inspector
                </span>
                <h3 className="text-lg font-bold text-[#212121]">
                  Entries for {formatFriendlyDateDDMMYYYY(selectedDateStr)}
                </h3>
              </div>

              <button
                onClick={() => onNewEntryForDate(selectedDateStr)}
                className="px-4 py-2 rounded-full bg-[#212121] text-white text-xs font-semibold hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Reflection</span>
              </button>
            </div>

            {selectedDateEntries.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#212121]/50 font-medium">
                No reflections logged on {formatDateDDMMYYYY(selectedDateStr)}. Click "New Reflection" to capture thoughts from this day.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEntries.map((entry) => {
                  const entryImages = entry.images && entry.images.length > 0
                    ? entry.images
                    : entry.image ? [entry.image] : [];

                  const sectionMoods: MoodType[] = [];
                  if (entry.sections && entry.sections.length > 0) {
                    entry.sections.forEach((s) => {
                      if (s.mood && !sectionMoods.includes(s.mood)) {
                        sectionMoods.push(s.mood);
                      }
                    });
                  }
                  if (sectionMoods.length === 0) {
                    sectionMoods.push(entry.mood || 'good');
                  }

                  return (
                    <div
                      key={entry.id}
                      onClick={() => onSelectEntry(entry.id)}
                      className="p-4 rounded-2xl bg-[#F6F5FA] hover:bg-[#EFF0A3]/40 border border-[#212121]/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        {/* Section Mood Marbles Side-by-Side */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5 sm:pt-0">
                          {sectionMoods.map((m, idx) => (
                            <GlowingMarble key={idx} mood={m} size="md" />
                          ))}
                        </div>

                        {/* Image preview thumbnail if attached */}
                        {entryImages.length > 0 && (
                          <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white shadow-xs shrink-0">
                            <img
                              src={entryImages[0]}
                              alt="Entry photo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#212121] group-hover:text-black truncate">
                              {entry.title || 'Untitled Reflection'}
                            </h4>
                            {entry.sections && entry.sections.length > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-white border border-[#212121]/10 text-[#212121]/70">
                                {entry.sections.length} sections
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#212121]/60 truncate max-w-lg mt-0.5">
                            {entry.content || (entry.messages.length > 0 ? entry.messages[0].content : 'No text content')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        {entryImages.length > 1 && (
                          <span className="text-[10px] font-semibold text-[#212121]/50 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            <span>{entryImages.length} photos</span>
                          </span>
                        )}
                        <div className="w-8 h-8 rounded-full bg-white group-hover:bg-[#212121] group-hover:text-white flex items-center justify-center text-[#212121] transition-colors shadow-2xs">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Upcoming Smart Reminders Panel */}
      <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-[#212121]/8 bg-white p-6 sm:p-8 flex flex-col justify-between overflow-y-auto shrink-0">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#EFF0A3] flex items-center justify-center text-[#212121]">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-[#212121]">Smart Reminders</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F6F5FA] text-xs font-bold text-[#212121]">
              {reminders.filter((r) => !r.completed).length} active
            </span>
          </div>

          {/* Quick Add Reminder */}
          <form onSubmit={handleCreateReminder} className="mb-6 space-y-2">
            <input
              type="text"
              value={newReminderTitle}
              onChange={(e) => setNewReminderTitle(e.target.value)}
              placeholder="Add reminder or task..."
              className="w-full h-10 px-4 text-xs bg-[#F6F5FA] rounded-full border border-transparent focus:border-[#212121]/20 outline-none text-[#212121]"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newReminderDate}
                onChange={(e) => setNewReminderDate(e.target.value)}
                className="flex-1 h-9 px-3 text-xs bg-[#F6F5FA] rounded-full border border-transparent focus:border-[#212121]/20 outline-none text-[#212121]"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-full bg-[#212121] text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </form>

          {/* Reminders List */}
          <div className="space-y-2">
            {reminders.length === 0 ? (
              <div className="text-center py-10 px-4 bg-[#F6F5FA] rounded-3xl border border-dashed border-[#212121]/15">
                <Sparkles className="w-6 h-6 text-[#212121]/40 mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#212121]/60">
                  No reminders scheduled yet.
                </p>
                <p className="text-[11px] text-[#212121]/40 mt-1">
                  Mention dates like "dinner on Friday" in your journal and Gemini will extract them automatically!
                </p>
              </div>
            ) : (
              reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    reminder.completed
                      ? 'bg-[#F6F5FA]/60 border-transparent opacity-60'
                      : 'bg-[#F6F5FA] border-[#212121]/5 hover:border-[#212121]/15'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleReminder(reminder.id, !reminder.completed)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        reminder.completed
                          ? 'bg-[#212121] border-[#212121] text-white'
                          : 'bg-white border-[#212121]/30 hover:border-[#212121]'
                      }`}
                    >
                      {reminder.completed && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="truncate">
                      <p
                        className={`text-xs font-bold truncate ${
                          reminder.completed ? 'line-through text-[#212121]/50' : 'text-[#212121]'
                        }`}
                      >
                        {reminder.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#212121]/50 font-semibold mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateDDMMYYYY(reminder.date)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteReminder(reminder.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                    title="Delete reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer info badge */}
        <div className="pt-6 border-t border-[#212121]/5 text-center">
          <span className="text-[10px] font-semibold text-[#212121]/40 uppercase tracking-widest">
            AI Event Sync Active
          </span>
        </div>
      </div>
    </div>
  );
};
