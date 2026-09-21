'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  auth, 
  signInWithGoogle, 
  signInAsGuest, 
  getSavedGuestUser, 
  logOut, 
  db, 
  AuthUser 
} from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  addDoc, 
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { 
  JournalEntry, 
  JournalSection,
  Reminder, 
  MoodType, 
  MOOD_CONFIGS, 
  ExtractedEvent, 
  VoiceNoteData, 
  LocationData,
  Message,
  ViewMode
} from '@/lib/types';
import { useDebounce } from '@/hooks/useDebounce';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { GlowingMarble } from '@/components/GlowingMarble';
import { ImageBall } from '@/components/ImageBall';
import { AudioNotePlayer } from '@/components/AudioNotePlayer';
import dynamic from 'next/dynamic';
import { DashboardHome } from '@/components/DashboardHome';

const CalendarView = dynamic(() => import('@/components/CalendarView').then((mod) => mod.CalendarView), { ssr: false });
const MemoriesView = dynamic(() => import('@/components/MemoriesView').then((mod) => mod.MemoriesView), { ssr: false });
const AnalyticsView = dynamic(() => import('@/components/AnalyticsView').then((mod) => mod.AnalyticsView), { ssr: false });
const SanctuaryView = dynamic(() => import('@/components/SanctuaryView').then((mod) => mod.SanctuaryView), { ssr: false });

const MapView = dynamic(() => import('@/components/MapView').then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#F6F5FA]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full border-2 border-[#212121] border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-[#212121]/60">Loading Interactive Map...</span>
      </div>
    </div>
  ),
});
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, parseToDate } from '@/lib/utils';
import { encryptLocalData, decryptLocalData } from '@/lib/storage-crypto';

import { 
  Loader2, 
  LogOut, 
  Plus, 
  Send, 
  Check, 
  AlertCircle, 
  Trash2, 
  Sparkles, 
  ChevronDown, 
  ShieldCheck, 
  X, 
  Search, 
  ArrowUpRight, 
  ArrowLeft,
  Calendar as CalendarIcon, 
  PanelLeftClose, 
  PanelLeft, 
  Compass, 
  Flame, 
  Feather, 
  ArrowUp,
  Image as ImageIcon,
  Mic,
  Square,
  MapPin,
  Sliders,
  PanelRightClose,
  PanelRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Briefcase,
  Home,
  TrendingUp,
  Globe,
  Layers,
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TimeFilter = 'all' | 'today' | 'week' | 'month';

const LOCAL_SESSIONS_PREFIX = 'mnemosyne_sessions_';
const LOCAL_REMINDERS_PREFIX = 'mnemosyne_reminders_';

// Image compression utility to ensure fast loading & storage
function compressImage(file: File, maxWidth = 800, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      return getSavedGuestUser();
    }
    return null;
  });

  useEffect(() => {
    let isSubscribed = true;

    // Listen to Firebase Auth state for Google account sign-in
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (currentUser) => {
          if (!isSubscribed) return;
          if (currentUser) {
            setUser(currentUser);
          }
        },
        (error) => {
          console.warn('[Mnemósyne Auth Error]:', error);
        }
      );
    } catch (err) {
      console.warn('[Mnemósyne Auth Init Error]:', err);
    }

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await logOut();
    setUser(null);
  };

  if (!user) {
    return <LandingPage onUserAuthenticated={setUser} />;
  }

  return <MainDashboard user={user} onSignOut={handleSignOut} />;
}

