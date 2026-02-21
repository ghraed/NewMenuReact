import React from 'react';
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
  return (
    <LiquidBackground>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 xl:grid-cols-2">
          <GlassBoard>
            <h2 className="text-2xl font-semibold text-text">Luxury Dark + Gold</h2>
            <p className="mt-1 text-sm text-muted">Shared component preview for the full app theme.</p>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <GlassPill active>Active</GlassPill>
                <GlassPill>Default</GlassPill>
              </div>
              <GlassInput leftSlot={<span>🔎</span>} placeholder="Search projects..." />
              <div className="flex flex-wrap gap-2">
                <LiquidButton tone="primary">Primary</LiquidButton>
                <LiquidButton tone="secondary">Secondary</LiquidButton>
                <LiquidButton tone="tertiary">Tertiary</LiquidButton>
              </div>
              <div className="flex gap-2">
                <GlassIconButton>+</GlassIconButton>
                <GlassIconButton>✓</GlassIconButton>
                <GlassIconButton>›</GlassIconButton>
              </div>
              <GlassCard>
                <p className="text-lg font-semibold text-text">Sample Card</p>
                <p className="text-sm text-muted">Premium glass card with dark luxury treatment.</p>
              </GlassCard>
            </div>
          </GlassBoard>

          <GlassBoard>
            <h2 className="text-2xl font-semibold text-text">Spacing + Typography</h2>
            <p className="mt-1 text-sm text-muted">Mobile-first rhythm and readable contrast.</p>

            <div className="mt-5 space-y-4">
              <GlassCard className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-gold2">Starter</p>
                <p className="text-xl font-semibold text-text">Truffle Mushroom Pizza</p>
                <p className="text-sm text-muted">Balanced hierarchy and restrained accent usage.</p>
              </GlassCard>
              <GlassCard className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-sage">Chef pick</p>
                <p className="text-xl font-semibold text-text">Dragon Roll</p>
                <p className="text-sm text-muted">Only highlights use gold/sage solid accents.</p>
              </GlassCard>
            </div>
          </GlassBoard>
        </div>
      </div>
    </LiquidBackground>
  );
};

export default LiquidGlassDemoPage;
