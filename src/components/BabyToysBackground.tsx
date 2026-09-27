import React from 'react';

/**
 * Minimal, peaceful Baby Night Sky SVG motifs:
 * - Soft glowing Crescent Moon
 * - Subtle drifting Night Clouds
 * - Twinkling Stars & Sparkles
 * - Delicate pastel pink (#F3C9D9) & baby blue (#A9D6F5) keepsake accents
 */

export const CrescentMoonSvg: React.FC<{ className?: string }> = ({ className = 'w-24 h-24' }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#D9ECFF" stopOpacity="0.28" />
        <stop offset="65%" stopColor="#A9D6F5" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#071426" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="moonCrescentGrad" x1="25" y1="20" x2="90" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFDF9" />
        <stop offset="55%" stopColor="#E6F3FF" />
        <stop offset="100%" stopColor="#A9D6F5" />
      </linearGradient>
    </defs>
    {/* Subtle ambient moon glow */}
    <circle cx="60" cy="60" r="54" fill="url(#moonHalo)" />
    {/* Minimalist crescent moon */}
    <path
      d="M74 26C56.5 28.8 43 43.9 43 62.2C43 82.4 59.4 98.8 79.6 98.8C85.2 98.8 90.5 97.5 95.2 95.2C88.1 101.8 78.6 105.8 68.1 105.8C46.1 105.8 28.2 87.9 28.2 65.9C28.2 45.9 42.9 29.3 62.1 26.4C66.1 25.8 70.1 25.7 74 26Z"
      fill="url(#moonCrescentGrad)"
    />
    {/* Tiny companion star near the crescent tip */}
    <path
      d="M84 34L85.4 37.6L89 39L85.4 40.4L84 44L82.6 40.4L79 39L82.6 37.6L84 34Z"
      fill="#D9ECFF"
      opacity="0.8"
    />
  </svg>
);

export const SoftNightCloudSvg: React.FC<{ className?: string }> = ({ className = 'w-36 h-16' }) => (
  <svg viewBox="0 0 200 84" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M42 68H158C171.255 68 182 57.2548 182 44C182 31.652 172.677 21.4848 160.685 20.1469C155.146 8.8095 143.489 1 130 1C114.643 1 101.663 11.1422 97.435 25.0757C92.811 22.4819 87.479 21 81.8 21C65.458 21 52.094 33.7689 51.063 49.865C49.423 49.303 47.664 49 45.8 49C36.521 49 29 56.521 29 65.8C29 66.55 29.049 67.288 29.144 68H42Z"
      fill="currentColor"
    />
  </svg>
);

export const TinySparkleSvg: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M12 2L13.85 9.15L21 11L13.85 12.85L12 20L10.15 12.85L3 11L10.15 9.15L12 2Z"
      fill="currentColor"
    />
  </svg>
);

export const TinyHeartSvg: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M12 20.25C12 20.25 4.5 15.2 4.5 9.35C4.5 6.95 6.4 5 8.75 5C10.18 5 11.45 5.72 12 6.82C12.55 5.72 13.82 5 15.25 5C17.6 5 19.5 6.95 19.5 9.35C19.5 15.2 12 20.25 12 20.25Z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Keepsake Moon & Stars Emblem (used in empty states)
 */
export const TeddyBearToy: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <CrescentMoonSvg className={className} />
);

/**
 * Hero Night Sky Overlay:
 * - Soft glowing crescent moon behind/beside the hero content
 * - 3 subtle drifting night clouds
 * - Staggered twinkling stars (opacity 0.25 - 0.75)
 * - 2 delicate pastel baby-pink (#F3C9D9) hearts
 */
