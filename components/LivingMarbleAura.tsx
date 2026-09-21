'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface LivingMarbleAuraProps {
  palette: {
    c1: [number, number, number];
    c2: [number, number, number];
    c3: [number, number, number];
  };
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
  mood?: string;
  audioLevel?: number; // 0.0 to 1.0
  className?: string;
}

const EMOTION_COLOR_MODS: Record<string, { c1: [number, number, number]; c2: [number, number, number]; c3: [number, number, number] }> = {
  warm: { c1: [255, 123, 84], c2: [255, 213, 107], c3: [255, 77, 109] },
  tender: { c1: [255, 154, 162], c2: [255, 183, 178], c3: [255, 107, 107] },
  thoughtful: { c1: [142, 68, 173], c2: [67, 97, 238], c3: [58, 12, 163] },
  pensive: { c1: [100, 116, 139], c2: [129, 140, 248], c3: [71, 85, 105] },
  playful: { c1: [255, 190, 11], c2: [6, 214, 160], c3: [251, 86, 7] },
  amused: { c1: [255, 183, 3], c2: [251, 133, 0], c3: [33, 158, 188] },
  curious: { c1: [76, 201, 240], c2: [114, 9, 183], c3: [247, 37, 133] },
  excited: { c1: [255, 0, 110], c2: [255, 190, 11], c3: [131, 56, 236] },
};

export const LivingMarbleAura: React.FC<LivingMarbleAuraProps> = ({
  palette,
  state = 'idle',
  mood = 'warm',
  audioLevel = 0.0,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animated values across frames
  const animRef = useRef({
    time: 0,
    currentC1: [...palette.c1] as [number, number, number],
    currentC2: [...palette.c2] as [number, number, number],
    currentC3: [...palette.c3] as [number, number, number],
    currentAudio: 0.0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform before scaling
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      animationId = requestAnimationFrame(render);
      const stateAnim = animRef.current;
      stateAnim.time += 0.022;

      // Target colors (blend persona palette with emotion overlay if available)
      const emotionMod = EMOTION_COLOR_MODS[mood.toLowerCase()];
      const targetC1 = emotionMod ? emotionMod.c1 : palette.c1;
      const targetC2 = emotionMod ? emotionMod.c2 : palette.c2;
      const targetC3 = emotionMod ? emotionMod.c3 : palette.c3;

      // Smooth color interpolation
      const lerpSpeed = 0.04;
      for (let i = 0; i < 3; i++) {
        stateAnim.currentC1[i] += (targetC1[i] - stateAnim.currentC1[i]) * lerpSpeed;
        stateAnim.currentC2[i] += (targetC2[i] - stateAnim.currentC2[i]) * lerpSpeed;
        stateAnim.currentC3[i] += (targetC3[i] - stateAnim.currentC3[i]) * lerpSpeed;
      }

      // Smooth audio level
      stateAnim.currentAudio += (audioLevel - stateAnim.currentAudio) * 0.2;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = Math.min(w, h) * 0.22;

      // State dynamic speeds
      let pulseSpeed = 1.0;
      let auraSpread = 1.0;
      if (state === 'listening') {
        pulseSpeed = 2.2;
        auraSpread = 1.25 + stateAnim.currentAudio * 0.8;
      } else if (state === 'thinking') {
        pulseSpeed = 3.5;
        auraSpread = 1.15;
      } else if (state === 'speaking') {
        pulseSpeed = 2.0;
        auraSpread = 1.2 + stateAnim.currentAudio * 0.9;
      }

      const pulse = Math.sin(stateAnim.time * pulseSpeed) * 0.08;
      const c1Str = `rgb(${Math.round(stateAnim.currentC1[0])}, ${Math.round(stateAnim.currentC1[1])}, ${Math.round(stateAnim.currentC1[2])})`;
      const c2Str = `rgb(${Math.round(stateAnim.currentC2[0])}, ${Math.round(stateAnim.currentC2[1])}, ${Math.round(stateAnim.currentC2[2])})`;
      const c3Str = `rgb(${Math.round(stateAnim.currentC3[0])}, ${Math.round(stateAnim.currentC3[1])}, ${Math.round(stateAnim.currentC3[2])})`;

      // 1. Concentric Breathing Aura Waves
      const waveCount = 3;
      for (let i = 0; i < waveCount; i++) {
        const wavePhase = stateAnim.time * 0.8 + (i * Math.PI * 2) / waveCount;
        const waveScale = 1.0 + (Math.sin(wavePhase) * 0.2 + 0.2) * auraSpread;
        const waveRadius = baseRadius * 1.8 * waveScale;
        const waveAlpha = Math.max(0, 0.2 - i * 0.05 + stateAnim.currentAudio * 0.15);

        const waveGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.6, cx, cy, waveRadius);
        waveGrad.addColorStop(0, `rgba(${Math.round(stateAnim.currentC1[0])}, ${Math.round(stateAnim.currentC1[1])}, ${Math.round(stateAnim.currentC1[2])}, ${waveAlpha})`);
        waveGrad.addColorStop(0.6, `rgba(${Math.round(stateAnim.currentC2[0])}, ${Math.round(stateAnim.currentC2[1])}, ${Math.round(stateAnim.currentC2[2])}, ${waveAlpha * 0.5})`);
        waveGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = waveGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Inner Radiant Core Aura
      const coreRadius = baseRadius * (1.0 + pulse + stateAnim.currentAudio * 0.4);
      const coreGrad = ctx.createRadialGradient(
        cx - coreRadius * 0.25,
        cy - coreRadius * 0.3,
        coreRadius * 0.1,
        cx,
        cy,
        coreRadius
      );
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.35, c2Str);
      coreGrad.addColorStop(0.75, c1Str);
      coreGrad.addColorStop(1, c3Str);

      ctx.save();
      ctx.shadowColor = c1Str;
      ctx.shadowBlur = 32 + stateAnim.currentAudio * 28;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Specular 3D Glass Highlights (Signature Mnemósyne Glass Marble finish)
      // Primary soft highlight
      const hlRadius = coreRadius * 0.45;
      const hlGrad = ctx.createRadialGradient(
        cx - coreRadius * 0.32,
        cy - coreRadius * 0.35,
        1,
        cx - coreRadius * 0.32,
        cy - coreRadius * 0.35,
        hlRadius
      );
      hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      hlGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
      hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.arc(cx - coreRadius * 0.32, cy - coreRadius * 0.35, hlRadius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle bottom rim rim-light
      const rimGrad = ctx.createRadialGradient(
        cx + coreRadius * 0.25,
        cy + coreRadius * 0.3,
        coreRadius * 0.6,
        cx + coreRadius * 0.25,
        cy + coreRadius * 0.3,
        coreRadius * 0.95
      );
      rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.35)');

      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [palette, state, mood, audioLevel]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full max-w-[320px] max-h-[320px] sm:max-w-[400px] sm:max-h-[400px]"
      />
    </div>
  );
};
