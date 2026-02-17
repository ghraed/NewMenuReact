import React, { useState } from 'react';
import {
  GlassChip,
  GlassInput,
  GlassSelect,
  GlassSurface,
  GlassToast,
  GlassToggle,
  LiquidBackground,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';

const chipValues = ['All', 'Featured', 'Popular', 'Vegan'];

const suggestions = [
  { id: 1, label: 'Truffle Mushroom Pizza', tone: 'from-lg-primary/35 to-white/30' },
  { id: 2, label: 'Strawberry Matcha Latte', tone: 'from-lg-secondary/35 to-white/30' },
  { id: 3, label: 'Mint Citrus Tart', tone: 'from-lg-tertiary/35 to-white/30' },
];

const LiquidGlassDemoPage: React.FC = () => {
  const [chip, setChip] = useState('All');
  const [enabled, setEnabled] = useState(true);
  const [category, setCategory] = useState('pizza');
  const { toast, showToast, dismiss } = useGlassToast();

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <GlassSurface className="p-8" iridescent>
          <h1 className="text-3xl font-bold tracking-tight text-lg-text">Liquid Glass UI Demo</h1>
          <p className="mt-2 text-sm text-lg-muted">
            Reusable components powered by shared Tailwind theme tokens.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <LiquidButton tone="primary" onClick={() => showToast('Successfully saved', 'primary')}>
                  Save Changes
                </LiquidButton>
                <LiquidButton tone="secondary" onClick={() => showToast('Successfully saved', 'secondary')}>
                  Publish Menu
                </LiquidButton>
              </div>

              <GlassInput
                placeholder="Search dishes"
                leftSlot={<span>🔎</span>}
                rightSlot={<span className="rounded-full bg-white/40 px-2 py-0.5 text-[10px]">Ctrl+K</span>}
              />

              <GlassInput
                placeholder="Email address"
                type="email"
                leftSlot={<span>✉️</span>}
                rightSlot={<span>Verified</span>}
              />

              <GlassSelect
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: 'pizza', label: 'Pizza' },
                  { value: 'dessert', label: 'Dessert' },
                  { value: 'drinks', label: 'Drinks' },
                ]}
              />

              <GlassToggle
                checked={enabled}
                onChange={setEnabled}
                label="Auto-publish new dishes"
                description="New dishes become visible to guests automatically"
              />
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {chipValues.map((value) => (
                  <GlassChip key={value} active={chip === value} onClick={() => setChip(value)}>
                    {value}
                  </GlassChip>
                ))}
              </div>

              <GlassSurface className="p-4" sheen={false}>
                <h2 className="text-sm font-semibold text-lg-text">Suggested Dishes</h2>
                <ul className="mt-3 space-y-2">
                  {suggestions.map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-2xl border border-white/50 bg-gradient-to-br ${item.tone} px-4 py-3 text-sm font-medium text-lg-text shadow-glass-soft`}
                    >
                      {item.label}
                    </li>
                  ))}
                </ul>
              </GlassSurface>

              <LiquidButton tone="tertiary" className="w-full" onClick={() => showToast('Successfully saved', 'tertiary')}>
                Trigger Success Toast
              </LiquidButton>
            </div>
          </div>
        </GlassSurface>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </LiquidBackground>
  );
};

export default LiquidGlassDemoPage;
