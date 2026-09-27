import React from 'react';

/**
 * High-quality, delightful SVG illustrations of baby toys and nursery accents.
 * Designed with soft pastel baby colors (#7DD3FC, #38BDF8, #FDE047, #FDBA74, #C4B5FD, #FBCFE8)
 * for Keion Arkin's baby boy album.
 */

export const TeddyBearToy: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Left Ear */}
    <circle cx="28" cy="28" r="14" fill="#F6D5A6" stroke="#D97706" strokeWidth="2.5" />
    <circle cx="28" cy="28" r="8" fill="#FDE68A" />
    {/* Right Ear */}
    <circle cx="72" cy="28" r="14" fill="#F6D5A6" stroke="#D97706" strokeWidth="2.5" />
    <circle cx="72" cy="28" r="8" fill="#FDE68A" />
    {/* Body */}
    <ellipse cx="50" cy="72" rx="26" ry="24" fill="#F6D5A6" stroke="#D97706" strokeWidth="2.5" />
    <ellipse cx="50" cy="72" rx="16" ry="15" fill="#FEF3C7" />
    {/* Feet / Paws */}
    <ellipse cx="28" cy="88" rx="11" ry="8" fill="#F6D5A6" stroke="#D97706" strokeWidth="2" />
    <circle cx="28" cy="88" r="5" fill="#BAE6FD" />
    <ellipse cx="72" cy="88" rx="11" ry="8" fill="#F6D5A6" stroke="#D97706" strokeWidth="2" />
    <circle cx="72" cy="88" r="5" fill="#BAE6FD" />
    {/* Head */}
    <circle cx="50" cy="46" r="26" fill="#F6D5A6" stroke="#D97706" strokeWidth="2.5" />
    {/* Eyes */}
    <circle cx="41" cy="42" r="3.2" fill="#1E293B" />
    <circle cx="42" cy="41" r="1" fill="#FFFFFF" />
    <circle cx="59" cy="42" r="3.2" fill="#1E293B" />
    <circle cx="60" cy="41" r="1" fill="#FFFFFF" />
    {/* Snout / Muzzle */}
    <ellipse cx="50" cy="52" rx="12" ry="9" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.5" />
    {/* Nose & Smile */}
    <path d="M46 49 Q50 51 54 49 Q50 54 46 49 Z" fill="#92400E" />
    <path d="M50 52 L50 56 M47 56 Q50 59 53 56" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
    {/* Rosy Cheeks */}
    <circle cx="34" cy="50" r="4" fill="#FCA5A5" opacity="0.6" />
    <circle cx="66" cy="50" r="4" fill="#FCA5A5" opacity="0.6" />
    {/* Cute Baby Bowtie */}
    <path d="M42 66 L50 70 L42 74 Z" fill="#38BDF8" />
    <path d="M58 66 L50 70 L58 74 Z" fill="#38BDF8" />
    <circle cx="50" cy="70" r="3" fill="#0284C7" />
  </svg>
);

export const RockingHorseToy: React.FC<{ className?: string }> = ({ className = 'w-20 h-20' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Rocker Base Curved Runner */}
    <path
      d="M10 82 Q50 96 90 82"
      stroke="#0284C7"
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
    {/* Rocker Posts */}
    <line x1="32" y1="68" x2="26" y2="86" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="68" y1="68" x2="74" y2="86" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" />
    {/* Horse Body */}
    <ellipse cx="50" cy="62" rx="20" ry="11" fill="#BAE6FD" stroke="#0284C7" strokeWidth="2.5" />
    {/* Horse Neck & Head */}
    <path
      d="M58 62 L66 42 Q68 34 76 34 Q82 35 80 42 L72 52 L66 62 Z"
      fill="#BAE6FD"
      stroke="#0284C7"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Horse Ear */}
    <polygon points="72,32 75,24 78,32" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
    {/* Horse Mane */}
    <path
      d="M65 37 Q61 39 63 43 Q59 45 61 49 Q57 51 59 55"
      stroke="#F59E0B"
      strokeWidth="3.5"
      strokeLinecap="round"
      fill="none"
    />
    {/* Eye */}
    <circle cx="75" cy="38" r="1.8" fill="#1E293B" />
    {/* Cute Saddle */}
    <path d="M43 55 Q50 60 57 55 L55 64 Q50 66 45 64 Z" fill="#F43F5E" />
    <circle cx="50" cy="61" r="2" fill="#FDE047" />
    {/* Tail */}
    <path d="M30 60 Q20 62 24 70" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </svg>
);

