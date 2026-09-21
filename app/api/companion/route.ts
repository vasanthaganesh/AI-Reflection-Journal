import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getPersonaPrompt, COMPANION_PERSONAS } from '@/lib/personas';
import { CompanionPersonaId } from '@/lib/types';

const AUDIO_MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

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
  header.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  header.writeUInt16LE(2, 32);  // BlockAlign
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

async function generateContentWithFallback(ai: GoogleGenAI, contents: any, systemInstruction: string, voiceName = 'Aoede') {
  let lastError: any;
  
  // First attempt: Request Audio + Text with prebuilt Gemini voice
  for (const model of AUDIO_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseModalities: ['AUDIO', 'TEXT'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      });
      return { response, hasAudio: true };
    } catch (error: any) {
      console.warn(`[Companion API] Audio model ${model} failed, trying fallback:`, error.message);
      lastError = error;
    }
  }

  // Fallback attempt: Request Text-only if Audio modality is unavailable
  for (const model of AUDIO_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction },
      });
      return { response, hasAudio: false };
    } catch (error: any) {
      console.warn(`[Companion API] Fallback text model ${model} failed:`, error.message);
      lastError = error;
    }
  }

  throw lastError;
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
    if (process.env.NODE_ENV === 'production') {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (!decoded || !decoded.uid) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
      }
    } else {
      if (token !== 'guest-dev-token') {
        try {
          await adminAuth.verifyIdToken(token);
        } catch {
          return NextResponse.json({ error: 'Invalid authentication token: unauthorized' }, { status: 401 });
        }
      }
    }

    // Body parsing
    const body = (await req.json().catch(() => null)) || {};
    const { history, prompt, personaId = 'samantha', journalContext } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const validPersonaId = (COMPANION_PERSONAS[personaId as CompanionPersonaId] ? personaId : 'samantha') as CompanionPersonaId;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json({
        error: 'Missing Gemini API Key. Please provide a GEMINI_API_KEY in your environment.',
      }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

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

    const persona = COMPANION_PERSONAS[validPersonaId];
    const voiceName = persona.voiceName || 'Aoede';

    const { response, hasAudio } = await generateContentWithFallback(ai, contents, systemInstruction, voiceName);
    
    let rawText = response.text || '';
    let audioDataUrl: string | null = null;

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          try {
            audioDataUrl = pcmToWavDataUrl(part.inlineData.data, 24000);
          } catch (e) {
            console.warn('[Companion Audio Conversion Error]:', e);
          }
        }
        if (part.text && !rawText) {
          rawText = part.text;
        }
      }
    }

    // Extract emotion bracket tag and clean speech text
    const { emotion, text: textAfterEmotion } = parseEmotion(rawText);
    const spokenText = cleanSpeechText(textAfterEmotion);

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