// ─────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────
function LandingPage({ onUserAuthenticated }: { onUserAuthenticated: (user: AuthUser) => void }) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGuestSigningIn, setIsGuestSigningIn] = useState(false);
  const [authError, setAuthError] = useState<{ type: string; message: string } | null>(null);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) onUserAuthenticated(loggedUser);
    } catch (e: any) {
      setIsSigningIn(false);
      if (e?.code === 'auth/unauthorized-domain') {
        setAuthError({
          type: 'unauthorized-domain',
          message: "Firebase domain notice: 'localhost' is not in authorized domains. You can continue instantly in Guest Mode."
        });
      } else if (e?.code !== 'auth/popup-closed-by-user') {
        setAuthError({
          type: 'general',
          message: e?.message || 'Failed to sign in. Please try again or continue as Guest.'
        });
      }
    }
  };

  const handleGuestSignIn = async () => {
    setIsGuestSigningIn(true);
    try {
      const guest = await signInAsGuest('Reflective Traveler');
      onUserAuthenticated(guest);
    } catch {
      setAuthError({
        type: 'general',
        message: 'Could not initialize guest session. Please retry.'
      });
    } finally {
      setIsGuestSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5FA] text-[#212121] flex flex-col justify-between relative overflow-hidden selection:bg-[#EFF0A3]">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#CFDECA]/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-[#EFF0A3]/50 rounded-full blur-3xl pointer-events-none" />

      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#212121] text-white flex items-center justify-center font-bold text-sm">
            M
          </div>
          <span className="font-bold text-xl tracking-tight">Mnemósyne</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-white border border-[#212121]/10 text-xs font-bold text-[#212121] flex items-center gap-1.5">
            <GlowingMarble mood="neutral" size="sm" />
            <span>Neural Glowing Marbles</span>
          </span>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#212121]/10 shadow-xs mb-6">
          <Sparkles className="w-3.5 h-3.5 text-[#212121]" />
          <span className="text-xs font-semibold tracking-wide uppercase text-[#212121]">
            Intelligent Mindful Journaling & Memories
          </span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight max-w-3xl leading-[1.08] mb-6 text-[#212121]">
          Record your life, reflected by intelligence.
        </h1>

        <p className="text-lg sm:text-xl text-[#212121]/70 max-w-xl mb-10 font-medium leading-relaxed">
          Distraction-free journaling with non-intrusive AI reflections, glowing mood marbles, smart reminders, interactive maps, and multimedia memories.
        </p>

        {authError && (
          <div className="mb-6 max-w-md w-full bg-white p-4 rounded-2xl border border-amber-300 text-left text-xs">
            <p className="font-bold text-[#212121] mb-1">Notice</p>
            <p className="text-[#212121]/80 mb-3">{authError.message}</p>
            <button
              onClick={handleGuestSignIn}
              className="w-full py-2 bg-[#212121] text-white rounded-full font-semibold cursor-pointer"
            >
              Continue in Guest Mode
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center mb-16">
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn || isGuestSigningIn}
            className="w-full sm:w-auto flex-1 h-13 px-8 rounded-full bg-[#212121] text-white font-semibold text-sm hover:bg-black transition-all flex items-center justify-center gap-3 shadow-md cursor-pointer disabled:opacity-70"
          >
            {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sign in with Google</span>}
          </button>

          <button
            onClick={handleGuestSignIn}
            disabled={isSigningIn || isGuestSigningIn}
            className="w-full sm:w-auto flex-1 h-13 px-8 rounded-full bg-white border border-[#212121]/15 text-[#212121] font-semibold text-sm hover:bg-[#F6F5FA] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isGuestSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-[#212121]" />}
            <span>Continue as Guest</span>
          </button>
        </div>

        {/* Emotion Marble Showcase */}
        <div className="flex flex-wrap items-center justify-center gap-4 p-4 rounded-3xl bg-white border border-[#212121]/5 shadow-xs">
          {(['neutral', 'great', 'good', 'low', 'rough', 'disturbing', 'professional'] as MoodType[]).map((m) => (
            <div key={m} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F6F5FA]">
              <GlowingMarble mood={m} size="md" />
              <span className="text-xs font-bold text-[#212121] capitalize">
                {MOOD_CONFIGS[m].label}
              </span>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-[#212121]/60 font-medium">
        © 2026 Mnemósyne — Urbanist Design System & Gemini AI
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN DASHBOARD & VIEW SWITCHER
// ─────────────────────────────────────────────────────────────
function MainDashboard({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  // Restore view mode and active entry from storage if available, defaulting to dashboard
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mnemosyne_active_view_' + user.uid) as ViewMode | null;
      if (saved) return saved;
    }
    return 'dashboard';
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem('mnemosyne_active_view_' + user.uid, mode);
    } catch {}
  }, [user.uid]);

  const [openedFromView, setOpenedFromView] = useState<ViewMode | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const [currentEntryId, setCurrentEntryIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mnemosyne_active_entry_' + user.uid);
    }
    return null;
  });

  const setCurrentEntryId = useCallback((id: string | null) => {
    setCurrentEntryIdState(id);
    try {
      if (id) {
        localStorage.setItem('mnemosyne_active_entry_' + user.uid, id);
      } else {
        localStorage.removeItem('mnemosyne_active_entry_' + user.uid);
      }
    } catch {}
  }, [user.uid]);

  const [loadingEntries, setLoadingEntries] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [userToken, setUserToken] = useState<string>('guest-dev-token');

  useEffect(() => {
    let isCancelled = false;
    user.getIdToken().then((t) => {
      if (!isCancelled && t) {
        setUserToken(t);
      }
    }).catch(() => {
      setUserToken('guest-dev-token');
    });
    return () => {
      isCancelled = true;
    };
  }, [user]);

  // Debounced cloud save queue
  const pendingUpdatesRef = useRef<{ id: string; updates: Partial<JournalEntry> } | null>(null);
  const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Encrypted Local Storage Helpers
  const loadLocalEntries = useCallback(async (): Promise<JournalEntry[]> => {
    try {
      const raw = localStorage.getItem(LOCAL_SESSIONS_PREFIX + user.uid);
      if (!raw) return [];
      const decrypted = await decryptLocalData(raw, user.uid);
      return decrypted ? JSON.parse(decrypted) : [];
    } catch {
      return [];
    }
  }, [user.uid]);

  const saveLocalEntries = useCallback(async (updated: JournalEntry[]) => {
    try {
      const plainText = JSON.stringify(updated);
      const encrypted = await encryptLocalData(plainText, user.uid);
      localStorage.setItem(LOCAL_SESSIONS_PREFIX + user.uid, encrypted);
    } catch (e) {
      console.warn("Could not save encrypted entries to local storage", e);
    }
  }, [user.uid]);

  const loadLocalReminders = useCallback((): Reminder[] => {
    try {
      const raw = localStorage.getItem(LOCAL_REMINDERS_PREFIX + user.uid);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [user.uid]);

  const saveLocalReminders = useCallback((updated: Reminder[]) => {
    try {
      localStorage.setItem(LOCAL_REMINDERS_PREFIX + user.uid, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save reminders to local storage", e);
    }
  }, [user.uid]);

  // Sync entries & reminders
  useEffect(() => {
    let isCancelled = false;

    if ((user as any).isGuest) {
      setIsUsingLocalStorage(true);
      loadLocalEntries().then((locals) => {
        if (isCancelled) return;
        setEntries(locals);
        setReminders(loadLocalReminders());
        setLoadingEntries(false);
        if (locals.length > 0) {
          setCurrentEntryIdState((prevId) => {
            if (prevId && locals.some((e) => e.id === prevId)) return prevId;
            return locals[0].id;
          });
        }
      });
      return () => {
        isCancelled = true;
      };
    }

    // Safeguard: Fallback to local entries if cloud sync takes more than 1200ms
    const cloudSyncFallbackTimeout = setTimeout(async () => {
      if (!isCancelled) {
        const locals = await loadLocalEntries();
        if (!isCancelled && locals.length > 0) {
          setEntries(locals);
        }
        setLoadingEntries(false);
      }
    }, 1200);

    let unsubscribeEntries = () => {};
    let unsubscribeReminders = () => {};

    try {
      const entriesQuery = query(collection(db, 'users', user.uid, 'sessions'), orderBy('updatedAt', 'desc'));
      unsubscribeEntries = onSnapshot(
        entriesQuery,
        (snapshot) => {
          clearTimeout(cloudSyncFallbackTimeout);
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as JournalEntry[];
          setEntries(list);
          setIsUsingLocalStorage(false);
          setLoadingEntries(false);
          if (list.length > 0) {
            setCurrentEntryIdState((prevId) => {
              if (prevId && list.some((e) => e.id === prevId)) return prevId;
              return list[0].id;
            });
          }
        },
        async () => {
          clearTimeout(cloudSyncFallbackTimeout);
          setIsUsingLocalStorage(true);
          const locals = await loadLocalEntries();
          if (isCancelled) return;
          setEntries(locals);
          setLoadingEntries(false);
          if (locals.length > 0) {
            setCurrentEntryIdState((prevId) => {
              if (prevId && locals.some((e) => e.id === prevId)) return prevId;
              return locals[0].id;
            });
          }
        }
      );

      const remindersQuery = query(collection(db, 'users', user.uid, 'reminders'), orderBy('date', 'asc'));
      unsubscribeReminders = onSnapshot(
        remindersQuery,
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Reminder[];
          setReminders(list);
        },
        () => {
          setReminders(loadLocalReminders());
        }
      );
    } catch {
      clearTimeout(cloudSyncFallbackTimeout);
      setIsUsingLocalStorage(true);
      loadLocalEntries().then((locals) => {
        if (isCancelled) return;
        setEntries(locals);
        setReminders(loadLocalReminders());
        setLoadingEntries(false);
      });
    }

    return () => {
      isCancelled = true;
      clearTimeout(cloudSyncFallbackTimeout);
      unsubscribeEntries();
      unsubscribeReminders();
    };
  }, [user.uid, loadLocalEntries, loadLocalReminders]);

  // Immediate flush function for debounced Firestore writes
  const flushPendingSave = useCallback(async () => {
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = null;
    }
    const pending = pendingUpdatesRef.current;
    if (!pending) return;
    pendingUpdatesRef.current = null;

    if (isUsingLocalStorage || (user as any).isGuest) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', pending.id), {
        ...pending.updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore write error, falling back to local storage:', err);
      setIsUsingLocalStorage(true);
    }
  }, [user.uid, isUsingLocalStorage, user]);

  // Flush on window unload or before unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // Create new entry
  const createNewEntry = async (dateOverride?: string) => {
    await flushPendingSave();
    const newDate = dateOverride ? new Date(dateOverride + 'T12:00:00').toISOString() : new Date().toISOString();
    const newEntryData: Omit<JournalEntry, 'id'> = {
      title: 'New Reflection',
      content: '',
      sections: [],
      createdAt: newDate,
      updatedAt: newDate,
      mood: 'neutral',
      messages: [],
      tags: [],
      images: [],
    };

    if (isUsingLocalStorage || (user as any).isGuest) {
      const newId = 'local-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const newEntry: JournalEntry = { id: newId, ...newEntryData };
      const updated = [newEntry, ...entries];
      setEntries(updated);
      saveLocalEntries(updated);
      setCurrentEntryId(newId);
      setViewMode('journal');
      return newId;
    }

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'sessions'), {
        ...newEntryData,
        updatedAt: serverTimestamp(),
      });
      setCurrentEntryId(docRef.id);
      setViewMode('journal');
      return docRef.id;
    } catch {
      setIsUsingLocalStorage(true);
      const newId = 'local-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const newEntry: JournalEntry = { id: newId, ...newEntryData };
      const updated = [newEntry, ...entries];
      setEntries(updated);
      saveLocalEntries(updated);
      setCurrentEntryId(newId);
      setViewMode('journal');
      return newId;
    }
  };

  // Save crystallized sanctuary reflection as a full journal entry
  const handleSaveSanctuaryReflection = async (reflection: {
    title: string;
    content: string;
    mood: MoodType;
    tags: string[];
    aiReflection: string;
  }) => {
    await flushPendingSave();
    const newDate = new Date().toISOString();
    const newEntryData: Omit<JournalEntry, 'id'> = {
      title: reflection.title || 'Sanctuary Reflection',
      content: reflection.content,
      sections: [],
      createdAt: newDate,
      updatedAt: newDate,
      mood: reflection.mood || 'good',
      messages: [],
      tags: reflection.tags || ['Sanctuary'],
      images: [],
      aiReflection: reflection.aiReflection,
    };

    if (isUsingLocalStorage || (user as any).isGuest) {
      const newId = 'local-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const newEntry: JournalEntry = { id: newId, ...newEntryData };
      const updated = [newEntry, ...entries];
      setEntries(updated);
      saveLocalEntries(updated);
      setCurrentEntryId(newId);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'sessions'), {
        ...newEntryData,
        updatedAt: serverTimestamp(),
      });
      setCurrentEntryId(docRef.id);
    } catch {
      setIsUsingLocalStorage(true);
      const newId = 'local-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const newEntry: JournalEntry = { id: newId, ...newEntryData };
      const updated = [newEntry, ...entries];
      setEntries(updated);
      saveLocalEntries(updated);
      setCurrentEntryId(newId);
    }
  };

  // Update entry with 1,500ms trailing debounce on remote Firestore writes
  const updateEntry = useCallback((id: string, updates: Partial<JournalEntry>, immediate = false) => {
    setEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e));
      if (isUsingLocalStorage || (user as any).isGuest) {
        saveLocalEntries(updated);
      }
      return updated;
    });

    if (isUsingLocalStorage || (user as any).isGuest) {
      return;
    }

    if (pendingUpdatesRef.current && pendingUpdatesRef.current.id === id) {
      pendingUpdatesRef.current.updates = { ...pendingUpdatesRef.current.updates, ...updates };
    } else {
      pendingUpdatesRef.current = { id, updates };
    }

    if (immediate) {
      flushPendingSave();
      return;
    }

    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }
    saveDebounceTimerRef.current = setTimeout(() => {
      flushPendingSave();
    }, 1500);
  }, [isUsingLocalStorage, user, saveLocalEntries, flushPendingSave]);

  // Delete entry with cascade reminder deletion
  const deleteEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this journal entry?')) return;

    if (pendingUpdatesRef.current?.id === id) {
      pendingUpdatesRef.current = null;
    }

    const updated = entries.filter((item) => item.id !== id);
    setEntries(updated);

    // Cascade delete associated reminders
    const remainingReminders = reminders.filter((r) => r.sourceEntryId !== id);
    const removedReminders = reminders.filter((r) => r.sourceEntryId === id);
    if (removedReminders.length > 0) {
      setReminders(remainingReminders);
      if (isUsingLocalStorage || (user as any).isGuest) {
        saveLocalReminders(remainingReminders);
      } else {
        removedReminders.forEach((r) => {
          deleteDoc(doc(db, 'users', user.uid, 'reminders', r.id)).catch(() => {});
        });
      }
    }

    if (currentEntryId === id) {
      const nextId = updated.length > 0 ? updated[0].id : null;
      setCurrentEntryId(nextId);
    }

    if (isUsingLocalStorage || (user as any).isGuest) {
      saveLocalEntries(updated);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'sessions', id));
    } catch {
      saveLocalEntries(updated);
    }
  };

  // Add Reminder
  const addReminder = async (title: string, date: string) => {
    const newRemData: Omit<Reminder, 'id'> = {
      title,
      date,
      completed: false,
      createdAt: new Date().toISOString(),
      sourceEntryId: currentEntryId || undefined,
    };

    if (isUsingLocalStorage || (user as any).isGuest) {
      const newId = 'rem-' + Date.now().toString(36);
      const updated = [...reminders, { id: newId, ...newRemData }];
      setReminders(updated);
      saveLocalReminders(updated);
      return;
    }

    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'reminders'), newRemData);
      setReminders((prev) => [...prev, { id: ref.id, ...newRemData }]);
    } catch {
      setIsUsingLocalStorage(true);
      const newId = 'rem-' + Date.now().toString(36);
      const updated = [...reminders, { id: newId, ...newRemData }];
      setReminders(updated);
      saveLocalReminders(updated);
    }
  };

  const toggleReminder = async (id: string, completed: boolean) => {
    const updated = reminders.map((r) => (r.id === id ? { ...r, completed } : r));
    setReminders(updated);

    if (isUsingLocalStorage || (user as any).isGuest) {
      saveLocalReminders(updated);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid, 'reminders', id), { completed });
    } catch {
      saveLocalReminders(updated);
    }
  };

  const deleteReminder = async (id: string) => {
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);

    if (isUsingLocalStorage || (user as any).isGuest) {
      saveLocalReminders(updated);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'reminders', id));
    } catch {
      saveLocalReminders(updated);
    }
  };

  // Filtered entries in left sidebar based on reflection timeline date (createdAt)
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Current week start (Monday)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);

    // Current month start (1st of month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    return entries.filter((entry) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.content && entry.content.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (timeFilter === 'all') return true;

      // Filter by the entry's timeline date
      const entryDate = parseToDate(entry.createdAt || entry.updatedAt);

      if (timeFilter === 'today') {
        return entryDate >= todayStart && entryDate <= todayEnd;
      }
      if (timeFilter === 'week') {
        return entryDate >= weekStart && entryDate <= todayEnd;
      }
      if (timeFilter === 'month') {
        return entryDate >= monthStart && entryDate <= todayEnd;
      }

      return true;
    });
  }, [entries, searchQuery, timeFilter]);

  const currentEntry = entries.find((e) => e.id === currentEntryId);

  return (
    <div className="flex h-screen bg-[#F6F5FA] text-[#212121] overflow-hidden relative">
      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-20 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          SIDEBAR / ENTRIES DRAWER
         ───────────────────────────────────────────────────────────── */}
      <aside
        className={`w-80 shrink-0 border-r border-[#212121]/8 flex flex-col bg-white transition-all duration-300 z-30 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full absolute h-full shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="p-5 pb-3 border-b border-[#212121]/5">
          <div className="flex items-center justify-between mb-4">
            <div 
              role="button"
              tabIndex={0}
              onClick={() => setViewMode('dashboard')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setViewMode('dashboard');
                }
              }}
              className="flex items-center gap-2.5 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-[#212121]/30 rounded-lg p-0.5"
            >
              <div className="w-8 h-8 rounded-full bg-[#212121] text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                M
              </div>
              <span className="font-bold text-lg tracking-tight">Mnemósyne</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F6F5FA] text-[#212121]/70 hover:text-[#212121] sm:hidden cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            onClick={() => createNewEntry()}
            className="w-full h-11 px-5 rounded-full bg-[#212121] text-white font-semibold text-xs tracking-wider uppercase hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Reflection</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#212121]/5 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#212121]/65" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search thoughts & memories..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-[#F6F5FA] rounded-full border border-transparent focus:border-[#212121]/20 outline-none text-[#212121] placeholder-[#212121]/65"
            />
          </div>

          {/* Time Filter Pills placed cleanly in the Sidebar with iOS/One UI sliding pill */}
          <div className="relative flex items-center justify-between p-1 bg-[#F6F5FA] rounded-full border border-[#212121]/5 text-xs">
            {(['all', 'today', 'week', 'month'] as TimeFilter[]).map((tab) => {
              const isActive = timeFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setTimeFilter(tab)}
                  className={`relative flex-1 py-1 rounded-full text-[11px] font-semibold text-center cursor-pointer transition-colors duration-200 select-none ${
                    isActive
                      ? 'text-[#212121] font-bold'
                      : 'text-[#212121]/65 hover:text-[#212121]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarTimeFilterPill"
                      className="absolute inset-0 bg-white rounded-full shadow-2xs -z-0"
                      transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
                    />
                  )}
                  <span className="relative z-10">
                    {tab === 'all' ? 'All' : tab === 'today' ? 'Today' : tab === 'week' ? 'Week' : 'Month'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#212121]/65">
            <span>Journal Timeline</span>
            <span className="px-2 py-0.5 rounded-full bg-[#F6F5FA] text-[10px] font-semibold text-[#212121]">
              {filteredEntries.length}
            </span>
          </div>

          {loadingEntries ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#212121]" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 px-4 text-xs text-[#212121]/65 font-medium">
              No entries found. Click "New Reflection" to begin.
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = currentEntryId === entry.id && viewMode === 'journal';
              const dateStr = formatDateDDMMYYYY(entry.createdAt || entry.updatedAt);
              const firstImg = (entry.images && entry.images.length > 0) ? entry.images[0] : entry.image;

              // Extract section moods if present
              const sectionMoods: MoodType[] = [];
              if (entry.sections && entry.sections.length > 0) {
                entry.sections.forEach((s) => {
                  if (s.mood && !sectionMoods.includes(s.mood)) {
                    sectionMoods.push(s.mood);
                  }
                });
              }
              if (sectionMoods.length === 0) {
                sectionMoods.push(entry.mood || 'neutral');
              }

              return (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setCurrentEntryId(entry.id);
                    setViewMode('journal');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCurrentEntryId(entry.id);
                      setViewMode('journal');
                    }
                  }}
                  className={`p-3.5 rounded-2xl cursor-pointer transition-all relative group flex items-start justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[#212121]/20 ${
                    isSelected
                      ? 'bg-[#F6F5FA] border border-[#212121]/15 shadow-xs'
                      : 'hover:bg-[#F6F5FA]/60 border border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {/* Section / Entry Mood Marbles */}
                      {sectionMoods.map((m, idx) => (
                        <GlowingMarble key={idx} mood={m} size="xs" />
                      ))}
                      <p className={`text-xs font-bold truncate leading-tight ml-1 ${isSelected ? 'text-[#212121]' : 'text-[#212121]/80'}`}>
                        {entry.title || 'Untitled Reflection'}
                      </p>
                    </div>

                    <p className="text-[11px] text-[#212121]/65 truncate pl-4">
                      {entry.content
                        ? entry.content.slice(0, 55)
                        : entry.messages.length > 0
                        ? entry.messages[entry.messages.length - 1].content.slice(0, 55)
                        : 'Empty reflection space...'}
                    </p>

                    <div className="flex items-center gap-2 pl-4 mt-2">
                      <span className="text-[10px] font-semibold text-[#212121]/65">{dateStr}</span>

                      {/* Small Circular Image preview if attached */}
                      {firstImg && (
                        <div className="w-4 h-4 rounded-full overflow-hidden border border-white shadow-2xs shrink-0">
                          <img src={firstImg} alt="Thumbnail" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Voice Note badge */}
                      {entry.voiceNote && (
                        <span className="w-4 h-4 rounded-full bg-[#CFDECA] flex items-center justify-center" title="Voice note attached">
                          <Mic className="w-2.5 h-2.5 text-[#212121]" />
                        </span>
                      )}

                      {/* Location badge */}
                      {entry.location && (
                        <span className="w-4 h-4 rounded-full bg-[#D8DFE9] flex items-center justify-center" title={entry.location.name}>
                          <MapPin className="w-2.5 h-2.5 text-[#212121]" />
                        </span>
                      )}

                      {/* Section count */}
                      {entry.sections && entry.sections.length > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[#212121]/5 text-[#212121]/60">
                          {entry.sections.length} sec
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => deleteEntry(entry.id, e)}
                    className="opacity-0 group-hover:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all shrink-0 -mr-2 -my-1 cursor-pointer"
                    title="Delete Entry"
                    aria-label="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-[#212121]/5 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#CFDECA] text-[#212121] flex items-center justify-center font-bold text-xs shrink-0">
              {user.displayName?.charAt(0) || ((user as any).isGuest ? 'G' : 'U')}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold truncate text-[#212121]">
                {user.displayName || ((user as any).isGuest ? 'Guest Philosopher' : 'Journaler')}
              </p>
              <p className="text-[10px] font-medium text-[#212121]/50 truncate">
                {(user as any).isGuest ? 'Local Guest Mode' : (user.email || 'Cloud Account')}
              </p>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="p-2 rounded-full hover:bg-[#F6F5FA] text-[#212121]/60 hover:text-[#212121] transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          MAIN VIEW CONTAINER
         ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* TOP NAVIGATION BAR WITH DYNAMIC GLIDING PILLS */}
        <header className="h-16 px-6 sm:px-8 border-b border-[#212121]/8 bg-white flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-full hover:bg-[#F6F5FA] text-[#212121] transition-colors cursor-pointer shrink-0"
                title="Open Sidebar"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}

            {/* View Mode Switcher Pills with iOS/One UI Sliding Capsule */}
            <div className="relative flex items-center gap-1 p-1 bg-[#F6F5FA] rounded-full border border-[#212121]/5 shrink-0">
              {[
                { id: 'dashboard' as ViewMode, label: 'Dashboard', icon: Home },
                { id: 'journal' as ViewMode, label: 'Journal', icon: BookOpen },
                { id: 'sanctuary' as ViewMode, label: 'Sanctuary', icon: Headphones },
                {
                  id: 'calendar' as ViewMode,
                  label: 'Calendar',
                  icon: CalendarIcon,
                  badge: reminders.filter((r) => !r.completed).length || undefined,
                },
                { id: 'memories' as ViewMode, label: 'Memories', icon: Sparkles },
                { id: 'map' as ViewMode, label: 'Map', icon: Globe },
                { id: 'analytics' as ViewMode, label: 'Analytics', icon: TrendingUp },
              ].map((tab) => {
                const isActive = viewMode === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id !== 'journal' && tab.id !== 'memories') {
                        setOpenedFromView(null);
                      }
                      setViewMode(tab.id);
                    }}
                    className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide cursor-pointer flex items-center gap-1.5 transition-colors duration-200 select-none ${
                      isActive ? 'text-white' : 'text-[#212121]/60 hover:text-[#212121]'
                    }`}
                    title={tab.label}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavBubble"
                        className="absolute inset-0 bg-[#212121] rounded-full shadow-xs -z-0"
                        transition={{
                          type: 'spring',
                          stiffness: 480,
                          damping: 34,
                          mass: 0.8,
                        }}
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={`relative z-10 px-1.5 py-0.2 rounded-full text-[9px] font-bold transition-colors ${
                          isActive ? 'bg-[#EFF0A3] text-[#212121]' : 'bg-[#212121] text-white'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Header: Cloud status & New Reflection action */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6F5FA] border border-[#212121]/5 text-[11px] font-semibold text-[#212121]/80">
              <span className={`w-2 h-2 rounded-full ${isUsingLocalStorage ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className="hidden md:inline">{isUsingLocalStorage ? 'Local' : 'Cloud'}</span>
            </div>

            <button
              onClick={() => {
                setOpenedFromView(null);
                createNewEntry();
              }}
              className="h-9 px-4 rounded-full bg-[#212121] text-white text-xs font-semibold hover:bg-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Entry</span>
            </button>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────
            ACTIVE VIEW CONTENT WITH SMOOTH IOS / ONE UI FLUID TRANSITIONS
           ───────────────────────────────────────────────────────────── */}
        <AnimatePresence mode={(viewMode === 'memories' || (viewMode === 'journal' && openedFromView === 'memories')) ? undefined : 'wait'}>
          <motion.div
            key={
              (viewMode === 'memories' || (viewMode === 'journal' && openedFromView === 'memories'))
                ? 'memories-shared'
                : (viewMode + (viewMode === 'journal' ? `-${currentEntryId}` : ''))
            }
            initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {viewMode === 'dashboard' && (
              <DashboardHome
                userDisplayName={user.displayName}
                entries={entries}
                reminders={reminders}
                onNavigate={(view) => {
                  setOpenedFromView(null);
                  setViewMode(view);
                }}
                onSelectEntry={(id) => {
                  setOpenedFromView(null);
                  setCurrentEntryId(id);
                  setViewMode('journal');
                }}
                onNewReflection={() => {
                  setOpenedFromView(null);
                  createNewEntry();
                }}
              />
            )}

            {viewMode === 'journal' && currentEntry && (
              <JournalEditorView
                user={user}
                entry={currentEntry}
                onUpdateEntry={(updates) => updateEntry(currentEntry.id, updates)}
                onAddReminder={addReminder}
                openedFromMemories={openedFromView === 'memories'}
                onBackToMemories={() => {
                  setViewMode('memories');
                  setTimeout(() => {
                    setOpenedFromView(null);
                  }, 400);
                }}
              />
            )}

            {viewMode === 'journal' && !currentEntry && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F6F5FA]">
                <div className="w-16 h-16 rounded-3xl bg-[#EFF0A3] flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8 text-[#212121]" />
                </div>
                <h3 className="text-2xl font-bold text-[#212121] mb-2">Select or Start a Reflection</h3>
                <p className="text-xs text-[#212121]/60 max-w-sm mb-6">
                  Your entries and insights will appear here in distraction-free clarity.
                </p>
                <button
                  onClick={() => {
                    setOpenedFromView(null);
                    createNewEntry();
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#212121] text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer"
                >
                  Begin Reflection
                </button>
              </div>
            )}

            {viewMode === 'sanctuary' && (
              <SanctuaryView
                entries={entries}
                userToken={userToken}
                onSaveAsEntry={handleSaveSanctuaryReflection}
                onNavigateToJournal={() => {
                  setOpenedFromView(null);
                  setViewMode('journal');
                }}
              />
            )}

            {viewMode === 'calendar' && (
              <CalendarView
                entries={entries}
                reminders={reminders}
                onSelectEntry={(id) => {
                  setOpenedFromView(null);
                  setCurrentEntryId(id);
                  setViewMode('journal');
                }}
                onNewEntryForDate={(dateStr) => {
                  setOpenedFromView(null);
                  createNewEntry(dateStr);
                }}
                onToggleReminder={toggleReminder}
                onDeleteReminder={deleteReminder}
                onAddReminder={addReminder}
              />
            )}

            {viewMode === 'memories' && (
              <MemoriesView
                entries={entries}
                onSelectEntry={(id) => {
                  setOpenedFromView('memories');
                  setCurrentEntryId(id);
                  setViewMode('journal');
                }}
                onNewEntry={() => {
                  setOpenedFromView('memories');
                  createNewEntry();
                }}
              />
            )}

            {viewMode === 'map' && (
              <MapView
                entries={entries}
                onSelectEntry={(id) => {
                  setCurrentEntryId(id);
                  setViewMode('journal');
                }}
                onNewReflection={() => createNewEntry()}
              />
            )}

            {viewMode === 'analytics' && (
              <AnalyticsView
                userDisplayName={user.displayName}
                entries={entries}
                onOpenEntry={(id) => {
                  setCurrentEntryId(id);
                  setViewMode('journal');
                }}
                onNewReflection={() => createNewEntry()}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// JOURNAL EDITOR VIEW (Distraction-Free + Non-Intrusive AI)
// ─────────────────────────────────────────────────────────────
function JournalEditorView({
  user,
  entry,
  onUpdateEntry,
  onAddReminder,
  openedFromMemories,
  onBackToMemories,
}: {
  user: AuthUser;
  entry: JournalEntry;
  onUpdateEntry: (updates: Partial<JournalEntry>) => void;
  onAddReminder: (title: string, date: string) => void;
  openedFromMemories?: boolean;
  onBackToMemories?: () => void;
}) {
  const [title, setTitle] = useState(entry.title || '');
  const [content, setContent] = useState(entry.content || '');
  const [sections, setSections] = useState<JournalSection[]>(entry.sections || []);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'typing' | 'saving' | 'saved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [dismissedTimelineDates, setDismissedTimelineDates] = useState<string[]>([]);
  const [isPaperMode, setIsPaperMode] = useState<boolean>(true);

  const [aiPrompt, setAiPrompt] = useState(entry.aiPrompt || 'What part of your day are you still processing?');
  const [aiReflection, setAiReflection] = useState(entry.aiReflection || '');
  const [detectedEvents, setDetectedEvents] = useState<ExtractedEvent[]>([]);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [activeSectionMoodPickerId, setActiveSectionMoodPickerId] = useState<string | null>(null);

  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedMsg, setLastFailedMsg] = useState<string | null>(null);

  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [manualLocationText, setManualLocationText] = useState('');
  const [chatMessageInput, setChatMessageInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // Close mood picker on Escape key
  useEffect(() => {
    if (!showMoodPicker) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMoodPicker(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMoodPicker]);

  // Sync state when active entry changes
  useEffect(() => {
    setTitle(entry.title || '');
    setContent(entry.content || '');
    setSections(entry.sections || []);
    setAiPrompt(entry.aiPrompt || 'What part of your day are you still processing?');
    setAiReflection(entry.aiReflection || '');
    setDetectedEvents(entry.extractedEvents || []);
    setSaveStatus('saved');
  }, [entry.id]);

  // Combined images array (supporting up to 10 photos)
  const allImages = useMemo(() => {
    if (entry.images && entry.images.length > 0) return entry.images;
    if (entry.image) return [entry.image];
    return [];
  }, [entry.images, entry.image]);

  // Debounced values for real-time background AI reflection
  const debouncedContent = useDebounce(content, 2000);
  const debouncedTitle = useDebounce(title, 2000);

  // Trigger Save on cease typing (3.5 - 5 seconds pause)
  const markUserTyping = useCallback(() => {
    setIsUserTyping(true);
    setSaveStatus('typing');

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    typingTimerRef.current = setTimeout(() => {
      setIsUserTyping(false);
    }, 1200);

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saving');
      // Save status transitions to saved
      setTimeout(() => {
        setSaveStatus('saved');
        setLastSavedTime(formatDateTimeDDMMYYYY(new Date()));
      }, 400);
    }, 3500);
  }, []);

  const handleTitleChange = (newVal: string) => {
    setTitle(newVal);
    markUserTyping();
    onUpdateEntry({ title: newVal });
  };

  const handleContentChange = (newVal: string) => {
    setContent(newVal);
    markUserTyping();
    onUpdateEntry({ content: newVal });
  };

  // Section handling
  const handleAddSection = () => {
    const newSec: JournalSection = {
      id: 'sec-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      title: 'New Reflection',
      content: '',
      mood: 'neutral',
    };
    const updated = [...sections, newSec];
    setSections(updated);
    markUserTyping();
    onUpdateEntry({ sections: updated });
  };

  const handleUpdateSection = (id: string, updates: Partial<JournalSection>) => {
    const updated = sections.map((s) => (s.id === id ? { ...s, ...updates } : s));
    setSections(updated);
    markUserTyping();
    onUpdateEntry({ sections: updated });
  };

  const handleDeleteSection = (id: string) => {
    const updated = sections.filter((s) => s.id !== id);
    setSections(updated);
    markUserTyping();
    onUpdateEntry({ sections: updated });
  };

  // Multiple Image Uploads (limit up to 10)
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 10 - allImages.length;
    if (remainingSlots <= 0) {
      alert('You have reached the maximum limit of 10 photos for this reflection.');
      return;
    }

    try {
      const toUpload = files.slice(0, remainingSlots);
      const compressed = await Promise.all(toUpload.map((f) => compressImage(f)));
      const updated = [...allImages, ...compressed];
      onUpdateEntry({ images: updated, image: updated[0] });
    } catch {
      alert('Could not compress one of the photos. Please try another image.');
    }
  };

  // Handle timeline relocation if AI detected a past date
  const handleRelocateTimeline = (dateIso: string, displayDate: string) => {
    setDismissedTimelineDates((prev) => [...prev, dateIso, displayDate]);
    onUpdateEntry({
      createdAt: dateIso + 'T12:00:00',
      suggestedTimelineDate: null,
    });
  };

  const handleDismissTimelineSuggestion = (dateIso?: string, displayDate?: string) => {
    if (dateIso || displayDate) {
      setDismissedTimelineDates((prev) => [
        ...prev,
        ...(dateIso ? [dateIso] : []),
        ...(displayDate ? [displayDate] : []),
      ]);
    }
    onUpdateEntry({ suggestedTimelineDate: null });
  };

  // Real-time background AI evaluation
  useEffect(() => {
    if (!isAiEnabled) return;
    if (!debouncedContent.trim() && !debouncedTitle.trim() && sections.length === 0) return;

    let isCancelled = false;

    const performAnalysis = async () => {
      setIsAnalyzing(true);
      setAiAnalysisError(null);
      try {
        const token = await user.getIdToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text: debouncedContent,
            title: debouncedTitle,
            sections: sections.map((s) => ({ id: s.id, title: s.title, content: s.content })),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Analysis failed (${res.status})`);
        }
        const data = await res.json();

        if (!isCancelled) {
          if (data.prompt) setAiPrompt(data.prompt);
          if (data.reflection) setAiReflection(data.reflection);
          if (data.events && Array.isArray(data.events)) setDetectedEvents(data.events);

          // Suppress timeline suggestion if already on that date or dismissed
          let suggested = data.suggestedTimelineDate || null;
          if (suggested) {
            const entryCreatedStr = formatDateDDMMYYYY(entry.createdAt || entry.updatedAt);
            const entryCreatedIso = entry.createdAt ? String(entry.createdAt).slice(0, 10) : '';
            const isAlreadyOnDate =
              suggested.displayDate === entryCreatedStr ||
              suggested.date === entryCreatedIso ||
              dismissedTimelineDates.includes(suggested.date) ||
              dismissedTimelineDates.includes(suggested.displayDate);

            if (isAlreadyOnDate) {
              suggested = null;
            }
          }

          const updates: Partial<JournalEntry> = {
            aiPrompt: data.prompt,
            aiReflection: data.reflection,
            extractedEvents: data.events,
            suggestedTimelineDate: suggested,
            analyticsEntities: {
              names: data.mentionedPersons || [],
              style: data.writingStyle || 'Reflective',
            },
          };

          if (data.isProfessional) {
            updates.isProfessional = true;
          }

          // If entry is in neutral or unset state, update entry mood
          if (!entry.skipMood && data.mood) {
            updates.mood = data.mood as MoodType;
          }

          // If section moods returned, update sections
          if (data.sectionMoods && Array.isArray(data.sectionMoods) && sections.length > 0) {
            const updatedSections = sections.map((sec) => {
              const match = data.sectionMoods.find((sm: any) => sm.id === sec.id);
              return match && match.mood ? { ...sec, mood: match.mood } : sec;
            });
            updates.sections = updatedSections;
            setSections(updatedSections);
          }

          onUpdateEntry(updates);
        }
      } catch (err: any) {
        console.warn('Real-time analysis error:', err);
        if (!isCancelled) {
          setAiAnalysisError(err.message || 'Analysis temporarily unavailable');
        }
      } finally {
        if (!isCancelled) setIsAnalyzing(false);
      }
    };

    performAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [debouncedContent, debouncedTitle, isAiEnabled]);

  // Stop voice recording
  const handleStopVoiceRecording = async () => {
    const audioData = await stopRecording();
    if (audioData) {
      onUpdateEntry({ voiceNote: audioData });
    }
  };

  // Location detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setIsLocationPromptOpen(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        onUpdateEntry({
          location: {
            name: `${lat.toFixed(2)}°, ${lng.toFixed(2)}° (Coordinates)`,
            lat,
            lng,
          },
        });
      },
      () => {
        setIsLocationPromptOpen(true);
      }
    );
  };

  const handleSaveManualLocation = () => {
    if (manualLocationText.trim()) {
      onUpdateEntry({
        location: { name: manualLocationText.trim() },
      });
      setManualLocationText('');
      setIsLocationPromptOpen(false);
    }
  };

  // Send message to Gemini in dialogue
  const handleSendChatMessage = async () => {
    if (!chatMessageInput.trim() || isChatTyping) return;
    const msg = chatMessageInput.trim();
    setChatMessageInput('');
    setIsChatTyping(true);
    setChatError(null);

    const newMsgs: Message[] = [...entry.messages, { role: 'user', content: msg }];
    onUpdateEntry({ messages: newMsgs });

    try {
      const token = await user.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const history = entry.messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          history,
          prompt: `Context of reflection:\nTitle: ${title}\nMain Content: ${content}\nSections: ${sections.map(s => s.title + ': ' + s.content).join('\n')}\n\nUser Question: ${msg}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get a response');

      onUpdateEntry({
        messages: [...newMsgs, { role: 'model', content: data.text }],
      });
    } catch (err: any) {
      console.warn('Chat interaction error:', err);
      setChatError(err.message || 'Failed to connect to reflection assistant.');
      setLastFailedMsg(msg);
    } finally {
      setIsChatTyping(false);
    }
  };

  const formattedEntryDate = formatDateDDMMYYYY(entry.createdAt || entry.updatedAt);

  return (
    <div className={`flex-1 flex h-full overflow-hidden transition-colors duration-300 ${isPaperMode ? 'bg-[#ECE8DF]' : 'bg-[#F6F5FA]'}`}>
      {/* ─────────────────────────────────────────────────────────────
          CENTRAL WRITING CANVAS (Distraction-Free)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-8 lg:p-10 relative">
        <div className="max-w-5xl xl:max-w-6xl w-full mx-auto flex flex-col flex-1">
          {/* AI Past-Date Timeline Relocation Suggestion Banner */}
          {entry.suggestedTimelineDate &&
            !dismissedTimelineDates.includes(entry.suggestedTimelineDate.date) &&
            !dismissedTimelineDates.includes(entry.suggestedTimelineDate.displayDate) &&
            formatDateDDMMYYYY(entry.createdAt) !== entry.suggestedTimelineDate.displayDate &&
            String(entry.createdAt || '').slice(0, 10) !== entry.suggestedTimelineDate.date && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-5 p-4 rounded-3xl bg-[#EFF0A3] border border-[#212121]/15 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#212121] text-white flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4 text-[#EFF0A3]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#212121]">
                    Timeline Shift Suggestion
                  </h4>
                  <p className="text-[11px] text-[#212121]/80 font-medium">
                    {entry.suggestedTimelineDate.reason}. Relocate this entry to {entry.suggestedTimelineDate.displayDate}?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRelocateTimeline(entry.suggestedTimelineDate!.date, entry.suggestedTimelineDate!.displayDate)}
                  className="px-4 py-1.5 rounded-full bg-[#212121] text-white text-xs font-bold hover:bg-black transition-colors shadow-xs cursor-pointer"
                >
                  Move to {entry.suggestedTimelineDate.displayDate}
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissTimelineSuggestion(entry.suggestedTimelineDate?.date, entry.suggestedTimelineDate?.displayDate)}
                  className="p-1.5 text-[#212121]/50 hover:text-black cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Back to Memories Button (Only when opened from Memories view) */}
          {openedFromMemories && onBackToMemories && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-4 flex items-center justify-between"
            >
              <button
                type="button"
                onClick={onBackToMemories}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 hover:bg-white text-xs font-bold text-[#212121] border border-[#212121]/10 shadow-2xs hover:shadow-sm transition-all cursor-pointer group select-none"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to Memories</span>
              </button>
            </motion.div>
          )}

          {/* High GSM Cotton Stationery Paper Sheet Container */}
          <motion.div
            layoutId={openedFromMemories ? `memory-card-${entry.id}` : undefined}
            transition={{
              layout: { type: 'spring', damping: 28, stiffness: 240 },
              opacity: { duration: 0.25 },
            }}
            className={`flex flex-col flex-1 transition-all duration-300 overflow-hidden ${
              isPaperMode
                ? 'high-gsm-paper rounded-3xl p-7 sm:p-12 lg:p-16 shadow-xl mb-8'
                : 'bg-white rounded-3xl p-7 sm:p-12 lg:p-16 shadow-sm border border-[#212121]/8 mb-8'
            }`}
          >
            {/* Top Status Bar: Mood Marble + Date + Save Status + AI Listening Pulse + Paper Style Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#212121]/5">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Primary Glowing Mood Marble */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoodPicker(!showMoodPicker)}
                    aria-haspopup="dialog"
                    aria-expanded={showMoodPicker}
                    className="px-3 py-1.5 rounded-full bg-white border border-[#212121]/10 hover:border-[#212121]/30 flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                    title="Click to adjust mood marble"
                  >
                    <GlowingMarble
                      mood={entry.mood || 'neutral'}
                      size="md"
                      isListening={isUserTyping}
                    />
                    <span className="text-xs font-bold capitalize text-[#212121]">
                      {entry.mood ? MOOD_CONFIGS[entry.mood]?.label || 'Neutral' : 'Neutral'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[#212121]/50" />
                  </button>

                  {/* Mood Marble Selection Popover */}
                  {showMoodPicker && (
                    <div className="absolute top-11 left-0 z-30 bg-white p-3 rounded-2xl border border-[#212121]/10 shadow-xl space-y-1.5 w-60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50 block px-2 pb-1">
                        Choose Emotion Marble
                      </span>
                      {(['neutral', 'great', 'good', 'low', 'rough', 'disturbing', 'professional'] as MoodType[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            onUpdateEntry({ mood: m, skipMood: m === 'professional' });
                            setShowMoodPicker(false);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-[#F6F5FA] flex items-center gap-2.5 text-left text-xs font-semibold text-[#212121] transition-colors cursor-pointer"
                        >
                          <GlowingMarble mood={m} size="sm" />
                          <span>{MOOD_CONFIGS[m]?.label || 'Neutral'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date Badge in DD-MM-YYYY */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#212121]/10 text-xs font-bold text-[#212121]">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#212121]/50" />
                  <span>{formattedEntryDate}</span>
                </div>

                {/* Live AI Listening Indicator */}
                {isUserTyping && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF0A3] text-[#212121] text-[11px] font-bold animate-pulse shadow-2xs">
                    <Sparkles className="w-3 h-3 text-[#212121]" />
                    <span>AI is listening...</span>
                  </div>
                )}

                {/* Save Status Indicator */}
                <div className="flex items-center gap-1 text-[11px] font-semibold">
                  {saveStatus === 'typing' && (
                    <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      <span>Editing...</span>
                    </span>
                  )}
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                      <span>Saving...</span>
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Saved {lastSavedTime ? `• ${lastSavedTime}` : ''}</span>
                    </span>
                  )}
                </div>

                {/* AI Error / Retry Status Pill */}
                {aiAnalysisError && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
                    <span>AI paused ({aiAnalysisError})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAiAnalysisError(null);
                        setIsAnalyzing(true);
                      }}
                      className="underline font-bold hover:text-amber-950 cursor-pointer ml-1"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons: Style Toggle + AI Panel */}
              <div className="flex items-center gap-2">
                {/* Paper & Blue Ink Style Switcher */}
                <button
                  type="button"
                  onClick={() => setIsPaperMode(!isPaperMode)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                    isPaperMode
                      ? 'bg-[#1a4eb8]/10 text-[#1a4eb8] border-[#1a4eb8]/25 font-bold'
                      : 'bg-white text-[#212121]/70 border-[#212121]/15 hover:text-[#212121]'
                  }`}
                  title="Switch between Hand-Written Blue Ink Paper and Clean Modern"
                >
                  <span>{isPaperMode ? '✒️ Blue Ink Diary' : 'Aa Modern Editorial'}</span>
                </button>

                {/* AI Panel toggle button */}
                <button
                  type="button"
                  onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
                  className={`p-2 rounded-full border transition-colors cursor-pointer ${
                    isAiPanelOpen ? 'bg-[#212121] text-white border-[#212121]' : 'bg-white text-[#212121] border-[#212121]/15'
                  }`}
                  title={isAiPanelOpen ? 'Hide AI Assistant Panel' : 'Show AI Assistant Panel'}
                >
                  {isAiPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Title of this reflection..."
              className={`w-full font-bold tracking-tight bg-transparent border-none outline-none mb-4 transition-all ${
                isPaperMode
                  ? 'font-handwriting text-3xl sm:text-5xl text-[#1a4eb8] blue-ink-text blue-ink-placeholder font-bold tracking-wide'
                  : 'text-2xl sm:text-4xl text-[#212121] placeholder-[#212121]/65'
              }`}
            />

            {/* Photo Gallery row if photos attached (up to 10 photos - clean layout, no polaroid frames) */}
            {allImages.length > 0 && (
              <div
                className={`mb-5 p-3 rounded-2xl border transition-all ${
                  isPaperMode
                    ? 'bg-[#FAF6EE]/80 border-[#212121]/8 shadow-2xs'
                    : 'bg-white border-[#212121]/8 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    <span>Attached Photos ({allImages.length}/10)</span>
                  </span>
                  {allImages.length < 10 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-bold text-[#212121] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add more</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                  {allImages.map((src, idx) => (
                    <div key={idx} className="shrink-0 relative">
                      <ImageBall
                        src={src}
                        size="lg"
                        showRemove
                        onRemove={() => {
                          const updated = allImages.filter((_, i) => i !== idx);
                          onUpdateEntry({ images: updated, image: updated.length > 0 ? updated[0] : null });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Distraction-Free Textarea Editor with Handwritten Blue Ink */}
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Pour your thoughts freely onto the page... Gemini reflects quietly alongside you."
              className={`w-full min-h-[380px] sm:min-h-[500px] bg-transparent border-none outline-none resize-none mb-6 transition-all ${
                isPaperMode
                  ? 'font-handwriting text-2xl sm:text-3xl lg:text-[28px] leading-[2.1] text-[#1a4eb8] blue-ink-text blue-ink-placeholder font-medium'
                  : 'text-base sm:text-lg leading-relaxed text-[#212121] placeholder-[#212121]/65 font-medium'
              }`}
            />

            {/* ─────────────────────────────────────────────────────────────
                MULTI-SECTION JOURNALING WITH INDEPENDENT MOOD MARBLES
               ───────────────────────────────────────────────────────────── */}
            {sections.length > 0 && (
              <div className="space-y-6 mb-6">
                <div className="flex items-center justify-between border-b border-[#212121]/5 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Journal Chapters & Moments</span>
                  </span>
                  <span className="text-xs font-bold text-[#212121]/60">
                    {sections.length} Sections
                  </span>
                </div>

                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-3 relative group ${
                      isPaperMode
                        ? 'bg-white/70 backdrop-blur-[2px] border-[#212121]/8 shadow-2xs'
                        : 'bg-white border-[#212121]/8 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Section Independent Mood Marble */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSectionMoodPickerId(
                                activeSectionMoodPickerId === section.id ? null : section.id
                              )
                            }
                            className="px-2.5 py-1 rounded-full bg-white border border-[#212121]/10 flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-[#EFF0A3]/50 transition-colors"
                            title="Set mood for this section"
                          >
                            <GlowingMarble mood={section.mood || 'neutral'} size="sm" />
                            <span className="text-[11px] font-bold text-[#212121] capitalize">
                              {section.mood ? MOOD_CONFIGS[section.mood]?.label || 'Neutral' : 'Neutral'}
                            </span>
                            <ChevronDown className="w-3 h-3 text-[#212121]/40" />
                          </button>

                          {/* Section Mood Picker Popover */}
                          {activeSectionMoodPickerId === section.id && (
                            <div className="absolute top-10 left-0 z-40 bg-white p-3 rounded-2xl border border-[#212121]/10 shadow-xl space-y-1 w-56">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/50 block px-2 pb-1">
                                Section Emotion
                              </span>
                              {(['great', 'good', 'low', 'rough', 'disturbing', 'professional', 'neutral'] as MoodType[]).map(
                                (m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                      handleUpdateSection(section.id, { mood: m });
                                      setActiveSectionMoodPickerId(null);
                                    }}
                                    className="w-full px-2 py-1 rounded-xl hover:bg-[#F6F5FA] flex items-center gap-2 text-left text-xs font-semibold text-[#212121] transition-colors cursor-pointer"
                                  >
                                    <GlowingMarble mood={m} size="xs" />
                                    <span>{MOOD_CONFIGS[m]?.label || 'Neutral'}</span>
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        {/* Section Title Input with handwriting blue ink */}
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => handleUpdateSection(section.id, { title: e.target.value })}
                          placeholder="New Reflection..."
                          className={`font-bold tracking-tight bg-transparent border-none outline-none flex-1 transition-all ${
                            isPaperMode
                              ? 'font-handwriting text-2xl sm:text-3xl text-[#1a4eb8] blue-ink-text blue-ink-placeholder font-bold'
                              : 'text-base font-bold text-[#212121] placeholder-[#212121]/65'
                          }`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSection(section.id)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-gray-400 hover:text-red-600 rounded-full cursor-pointer transition-colors -mr-2"
                        title="Remove section"
                        aria-label="Remove section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Section Textarea with handwriting blue ink */}
                    <textarea
                      value={section.content}
                      onChange={(e) => handleUpdateSection(section.id, { content: e.target.value })}
                      placeholder="Write details for this moment of your day..."
                      className={`w-full min-h-[130px] sm:min-h-[170px] bg-transparent border-none outline-none resize-none font-medium transition-all ${
                        isPaperMode
                          ? 'font-handwriting text-xl sm:text-2xl leading-[1.9] text-[#1a4eb8] blue-ink-text blue-ink-placeholder'
                          : 'text-sm leading-relaxed text-[#212121] placeholder-[#212121]/65'
                      }`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Subtle Section Insertion Divider */}
            <div className="my-5 flex items-center gap-3 group">
              <div className="flex-1 h-[1px] bg-[#212121]/8 group-hover:bg-[#212121]/15 transition-colors" />
              <button
                type="button"
                onClick={handleAddSection}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                  isPaperMode
                    ? 'bg-white hover:bg-[#1a4eb8] text-[#1a4eb8] hover:text-white border border-[#1a4eb8]/20 hover:border-[#1a4eb8]'
                    : 'bg-white hover:bg-[#212121] text-[#212121] hover:text-white border border-[#212121]/12 hover:border-[#212121]'
                }`}
                title="Add a new chapter or section with independent mood marble"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Chapter / Section</span>
              </button>
              <div className="flex-1 h-[1px] bg-[#212121]/8 group-hover:bg-[#212121]/15 transition-colors" />
            </div>

            {/* Multimedia & Editor Toolbar at Bottom */}
            <div className="pt-4 border-t border-[#212121]/5 flex flex-wrap items-center justify-between gap-3 mt-auto">
              <div className="flex items-center gap-2">
                {/* Hidden file input for multiple images */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultipleImageUpload}
                  className="hidden"
                />

                {/* Photo Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F6F5FA] border border-[#212121]/10 text-xs font-semibold text-[#212121] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Attach photos (up to 10)"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#212121]" />
                  <span>Add Photos ({allImages.length}/10)</span>
                </button>

                {/* Voice Note Recording Button */}
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F6F5FA] border border-[#212121]/10 text-xs font-semibold text-[#212121] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title="Record voice note"
                  >
                    <Mic className="w-3.5 h-3.5 text-[#212121]" />
                    <span>Voice Note</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>Recording {recordingTime}s</span>
                    <button
                      type="button"
                      onClick={handleStopVoiceRecording}
                      className="p-1 hover:bg-red-100 rounded-full cursor-pointer ml-1"
                      title="Stop & save"
                    >
                      <Square className="w-3 h-3 fill-red-600" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-1 hover:bg-red-100 rounded-full cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Location Tag Button */}
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F6F5FA] border border-[#212121]/10 text-xs font-semibold text-[#212121] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Add location tag"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#212121]" />
                  <span>Location</span>
                </button>

                {/* Add Section Button in Toolbar */}
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F6F5FA] border border-[#212121]/10 text-xs font-semibold text-[#212121] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Add a new chapter or section with independent mood marble"
                >
                  <Layers className="w-3.5 h-3.5 text-[#212121]" />
                  <span>Add Section</span>
                </button>
              </div>

              {/* Word count & chars */}
              <div className="flex items-center gap-4 text-xs font-medium text-[#212121]/65">
                <span>{content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
                <span>•</span>
                <span>{content.length} chars</span>
              </div>
            </div>

            {/* Location Manual Input Modal if Geolocation Denied */}
            {isLocationPromptOpen && (
              <div className="mt-3 p-3 bg-white rounded-2xl border border-[#212121]/10 shadow-xs flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#212121]/50" />
                <input
                  type="text"
                  value={manualLocationText}
                  onChange={(e) => setManualLocationText(e.target.value)}
                  placeholder="Enter city or location name..."
                  className="flex-1 text-xs bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveManualLocation}
                  className="px-3 py-1 rounded-full bg-[#212121] text-white text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsLocationPromptOpen(false)}
                  className="p-1 text-gray-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT-SIDE AI ASSISTANT PANEL (Responsive Drawer / Slide-Over)
         ───────────────────────────────────────────────────────────── */}
      {/* AI Panel Mobile Backdrop */}
      {isAiPanelOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setIsAiPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      {isAiPanelOpen && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 lg:static lg:w-88 xl:w-96 border-l border-[#212121]/8 bg-white flex flex-col justify-between overflow-hidden shadow-2xl lg:shadow-none shrink-0 transition-transform">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#212121]/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#EFF0A3] flex items-center justify-center text-[#212121]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-[#212121]">Gemini AI Mirror</h3>
              </div>

              <div className="flex items-center gap-2">
                {isAnalyzing && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#212121]/65">
                    <Loader2 className="w-3 h-3 animate-spin text-[#212121]" />
                    <span>Reflecting...</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsAiPanelOpen(false)}
                  className="lg:hidden p-1.5 rounded-full hover:bg-[#F6F5FA] text-[#212121]/70 hover:text-[#212121] cursor-pointer"
                  title="Close AI Assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Real-time Contextual Prompt Card */}
            <div className="bg-[#EFF0A3] p-5 rounded-3xl border border-[#212121]/5 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]">
                  Contextual Prompt
                </span>
                <Sparkles className="w-3.5 h-3.5 text-[#212121]" />
              </div>
              <p className="text-sm font-bold text-[#212121] leading-snug mb-3">
                "{aiPrompt}"
              </p>
              <button
                type="button"
                onClick={() => {
                  const newText = content ? `${content}\n\n${aiPrompt}\n` : `${aiPrompt}\n`;
                  setContent(newText);
                  onUpdateEntry({ content: newText });
                }}
                className="w-full py-1.5 rounded-full bg-[#212121] text-white text-[11px] font-bold hover:bg-black transition-colors cursor-pointer"
              >
                Insert Prompt to Explore
              </button>
            </div>

            {/* Real-time Philosophical Mirror */}
            {aiReflection && (
              <div className="bg-[#CFDECA] p-5 rounded-3xl border border-[#212121]/5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]">
                    Philosophical Insight
                  </span>
                  <Compass className="w-3.5 h-3.5 text-[#212121]" />
                </div>
                <p className="text-xs font-semibold text-[#212121]/90 leading-relaxed">
                  {aiReflection}
                </p>
              </div>
            )}

            {/* Smart Reminders / Detected Events Card */}
            {detectedEvents.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-[#212121]/15 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121] flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Detected Event</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    Smart Extract
                  </span>
                </div>

                {detectedEvents.map((evt, idx) => (
                  <div key={idx} className="p-3 bg-[#F6F5FA] rounded-2xl space-y-2">
                    <p className="text-xs font-bold text-[#212121]">{evt.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#212121]/65 font-semibold">
                        {evt.dateText}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const targetDate = evt.suggestedDate || new Date().toISOString().split('T')[0];
                          onAddReminder(evt.title, targetDate);
                          alert(`Added "${evt.title}" to Calendar Reminders!`);
                        }}
                        className="px-3 py-1 rounded-full bg-[#212121] text-white text-[10px] font-bold hover:bg-black transition-colors cursor-pointer"
                      >
                        + Add to Calendar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Conversation Stream */}
            {entry.messages.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/65 block">
                  Dialogue History
                </span>
                {entry.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-2xl text-xs font-medium ${
                      m.role === 'user'
                        ? 'bg-[#F6F5FA] ml-4 text-[#212121]'
                        : 'bg-[#CFDECA]/40 mr-4 border border-[#212121]/5 text-[#212121]'
                    }`}
                  >
                    <p className="text-[10px] font-bold text-[#212121]/65 uppercase mb-1">
                      {m.role === 'user' ? 'You' : 'Gemini'}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer: Toggle AI & Direct Question input */}
          <div className="p-4 border-t border-[#212121]/5 bg-[#F6F5FA] space-y-3">
            {/* Transient Chat Error Banner */}
            {chatError && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-800">
                <span>{chatError}</span>
                {lastFailedMsg && (
                  <button
                    type="button"
                    onClick={() => {
                      setChatMessageInput(lastFailedMsg);
                      setChatError(null);
                    }}
                    className="underline font-bold hover:text-amber-950 ml-2 cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* Ask Gemini input */}
            <div className="relative flex items-center bg-white rounded-full border border-[#212121]/15 px-3 py-1.5 focus-within:border-[#212121]">
              <input
                type="text"
                value={chatMessageInput}
                onChange={(e) => setChatMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder="Ask Gemini to unpack this..."
                className="w-full text-xs outline-none bg-transparent placeholder-[#212121]/65"
              />
              <button
                type="button"
                onClick={handleSendChatMessage}
                disabled={!chatMessageInput.trim() || isChatTyping}
                className="w-7 h-7 rounded-full bg-[#212121] text-white flex items-center justify-center hover:bg-black disabled:opacity-40 cursor-pointer shrink-0 ml-1"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#212121]/70">AI Background Analysis</span>
              <button
                type="button"
                onClick={() => setIsAiEnabled(!isAiEnabled)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  isAiEnabled ? 'bg-[#212121] text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {isAiEnabled ? 'Active' : 'Paused'}
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
