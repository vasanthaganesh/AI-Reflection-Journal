'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CompanionPersonaId, 
  CompanionMessage, 
  JournalEntry, 
  MoodType, 
  CrystallizeResult 
} from '@/lib/types';
import { COMPANION_PERSONAS, DEFAULT_PERSONA_ID } from '@/lib/personas';
import { LivingMarbleAura } from '@/components/LivingMarbleAura';
import { 
  Mic, 
  MicOff, 
  Send, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  Sparkles, 
  Loader2, 
  Trash2, 
  ArrowRight, 
  Check, 
  Info,
  X
} from 'lucide-react';

interface SanctuaryViewProps {
  entries: JournalEntry[];
  userToken: string;
  onSaveAsEntry: (entry: {
    title: string;
    content: string;
    mood: MoodType;
    tags: string[];
    aiReflection: string;
  }) => Promise<void>;
  onNavigateToJournal: () => void;
}

export const SanctuaryView: React.FC<SanctuaryViewProps> = ({
  entries,
  userToken,
  onSaveAsEntry,
  onNavigateToJournal,
}) => {
  const [activePersonaId, setActivePersonaId] = useState<CompanionPersonaId>(DEFAULT_PERSONA_ID);
  const activePersona = COMPANION_PERSONAS[activePersonaId];

  const [messages, setMessages] = useState<CompanionMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      content: COMPANION_PERSONAS[DEFAULT_PERSONA_ID].greeting,
      emotion: 'warm',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [companionState, setCompanionState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [currentEmotion, setCurrentEmotion] = useState('warm');
  const [currentSubtitle, setCurrentSubtitle] = useState(COMPANION_PERSONAS[DEFAULT_PERSONA_ID].greeting);
  const [audioLevel, setAudioLevel] = useState(0.0);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isCrystallizing, setIsCrystallizing] = useState(false);
  const [crystallizeSuccess, setCrystallizeSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Speech Recognition ref
  const recognitionRef = useRef<any>(null);
  const isHoldingSpaceRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Audio Context for mic level visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // Prepare recent journal memories context
  const journalContextString = useCallback(() => {
    if (!entries || entries.length === 0) return '';
    const recent = entries.slice(0, 4);
    return recent
      .map((e) => {
        const dateStr = new Date(e.createdAt).toLocaleDateString();
        const snippet = (e.content || '').substring(0, 150).replace(/\n+/g, ' ');
        return `[${dateStr}] Title: "${e.title}". Mood: ${e.mood || 'neutral'}. Snippet: "${snippet}..."`;
      })
      .join('\n');
  }, [entries]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (isHistoryDrawerOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHistoryDrawerOpen]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackRafIdRef = useRef<number | null>(null);

  const initOrResumeAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        playbackAnalyserRef.current = analyser;
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch (e) {
      console.warn('AudioContext initialization error:', e);
      return null;
    }
  }, []);

  const stopActiveAudio = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (playbackRafIdRef.current) {
      cancelAnimationFrame(playbackRafIdRef.current);
      playbackRafIdRef.current = null;
    }
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null;
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {}
      currentSourceRef.current = null;
    }
    setCompanionState('idle');
    setAudioLevel(0);
  }, []);

  // Web Speech API client-side fallback with strict female voice filtering
  const speakBrowserFallback = useCallback((text: string, targetPersonaId: CompanionPersonaId = activePersonaId) => {
    if (isVoiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setCompanionState('idle');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\*.*?\*/g, '').replace(/\([a-zA-Z\s]+\)/g, '').replace(/\[.*?\]/g, '').trim();
      if (!cleanText) {
        setCompanionState('idle');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Pitch & Rate tuning for natural female warmth
      if (targetPersonaId === 'samantha') {
        utterance.pitch = 1.15; // Soft, warm female pitch
        utterance.rate = 0.94;  // Soothing conversational pace
      } else if (targetPersonaId === 'parent') {
        utterance.pitch = 1.08;
        utterance.rate = 0.90;
      } else if (targetPersonaId === 'bestie') {
        utterance.pitch = 1.12;
        utterance.rate = 1.0;
      } else {
        utterance.pitch = 1.10;
        utterance.rate = 0.95;
      }

      const voices = window.speechSynthesis.getVoices();
      
      const MALE_KEYWORDS = [
        'male', 'david', 'mark', 'george', 'daniel', 'guy', 'stefan', 
        'james', 'richard', 'christopher', 'sean', 'adam', 'paul', 'brian'
      ];
      const isMale = (v: SpeechSynthesisVoice) => MALE_KEYWORDS.some((kw) => v.name.toLowerCase().includes(kw));

      const PREFERRED_FEMALE_VOICES = [
        'jenny', 'aria', 'zira', 'samantha', 'victoria', 'karen', 'fiona',
        'moira', 'veena', 'google us english', 'google uk english female',
        'female', 'natural', 'siri', 'eva', 'hazel', 'catherine'
      ];

      // 1. Match preferred female voice
      let selectedVoice = voices.find((v) => {
        if (isMale(v)) return false;
        const nameLower = v.name.toLowerCase();
        return v.lang.startsWith('en') && PREFERRED_FEMALE_VOICES.some((kw) => nameLower.includes(kw));
      });

      // 2. Fallback: Any English voice that is NOT male
      if (!selectedVoice) {
        selectedVoice = voices.find((v) => v.lang.startsWith('en') && !isMale(v));
      }

      // 3. Fallback: Any voice that is NOT male
      if (!selectedVoice) {
        selectedVoice = voices.find((v) => !isMale(v));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => setCompanionState('speaking');
      utterance.onend = () => setCompanionState('idle');
      utterance.onerror = () => setCompanionState('idle');

      window.speechSynthesis.speak(utterance);
    } catch {
      setCompanionState('idle');
    }
  }, [isVoiceMuted, activePersonaId]);

  // Web Audio API playback for natural Gemini voice (Aoede, Puck, Charon, Kore, Fenrir)
  const playGeminiAudio = useCallback(async (audioDataUrl: string, fallbackText?: string) => {
    if (isVoiceMuted || typeof window === 'undefined') {
      setCompanionState('idle');
      return;
    }

    try {
      stopActiveAudio();
      const ctx = initOrResumeAudioContext();
      if (!ctx) {
        if (fallbackText) speakBrowserFallback(fallbackText);
        return;
      }
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Extract raw base64 data whether payload is data:audio/wav;base64,... or plain base64
      const base64Data = audioDataUrl.includes(',') ? audioDataUrl.split(',')[1] : audioDataUrl;
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const analyser = playbackAnalyserRef.current;
      if (analyser) {
        source.connect(analyser);
        analyser.connect(ctx.destination);

        // Real-time audio frequency visualizer that drives the specular marble pulsation
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length / 255.0;
          setAudioLevel(Math.min(1.0, avg * 1.8));
          playbackRafIdRef.current = requestAnimationFrame(updateAudioLevel);
        };
        playbackRafIdRef.current = requestAnimationFrame(updateAudioLevel);
      } else {
        source.connect(ctx.destination);
      }

      currentSourceRef.current = source;
      setCompanionState('speaking');

      source.onended = () => {
        if (currentSourceRef.current === source) {
          currentSourceRef.current = null;
        }
        stopActiveAudio();
      };

      source.start(0);
    } catch (err) {
      console.warn('Gemini Web Audio playback error, switching to browser speech synthesis:', err);
      stopActiveAudio();
      if (fallbackText && !isVoiceMuted) {
        speakBrowserFallback(fallbackText);
      }
    }
  }, [isVoiceMuted, initOrResumeAudioContext, stopActiveAudio, speakBrowserFallback]);

  // Handle persona change
  const handleSelectPersona = async (id: CompanionPersonaId) => {
    setActivePersonaId(id);
    const newPersona = COMPANION_PERSONAS[id];
    setCurrentSubtitle(newPersona.greeting);
    setCurrentEmotion('warm');
    setMessages((prev) => [
      ...prev,
      {
        id: 'switch-' + Date.now(),
        role: 'assistant',
        content: newPersona.greeting,
        emotion: 'warm',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    if (isVoiceMuted) return;

    // Synthesize greeting with natural Gemini Voice
    try {
      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken || 'guest-dev-token'}`,
        },
        body: JSON.stringify({
          prompt: newPersona.greeting,
          personaId: id,
          ttsOnly: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          playGeminiAudio(data.audio, newPersona.greeting);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to synthesize persona greeting voice:', e);
    }

    if (!isVoiceMuted) {
      speakBrowserFallback(newPersona.greeting);
    }
  };

  // Send turn to backend
  const handleSendMessage = async (rawInput?: string) => {
    const textToSend = (rawInput !== undefined ? rawInput : inputText).trim();
    if (!textToSend || companionState === 'thinking') return;

    setInputText('');
    setErrorMessage(null);

    // Stop previous audio playback if user speaks again
    stopActiveAudio();

    const userMsg: CompanionMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setCompanionState('thinking');
    setCurrentSubtitle('Thinking...');

    try {
      // Build conversation history for Gemini
      const apiHistory = messages.slice(-12).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken || 'guest-dev-token'}`,
        },
        body: JSON.stringify({
          prompt: textToSend,
          history: apiHistory,
          personaId: activePersonaId,
          journalContext: journalContextString(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to receive companion response.');
      }

      const data = await res.json();
      const replyText = data.text || 'I hear you completely.';
      const emotion = data.emotion || 'warm';

      setCurrentEmotion(emotion);
      setCurrentSubtitle(replyText);

      const assistantMsg: CompanionMessage = {
        id: 'ast-' + Date.now(),
        role: 'assistant',
        content: replyText,
        emotion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.audio && !isVoiceMuted) {
        playGeminiAudio(data.audio, replyText);
      } else if (!isVoiceMuted) {
        speakBrowserFallback(replyText);
      } else {
        setCompanionState('idle');
      }
    } catch (err: any) {
      console.error('Companion error:', err);
      setErrorMessage(err.message || 'Companion connection interrupted.');
      setCompanionState('idle');
      setCurrentSubtitle('I am right here whenever you want to try again.');
    }
  };

  // Mic audio analyzer setup
  const startMicAnalyzer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, (avg / 128) * 1.5);
        setAudioLevel(normalized);
        micAnimFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.warn('Could not initialize microphone visualizer:', err);
    }
  };

  const stopMicAnalyzer = () => {
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0.0);
  };

  // Speech Recognition (Web Speech API)
  const startListening = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMessage('Speech recognition is not supported in this browser. You can type freely below!');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setCompanionState('listening');
        startMicAnalyzer();
        setCurrentSubtitle('Listening to you...');
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        stopMicAnalyzer();
        setCompanionState('idle');
      };

      rec.onend = () => {
        stopMicAnalyzer();
        if (inputText.trim()) {
          handleSendMessage(inputText);
        } else {
          setCompanionState('idle');
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      stopMicAnalyzer();
      setCompanionState('idle');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    stopMicAnalyzer();
  };

  // Push-to-Talk via Spacebar listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not actively typing into an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space' && !isHoldingSpaceRef.current && companionState !== 'speaking' && companionState !== 'thinking') {
        e.preventDefault();
        isHoldingSpaceRef.current = true;
        startListening();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isHoldingSpaceRef.current) {
        e.preventDefault();
        isHoldingSpaceRef.current = false;
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopMicAnalyzer();
    };
  }, [companionState, inputText]);

  // 1-Click "Save Conversation as Journal Reflection"
  const handleCrystallizeReflection = async () => {
    const dialogueMessages = messages.filter((m) => m.id !== 'init');
    if (dialogueMessages.length === 0) {
      setErrorMessage('Share a few thoughts with your companion before crystallizing a journal reflection.');
      return;
    }

    setIsCrystallizing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/companion/crystallize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken || 'guest-dev-token'}`,
        },
        body: JSON.stringify({
          messages: dialogueMessages.map((m) => ({ role: m.role, content: m.content })),
          personaId: activePersonaId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to crystallize conversation into entry.');
      }

      const crystallizeResult: CrystallizeResult = await res.json();
      await onSaveAsEntry(crystallizeResult);
      setCrystallizeSuccess(true);

      setTimeout(() => {
        onNavigateToJournal();
      }, 1200);
    } catch (err: any) {
      console.error('Crystallize error:', err);
      setErrorMessage(err.message || 'Could not save reflection.');
    } finally {
      setIsCrystallizing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F6F5FA] relative overflow-hidden selection:bg-[#EFF0A3]">
      {/* Background ambient lighting */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none opacity-45 transition-all duration-700"
        style={{
          background: `radial-gradient(circle, rgba(${activePersona.auraColors.c1.join(',')}, 0.35) 0%, rgba(${activePersona.auraColors.c2.join(',')}, 0.15) 50%, transparent 80%)`,
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          TOP TOOLBAR: PERSONA CAROUSEL & ACTIONS
         ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-6 sm:px-8 py-3.5 border-b border-[#212121]/8 bg-white/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        {/* Persona Selector Capsule */}
        <div className="relative flex items-center p-1 bg-[#F6F5FA] rounded-full border border-[#212121]/5 overflow-x-auto no-scrollbar">
          {(Object.keys(COMPANION_PERSONAS) as CompanionPersonaId[]).map((id) => {
            const p = COMPANION_PERSONAS[id];
            const isActive = activePersonaId === id;
            return (
              <button
                key={id}
                onClick={() => handleSelectPersona(id)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide cursor-pointer flex items-center gap-1.5 transition-colors duration-200 select-none shrink-0 ${
                  isActive ? 'text-[#212121] font-bold' : 'text-[#212121]/60 hover:text-[#212121]'
                }`}
                title={p.description}
              >
                {isActive && (
                  <motion.div
                    layoutId="sanctuaryPersonaPill"
                    className="absolute inset-0 bg-white rounded-full shadow-xs -z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10 text-sm">{p.avatarEmoji}</span>
                <span className="relative z-10">{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Mute Voice Toggle */}
          <button
            onClick={() => {
              setIsVoiceMuted((prev) => {
                if (!prev) stopActiveAudio();
                return !prev;
              });
            }}
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              isVoiceMuted
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-white text-[#212121]/70 border-[#212121]/10 hover:text-[#212121]'
            }`}
            title={isVoiceMuted ? 'Unmute companion voice' : 'Mute companion voice'}
          >
            {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Toggle Transcript Drawer */}
          <button
            onClick={() => setIsHistoryDrawerOpen((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isHistoryDrawerOpen
                ? 'bg-[#212121] text-white border-[#212121]'
                : 'bg-white text-[#212121]/70 border-[#212121]/10 hover:text-[#212121]'
            }`}
            title="Toggle conversation transcript"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dialogue</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#212121]/10 text-[10px] font-bold">
              {messages.length}
            </span>
          </button>

          {/* 1-Click Crystallize Reflection */}
          <button
            onClick={handleCrystallizeReflection}
            disabled={isCrystallizing || crystallizeSuccess}
            className="px-4 py-1.5 rounded-full bg-[#212121] text-white text-xs font-semibold hover:bg-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
            title="Save this conversation as a new Journal Reflection entry"
          >
            {isCrystallizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Crystallizing...</span>
              </>
            ) : crystallizeSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Saved to Journal!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#EFF0A3]" />
                <span className="hidden sm:inline">Save as Reflection</span>
                <span className="sm:hidden">Reflect</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN SANCTUARY STAGE
         ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative z-10">
          {/* Living Neural Marble Aura */}
          <div className="relative my-auto flex flex-col items-center">
            <LivingMarbleAura
              palette={activePersona.auraColors}
              state={companionState}
              mood={currentEmotion}
              audioLevel={audioLevel}
              className="w-64 h-64 sm:w-80 sm:h-80"
            />

            {/* Persona and Mood badge */}
            <div className="mt-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white border border-[#212121]/8 shadow-xs text-xs font-bold text-[#212121] flex items-center gap-1.5">
                <span>{activePersona.avatarEmoji}</span>
                <span>{activePersona.name}</span>
                <span className="text-[#212121]/40 font-normal">({activePersona.role})</span>
              </span>

              <span className="px-2.5 py-0.5 rounded-full bg-[#CFDECA]/70 text-[#212121] text-[11px] font-bold capitalize">
                [{currentEmotion}]
              </span>
            </div>

            {/* Subtitles / Spoken Speech Banner */}
            <div className="mt-5 max-w-xl text-center px-4">
              <p className="text-base sm:text-lg text-[#212121] font-medium leading-relaxed blue-ink-text font-sans">
                &ldquo;{currentSubtitle}&rdquo;
              </p>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 text-xs rounded-full border border-red-200 flex items-center gap-2 animate-fade-in">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
                <button 
                  onClick={() => setErrorMessage(null)} 
                  className="ml-1 cursor-pointer hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              BOTTOM INTERACTION PILL
             ───────────────────────────────────────────────────────────── */}
          <div className="w-full max-w-xl pb-2">
            <div className="relative flex items-center bg-white rounded-full border border-[#212121]/15 shadow-md px-2 py-1.5 focus-within:border-[#212121] transition-all">
              {/* Mic Trigger button */}
              <button
                type="button"
                onClick={companionState === 'listening' ? stopListening : startListening}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  companionState === 'listening'
                    ? 'bg-red-500 text-white animate-pulse shadow-md'
                    : 'bg-[#F6F5FA] text-[#212121] hover:bg-[#212121] hover:text-white'
                }`}
                title={companionState === 'listening' ? 'Click to stop listening' : 'Click or hold Space to speak'}
              >
                {companionState === 'listening' ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>

              {/* Text input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  companionState === 'listening'
                    ? 'Listening to you speak...'
                    : `Confide in ${activePersona.name} or hold Space to talk...`
                }
                className="flex-1 px-4 text-xs sm:text-sm bg-transparent outline-none text-[#212121] placeholder-[#212121]/50"
              />

              {/* Send button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || companionState === 'thinking'}
                className="w-10 h-10 rounded-full bg-[#212121] text-white flex items-center justify-center hover:bg-black transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-xs"
                title="Send message"
              >
                {companionState === 'thinking' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Hint pill */}
            <div className="flex items-center justify-center gap-3 mt-2.5 text-[11px] text-[#212121]/50 font-medium">
              <span>Tip: Hold <kbd className="px-1.5 py-0.5 bg-white border border-[#212121]/15 rounded text-[10px] shadow-2xs font-mono font-semibold">Space</kbd> to talk freely</span>
              <span>&bull;</span>
              <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-[#212121]/15 rounded text-[10px] shadow-2xs font-mono font-semibold">Enter</kbd> to send</span>
            </div>
          </div>
        </main>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT SLIDE-OVER DIALOGUE TRANSCRIPT DRAWER
           ───────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {isHistoryDrawerOpen && (
            <motion.aside
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
              className="w-80 sm:w-96 border-l border-[#212121]/8 bg-white flex flex-col h-full z-20 shadow-xl"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-[#212121]/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#212121]" />
                  <span className="font-bold text-sm tracking-tight text-[#212121]">
                    Sanctuary Dialogue
                  </span>
                </div>
                <button
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[#F6F5FA] text-[#212121]/60 hover:text-[#212121] cursor-pointer"
                  title="Close dialogue"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dialogue Transcript List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 high-gsm-paper">
                {messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] font-bold text-[#212121]/45 mb-1 px-1">
                        {isUser ? 'You' : `${activePersona.name} ${m.emotion ? `[${m.emotion}]` : ''}`} &bull; {m.timestamp}
                      </span>
                      <div
                        className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? 'bg-[#212121] text-white rounded-br-xs shadow-xs'
                            : 'bg-white border border-[#212121]/10 text-[#212121] rounded-bl-xs shadow-xs'
                        }`}
                      >
                        <p className={!isUser ? 'blue-ink-text' : ''}>{m.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-3.5 border-t border-[#212121]/5 bg-[#F6F5FA] flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setMessages([
                      {
                        id: 'init-' + Date.now(),
                        role: 'assistant',
                        content: activePersona.greeting,
                        emotion: 'warm',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      },
                    ]);
                  }}
                  className="p-2 rounded-full hover:bg-white text-[#212121]/60 hover:text-red-600 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                  title="Clear dialogue transcript"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">Clear</span>
                </button>

                <button
                  onClick={handleCrystallizeReflection}
                  disabled={isCrystallizing || crystallizeSuccess}
                  className="px-4 py-2 rounded-full bg-[#212121] text-white text-xs font-semibold hover:bg-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {isCrystallizing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-[#EFF0A3]" />
                  )}
                  <span>Save as Reflection</span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
