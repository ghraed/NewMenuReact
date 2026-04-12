import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 xl:grid-cols-2">
          <GlassBoard>
            <h2 className="text-2xl font-semibold text-text">{t('demo.luxuryTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('demo.luxuryDescription')}</p>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <GlassPill active>Active</GlassPill>
                <GlassPill>{t('demo.default')}</GlassPill>
              </div>
              <GlassInput leftSlot={<span>🔎</span>} placeholder={t('demo.searchProjects')} />
              <div className="flex flex-wrap gap-2">
                <LiquidButton tone="primary">{t('demo.primary')}</LiquidButton>
                <LiquidButton tone="secondary">{t('demo.secondary')}</LiquidButton>
                <LiquidButton tone="tertiary">{t('demo.tertiary')}</LiquidButton>
              </div>
              <div className="flex gap-2">
                <GlassIconButton>+</GlassIconButton>
                <GlassIconButton>✓</GlassIconButton>
                <GlassIconButton>›</GlassIconButton>
              </div>
              <GlassCard>
                <p className="text-lg font-semibold text-text">{t('demo.sampleCard')}</p>
                <p className="text-sm text-muted">{t('demo.sampleCardDescription')}</p>
              </GlassCard>
            </div>
          </GlassBoard>

          <GlassBoard>
            <h2 className="text-2xl font-semibold text-text">{t('demo.spacingTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('demo.spacingDescription')}</p>

            <div className="mt-5 space-y-4">
              <GlassCard className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-gold2">{t('demo.starter')}</p>
                <p className="text-xl font-semibold text-text">{t('demo.exampleDishOne')}</p>
                <p className="text-sm text-muted">{t('demo.exampleDescriptionOne')}</p>
              </GlassCard>
              <GlassCard className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-sage">{t('demo.chefPick')}</p>
                <p className="text-xl font-semibold text-text">{t('demo.exampleDishTwo')}</p>
                <p className="text-sm text-muted">{t('demo.exampleDescriptionTwo')}</p>
              </GlassCard>
            </div>
          </GlassBoard>
        </div>
      </div>
    </LiquidBackground>
  );
};

export default LiquidGlassDemoPage;
