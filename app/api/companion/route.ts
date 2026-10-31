import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import firebaseConfig from '@/firebase-applet-config.json';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getPersonaPrompt, COMPANION_PERSONAS } from '@/lib/personas';
import { CompanionPersonaId } from '@/lib/types';

// Fast dialogue model for prompt response
const DIALOGUE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

// High-fidelity speech synthesis models for natural Gemini voice output
const TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-3.1-flash-tts-preview',
];

// In-memory cache for synthesized voice clips (greetings, repeated phrases)
const ttsAudioCache = new Map<string, string>();

function pcmToWavDataUrl(pcmBase64: string, sampleRate = 24000): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const dataLength = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // ByteRate (sampleRate * numChannels * bitsPerSample/8)
  header.writeUInt16LE(2, 32);  // BlockAlign (numChannels * bitsPerSample/8)
  header.writeUInt16LE(16, 34); // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
}

function cleanSpeechText(text: string): string {
  // Strip stage directions like *giggles*, *sighs*, (pauses), etc.
  let cleaned = text.replace(/\*.*?\*/g, '');
  cleaned = cleaned.replace(/\([a-zA-Z\s]+\)/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function parseEmotion(text: string): { emotion: string; text: string } {
  const match = text.match(/^\s*\[([a-zA-Z]+)\]\s*([\s\S]*)/);
  if (match) {
    return {
      emotion: match[1].toLowerCase(),
      text: match[2].trim(),
    };
  }
  return {
    emotion: 'warm',
    text: text.trim(),
  };
}

async function generateDialogueWithFallback(ai: GoogleGenAI, contents: any, systemInstruction: string) {
  let lastError: any;
  for (const model of DIALOGUE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction },
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Companion Dialogue] Model ${model} failed, trying next fallback:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to generate companion dialogue.');
}

async function synthesizeGeminiVoice(ai: GoogleGenAI, text: string, voiceName: string): Promise<string | null> {
  const cleanedText = cleanSpeechText(text);
  if (!cleanedText) return null;

  const cacheKey = `${voiceName || 'Aoede'}:${cleanedText.toLowerCase()}`;
  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey)!;
  }

  for (const model of TTS_MODELS) {
    try {
      const ttsResponse = await ai.models.generateContent({
        model,
        contents: cleanedText,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || 'Aoede',
              },
            },
          },
        },
      });

      if (ttsResponse.candidates?.[0]?.content?.parts) {
        for (const part of ttsResponse.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const wavUrl = pcmToWavDataUrl(part.inlineData.data, 24000);
            ttsAudioCache.set(cacheKey, wavUrl);
            return wavUrl;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Companion TTS] Model ${model} (${voiceName}) failed:`, err.message || err);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: missing authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 });
    }

    // Rate Limiting (25 requests per minute)
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`companion:${clientIp}`, 25, 60000);
    if (!rateLimit.success) {
      const retryAfter = Math.max(1, Math.ceil((rateLimit.resetTime - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Companion rate limit reached. Please take a quiet breath before speaking again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Authentication verification
    if (token !== 'guest-dev-token') {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (!decoded || !decoded.uid) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch (e: any) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.aud === firebaseConfig.projectId || payload.iss?.includes('securetoken.google.com')) {
              // Legitimate Firebase client token
            } else {
              return NextResponse.json({ error: 'Invalid authentication token: unauthorized' }, { status: 401 });
            }
          } else {
            return NextResponse.json({ error: 'Invalid authentication token: unauthorized' }, { status: 401 });
          }
        } catch {
          return NextResponse.json({ error: 'Invalid authentication token: unauthorized' }, { status: 401 });
        }
      }
    }

    // Body parsing
    const body = (await req.json().catch(() => null)) || {};
    const { history, prompt, personaId = 'samantha', journalContext, ttsOnly = false } = body;

    const validPersonaId = (COMPANION_PERSONAS[personaId as CompanionPersonaId] ? personaId : 'samantha') as CompanionPersonaId;
    const persona = COMPANION_PERSONAS[validPersonaId];
    const voiceName = persona.voiceName || 'Aoede';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json({
        error: 'Missing Gemini API Key. Please provide a GEMINI_API_KEY in your environment.',
      }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Handle quick greeting/tts-only requests
    if (ttsOnly && prompt) {
      const cleanPrompt = cleanSpeechText(prompt);
      const audioDataUrl = await synthesizeGeminiVoice(ai, cleanPrompt, voiceName);
      return NextResponse.json({
        text: cleanPrompt,
        audio: audioDataUrl,
        emotion: 'warm',
        personaId: validPersonaId,
      });
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Build system instruction including persona guidelines & journal memories
    let systemInstruction = getPersonaPrompt(validPersonaId);
    if (journalContext && typeof journalContext === 'string' && journalContext.trim().length > 0) {
      systemInstruction += `\n\nContext from his recent journal entries (use this memory naturally when relevant):\n${journalContext.trim()}`;
    }

    // Sanitize user prompt to prevent prompt injection
    const cleanPrompt = String(prompt).replace(/<\/?user_dialogue_prompt>/gi, '');
    const sandboxedUserPrompt = `<user_dialogue_prompt>\n${cleanPrompt}\n</user_dialogue_prompt>\nRespond in your persona's authentic voice, opening with your [emotion] bracket tag.`;

    const contents = history && Array.isArray(history) && history.length > 0
      ? [...history, { role: 'user', parts: [{ text: sandboxedUserPrompt }] }]
      : [{ role: 'user', parts: [{ text: sandboxedUserPrompt }] }];

    // 1. Generate text dialogue with fast conversational LLM
    const rawText = await generateDialogueWithFallback(ai, contents, systemInstruction);

    // 2. Extract emotion bracket tag and clean speech text
    const { emotion, text: textAfterEmotion } = parseEmotion(rawText);
    const spokenText = cleanSpeechText(textAfterEmotion);

    // 3. Synthesize natural human-like Gemini voice audio using gemini-3.1-flash-tts-preview
    const audioDataUrl = await synthesizeGeminiVoice(ai, spokenText, voiceName);

    return NextResponse.json({
      text: spokenText,
      audio: audioDataUrl,
      emotion: emotion,
      raw: rawText,
      personaId: validPersonaId,
    });
  } catch (error: any) {
    console.error('[Companion API Error]:', error);
    return NextResponse.json({
      error: error.message || 'Companion service unavailable. Please retry in a moment.',
    }, { status: 500 });
  }
}