export const HeroBabyToysOverlay: React.FC = () => {
  return (
    <div
      className="hero-anim-sky absolute inset-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Soft radial night-sky illumination */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[540px] sm:w-[760px] h-[340px] rounded-full blur-3xl opacity-35"
        style={{
          background:
            'radial-gradient(circle, rgba(111,168,220,0.28) 0%, rgba(16,38,66,0.08) 65%, transparent 100%)',
        }}
      />

      {/* Elegant Crescent Moon (Top Right-ish of Hero, never blocking text) */}
      <div className="absolute top-4 right-4 sm:top-7 sm:right-12 lg:right-24 animate-moon-float opacity-85">
        <CrescentMoonSvg className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32" />
      </div>

      {/* Subtle Cloud 1 (Left upper horizon) */}
      <div className="absolute top-14 left-2 sm:left-10 lg:left-20 animate-cloud-drift text-[#163358]/55 dark:text-[#163358]/55">
        <SoftNightCloudSvg className="w-28 h-12 sm:w-40 sm:h-18" />
      </div>

      {/* Subtle Cloud 2 (Right lower horizon) */}
      <div className="absolute bottom-8 right-3 sm:right-14 lg:right-28 animate-cloud-drift-reverse text-[#153052]/50">
        <SoftNightCloudSvg className="w-24 h-10 sm:w-36 sm:h-16" />
      </div>

      {/* Subtle Cloud 3 (Desktop soft mid-left cloud) */}
      <div className="hidden md:block absolute bottom-14 left-24 animate-cloud-drift text-[#132C4C]/45">
        <SoftNightCloudSvg className="w-32 h-14" />
      </div>

      {/* Staggered Twinkling Stars */}
      <div
        className="absolute top-10 left-[14%] w-1.5 h-1.5 rounded-full bg-[#D9ECFF] animate-night-twinkle"
        style={{ animationDelay: '0.2s' }}
      />
      <div
        className="absolute top-24 left-[26%] w-1 h-1 rounded-full bg-[#A9D6F5] animate-night-twinkle"
        style={{ animationDelay: '1.9s' }}
      />
      <div
        className="absolute top-16 right-[28%] w-1.5 h-1.5 rounded-full bg-[#D9ECFF] animate-night-twinkle"
        style={{ animationDelay: '3.1s' }}
      />
      <div
        className="hidden sm:block absolute bottom-20 left-[18%] w-1.5 h-1.5 rounded-full bg-[#A9D6F5] animate-night-twinkle"
        style={{ animationDelay: '2.4s' }}
      />
      <div
        className="hidden sm:block absolute bottom-24 right-[20%] w-1 h-1 rounded-full bg-[#D9ECFF] animate-night-twinkle"
        style={{ animationDelay: '4.2s' }}
      />

      {/* Delicate Sparkles */}
      <div
        className="absolute top-12 left-[20%] text-[#A9D6F5] animate-night-sparkle"
        style={{ animationDelay: '0.8s' }}
      >
        <TinySparkleSvg className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      </div>
      <div
        className="absolute bottom-16 right-[16%] text-[#D9ECFF] animate-night-sparkle"
        style={{ animationDelay: '2.7s' }}
      >
        <TinySparkleSvg className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
      </div>

      {/* Two subtle pastel baby-pink (#F3C9D9) hearts */}
      <div
        className="hidden sm:block absolute top-28 left-[12%] text-[#F3C9D9] animate-heart-float"
        style={{ animationDelay: '1.2s' }}
      >
        <TinyHeartSvg className="w-3 h-3" />
      </div>
      <div
        className="hidden sm:block absolute bottom-20 right-[12%] text-[#F3C9D9] animate-heart-float"
        style={{ animationDelay: '3.6s' }}
      >
        <TinyHeartSvg className="w-2.5 h-2.5" />
      </div>
    </div>
  );
};

/**
 * Calm, unobtrusive page-wide night-sky starfield background.
 * Keeps photos and videos as the clear focal point.
 */
export const PageBabyMotifBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Subtle top-to-bottom night sky depth gradient */}
      <div
        className="
          absolute inset-0 opacity-90
          bg-[radial-gradient(ellipse_at_top,_rgba(16,38,66,0.55)_0%,_transparent_70%)]
        "
      />

      {/* Quiet ambient stars along outer margins */}
      <div
        className="absolute top-[18%] left-[6%] w-1 h-1 rounded-full bg-[#A9D6F5] animate-night-twinkle"
        style={{ animationDelay: '0.5s' }}
      />
      <div
        className="absolute top-[46%] left-[4%] w-1.5 h-1.5 rounded-full bg-[#D9ECFF] animate-night-twinkle"
        style={{ animationDelay: '2.8s' }}
      />
      <div
        className="hidden sm:block absolute top-[74%] left-[7%] text-[#6FA8DC] animate-night-sparkle"
        style={{ animationDelay: '1.4s' }}
      >
        <TinySparkleSvg className="w-2.5 h-2.5" />
      </div>

      <div
        className="absolute top-[28%] right-[5%] w-1 h-1 rounded-full bg-[#D9ECFF] animate-night-twinkle"
        style={{ animationDelay: '1.7s' }}
      />
      <div
        className="hidden sm:block absolute top-[62%] right-[6%] w-1.5 h-1.5 rounded-full bg-[#A9D6F5] animate-night-twinkle"
        style={{ animationDelay: '3.9s' }}
      />
      <div
        className="hidden md:block absolute top-[82%] right-[8%] text-[#F3C9D9] animate-heart-float"
        style={{ animationDelay: '2.2s' }}
      >
        <TinyHeartSvg className="w-2.5 h-2.5" />
      </div>
    </div>
  );
};