export const BabyBlocksToy: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Block A (Bottom Left) */}
    <g transform="translate(10, 48)">
      <rect x="0" y="0" width="38" height="38" rx="6" fill="#60A5FA" stroke="#2563EB" strokeWidth="2" />
      <rect x="4" y="4" width="30" height="30" rx="4" fill="#93C5FD" opacity="0.6" />
      <text x="19" y="27" fontSize="22" fontWeight="bold" fontFamily="sans-serif" fill="#FFFFFF" textAnchor="middle">
        A
      </text>
    </g>
    {/* Block B (Bottom Right) */}
    <g transform="translate(52, 48)">
      <rect x="0" y="0" width="38" height="38" rx="6" fill="#F472B6" stroke="#DB2777" strokeWidth="2" />
      <rect x="4" y="4" width="30" height="30" rx="4" fill="#FBCFE8" opacity="0.6" />
      <text x="19" y="27" fontSize="22" fontWeight="bold" fontFamily="sans-serif" fill="#FFFFFF" textAnchor="middle">
        B
      </text>
    </g>
    {/* Block C (Top Center) */}
    <g transform="translate(31, 10)">
      <rect x="0" y="0" width="38" height="38" rx="6" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
      <rect x="4" y="4" width="30" height="30" rx="4" fill="#FDE68A" opacity="0.6" />
      <text x="19" y="27" fontSize="22" fontWeight="bold" fontFamily="sans-serif" fill="#FFFFFF" textAnchor="middle">
        C
      </text>
    </g>
  </svg>
);

export const BabyRattleToy: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Handle Stick */}
    <rect x="46" y="45" width="8" height="38" rx="4" fill="#FDE68A" stroke="#D97706" strokeWidth="2" />
    {/* Bottom Ring */}
    <circle cx="50" cy="85" r="9" fill="none" stroke="#38BDF8" strokeWidth="5" />
    <circle cx="50" cy="85" r="3" fill="#F472B6" />
    {/* Decorative Bow */}
    <path d="M42 46 Q50 50 58 46 Q50 42 42 46 Z" fill="#F43F5E" />
    {/* Rattle Ball Outer Ring */}
    <circle cx="50" cy="28" r="22" fill="#E0F2FE" stroke="#0284C7" strokeWidth="3" />
    {/* Inner Colorful Beads */}
    <circle cx="44" cy="24" r="5" fill="#F472B6" />
    <circle cx="56" cy="22" r="5" fill="#38BDF8" />
    <circle cx="50" cy="32" r="5.5" fill="#FBBF24" />
    {/* Shiny Reflection */}
    <path d="M38 18 Q46 12 56 14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

export const RubberDuckyToy: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Water ripples */}
    <path d="M14 82 Q30 86 50 82 Q70 86 86 82" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
    {/* Body */}
    <ellipse cx="48" cy="62" rx="28" ry="18" fill="#FACC15" stroke="#CA8A04" strokeWidth="2.5" />
    {/* Tail Feathers Upward */}
    <path d="M22 62 Q16 52 24 46 Q28 54 32 58 Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="2" />
    {/* Wing */}
    <ellipse cx="46" cy="64" rx="12" ry="8" fill="#FDE047" stroke="#CA8A04" strokeWidth="1.5" />
    {/* Head */}
    <circle cx="68" cy="42" r="16" fill="#FACC15" stroke="#CA8A04" strokeWidth="2.5" />
    {/* Eye */}
    <circle cx="73" cy="38" r="2.8" fill="#1E293B" />
    <circle cx="74" cy="37" r="1" fill="#FFFFFF" />
    {/* Beak */}
    <path d="M82 42 Q94 44 84 49 Q80 48 81 44 Z" fill="#FB923C" stroke="#EA580C" strokeWidth="1.5" />
    {/* Rosy Cheek */}
    <circle cx="68" cy="46" r="3.5" fill="#FCA5A5" opacity="0.6" />
  </svg>
);

