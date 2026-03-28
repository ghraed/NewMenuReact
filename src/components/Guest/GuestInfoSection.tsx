import React from 'react';
import FooterInfoCard from './FooterInfoCard';

interface GuestInfoSectionProps {
  restaurantName: string;
}

const GuestInfoSection: React.FC<GuestInfoSectionProps> = ({ restaurantName }) => {
  return (
    <section className="mt-12 space-y-5 pb-6 sm:mt-16">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">Guest Information</p>
        <h2 className="mt-3 font-serif text-3xl text-[var(--guest-text)] sm:text-4xl">Service notes for your table</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FooterInfoCard
          eyebrow="Dining Room"
          title={restaurantName}
          lines={[
            'Quiet luxury plating, refined pacing, and a detail-first presentation throughout the menu.',
            'Mobile rows stay horizontally scroll-safe when any label or line runs longer than the viewport.',
          ]}
        />
        <FooterInfoCard
          eyebrow="Pairing Notes"
          title="Guest Guidance"
          lines={[
            'Please share allergy or dietary requests before selecting a dish detail page.',
            'Ask the team for seasonal pairings, tasting order suggestions, and lighter alternatives.',
          ]}
        />
        <FooterInfoCard
          eyebrow="Viewing"
          title="Digital Experience"
          lines={[
            'Every published dish keeps its existing dedicated detail route and AR viewer behavior.',
            'Theme preference is stored locally so the menu remains consistent between pages.',
          ]}
        />
      </div>
    </section>
  );
};

export default GuestInfoSection;

