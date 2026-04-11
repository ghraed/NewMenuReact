import React from 'react';
import { useTranslation } from 'react-i18next';
import FooterInfoCard from './FooterInfoCard';

interface GuestInfoSectionProps {
  restaurantName: string;
}

const GuestInfoSection: React.FC<GuestInfoSectionProps> = () => {
  const { t } = useTranslation();

  return (
    <section className="mt-12 space-y-5 pb-6 sm:mt-16">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('guestInfo.title')}</p>
        <h2 className="mt-3 font-serif text-3xl text-[var(--guest-text)] sm:text-4xl">{t('guestInfo.heading')}</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <FooterInfoCard
          eyebrow={t('guestInfo.pairingNotes')}
          title={t('guestInfo.guestGuidance')}
          lines={[
            t('guestInfo.allergyNote'),
            t('guestInfo.pairingNote'),
          ]}
        />
      </div>
    </section>
  );
};

export default GuestInfoSection;