export const BabyBottleToy: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Silicone Nipple */}
    <path d="M42 22 Q50 10 58 22 Z" fill="#FDE68A" stroke="#D97706" strokeWidth="1.8" />
    {/* Screw Ring Collar */}
    <rect x="36" y="22" width="28" height="8" rx="3" fill="#38BDF8" stroke="#0284C7" strokeWidth="2" />
    {/* Bottle Body */}
    <rect x="34" y="30" width="32" height="52" rx="6" fill="#F0F9FF" stroke="#0284C7" strokeWidth="2.5" />
    {/* Milk level */}
    <rect x="36" y="46" width="28" height="34" rx="4" fill="#FFFFFF" opacity="0.9" />
    {/* Measurement lines */}
    <line x1="40" y1="52" x2="48" y2="52" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
    <line x1="40" y1="60" x2="52" y2="60" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
    <line x1="40" y1="68" x2="48" y2="68" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
    {/* Heart accent on bottle */}
    <path d="M53 72 Q56 70 59 72 Q62 75 56 80 Q50 75 53 72 Z" fill="#38BDF8" />
  </svg>
);

export const PacifierToy: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Teat */}
    <path d="M42 36 Q50 20 58 36 Z" fill="#FDE68A" stroke="#D97706" strokeWidth="2" />
    {/* Shield curved plate */}
    <ellipse cx="50" cy="46" rx="26" ry="14" fill="#38BDF8" stroke="#0284C7" strokeWidth="2.5" />
    {/* Ventilation Holes */}
    <circle cx="36" cy="46" r="3.5" fill="#FFFFFF" />
    <circle cx="64" cy="46" r="3.5" fill="#FFFFFF" />
    {/* Knob Button */}
    <circle cx="50" cy="52" r="8" fill="#BAE6FD" stroke="#0284C7" strokeWidth="2" />
    {/* Handle Ring */}
    <path
      d="M38 56 Q50 76 62 56"
      stroke="#0284C7"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const BabyCloudToy: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Puffy Cloud */}
    <path
      d="M26 62 Q16 62 16 52 Q16 42 26 40 Q28 26 42 26 Q54 26 58 34 Q64 30 72 32 Q82 34 82 46 Q90 48 90 56 Q90 62 80 62 Z"
      fill="#FFFFFF"
      stroke="#BAE6FD"
      strokeWidth="2.5"
    />
    {/* Sweet Sleeping Eyes */}
    <path d="M42 46 Q46 50 50 46" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M58 46 Q62 50 66 46" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* Rosy Cheeks */}
    <circle cx="38" cy="48" r="3" fill="#FCA5A5" opacity="0.7" />
    <circle cx="70" cy="48" r="3" fill="#FCA5A5" opacity="0.7" />
    {/* Little Smile */}
    <path d="M52 51 Q54 54 56 51" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
);

export const BabyBalloonsToy: React.FC<{ className?: string }> = ({ className = 'w-16 h-20' }) => (
  <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Balloon Strings */}
    <path d="M38 60 Q45 80 50 110" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M50 52 Q50 80 50 110" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M62 60 Q55 80 50 110" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* String Tie Bow */}
    <circle cx="50" cy="110" r="3" fill="#38BDF8" />
    {/* Balloon 1: Soft Mint/Green (Left) */}
    <g transform="translate(18, 18)">
      <ellipse cx="20" cy="24" rx="14" ry="18" fill="#6EE7B7" stroke="#059669" strokeWidth="1.5" />
      <polygon points="18,41 22,41 20,44" fill="#059669" />
      <path d="M14 14 Q18 10 22 12" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
    </g>
    {/* Balloon 3: Pastel Yellow/Cream (Right) */}
    <g transform="translate(48, 18)">
      <ellipse cx="20" cy="24" rx="14" ry="18" fill="#FDE047" stroke="#D97706" strokeWidth="1.5" />
      <polygon points="18,41 22,41 20,44" fill="#D97706" />
      <path d="M14 14 Q18 10 22 12" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
    </g>
    {/* Balloon 2: Sky Blue (Center Foreground) */}
    <g transform="translate(33, 4)">
      <ellipse cx="17" cy="26" rx="17" ry="22" fill="#38BDF8" stroke="#0284C7" strokeWidth="2" />
      <polygon points="14,47 20,47 17,50" fill="#0284C7" />
      <path d="M11 15 Q17 9 22 12" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.8" />
    </g>
  </svg>
);

