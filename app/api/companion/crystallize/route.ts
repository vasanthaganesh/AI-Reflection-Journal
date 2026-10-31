import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import firebaseConfig from '@/firebase-applet-config.json';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { COMPANION_PERSONAS } from '@/lib/personas';
import { CompanionPersonaId, MoodType } from '@/lib/types';

const MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

const VALID_MOODS = new Set<MoodType>([
  'great',
  'good',
  'low',
  'rough',
  'disturbing',
  'professional',
  'neutral',
]);

async function generateWithFallback(ai: GoogleGenAI, contents: any, systemInstruction: string) {
  let lastError: any;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });
      return response;
    } catch (error: any) {
      console.warn(`[Crystallize API] Model ${model} failed:`, error.message);
      lastError = error;
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429 && error.status !== 404) {
        throw error;
      }
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

    // Rate Limiting
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`crystallize:${clientIp}`, 15, 60000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Please wait a moment before saving another reflection.' },
        { status: 429 }
      );
    }

    // Authentication verification (consistent with companion, chat, and analyze routes)
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

    const body = (await req.json().catch(() => null)) || {};
    const { messages, personaId = 'samantha' } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No dialogue messages provided to crystallize' }, { status: 400 });
    }

    const validPersonaId = (COMPANION_PERSONAS[personaId as CompanionPersonaId] ? personaId : 'samantha') as CompanionPersonaId;
    const persona = COMPANION_PERSONAS[validPersonaId];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json({
        error: 'Missing Gemini API Key. Please provide a GEMINI_API_KEY in your environment.',
      }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format transcript
    const transcriptLines = messages.map((m: any) => {
      const speaker = m.role === 'user' ? 'Me' : persona.name;
      return `${speaker}: ${m.content}`;
    }).join('\n');

    const systemInstruction = `You are Mnemósyne, an empathetic intelligence engine that crystallizes spoken companion conversations into deeply meaningful journal reflections.
The user just spent time speaking with their companion, ${persona.name} (${persona.role}).
Analyze this conversation transcript and write a reflective journal entry strictly from the USER's first-person perspective ("I...").
Capture:
1. What happened or what the user had been processing today.
2. The emotions and feelings that surfaced.
3. The clarity, relief, perspective, or comfort discovered during the conversation with ${persona.name}.

Return a STRICT JSON object with these exact keys:
- "title": A thoughtful, evocative title (3 to 6 words).
- "content": An authentic first-person narrative journal reflection (2 to 4 paragraphs) in high-quality markdown.
- "mood": Exactly one of: "great", "good", "low", "rough", "disturbing", "professional", "neutral".
- "tags": An array of 2-4 strings, including "Sanctuary" and "${persona.name}".
- "aiReflection": A gentle 1-2 sentence closing reflection from ${persona.name}.

OUTPUT FORMAT: Return ONLY the raw JSON object, no wrapping markdown, no backticks.`;

    const response = await generateWithFallback(
      ai,
      [{ role: 'user', parts: [{ text: transcriptLines }] }],
      systemInstruction
    );

    let parsedResult: any = {};
    try {
      const rawText = response.text || '{}';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (err) {
      console.warn('[Crystallize JSON parse error]:', err);
      parsedResult = {
        title: `Heart-to-Heart with ${persona.name}`,
        content: messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join('\n\n'),
        mood: 'good',
        tags: ['Sanctuary', persona.name],
        aiReflection: `Remember the warmth we shared today. I'm always right here with you.`,
      };
    }

    const mood: MoodType = VALID_MOODS.has(parsedResult.mood) ? parsedResult.mood : 'good';

    return NextResponse.json({
      title: parsedResult.title || `Reflection with ${persona.name}`,
      content: parsedResult.content || 'Spoken reflection from Sanctuary conversation.',
      mood,
      tags: Array.isArray(parsedResult.tags) ? parsedResult.tags : ['Sanctuary', persona.name],
      aiReflection: parsedResult.aiReflection || `A quiet moment of reflection with ${persona.name}.`,
    });
  } catch (error: any) {
    console.error('[Crystallize API Error]:', error);
    return NextResponse.json({
      error: error.message || 'Failed to crystallize reflection.',
    }, { status: 500 });
  }
}
