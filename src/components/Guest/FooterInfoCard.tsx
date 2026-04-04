import React from 'react';

interface FooterInfoCardProps {
  eyebrow: string;
  title: string;
  lines: string[];
}

const FooterInfoCard: React.FC<FooterInfoCardProps> = ({ eyebrow, title, lines }) => {
  return (
    <article
      className="rounded-[28px] border p-5 sm:p-6"
      style={{
        backgroundColor: 'var(--guest-panel)',
        borderColor: 'var(--guest-border)',
        boxShadow: 'var(--guest-shadow-soft)',
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{eyebrow}</p>
      <h3 className="mt-3 font-serif text-2xl text-[var(--guest-text)]">{title}</h3>

      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <div key={line} className="min-w-0">
            <p className="break-words text-sm leading-7 text-[var(--guest-muted)]">{line}</p>
          </div>
        ))}
      </div>
    </article>
  );
};

export default FooterInfoCard;
