export type MoodType = 'great' | 'good' | 'low' | 'rough' | 'disturbing' | 'professional' | 'neutral';

export interface MoodConfig {
  type: MoodType;
  label: string;
  color: string;
  shadow: string;
  gradient: string;
  description: string;
}

export const MOOD_CONFIGS: Record<MoodType, MoodConfig> = {
  neutral: {
    type: 'neutral',
    label: 'Neutral / Attuned',
    color: '#e2e8f0',
    shadow: 'rgba(255, 255, 255, 0.75)',
    gradient: 'radial-gradient(circle at 35% 30%, #ffffff, #f8fafc 45%, #cbd5e1)',
    description: 'Calm, receptive, waiting for your thoughts',
  },
  great: {
    type: 'great',
    label: 'Great',
    color: '#22c55e',
    shadow: 'rgba(34, 197, 94, 0.45)',
    gradient: 'radial-gradient(circle at 35% 30%, #86efac, #22c55e 55%, #15803d)',
    description: 'Joyful, energized, deep gratitude',
  },
  good: {
    type: 'good',
    label: 'Good',
    color: '#eab308',
    shadow: 'rgba(234, 179, 8, 0.45)',
    gradient: 'radial-gradient(circle at 35% 30%, #fef08a, #eab308 55%, #a16207)',
    description: 'Calm, positive, content',
  },
  low: {
    type: 'low',
    label: 'Low',
    color: '#f97316',
    shadow: 'rgba(249, 115, 22, 0.45)',
    gradient: 'radial-gradient(circle at 35% 30%, #fdba74, #f97316 55%, #c2410c)',
    description: 'Fatigued, lingering resistance, wistful',
  },
  rough: {
    type: 'rough',
    label: 'Rough / Bad',
    color: '#ef4444',
    shadow: 'rgba(239, 68, 68, 0.45)',
    gradient: 'radial-gradient(circle at 35% 30%, #fca5a5, #ef4444 55%, #b91c1c)',
    description: 'Stressed, overwhelmed, frustrated',
  },
  disturbing: {
    type: 'disturbing',
    label: 'Disturbing / Heavy',
    color: '#a855f7',
    shadow: 'rgba(168, 85, 247, 0.45)',
    gradient: 'radial-gradient(circle at 35% 30%, #d8b4fe, #a855f7 55%, #6b21a8)',
    description: 'Heavy emotion, unresolved disturbance',
  },
  professional: {
    type: 'professional',
    label: 'Professional Note',
    color: '#3b82f6',
    shadow: 'rgba(59, 130, 246, 0.45)',
    gradient: 'radial-gradient(circle at 35% 30%, #93c5fd, #3b82f6 55%, #1d4ed8)',
    description: 'Objective, work, technical plan',
  },
};

export interface Message {
  role: 'user' | 'model';
  content: string;
}

export interface ExtractedEvent {
  title: string;
  dateText: string;
  suggestedDate?: string;
}

export interface LocationData {
  name: string;
  lat?: number;
  lng?: number;
}

export interface VoiceNoteData {
  audioUrl: string;
  duration: number; // in seconds
}

export interface JournalSection {
  id: string;
  title: string;
  content: string;
  mood?: MoodType | null;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  sections?: JournalSection[];
  createdAt: any;
  updatedAt: any;
  mood?: MoodType | null;
  isProfessional?: boolean;
  skipMood?: boolean;
  image?: string | null; // Data URL or Image URL (backward compatibility)
  images?: string[];     // Array of up to 10 image Data URLs
  voiceNote?: VoiceNoteData | null;
  location?: LocationData | null;
  tags?: string[];
  aiReflection?: string | null;
  aiPrompt?: string | null;
  extractedEvents?: ExtractedEvent[];
  suggestedTimelineDate?: {
    date: string;       // YYYY-MM-DD
    displayDate: string;// DD-MM-YYYY
    reason: string;
  } | null;
  analyticsEntities?: {
    names: string[];
    style: string;
  };
  messages: Message[];
}

export interface Reminder {
  id: string;
  title: string;
  date: string; // Stored as DD-MM-YYYY or YYYY-MM-DD
  time?: string;
  completed: boolean;
  sourceEntryId?: string;
  createdAt: string;
}

