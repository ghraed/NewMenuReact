import React from 'react';

interface NotFoundViewProps {
  title?: string;
  message?: string;
}

const NotFoundView: React.FC<NotFoundViewProps> = ({
  title = '404',
  message = 'The page you requested does not exist.',
}) => (
  <div className="relative min-h-screen overflow-hidden bg-[#070605] text-[#f4efe7]">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-[#c8a86b]/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-20 h-96 w-96 rounded-full bg-[#8a6a3f]/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(210,179,123,0.14),transparent_42%),linear-gradient(120deg,rgba(255,255,255,0.03),transparent_45%)]" />
      <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(90deg,transparent,transparent_45px,rgba(255,255,255,0.04)_46px)]" />
    </div>

    <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-2xl border border-[#d2b37b]/40 bg-[#0f0d0b]/70 p-12 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm">
        <p className="text-center text-xs uppercase tracking-[0.5em] text-[#c8a86b]">AR Menu Platform</p>
        <h1
          className="mt-6 text-center text-7xl font-semibold leading-none md:text-8xl"
          style={{ fontFamily: '"Bodoni MT", "Didot", "Times New Roman", serif' }}
        >
          {title}
        </h1>
        <p className="mt-8 text-center text-base tracking-[0.08em] text-[#ddd2c2] md:text-lg">{message}</p>
      </section>
    </div>
  </div>
);

export default NotFoundView;
