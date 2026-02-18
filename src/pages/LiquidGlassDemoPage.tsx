import React, { useState } from 'react';
import {
  GlassBoard,
  GlassCard,
  GlassIconButton,
  GlassInput,
  GlassPill,
  LiquidBackground,
  LiquidButton,
} from '../components/ui/liquid-glass';

const LiquidGlassDemoPage: React.FC = () => {
  const [modern, setModern] = useState(document.body.classList.contains('modern'));

  const toggleModern = () => {
    document.body.classList.toggle('modern');
    setModern(document.body.classList.contains('modern'));
  };

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex justify-end">
          <GlassPill active={modern} onClick={toggleModern} className="text-xs">
            {modern ? 'NEW' : 'OLD'}
          </GlassPill>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <GlassBoard modern={false}>
            <h2 className="text-2xl font-bold text-lg-text">OLD</h2>
            <p className="mt-1 text-sm text-slate-700/70">Legacy softer glass style.</p>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <GlassPill modern={false} active>Primary</GlassPill>
                <GlassPill modern={false}>Secondary</GlassPill>
              </div>
              <GlassInput modern={false} leftSlot={<span>🔎</span>} placeholder="Search projects..." />
              <div className="flex gap-2">
                <LiquidButton modern={false} tone="primary">Primary</LiquidButton>
                <LiquidButton modern={false} tone="secondary">Secondary</LiquidButton>
                <LiquidButton modern={false} tone="tertiary">Tertiary</LiquidButton>
              </div>
              <div className="flex gap-2">
                <GlassIconButton modern={false}>+</GlassIconButton>
                <GlassIconButton modern={false}>✓</GlassIconButton>
                <GlassIconButton modern={false}>›</GlassIconButton>
              </div>
              <GlassCard modern={false}>
                <p className="text-lg font-semibold text-lg-text">Sample Card</p>
                <p className="text-sm text-slate-700/70">Old glass card surface preview.</p>
              </GlassCard>
            </div>
          </GlassBoard>

          <GlassBoard modern>
            <h2 className="text-2xl font-bold text-lg-text">NEW</h2>
            <p className="mt-1 text-sm text-slate-700/70">Liquid glass board with rim, lift, and noise.</p>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <GlassPill modern active>Primary</GlassPill>
                <GlassPill modern>Secondary</GlassPill>
              </div>
              <GlassInput modern leftSlot={<span>🔎</span>} placeholder="Search projects..." rightSlot={<span>⌘K</span>} />
              <div className="flex gap-2">
                <LiquidButton modern tone="primary">Primary</LiquidButton>
                <LiquidButton modern tone="secondary">Secondary</LiquidButton>
                <LiquidButton modern tone="tertiary">Tertiary</LiquidButton>
              </div>
              <div className="flex gap-2">
                <GlassIconButton modern>+</GlassIconButton>
                <GlassIconButton modern>✓</GlassIconButton>
                <GlassIconButton modern>›</GlassIconButton>
              </div>
              <GlassCard modern>
                <p className="text-lg font-semibold text-lg-text">Sample Card</p>
                <p className="text-sm text-slate-700/70">New glass card with internal gradient blobs.</p>
              </GlassCard>
            </div>
          </GlassBoard>
        </div>
      </div>
    </LiquidBackground>
  );
};

export default LiquidGlassDemoPage;