export const BabyStarCluster: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Big Star */}
    <path
      d="M50 10 L58 35 L85 35 L63 51 L71 76 L50 60 L29 76 L37 51 L15 35 L42 35 Z"
      fill="#FBBF24"
      stroke="#D97706"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <circle cx="50" cy="46" r="3" fill="#FFFFFF" opacity="0.8" />
  </svg>
);

/**
 * Ambient floating baby toys background for Hero section.
 * Positioned on desktop and tablet to gently frame the baby name, quote, and stats.
 */
export const HeroBabyToysOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
      {/* Top Left: Floating Balloons */}
      <div className="absolute -top-2 left-3 sm:left-8 lg:left-16 animate-baby-float opacity-80 hover:opacity-100 transition-opacity">
        <BabyBalloonsToy className="w-16 h-20 sm:w-20 sm:h-26 drop-shadow-xs" />
      </div>

      {/* Mid Left: Cute Teddy Bear */}
      <div className="absolute top-28 left-4 sm:left-10 lg:left-24 animate-baby-float-reverse opacity-85 hover:opacity-100 transition-opacity">
        <TeddyBearToy className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-xs" />
      </div>

      {/* Bottom Left: ABC Toy Blocks */}
      <div className="absolute bottom-4 left-6 sm:left-14 lg:left-28 animate-baby-rock opacity-85 hover:opacity-100 transition-opacity">
        <BabyBlocksToy className="w-14 h-14 sm:w-18 sm:h-18 drop-shadow-xs" />
      </div>

      {/* Top Right: Sleeping Cloud with Moon/Star */}
      <div className="absolute top-2 right-4 sm:right-10 lg:right-20 animate-baby-float-slow opacity-85 hover:opacity-100 transition-opacity">
        <BabyCloudToy className="w-18 h-18 sm:w-24 sm:h-24 drop-shadow-xs" />
      </div>

      {/* Mid Right: Rocking Horse */}
      <div className="absolute top-32 right-4 sm:right-10 lg:right-24 animate-baby-rock opacity-85 hover:opacity-100 transition-opacity">
        <RockingHorseToy className="w-16 h-16 sm:w-22 sm:h-22 drop-shadow-xs" />
      </div>

      {/* Bottom Right: Baby Rattle & Duck */}
      <div className="absolute bottom-5 right-6 sm:right-14 lg:right-32 flex items-center gap-2 animate-baby-float opacity-85 hover:opacity-100 transition-opacity">
        <BabyRattleToy className="w-12 h-12 sm:w-16 sm:h-16 drop-shadow-xs" />
        <RubberDuckyToy className="w-10 h-10 sm:w-14 sm:h-14 hidden sm:block drop-shadow-xs" />
      </div>

      {/* Twinkling ambient baby stars */}
      <div className="absolute top-14 left-1/4 animate-baby-twinkle opacity-40">
        <BabyStarCluster className="w-5 h-5 sm:w-7 sm:h-7" />
      </div>
      <div className="absolute top-20 right-1/4 animate-baby-twinkle opacity-50" style={{ animationDelay: '1.5s' }}>
        <BabyStarCluster className="w-4 h-4 sm:w-6 sm:h-6" />
      </div>
      <div className="absolute bottom-16 left-1/3 animate-baby-twinkle opacity-40" style={{ animationDelay: '2.5s' }}>
        <BabyStarCluster className="w-4 h-4" />
      </div>
    </div>
  );
};

/**
 * Ambient watermarks floating subtly down page margins on desktop screens.
 */
export const PageBabyMotifBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none opacity-25" aria-hidden="true">
      {/* Left Margin Scattered Toys */}
      <div className="absolute top-1/3 -left-3 animate-baby-float-slow">
        <PacifierToy className="w-12 h-12" />
      </div>
      <div className="absolute top-2/3 -left-2 animate-baby-rock">
        <RubberDuckyToy className="w-14 h-14" />
      </div>

      {/* Right Margin Scattered Toys */}
      <div className="absolute top-1/2 -right-3 animate-baby-float">
        <BabyBottleToy className="w-12 h-12" />
      </div>
      <div className="absolute top-3/4 -right-2 animate-baby-float-reverse">
        <BabyBlocksToy className="w-12 h-12" />
      </div>
    </div>
  );
};
